#!/usr/bin/env bash
# People 360 — export de banco + volumes (snapshot do ambiente atual)
# Uso: bash scripts/migrate-export.sh
# Saída: /tmp/people360-migracao-YYYYMMDD-HHMMSS.tar.gz
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DB_CONTAINER="${DB_CONTAINER:-gestaorh-db}"
DB_USER="${DB_USER:-gestaorh}"
DB_NAME="${DB_NAME:-gestaorh}"
STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="/tmp/people360-export-${STAMP}"
OUT="/tmp/people360-migracao-${STAMP}.tar.gz"

echo "==> People 360 export"
echo "    APP_DIR=${APP_DIR}"
echo "    WORK=${WORK}"
echo "    OUT=${OUT}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERRO: diretório não encontrado: $APP_DIR" >&2
  exit 1
fi
if [[ ! -f "$APP_DIR/$COMPOSE_FILE" && ! -f "$APP_DIR/docker-compose.yml" ]]; then
  echo "ERRO: docker-compose.yml não encontrado em $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"
mkdir -p "$WORK/files" "$WORK/meta"

# --- Metadados ---
{
  echo "exported_at=$(date -Iseconds)"
  echo "host=$(hostname)"
  echo "app_dir=${APP_DIR}"
  echo "git_head=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "git_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo none)"
  echo "compose_project=$(basename "$APP_DIR")"
} > "$WORK/meta/export.env"

docker compose -f "$COMPOSE_FILE" ps > "$WORK/meta/compose-ps.txt" 2>&1 || true
docker volume ls > "$WORK/meta/volumes.txt" 2>&1 || true

# --- Dump Postgres ---
echo "==> Dump do banco ($DB_CONTAINER / $DB_NAME)"
if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "ERRO: container $DB_CONTAINER não está rodando." >&2
  exit 1
fi
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
  > "$WORK/database.sql"
echo "    database.sql: $(wc -c < "$WORK/database.sql") bytes"

# --- Descobrir volumes de uploads/documentos ---
# Preferência: volumes do compose project (nome da pasta)
PROJECT="$(basename "$APP_DIR")"
# fallbacks comuns
CANDIDATES_UPLOADS=(
  "${PROJECT}_uploads_data"
  "gestaorh_uploads_data"
  "uploads_data"
)
CANDIDATES_DOCS=(
  "${PROJECT}_documentos_data"
  "gestaorh_documentos_data"
  "documentos_data"
)

resolve_volume() {
  local name
  for name in "$@"; do
    if docker volume inspect "$name" >/dev/null 2>&1; then
      echo "$name"
      return 0
    fi
  done
  return 1
}

VOL_UPLOADS="$(resolve_volume "${CANDIDATES_UPLOADS[@]}")" || {
  echo "ERRO: volume de uploads não encontrado. Rode: docker volume ls" >&2
  exit 1
}
VOL_DOCS="$(resolve_volume "${CANDIDATES_DOCS[@]}")" || {
  echo "ERRO: volume de documentos não encontrado. Rode: docker volume ls" >&2
  exit 1
}

echo "==> Volumes"
echo "    uploads:    $VOL_UPLOADS"
echo "    documentos: $VOL_DOCS"
echo "uploads_volume=${VOL_UPLOADS}" >> "$WORK/meta/export.env"
echo "documentos_volume=${VOL_DOCS}" >> "$WORK/meta/export.env"

echo "==> Copiando arquivos dos volumes"
docker run --rm \
  -v "${VOL_UPLOADS}:/from_up:ro" \
  -v "${VOL_DOCS}:/from_doc:ro" \
  -v "${WORK}/files:/to" \
  alpine:3.20 sh -c '
    set -e
    mkdir -p /to/uploads /to/documentos
    cp -a /from_up/. /to/uploads/ 2>/dev/null || true
    cp -a /from_doc/. /to/documentos/ 2>/dev/null || true
    echo "uploads files: $(find /to/uploads -type f | wc -l)"
    echo "documentos files: $(find /to/documentos -type f | wc -l)"
  '

# --- Compose / env de referência (sem assumir .env se só houver vars no yml) ---
cp -a "$COMPOSE_FILE" "$WORK/meta/docker-compose.yml" 2>/dev/null || true
if [[ -f .env ]]; then cp -a .env "$WORK/meta/dotenv.example-from-server"; fi
if [[ -f .env.local ]]; then cp -a .env.local "$WORK/meta/dotenv.local-from-server"; fi

# --- Empacota ---
echo "==> Empacotando $OUT"
tar -czf "$OUT" -C "$WORK" .
rm -rf "$WORK"

ls -lh "$OUT"
echo ""
echo "OK. Snapshot: $OUT"
echo "Import em outro host:"
echo "  bash scripts/migrate-import.sh $OUT"
