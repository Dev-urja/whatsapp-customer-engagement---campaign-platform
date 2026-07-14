#!/usr/bin/env bash
# Urja WhatsApp Platform — VPS deploy (Ubuntu/Debian)
# Run on the VPS as a user with docker access:
#   chmod +x deploy/vps-deploy.sh && ./deploy/vps-deploy.sh

set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"

echo "==> Checking Docker..."
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
  echo "Log out and back in, then re-run this script."
  exit 1
fi

if [ ! -f .env ]; then
  echo "==> Creating .env from deploy/env.production.example"
  cp deploy/env.production.example .env
  echo "Edit .env with your domain and secrets, then run this script again."
  exit 1
fi

if grep -qE "your-domain\.com|replace_with_" .env; then
  echo "Update PUBLIC_URL, APP_URL, JWT_SECRET, and PGPASSWORD in .env before deploying."
  exit 1
fi

echo "==> Building and starting containers..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo "==> Waiting for database..."
sleep 8

echo "==> Running database seed (safe to re-run)..."
docker compose -f "$COMPOSE_FILE" exec -T app node node_modules/tsx/dist/cli.mjs server/seed.ts

echo ""
echo "Deploy complete."
echo "  App (local on VPS): http://127.0.0.1:3001"
echo "  Health:             curl -s http://127.0.0.1:3001/api/health"
echo ""
echo "Next steps:"
echo "  1. DNS A record: wa.urjagroupofcompany.com → this VPS IP"
echo "  2. sudo apt install -y nginx certbot python3-certbot-nginx"
echo "  3. sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/urja-wa"
echo "  4. sudo ln -sf /etc/nginx/sites-available/urja-wa /etc/nginx/sites-enabled/"
echo "  5. sudo nginx -t && sudo systemctl reload nginx"
echo "  6. sudo certbot --nginx -d wa.urjagroupofcompany.com"
echo "  7. Login at https://wa.urjagroupofcompany.com — admin@urjagroup.com / Urja@2026!"
echo "  8. Settings → WhatsApp API: add Phone Number ID, WABA ID, Access Token"
echo "  9. Meta Developer Console → Webhook URL: https://wa.urjagroupofcompany.com/api/webhook"
