#!/usr/bin/env bash
# Pull the latest code, build, migrate and restart. Run as root: `jobfair-update`.
set -euo pipefail
APP_DIR=/opt/jobfair
BRANCH="${BRANCH:-main}"
run() { sudo -u jobfair -H bash -c "set -a; . /etc/jobfair.env; set +a; cd $APP_DIR && $*"; }

run "git fetch --quiet origin $BRANCH && git checkout --quiet $BRANCH && git reset --quiet --hard origin/$BRANCH"
run "COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --frozen-lockfile"
run "pnpm --filter @vwo/db migrate"
run "pnpm --filter @vwo/web build"
if systemctl list-unit-files | grep -q jobfair-web; then
  systemctl restart jobfair-web jobfair-realtime
fi
echo "jobfair updated to $(run 'git rev-parse --short HEAD')"
