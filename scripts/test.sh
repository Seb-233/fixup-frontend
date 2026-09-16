#!/usr/bin/env bash
set -e

echo "Running FixUp test suite and linter..."
npm run lint
npm run test -- --watch=false
echo "All tests and lint checks passed."
