#!/usr/bin/env bash
# One-shot setup for a fresh Ubuntu 24.04 droplet: Postgres, Node, the web app and the
# realtime server behind Caddy (automatic HTTPS). Paste it into "User data" when creating
# the droplet, or run it as root: `curl -fsSL <raw url> | DOMAIN=jobfair.example bash`.
# Safe to run again; it skips what is already there. Progress goes to /var/log/jobfair-setup.log.
set -euo pipefail
exec > >(tee -a /var/log/jobfair-setup.log) 2>&1

# ---- Settings: edit these before pasting into User data. ----
DOMAIN="${DOMAIN:-}"              # e.g. jobfair.co.id, pointed at this droplet. Empty = plain HTTP on the IP.
BRANCH="${BRANCH:-main}"
REPO="${REPO:-https://github.com/chalidade/vwo.git}"
RESEND_API_KEY="${RESEND_API_KEY:-}"  # email; empty = emails only go to the log
MAIL_FROM="${MAIL_FROM:-jobfair <noreply@jobfair.example>}"
# -------------------------------------------------------------

APP_USER=jobfair
APP_DIR=/opt/jobfair
ENV_FILE=/etc/jobfair.env
export DEBIAN_FRONTEND=noninteractive

echo "== $(date -Is) jobfair setup starting"

# Swap, so building the Next.js app fits on a 1-2 GB droplet.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

apt-get update -y
apt-get install -y ca-certificates curl gnupg git ufw fail2ban unattended-upgrades postgresql postgresql-contrib debian-keyring debian-archive-keyring apt-transport-https

# Node 22 and pnpm.
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable

# Caddy, for HTTPS certificates and the reverse proxy.
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

# Firewall: SSH and web only. Postgres listens on localhost only.
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

# SSH by key only, fail2ban against password guessing, and security updates installed daily.
cat > /etc/ssh/sshd_config.d/10-jobfair.conf <<'SSHD'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
SSHD
systemctl reload ssh || systemctl reload sshd || true
systemctl enable --now fail2ban
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$APP_USER" --shell /usr/sbin/nologin "$APP_USER"

# Database and the env file. The password is generated once and kept in $ENV_FILE.
if [ ! -f "$ENV_FILE" ]; then
  DB_PASS=$(openssl rand -hex 24)
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jobfair') THEN CREATE ROLE jobfair LOGIN PASSWORD '$DB_PASS';
  ELSE ALTER ROLE jobfair PASSWORD '$DB_PASS'; END IF;
END \$\$;
SQL
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='jobfair'" | grep -q 1 || sudo -u postgres createdb -O jobfair jobfair
  if [ -n "$DOMAIN" ]; then ORIGIN="https://$DOMAIN"; else ORIGIN="http://$(curl -fsS http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || hostname -I | awk '{print $1}')"; fi
  cat > "$ENV_FILE" <<ENV
NODE_ENV=production
DATABASE_URL=postgres://jobfair:$DB_PASS@127.0.0.1:5432/jobfair
APP_URL=$ORIGIN
WEB_ORIGIN=$ORIGIN
NEXT_PUBLIC_REALTIME_URL=$ORIGIN
REALTIME_PORT=4001
RESEND_API_KEY=$RESEND_API_KEY
MAIL_FROM="$MAIL_FROM"
ENV
  chmod 640 "$ENV_FILE" && chgrp "$APP_USER" "$ENV_FILE"
fi

# Code, build and migrations.
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
install -m 755 "$APP_DIR/deploy/update.sh" /usr/local/bin/jobfair-update
BRANCH="$BRANCH" /usr/local/bin/jobfair-update

# Services.
cat > /etc/systemd/system/jobfair-web.service <<UNIT
[Unit]
Description=jobfair web (Next.js)
After=network.target postgresql.service
[Service]
User=$APP_USER
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true
WorkingDirectory=$APP_DIR/apps/web
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/env pnpm start
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/jobfair-realtime.service <<UNIT
[Unit]
Description=jobfair realtime (Socket.IO)
After=network.target postgresql.service
[Service]
User=$APP_USER
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true
WorkingDirectory=$APP_DIR/apps/realtime
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/env pnpm start
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT

SITE="${DOMAIN:-:80}"
cat > /etc/caddy/Caddyfile <<CADDY
$SITE {
	encode zstd gzip
	handle /socket.io/* {
		reverse_proxy 127.0.0.1:4001
	}
	handle {
		reverse_proxy 127.0.0.1:3000
	}
}
CADDY

# Nightly database backup, keeping 14 days.
mkdir -p /var/backups/jobfair && chown postgres /var/backups/jobfair
cat > /etc/cron.d/jobfair-backup <<'CRON'
30 2 * * * postgres pg_dump -Fc jobfair > /var/backups/jobfair/jobfair-$(date +\%F).dump && find /var/backups/jobfair -name '*.dump' -mtime +14 -delete
CRON

systemctl daemon-reload
systemctl enable --now jobfair-web jobfair-realtime
systemctl restart jobfair-web jobfair-realtime caddy

echo "== $(date -Is) jobfair setup done: $(grep ^APP_URL "$ENV_FILE" | cut -d= -f2)"
