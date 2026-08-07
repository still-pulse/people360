#!/usr/bin/env bash
# People 360 — import de snapshot (banco + volumes)
# Uso: bash scripts/migrate-import.sh /caminho/people360-migracao-*.tar.gz
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DB_CONTAINER="${DB_CONTAINER:-gestaorh-db}"
APP_CONTAINER="${APP_CONTAINER:-gestaorh-app}"
DB_USER="${DB_USER:-gestaorh}"
DB_NAME="${DB_NAME:-gestaorh}"
ARCHIVE="${1:-}"

if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Uso: bash scripts/migrate-import.sh /caminho/people360-migracao-*.tar.gz" >&2
  echo "APP_DIR detectado: $APP_DIR" >&2
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERRO: $APP_DIR não existe. Clone o repo primeiro:" >&2
  echo "  git clone https://github.com/still-pulse/people360.git /opt/people360" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="/tmp/people360-import-${STAMP}"
mkdir -p "$WORK"

echo "==> People 360 import"
echo "    APP_DIR=${APP_DIR}"
echo "    ARCHIVE=${ARCHIVE}"
echo "    WORK=${WORK}"

tar -xzf "$ARCHIVE" -C "$WORK"

if [[ ! -f "$WORK/database.sql" ]]; then
  echo "ERRO: archive sem database.sql" >&2
  exit 1
fi

cd "$APP_DIR"

# --- Sobe stack se necessário ---
echo "==> Subindo stack (build se preciso)"
docker compose -f "$COMPOSE_FILE" up -d --build

echo "==> Aguardando Postgres ($DB_CONTAINER)"
for i in $(seq 1 60); do
  if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    echo "    Postgres ok"
    break
  fi
  if [[ $i -eq 60 ]]; then
    echo "ERRO: Postgres não ficou pronto a tempo" >&2
    exit 1
  fi
  sleep 2
done

# --- Restore DB ---
echo "==> Restaurando banco (drop schema public + restore)"
# Encerra conexões e recria schema limpo
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid();
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO gestaorh;
SQL

docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$WORK/database.sql"
echo "    restore SQL concluído"

# --- Volumes de arquivos ---
PROJECT="$(basename "$APP_DIR")"
resolve_or_create() {
  # lista volumes do compose e tenta achar por sufixo
  local suffix="$1"
  local found
  found="$(docker volume ls --format '{{.Name}}' | grep -E "_${suffix}$|^${suffix}$" | head -n1 || true)"
  if [[ -n "$found" ]]; then
    echo "$found"
    return 0
  fi
  # fallback nome projetado
  echo "${PROJECT}_${suffix}"
}

# Garante volumes criados pelo compose
docker compose -f "$COMPOSE_FILE" up -d

VOL_UPLOADS="$(resolve_or_create uploads_data)"
VOL_DOCS="$(resolve_or_create documentos_data)"

# Se volume ainda não existe, deixa o compose criar
if ! docker volume inspect "$VOL_UPLOADS" >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" up -d
  VOL_UPLOADS="$(docker volume ls --format '{{.Name}}' | grep uploads_data | head -n1)"
fi
if ! docker volume inspect "$VOL_DOCS" >/dev/null 2>&1; then
  VOL_DOCS="$(docker volume ls --format '{{.Name}}' | grep documentos_data | head -n1)"
fi

echo "==> Restaurando arquivos"
echo "    uploads -> $VOL_UPLOADS"
echo "    documentos -> $VOL_DOCS"

if [[ ! -d "$WORK/files/uploads" && ! -d "$WORK/files/documentos" ]]; then
  echo "AVISO: archive sem pasta files/ — pulando arquivos"
else
  docker run --rm \
    -v "${VOL_UPLOADS}:/to_up" \
    -v "${VOL_DOCS}:/to_doc" \
    -v "${WORK}/files:/from:ro" \
    alpine:3.20 sh -c '
      set -e
      if [ -d /from/uploads ]; then
        rm -rf /to_up/* /to_up/.[!.]* 2>/dev/null || true
        cp -a /from/uploads/. /to_up/
      fi
      if [ -d /from/documentos ]; then
        rm -rf /to_doc/* /to_doc/.[!.]* 2>/dev/null || true
        cp -a /from/documentos/. /to_doc/
      fi
      # permissões amigáveis ao user nextjs (uid 1001)
      chown -R 1001:1001 /to_up /to_doc 2>/dev/null || true
      echo "uploads files: $(find /to_up -type f 2>/dev/null | wc -l)"
      echo "documentos files: $(find /to_doc -type f 2>/dev/null | wc -l)"
    '
fi

echo "==> Reiniciando app"
docker compose -f "$COMPOSE_FILE" restart app || docker restart "$APP_CONTAINER" || true

echo "==> Checagens rápidas"
docker compose -f "$COMPOSE_FILE" ps || true
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT count(*) AS users FROM users;" 2>/dev/null || true

rm -rf "$WORK"

echo ""
echo "OK — People 360 importado em ${APP_DIR}"
echo "Próximos passos:"
echo "  1) Ajustar NEXTAUTH_URL / DNS / proxy se necessário"
echo "  2) docker logs ${APP_CONTAINER} -f --tail 100"
echo "  3) Testar login, logo, CV, documentos de candidato"
