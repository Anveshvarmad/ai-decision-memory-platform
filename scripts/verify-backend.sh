#!/usr/bin/env bash

set -u

echo
echo "========================================"
echo "1. Docker services"
echo "========================================"

docker compose ps

echo
echo "========================================"
echo "2. Backend Python import"
echo "========================================"

if docker compose exec -T backend python - <<'PY'
from app.main import app

print("BACKEND_IMPORT_OK")
print("Application:", app.title)
print("Registered routes:", len(app.routes))
PY
then
  echo "Backend application imports successfully."
else
  echo "BACKEND_IMPORT_FAILED"
fi

echo
echo "========================================"
echo "3. Database connection"
echo "========================================"

if docker compose exec -T backend python - <<'PY'
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
then
  echo "Database connection succeeded."
else
  echo "DATABASE_CONNECTION_FAILED"
fi

echo
echo "========================================"
echo "4. Registered API routes"
echo "========================================"

docker compose exec -T backend python - <<'PY'
from app.main import app

for route in sorted(
    app.routes,
    key=lambda item: item.path,
):
    methods = getattr(
        route,
        "methods",
        None,
    )

    if methods:
        print(
            ",".join(sorted(methods)),
            route.path,
        )
PY

echo
echo "========================================"
echo "5. HTTP endpoint checks"
echo "========================================"

check_endpoint() {
  URL="$1"

  STATUS=$(curl -sS \
    -o /tmp/decision-memory-response.txt \
    -w "%{http_code}" \
    "$URL" 2>/dev/null || true)

  echo "$STATUS  $URL"

  if [ "$STATUS" != "000" ]; then
    head -c 300 \
      /tmp/decision-memory-response.txt

    echo
  fi
}

check_endpoint \
  "http://localhost:8000/api/health"

check_endpoint \
  "http://localhost:8000/health"

check_endpoint \
  "http://localhost:8000/openapi.json"

check_endpoint \
  "http://localhost:8000/docs"

echo
echo "========================================"
echo "6. Recent backend logs"
echo "========================================"

docker compose logs backend --since=5m
