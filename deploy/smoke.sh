#!/usr/bin/env bash
set -euo pipefail
base=${1:-https://qr.enesoglu.com}
temp_dir=$(mktemp -d)
trap 'rm -rf -- "$temp_dir"' EXIT
for path in / /manifest.webmanifest; do
  status=$(curl --silent --show-error --fail-with-body --retry 4 --retry-delay 5 \
    --retry-all-errors --connect-timeout 10 --max-time 30 \
    --output "$temp_dir/body" --write-out '%{http_code}' "$base$path")
  [[ "$status" == 200 ]] || { echo "Expected HTTP 200 for $path, got $status" >&2; exit 1; }
  if [[ "$path" == / ]]; then
    grep -Fq '<title>QR Generator — free, private QR code generator</title>' "$temp_dir/body"
  else
    # SPA fallback HTML must never count as a reachable manifest.
    python3 -c 'import json,sys; m=json.load(open(sys.argv[1])); assert isinstance(m,dict) and (m.get("name") or m.get("short_name"))' "$temp_dir/body"
  fi
done
