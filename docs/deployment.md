# Production deployment

GitHub Actions verifies main with the reusable CI workflow, builds static files, and transfers the artifact over SSH to a Debian 13 VPS. Host Caddy serves `/srv/qr-enesoglu-com/current`; activation replaces that relative symlink atomically. The five newest release directories are retained. There are no containers or application backend, and payload processing stays in the browser. No server address or private key belongs in this repository.

## Prerequisites

The owner needs an administrator SSH account on the server, GitHub repository administration, and Cloudflare DNS access. Caddy v2 must already run as a host systemd service. Allow inbound TCP 80 and 443 for automatic HTTPS, and the configured SSH port (normally 22). Production builds must contain a real `manifest.webmanifest`. The release script refuses to connect if it is missing.

Local commands below are **PowerShell**. Commands marked server run in **bash on the VPS**. Replace placeholders privately. The administrator account used for setup is distinct from the unprivileged deployment account.

## Generate the deployment key

Run locally from the repository:

```powershell
$DeployHost = 'YOUR_VPS_HOST'
$DeployPort = 22
$AdminUser = 'YOUR_ADMIN_USER'
$Repo = 'enesoglu/qr-enesoglu-com'
$KeyPath = Join-Path $HOME '.ssh/qr-deploy'
ssh-keygen -t ed25519 -f $KeyPath -C 'qr-production-deploy'
Get-Content "$KeyPath.pub"
```

Use an empty passphrase for this dedicated automated key. Keep the private key private; copy only the public key into the server command below. Never use your administrator key as the deployment key.

## Prepare the server

Connect locally:

```powershell
ssh -p $DeployPort "$AdminUser@$DeployHost"
```

Run on the **server** as the administrator:

```bash
sudo apt-get update
sudo apt-get install --yes rsync
sudo adduser --disabled-password --gecos '' deploy
sudo install -d -o deploy -g deploy -m 755 /srv/qr-enesoglu-com
sudo install -d -o deploy -g deploy -m 755 /srv/qr-enesoglu-com/releases
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
printf '%s\n' 'restrict ssh-ed25519 REPLACE_WITH_PUBLIC_KEY qr-production-deploy' | sudo tee -a /home/deploy/.ssh/authorized_keys > /dev/null
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo -l -U deploy
```

The account has no password and must have **no sudo permissions**. Inspect any local group or sudo policy if the last command reports grants. Its shell must remain bash-compatible because SSH executes non-interactive commands. `restrict` disables PTY, forwarding and agent access while permitting rsync and these commands; do not add a forced command or enable password authentication.

If SSH configuration uses `AllowUsers`, append `deploy` to that existing directive without removing existing users. Check `/etc/ssh/sshd_config` and its included files. Before reloading, run `sudo sshd -t`; keep the administrator connection open and then use `sudo systemctl reload ssh`. Do not weaken other SSH policy.

## DNS and Caddy

In Cloudflare, create an `A` record named `qr` pointing to the VPS IPv4 address. Start **DNS only** (grey cloud). Remove or correct any conflicting AAAA record. After Caddy issues its certificate, optional proxying requires **Full (strict)** SSL mode.

Upload the standalone site block from **local PowerShell**:

```powershell
scp -P $DeployPort deploy/Caddyfile.qr "${AdminUser}@${DeployHost}:Caddyfile.qr"
ssh -p $DeployPort "$AdminUser@$DeployHost"
```

On the **server**, first confirm there is no existing `qr.enesoglu.com` site block. Append only once, preserving all other sites and the existing global options:

```bash
sudo cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.backup.$(date +%Y%m%d%H%M%S)"
printf '\n' | sudo tee -a /etc/caddy/Caddyfile > /dev/null
cat "$HOME/Caddyfile.qr" | sudo tee -a /etc/caddy/Caddyfile > /dev/null
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Reload only after validation succeeds. On failure, restore the timestamped backup before retrying validation. The site returns an error until its first release is uploaded; existing sites continue using their own configuration.

The block provides HSTS for one year, frame denial, MIME protection, a restrictive permissions policy and CSP. The CSP permits local scripts/workers, data/blob images and inline styles used by React; it does not require inline scripts or external connections. Production preview was checked with the same headers for QR rendering, exports and lazy loading. Hashed `/assets/*` files receive immutable one-year caching; other responses, including index, service-worker entry files and the manifest, receive `no-cache`. SPA rewriting happens before cache matching so an HTML fallback does not get immutable asset caching. CI adapts the standalone configuration with official Caddy v2.11.9.

## Pin the host key and configure GitHub

Get the server host-key fingerprint through an independently trusted channel, such as your VPS console. On the **server**:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

In **local PowerShell**, collect the public host key and compare its fingerprint to the console value before trusting it. `ssh-keyscan` alone does not authenticate the server:

```powershell
$KnownHosts = Join-Path $env:TEMP 'qr-known-hosts'
ssh-keyscan -t ed25519 -p $DeployPort $DeployHost 2>$null | Set-Content -Encoding ascii $KnownHosts
ssh-keygen -lf $KnownHosts
```

Create a GitHub environment named `production` in repository Settings → Environments, restricted to deployments from `main`. Optional required reviewers are an owner choice. Add secrets to that environment using the GitHub CLI:

```powershell
gh auth status
gh secret set DEPLOY_HOST --repo $Repo --env production --body $DeployHost
gh secret set DEPLOY_PORT --repo $Repo --env production --body "$DeployPort"
gh secret set DEPLOY_USER --repo $Repo --env production --body 'deploy'
Get-Content -Raw $KeyPath | gh secret set DEPLOY_SSH_KEY --repo $Repo --env production
Get-Content -Raw $KnownHosts | gh secret set DEPLOY_KNOWN_HOSTS --repo $Repo --env production
Remove-Item -LiteralPath $KnownHosts
```

`DEPLOY_PORT` is optional and defaults to 22. The other four secrets are required. The guard prints a notice and skips transfer steps and smoke checks when any are missing; the deploy job itself finishes successfully. No SSH connection is attempted. CR characters are stripped from key files, a trailing LF is added, and file permissions are set to 600. Host-key checking is always strict.

## First release and routine operation

After the setup above is complete, run locally:

```powershell
gh workflow run deploy.yml --repo $Repo --ref main
gh run list --repo $Repo --workflow deploy.yml --limit 5
gh run watch RUN_ID --repo $Repo --exit-status
curl.exe --fail --show-error --head https://qr.enesoglu.com/
curl.exe --fail --show-error https://qr.enesoglu.com/manifest.webmanifest
```

On the **server**, after activation:

```bash
sudo -u caddy test -r /srv/qr-enesoglu-com/current/index.html
readlink /srv/qr-enesoglu-com/current
```

Every push to main repeats verification, build and deployment. Manual dispatches from other branches cannot deploy. Runs are serialized without cancellation. No Caddy reload is needed for a normal release. HTTP smoke checks retry transient failures and require HTTP 200, the expected title and a JSON manifest; they do not automatically roll back a failed release.

## Rollback

On the **server**, list retained releases and choose a known-good 40-character SHA. Rollback does not need sudo when signed in as `deploy`; an administrator can run the same commands using `sudo -u deploy bash`:

```bash
cd /srv/qr-enesoglu-com
ls -dt releases/*/
previous=REPLACE_WITH_RETAINED_SHA
test -s "releases/$previous/index.html" || exit 1
test -s "releases/$previous/manifest.webmanifest" || exit 1
if test -L current.tmp; then rm -- current.tmp; fi
ln -s "releases/$previous" current.tmp
mv -T current.tmp current
```

Check the site with `curl.exe` locally afterward. A later main deployment replaces the rollback; coordinate changes before triggering it. Browser-installed service workers can retain an earlier app until their update lifecycle completes.

## Troubleshooting

- **SSH failure:** stop and inspect the first error. fail2ban bans an IP for one hour after five failed attempts in ten minutes. Do not repeatedly re-run a failing deployment. The workflow never loops SSH or rsync retries. Check the port, `AllowUsers`, key restriction, account permissions and `sudo journalctl -u ssh` through your administrator connection.
- **Host-key mismatch:** verify the replacement key through the VPS console before updating `DEPLOY_KNOWN_HOSTS`; never disable checking.
- **Skipped transfer:** configure all four required secrets in `production`; check branch restrictions and environment approvals.
- **Missing manifest:** check PWA build output and rebuild. An HTML SPA fallback is not a valid manifest.
- **403/404 or blank app:** inspect the `current` symlink and Caddy readability, ensure ancestors have execute permission, and inspect `sudo journalctl -u caddy`. Releases use directory 755/file 644 permissions. Check the browser console for CSP violations before changing policy.
- **Certificate failure:** verify public DNS and ports 80/443; start DNS-only and use Full (strict) when proxying later. Caddy validation must pass before reload.
- **Interrupted upload:** current is unchanged until activation. After fixing the cause, rerun once; an already-current SHA is left untouched. Smoke failures occur after activation: inspect the live release and roll back explicitly when needed.
