#!/usr/bin/env bash
# Manage the jobfair droplet through the DigitalOcean API. Needs DIGITALOCEAN_TOKEN, curl and jq.
#   deploy/do.sh create [size]   create the droplet; deploy/setup.sh runs as its user data
#   deploy/do.sh status          name, size, status and public IP
#   deploy/do.sh resize <size>   e.g. s-4vcpu-8gb before an event, s-1vcpu-2gb after
# Resizes keep the disk as is (CPU/RAM only), so the droplet can be made smaller again.
# The site is offline for about a minute during a resize.
set -euo pipefail
: "${DIGITALOCEAN_TOKEN:?set DIGITALOCEAN_TOKEN}"
NAME="${NAME:-jobfair}"
REGION="${REGION:-sgp1}"
API=https://api.digitalocean.com/v2
api() { curl -fsS -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" -H "Content-Type: application/json" "$@"; }
droplet() { api "$API/droplets?tag_name=$NAME" | jq -e '.droplets[0]'; }
wait_action() {
  local id=$1 a=$2
  until [ "$(api "$API/droplets/$id/actions/$a" | jq -r .action.status)" = completed ]; do sleep 5; done
}

case "${1:-}" in
  create)
    size="${2:-s-1vcpu-2gb}"
    if droplet >/dev/null 2>&1; then echo "droplet '$NAME' already exists"; exit 1; fi
    user_data=$(sed "s|^DOMAIN=\"\${DOMAIN:-}\"|DOMAIN=\"${DOMAIN:-}\"|" "$(dirname "$0")/setup.sh")
    keys=$(api "$API/account/keys" | jq '[.ssh_keys[].id]')
    jq -n --arg n "$NAME" --arg r "$REGION" --arg s "$size" --arg u "$user_data" --argjson k "$keys" \
      '{name:$n, region:$r, size:$s, image:"ubuntu-24-04-x64", ssh_keys:$k, user_data:$u, tags:[$n], monitoring:true, backups:false}' |
      api -X POST "$API/droplets" -d @- | jq -r '"created droplet \(.droplet.id) (\(.droplet.size_slug)); setup takes about 10 minutes"'
    ;;
  status)
    droplet | jq -r '"\(.name) \(.size_slug) \(.status) \(.networks.v4[] | select(.type=="public") | .ip_address)"'
    ;;
  resize)
    size="${2:?size, e.g. s-4vcpu-8gb}"
    id=$(droplet | jq -r .id)
    a=$(api -X POST "$API/droplets/$id/actions" -d '{"type":"power_off"}' | jq -r .action.id); wait_action "$id" "$a"
    a=$(api -X POST "$API/droplets/$id/actions" -d "{\"type\":\"resize\",\"size\":\"$size\",\"disk\":false}" | jq -r .action.id); wait_action "$id" "$a"
    a=$(api -X POST "$API/droplets/$id/actions" -d '{"type":"power_on"}' | jq -r .action.id); wait_action "$id" "$a"
    echo "resized to $size"
    ;;
  *) sed -n '2,8p' "$0"; exit 1 ;;
esac
