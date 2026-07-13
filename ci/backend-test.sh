#!/usr/bin/env sh

set -eu

echo "Running backend tests..."

pytest \
  -q \
  --disable-warnings \
  --maxfail=1 \
  --cov=app \
  --cov-report=term-missing \
  tests
