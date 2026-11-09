#!/usr/bin/env bash
set -euo pipefail
trap 'echo "Deployment failed. Inspect the error before trying again; repeated SSH failures can trigger fail2ban." >&2' ERR

: "${DEPLOY_HOST:?Missing DEPLOY_HOST}"
: "${DEPLOY_USER:?Missing DEPLOY_USER}"
: "${DEPLOY_SSH_KEY:?Missing DEPLOY_SSH_KEY}"
: "${DEPLOY_KNOWN_HOSTS:?Missing DEPLOY_KNOWN_HOSTS}"
: "${RELEASE_SHA:?Missing RELEASE_SHA}"
port=${DEPLOY_PORT:-22}
source_dir=${1:-dist}
[[ "$RELEASE_SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid release SHA' >&2; exit 1; }
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || { echo 'Use a hostname or IPv4 address for DEPLOY_HOST' >&2; exit 1; }
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || { echo 'Invalid deployment user' >&2; exit 1; }
if [[ ! "$port" =~ ^[0-9]{1,5}$ ]] || ((10#$port < 1 || 10#$port > 65535)); then
  echo 'Invalid SSH port' >&2
  exit 1
fi
[[ -s "$source_dir/index.html" && -s "$source_dir/manifest.webmanifest" ]] || {
  echo 'Build must include index.html and manifest.webmanifest before production deployment.' >&2
  exit 1
}

umask 077
ssh_dir=$(mktemp -d)
trap 'rm -rf -- "$ssh_dir"' EXIT
# PowerShell-provided secrets may contain CRLF. Always terminate the key with LF.
printf '%s\n' "$DEPLOY_SSH_KEY" | tr -d '\r' > "$ssh_dir/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" | tr -d '\r' > "$ssh_dir/known_hosts"
chmod 600 "$ssh_dir/key" "$ssh_dir/known_hosts"
ssh_options=(-T -p "$port" -i "$ssh_dir/key" -o BatchMode=yes -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$ssh_dir/known_hosts"
  -o ConnectionAttempts=1 -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=2)
target="$DEPLOY_USER@$DEPLOY_HOST"

# Do not mutate the currently served directory when rerunning the same commit.
prepare_status=0
ssh "${ssh_options[@]}" "$target" bash -s -- "$RELEASE_SHA" <<'REMOTE' || prepare_status=$?
set -euo pipefail
cd /srv/qr-enesoglu-com
if [[ "$(readlink current || true)" == "releases/$1" ]]; then
  exit 10
fi
mkdir -p "releases/$1"
REMOTE
if [[ "$prepare_status" == 10 ]]; then
  echo 'This release is already current.'
  exit 0
elif [[ "$prepare_status" != 0 ]]; then
  echo 'SSH preparation failed; no retry was attempted.' >&2
  exit "$prepare_status"
fi

# rsync invokes exactly one SSH connection and never retries.
printf -v rsync_ssh '%q ' ssh "${ssh_options[@]}"
rsync -rlt --delete --chmod=D755,F644 --perms -e "$rsync_ssh" -- \
  "$source_dir/" "$target:/srv/qr-enesoglu-com/releases/$RELEASE_SHA/"
ssh "${ssh_options[@]}" "$target" bash -s -- "$RELEASE_SHA" <<'REMOTE'
set -euo pipefail
cd /srv/qr-enesoglu-com
[[ -s "releases/$1/index.html" && -s "releases/$1/manifest.webmanifest" ]]
chmod 755 "releases/$1"
touch "releases/$1"
# Recover a stale temporary symlink from an interrupted activation.
if [[ -L current.tmp ]]; then rm -- current.tmp; fi
ln -s "releases/$1" current.tmp
mv -T current.tmp current
mapfile -t releases < <(find releases -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -rn | cut -d ' ' -f 2-)
for ((i=5; i<${#releases[@]}; i++)); do
  release=${releases[i]}
  if [[ "$release" =~ ^[a-f0-9]{40}$ && "$release" != "$1" ]]; then
    rm -rf -- "releases/$release"
  fi
done
REMOTE
