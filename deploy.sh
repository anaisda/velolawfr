#!/bin/bash
# VeloLaw — Full deploy script
# Run this once on your Hetzner server after cloning the repo
# Usage: bash deploy.sh

set -e
echo "========================================"
echo "  VeloLaw Full Deploy Script"
echo "========================================"

SERVER_IP=$(curl -s ifconfig.me)
REPO_DIR="/home/velolaw/app/velolaw"
FRONTEND_DIR="$REPO_DIR/frontend"
BACKEND_DIR="$REPO_DIR/backend"

echo ""
echo ">> Step 1: Installing Node.js dependencies (backend)..."
cd $BACKEND_DIR
npm install

echo ""
echo ">> Step 2: Installing frontend dependencies..."
cd $FRONTEND_DIR
npm install

echo ""
echo ">> Step 3: Building frontend..."
npm run build
echo "Frontend built successfully!"

echo ""
echo ">> Step 4: Setting up nginx..."
cat > /etc/nginx/sites-available/velolaw << EOF
server {
    listen 80;
    server_name $SERVER_IP;

    client_max_body_size 2G;
    proxy_read_timeout 3600;
    proxy_connect_timeout 3600;
    proxy_send_timeout 3600;

    # Serve React frontend
    root $FRONTEND_DIR/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API to Node.js backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Internal worker callback
    location /internal/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
EOF

ln -sf /etc/nginx/sites-available/velolaw /etc/nginx/sites-enabled/velolaw
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
echo "Nginx configured!"

echo ""
echo ">> Step 5: Starting backend with PM2..."
cd $BACKEND_DIR
pm2 delete velolaw 2>/dev/null || true
pm2 start server.js --name velolaw
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash

echo ""
echo "========================================"
echo "  DEPLOY COMPLETE!"
echo ""
echo "  Your platform is live at:"
echo "  http://$SERVER_IP"
echo ""
echo "  Admin panel:"
echo "  http://$SERVER_IP  (login with admin credentials)"
echo "========================================"
