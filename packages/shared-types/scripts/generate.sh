#!/usr/bin/env bash
set -euo pipefail

SPEC_URL="${SPEC_URL:-http://localhost:8000/openapi.json}"
OUT="src/api.ts"

echo "Fetching $SPEC_URL → $OUT"
pnpm exec openapi-typescript "$SPEC_URL" -o "$OUT"
echo "Done."
