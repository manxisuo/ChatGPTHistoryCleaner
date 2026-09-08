#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname "$SCRIPT_DIR")
OUTPUT_PARENT=$(dirname "$PROJECT_DIR")

xcrun safari-web-extension-converter "$PROJECT_DIR" \
  --project-location "$OUTPUT_PARENT" \
  --app-name "ChatGPT Long Conversation Toolkit" \
  --bundle-identifier "local.chatgpt.longconversationtoolkit.safari" \
  --macos-only \
  --swift \
  --copy-resources \
  --no-open \
  --no-prompt \
  --force
