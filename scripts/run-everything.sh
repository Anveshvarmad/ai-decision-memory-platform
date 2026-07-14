#!/usr/bin/env bash

set -uo pipefail

PROJECT_ROOT="$HOME/Desktop/ai-decision-memory-platform"

cd "$PROJECT_ROOT" || exit 1

echo
echo "========================================"
echo "1. Cleaning previous containers"
echo "========================================"

docker compose down --remove-orphans

echo
echo "========================================"
echo "2. Building frontend locally"
echo "========================================"

cd frontend || exit 1

rm -rf dist node_modules/.vite
rm -f tsconfig.app.tsbuildinfo
rm -f tsconfig.node.tsbuildinfo

if ! npm run build; then
  echo
  echo "FRONTEND BUILD FAILED"
  exit 1
fi

cd "$PROJECT_ROOT" || exit 1

echo
echo "========================================"
echo "3. Building all Docker services"
echo "========================================"

if ! docker compose build --no-cache; then
  echo
  echo "DOCKER BUILD FAILED"
  exit 1
fi

echo
echo "========================================"
echo "4. Starting all services"
echo "========================================"

if ! docker compose up -d; then
  echo
  echo "DOCKER START FAILED"
  exit 1
fi

echo
echo "========================================"
echo "5. Waiting for backend"
echo "========================================"

BACKEND_READY=false

for attempt in $(seq 1 60); do
  for endpoint in \
    "http://localhost:8000/api/health" \
    "http://localhost:8000/health" \
    "http://localhost:8000/openapi.json"
  do
    STATUS=$(curl -sS \
      -o /dev/null \
      -w "%{http_code}" \
      "$endpoint" 2>/dev/null || true)

    if [ "$STATUS" = "200" ]; then
      echo "Backend ready: $endpoint"
      BACKEND_READY=true
      break 2
    fi
  done

  printf "."
  sleep 2
done

echo

if [ "$BACKEND_READY" != "true" ]; then
  echo "Backend did not become ready."
  docker compose logs backend --tail=150
fi

echo
echo "========================================"
echo "6. Verifying backend import"
echo "========================================"

docker compose exec -T backend python - <<'PY'
from app.main import app

print("BACKEND_IMPORT_OK")
print("Application:", app.title)
print("Registered routes:", len(app.routes))
PY

echo
echo "========================================"
echo "7. Verifying database connection"
echo "========================================"

docker compose exec -T backend python - <<'PY'
from sqlalchemy import text
from app.db.session import SessionLocal

database = SessionLocal()

try:
    result = database.execute(
        text("SELECT 1")
    ).scalar()

    print("DATABASE_OK:", result)
finally:
    database.close()
PY

echo
echo "========================================"
echo "8. Waiting for frontend"
echo "========================================"

FRONTEND_READY=false

for attempt in $(seq 1 60); do
  STATUS=$(curl -sS \
    -o /dev/null \
    -w "%{http_code}" \
    http://localhost:5173/ \
    2>/dev/null || true)

  if [ "$STATUS" = "200" ]; then
    FRONTEND_READY=true
    echo "Frontend ready: http://localhost:5173/"
    break
  fi

  printf "."
  sleep 2
done

echo

if [ "$FRONTEND_READY" != "true" ]; then
  echo "Frontend did not become ready."
  docker compose logs frontend --tail=150
fi

echo
echo "========================================"
echo "9. Service status"
echo "========================================"

docker compose ps

echo
echo "========================================"
echo "10. Backend response"
echo "========================================"

for endpoint in \
  "http://localhost:8000/api/health" \
  "http://localhost:8000/health" \
  "http://localhost:8000/openapi.json"
do
  STATUS=$(curl -sS \
    -o /tmp/decision-memory-response.txt \
    -w "%{http_code}" \
    "$endpoint" 2>/dev/null || true)

  echo "$STATUS  $endpoint"

  if [ "$STATUS" = "200" ]; then
    head -c 300 /tmp/decision-memory-response.txt
    echo
    break
  fi
done

echo
echo "========================================"
echo "11. Frontend HTML and JavaScript"
echo "========================================"

curl -sS http://localhost:5173/ \
  | head -20

ASSET_PATH=$(curl -sS \
  http://localhost:5173/ \
  | grep -oE 'src="[^"]+\.js"' \
  | head -1 \
  | cut -d'"' -f2)

echo
echo "JavaScript asset: $ASSET_PATH"

if [ -n "$ASSET_PATH" ]; then
  curl -I \
    "http://localhost:5173$ASSET_PATH"
fi

echo
echo "========================================"
echo "12. Recent logs"
echo "========================================"

echo
echo "BACKEND:"
docker compose logs backend --tail=50

echo
echo "FRONTEND:"
docker compose logs frontend --tail=50

echo
echo "========================================"
echo "STARTUP COMPLETE"
echo "========================================"

echo "Frontend: http://localhost:5173/"
echo "App:      http://localhost:5173/app"
echo "Backend:  http://localhost:8000/docs"

if command -v open >/dev/null 2>&1; then
  open http://localhost:5173/
  open http://localhost:8000/docs
fi
