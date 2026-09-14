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
  make new tab at end of tabs of front window with properties {URL:"$url"}
  set active tab index of front window to (count of tabs of front window)
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
    tell front window to set current tab to (make new tab with properties {URL:"$url"})
  end if
end tell
EOF
  exit 0
fi

exec open-cli "$url"
