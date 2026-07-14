#!/usr/bin/env bash

set +e

ROOT="$HOME/Desktop/ai-decision-memory-platform"
REPORT="/tmp/decision-memory-debug.txt"

cd "$ROOT" || exit 1

exec > >(tee "$REPORT") 2>&1

echo "=================================================="
echo "DECISION MEMORY BLANK-PAGE DIAGNOSTICS"
echo "Generated: $(date)"
echo "=================================================="

echo
echo "========== 1. GIT STATUS =========="
git status --short

echo
echo "========== 2. DOCKER SERVICES =========="
docker compose ps

echo
echo "========== 3. BACKEND HEALTH =========="

for URL in \
  "http://localhost:8000/api/health" \
  "http://localhost:8000/health" \
  "http://localhost:8000/openapi.json"
do
  STATUS=$(curl -sS \
    -o /tmp/backend-response.txt \
    -w "%{http_code}" \
    "$URL" 2>/dev/null)

  echo "$STATUS $URL"

  if [ "$STATUS" = "200" ]; then
    head -c 300 /tmp/backend-response.txt
    echo
  fi
done

echo
echo "========== 4. BACKEND IMPORT =========="

docker compose exec -T backend python - <<'PY'
try:
    from app.main import app

    print("BACKEND_IMPORT_OK")
    print("Title:", app.title)
    print("Routes:", len(app.routes))
except Exception:
    import traceback
    traceback.print_exc()
PY

echo
echo "========== 5. DATABASE =========="

docker compose exec -T backend python - <<'PY'
try:
    from sqlalchemy import text
    from app.db.session import SessionLocal

    database = SessionLocal()

    try:
        value = database.execute(
            text("SELECT 1")
        ).scalar()

        print("DATABASE_OK:", value)
    finally:
        database.close()
except Exception:
    import traceback
    traceback.print_exc()
PY

echo
echo "========== 6. FRONTEND HTTP =========="

FRONTEND_STATUS=$(curl -sS \
  -o /tmp/frontend-index.html \
  -w "%{http_code}" \
  "http://localhost:5173/" \
  2>/dev/null)

echo "Frontend HTTP status: $FRONTEND_STATUS"

echo
echo "Frontend HTML:"
sed -n '1,60p' /tmp/frontend-index.html

ASSET_PATH=$(grep -oE \
  'src="[^"]+\.js"' \
  /tmp/frontend-index.html \
  | head -1 \
  | cut -d'"' -f2)

echo
echo "JavaScript asset: $ASSET_PATH"

if [ -n "$ASSET_PATH" ]; then
  ASSET_STATUS=$(curl -sS \
    -o /tmp/frontend-bundle.js \
    -w "%{http_code}" \
    "http://localhost:5173$ASSET_PATH" \
    2>/dev/null)

  echo "JavaScript asset status: $ASSET_STATUS"
  echo "JavaScript asset size: $(wc -c < /tmp/frontend-bundle.js)"
fi

echo
echo "========== 7. PACKAGE VERSIONS =========="

cd "$ROOT/frontend" || exit 1

npm ls \
  react \
  react-dom \
  react-router \
  react-router-dom \
  --depth=0

echo
echo "========== 8. TYPESCRIPT BUILD =========="

rm -rf dist node_modules/.vite
rm -f tsconfig.app.tsbuildinfo
rm -f tsconfig.node.tsbuildinfo

npm run build

BUILD_STATUS=$?

echo
echo "Frontend build exit code: $BUILD_STATUS"

cd "$ROOT" || exit 1

echo
echo "========== 9. APP.TSX =========="

sed -n '1,280p' frontend/src/App.tsx

echo
echo "========== 10. MAIN.TSX =========="

sed -n '1,180p' frontend/src/main.tsx

echo
echo "========== 11. APP LAYOUT =========="

sed -n '1,320p' \
  frontend/src/layouts/AppLayout.tsx

echo
echo "========== 12. ROUTER IMPORTS =========="

grep -RniE \
  'from "react-router"|from "react-router-dom"' \
  frontend/src \
  --include='*.ts' \
  --include='*.tsx'

echo
echo "========== 13. PROVIDER USAGE =========="

grep -RniE \
  'WorkspaceProcessingProvider|useWorkspaceProcessing|GlobalProcessingDock|AuthProvider|WorkspaceProvider' \
  frontend/src \
  --include='*.ts' \
  --include='*.tsx'

echo
echo "========== 14. FRONTEND LOGS =========="

docker compose logs frontend --tail=150

echo
echo "========== 15. BACKEND LOGS =========="

docker compose logs backend --tail=150

echo
echo "=================================================="
echo "REPORT SAVED TO: $REPORT"
echo "=================================================="
