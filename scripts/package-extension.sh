#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$ROOT_DIR/chrome-extension"
BUILD_DIR="$ROOT_DIR/release/chrome-extension"
ZIP_PATH="$ROOT_DIR/release/freepik-downloader-extension.zip"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
rm -f "$ZIP_PATH"

cp -R \
  "$EXT_DIR/manifest.json" \
  "$EXT_DIR/popup.html" \
  "$EXT_DIR/popup.css" \
  "$EXT_DIR/popup.js" \
  "$EXT_DIR/background.js" \
  "$EXT_DIR/content.css" \
  "$EXT_DIR/content.js" \
  "$EXT_DIR/icons" \
  "$BUILD_DIR"

cd "$BUILD_DIR"
zip -qr "$ZIP_PATH" .

echo "Created $ZIP_PATH"
