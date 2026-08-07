#!/usr/bin/env bash
# People 360 — backup diário → Google Drive (rclone)
# Política: envia o backup do dia e remove no Drive os de dias anteriores.
# Requer: rclone configurado (remote gdrive), pasta People360-Backups.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/people360}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/people360}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
RCLONE_PATH="${RCLONE_PATH:-People360-Backups}"
# 1 = só o dia de hoje no Drive (apaga ontem e mais antigos)
KEEP_REMOTE_DAYS="${KEEP_REMOTE_DAYS:-1}"
# se 1, remove o .tar.gz local após upload OK (mantém disco da VPS leve)
DELETE_LOCAL_AFTER_UPLOAD="${DELETE_LOCAL_AFTER_UPLOAD:-1}"
LOCK="/var/lock/people360-backup.lock"

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

log() { echo "[$(date -Iseconds)] $*"; }

# lock anti-overlap
exec 9>"$LOCK"
if ! flock -n 9; then
  log "Já existe backup em andamento — saindo."
  exit 0
fi

if ! command -v rclone >/dev/null 2>&1; then
  log "ERRO: rclone não instalado. Rode: apt install -y rclone"
  exit 1
fi

if ! rclone listremotes 2>/dev/null | grep -qx "${RCLONE_REMOTE}:"; then
  log "ERRO: remote rclone '${RCLONE_REMOTE}:' não configurado."
  log "Rode: rclone config"
  exit 1
fi

log "==> Início backup People 360 → ${RCLONE_REMOTE}:${RCLONE_PATH}"

# 1) backup local
bash "${APP_DIR}/scripts/backup-people360.sh"
# pega o mais recente
LOCAL_FILE="$(ls -1t "${BACKUP_ROOT}"/people360-*.tar.gz | head -n1)"
if [[ ! -f "$LOCAL_FILE" ]]; then
  log "ERRO: nenhum arquivo local gerado"
  exit 1
fi
BASENAME="$(basename "$LOCAL_FILE")"
DAY_PREFIX="people360-$(date +%Y%m%d)"

log "==> Upload ${BASENAME}"
rclone copy "$LOCAL_FILE" "${RCLONE_REMOTE}:${RCLONE_PATH}/" \
  --checksum \
  --transfers 4 \
  --checkers 8 \
  --drive-chunk-size 64M \
  --log-level INFO

if [[ -f "${LOCAL_FILE}.sha256" ]]; then
  rclone copy "${LOCAL_FILE}.sha256" "${RCLONE_REMOTE}:${RCLONE_PATH}/" --log-level INFO || true
fi

# confere que subiu
if ! rclone lsf "${RCLONE_REMOTE}:${RCLONE_PATH}/" | grep -qx "$BASENAME"; then
  log "ERRO: upload não encontrado no remoto após copy"
  exit 1
fi
log "    upload OK"

# 2) retenção no Drive: apaga arquivos com dia < (hoje - KEEP_REMOTE_DAYS + 1)
#    KEEP_REMOTE_DAYS=1 → só arquivos cujo nome contém a data de hoje
log "==> Retenção remota: KEEP_REMOTE_DAYS=${KEEP_REMOTE_DAYS}"
mapfile -t REMOTE_FILES < <(rclone lsf "${RCLONE_REMOTE}:${RCLONE_PATH}/" 2>/dev/null | grep -E '^people360-[0-9]{8}' || true)

CUTOFF="$(date -d "${KEEP_REMOTE_DAYS} days ago" +%Y%m%d 2>/dev/null || date -v-"${KEEP_REMOTE_DAYS}"d +%Y%m%d 2>/dev/null || true)"
# se date -d falhar, usa só "apaga tudo que não é de hoje" quando KEEP=1
TODAY="$(date +%Y%m%d)"

for rf in "${REMOTE_FILES[@]:-}"; do
  [[ -z "${rf:-}" ]] && continue
  # extrai YYYYMMDD do nome people360-YYYYMMDD-...
  if [[ "$rf" =~ people360-([0-9]{8}) ]]; then
    FDAY="${BASH_REMATCH[1]}"
  else
    continue
  fi

  should_delete=0
  if [[ "$KEEP_REMOTE_DAYS" -eq 1 ]]; then
    [[ "$FDAY" != "$TODAY" ]] && should_delete=1
  else
    # apaga se FDAY < cutoff (mais antigo que a janela)
    if [[ -n "${CUTOFF:-}" && "$FDAY" < "$CUTOFF" ]]; then
      # na verdade: manter dias >= (today - KEEP + 1)
      # cutoff = today - KEEP days → apagar FDAY <= cutoff? 
      # KEEP=2, today=07 → cutoff=05 → apagar dias < 06? 
      # Simples: apagar se FDAY < (today - KEEP + 1) ... 
      # today-KEEP+1 for KEEP=2: 06 → keep 06 and 07. delete FDAY < 06
      MIN_KEEP="$(date -d "$((KEEP_REMOTE_DAYS - 1)) days ago" +%Y%m%d 2>/dev/null || echo "$TODAY")"
      [[ "$FDAY" < "$MIN_KEEP" ]] && should_delete=1
    fi
  fi

  if [[ "$should_delete" -eq 1 ]]; then
    log "    rm remoto: $rf"
    rclone delete "${RCLONE_REMOTE}:${RCLONE_PATH}/${rf}" || true
    rclone delete "${RCLONE_REMOTE}:${RCLONE_PATH}/${rf}.sha256" 2>/dev/null || true
  fi
done

# limpa .sha256 órfãos antigos no remoto
mapfile -t REMOTE_SHA < <(rclone lsf "${RCLONE_REMOTE}:${RCLONE_PATH}/" 2>/dev/null | grep -E '^people360-.*\.sha256$' || true)
for rf in "${REMOTE_SHA[@]:-}"; do
  base="${rf%.sha256}"
  if ! rclone lsf "${RCLONE_REMOTE}:${RCLONE_PATH}/" 2>/dev/null | grep -qx "$base"; then
    log "    rm sha órfão: $rf"
    rclone delete "${RCLONE_REMOTE}:${RCLONE_PATH}/${rf}" || true
  fi
done

if [[ "$DELETE_LOCAL_AFTER_UPLOAD" == "1" ]]; then
  log "==> Removendo cópia local (economia de disco)"
  rm -f "$LOCAL_FILE" "${LOCAL_FILE}.sha256"
fi

log "==> Remotos restantes:"
rclone lsf -l "${RCLONE_REMOTE}:${RCLONE_PATH}/" 2>/dev/null || true
log "OK — backup concluído"
