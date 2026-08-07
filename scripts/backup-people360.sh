#!/usr/bin/env bash
# People 360 — backup local (Postgres + volumes)
# Uso: bash scripts/backup-people360.sh
# Saída: /var/backups/people360/people360-YYYYMMDD-HHMMSS.tar.gz
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/people360}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/people360}"
DB_CONTAINER="${DB_CONTAINER:-gestaorh-db}"
DB_USER="${DB_USER:-gestaorh}"
DB_NAME="${DB_NAME:-gestaorh}"
# Quantos backups LOCAIS manter (0 = apaga local após upload, se o caller quiser)
KEEP_LOCAL="${KEEP_LOCAL:-2}"

STAMP="$(date +%Y%m%d-%H%M%S)"
DAY="$(date +%Y%m%d)"
WORK="${BACKUP_ROOT}/.work-${STAMP}"
OUT="${BACKUP_ROOT}/people360-${STAMP}.tar.gz"

mkdir -p "$BACKUP_ROOT" "$WORK/meta" "$WORK/files"

echo "==> People 360 backup local"
echo "    APP_DIR=${APP_DIR}"
echo "    OUT=${OUT}"

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "ERRO: container $DB_CONTAINER não está rodando." >&2
  exit 1
fi

{
  echo "created_at=$(date -Iseconds)"
  echo "host=$(hostname)"
  echo "app_dir=${APP_DIR}"
  echo "day=${DAY}"
} > "$WORK/meta/backup.env"

# --- Postgres ---
echo "==> Dump Postgres"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
  > "$WORK/database.sql"
echo "    database.sql: $(wc -c < "$WORK/database.sql") bytes"

# --- Volumes (uploads + documentos) ---
PROJECT="$(basename "$APP_DIR")"
resolve_volume() {
  local suffix="$1"
  local found
  found="$(docker volume ls --format '{{.Name}}' | grep -E "_${suffix}$|^${suffix}$" | head -n1 || true)"
  if [[ -n "$found" ]]; then
    echo "$found"
    return 0
  fi
  # fallbacks
  for name in "${PROJECT}_${suffix}" "gestaorh_${suffix}" "people360_${suffix}"; do
    if docker volume inspect "$name" >/dev/null 2>&1; then
      echo "$name"
      return 0
    fi
  done
  return 1
}

VOL_UPLOADS="$(resolve_volume uploads_data)" || {
  echo "ERRO: volume uploads_data não encontrado" >&2
  exit 1
}
VOL_DOCS="$(resolve_volume documentos_data)" || {
  echo "ERRO: volume documentos_data não encontrado" >&2
  exit 1
}

echo "    uploads:    $VOL_UPLOADS"
echo "    documentos: $VOL_DOCS"
echo "uploads_volume=${VOL_UPLOADS}" >> "$WORK/meta/backup.env"
echo "documentos_volume=${VOL_DOCS}" >> "$WORK/meta/backup.env"

echo "==> Arquivos dos volumes"
docker run --rm \
  -v "${VOL_UPLOADS}:/from_up:ro" \
  -v "${VOL_DOCS}:/from_doc:ro" \
  -v "${WORK}/files:/to" \
  alpine:3.20 sh -c '
    set -e
    mkdir -p /to/uploads /to/documentos
    cp -a /from_up/. /to/uploads/ 2>/dev/null || true
    cp -a /from_doc/. /to/documentos/ 2>/dev/null || true
    echo "uploads: $(find /to/uploads -type f | wc -l) files"
    echo "documentos: $(find /to/documentos -type f | wc -l) files"
  '

# compose de referência (sem secrets extras)
if [[ -f "$APP_DIR/docker-compose.yml" ]]; then
  cp -a "$APP_DIR/docker-compose.yml" "$WORK/meta/docker-compose.yml" || true
fi

echo "==> Empacotando"
tar -czf "$OUT" -C "$WORK" .
rm -rf "$WORK"

# checksum
sha256sum "$OUT" > "${OUT}.sha256"
ls -lh "$OUT"

# limpa backups locais antigos
if [[ "$KEEP_LOCAL" =~ ^[0-9]+$ ]] && [[ "$KEEP_LOCAL" -gt 0 ]]; then
  echo "==> Retenção local: mantém ${KEEP_LOCAL} mais recentes"
  mapfile -t OLD < <(ls -1t "${BACKUP_ROOT}"/people360-*.tar.gz 2>/dev/null | tail -n +"$((KEEP_LOCAL + 1))" || true)
  for f in "${OLD[@]:-}"; do
    [[ -z "${f:-}" ]] && continue
    echo "    rm local $f"
    rm -f "$f" "${f}.sha256"
  done
fi

echo "OK_LOCAL=${OUT}"
