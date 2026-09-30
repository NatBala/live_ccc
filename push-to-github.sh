#!/usr/bin/env bash
# Creates the GitHub repo and pushes this code.
# Usage: ./push-to-github.sh [repo-name] [private|public] [owner-or-org]
set -euo pipefail
NAME="${1:-live_ccc}"; VIS="${2:-private}"; OWNER="${3:-}"
TARGET="$NAME"; [ -n "$OWNER" ] && TARGET="$OWNER/$NAME"
if command -v gh >/dev/null 2>&1; then
  gh auth status >/dev/null 2>&1 || gh auth login
  gh repo create "$TARGET" --"$VIS" --source . --remote origin --push \
    --description "Connected Client Experience: live multi-agent demo on a shared AI foundation"
  echo "Done: $(gh repo view "$TARGET" --json url -q .url)"
else
  echo "GitHub CLI (gh) not found. Either install it (https://cli.github.com) and rerun, or:"
  echo "  1. Create an empty repo named $NAME on github.com (no README)."
  echo "  2. git remote add origin https://github.com/<owner>/$NAME.git"
  echo "  3. git push -u origin main"
fi
