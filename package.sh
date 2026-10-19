#!/usr/bin/env bash
# Builds dist/sky-stack.zip with index.html at the ZIP root (Playables requirement).
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist
zip -r -q dist/sky-stack.zip index.html style.css src
echo "Built dist/sky-stack.zip ($(du -h dist/sky-stack.zip | cut -f1))"
unzip -l dist/sky-stack.zip
