#!/usr/bin/env bash
set -e

echo "Building and syncing FixUp with Capacitor Android..."
npm run build
npx cap sync android
echo "Capacitor Android sync completed successfully."
