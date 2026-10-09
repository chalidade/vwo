# Deploying jobfair on DigitalOcean

One droplet runs everything: PostgreSQL, the Next.js web app (port 3000), the Socket.IO
realtime server (port 4001) and Caddy in front for HTTPS (`/socket.io/*` goes to realtime,
the rest to web). Secrets live in `/etc/jobfair.env` on the droplet, never in the repo.

| File | What it does |
| --- | --- |
| `setup.sh` | Sets up a fresh Ubuntu 24.04 droplet. Used as the droplet's user data. Re-runnable. |
| `update.sh` | Installed as `jobfair-update`: pull, install, migrate, build, restart. |
| `do.sh` | `create`, `status` and `resize` through the DigitalOcean API (`DIGITALOCEAN_TOKEN`). |

```sh
DOMAIN=jobfair.co.id deploy/do.sh create      # 2 GB droplet in Singapore
deploy/do.sh resize s-4vcpu-8gb               # before an event
deploy/do.sh resize s-1vcpu-2gb               # after it
```

Without `DOMAIN` the site is served over plain HTTP on the droplet's IP. With a domain, point
its A record at the droplet first; Caddy then fetches the certificate by itself.
Setup progress is in `/var/log/jobfair-setup.log`; backups are in `/var/backups/jobfair` (14 days).
