#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://localhost:3000}"

if ! command -v osascript >/dev/null 2>&1; then
  exec open-cli "$url"
fi

if osascript -e 'tell application "Google Chrome" to return running' >/dev/null 2>&1; then
  osascript <<EOF
tell application "Google Chrome"
  activate
  if (count of windows) is 0 then
    make new window
  end if
  set URL of active tab of front window to "$url"
end tell
EOF
  exit 0
fi

if osascript -e 'tell application "Safari" to return running' >/dev/null 2>&1; then
  osascript <<EOF
tell application "Safari"
  activate
  if (count of windows) is 0 then
    make new document with properties {URL:"$url"}
  else
    set URL of front document to "$url"
  end if
end tell
EOF
  exit 0
fi

exec open-cli "$url"
