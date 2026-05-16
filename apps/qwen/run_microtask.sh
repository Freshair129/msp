#!/usr/bin/env bash
# Usage: run_microtask.sh <prompt-file> <output-file>
# Pipes prompt-file to qwen, strips fence, writes to output-file.
set -euo pipefail
PROMPT="$1"
OUT="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cat "$PROMPT" \
  | python "$SCRIPT_DIR/qwen.py" --code --no-stream --temp 0.1 \
  | python "$SCRIPT_DIR/strip_fence.py" > "$OUT"
echo "--- $(basename "$OUT") ---"
cat "$OUT"
