#!/bin/bash
set -e
echo "========================================"
echo "  VeloLaw Full Deploy Script"
echo "========================================"

SERVER_IP=$(curl -s ifconfig.me)
REPO_DIR="/home/velolaw/app/velolaw/frontend/velolawfr"

echo ""
echo ">> Step 1: Installing frontend dependencies..."
cd $REPO_DIR
npm install

echo ""
echo ">> Step 2: Building frontend..."
npm run build
echo "Frontend built!"

echo ""
echo ">> Step 3: Installing backend dependencies..."
npm install --prefix $REPO_DIR

echo ""
echo ">> Step 4: Setting up nginx..."
cat > /etc/nginx/sites-available/velolaw << EOF
server {
    listen 80;
    server_name $SERVER_IP;
    client_max_body_size 2G;
    proxy_read_timeout 3600;

    root $REPO_DIR/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 3600;
    }

    location /internal/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
    }
}
EOF

ln -sf /etc/nginx/sites-available/velolaw /etc/nginx/sites-enabled/velolaw
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
echo "Nginx configured!"

echo ""
echo ">> Step 5: Restarting backend with PM2..."
cd $REPO_DIR
pm2 delete velolaw 2>/dev/null || true
pm2 start server.js --name velolaw
pm2 save

echo ""
echo "========================================"
echo "  DEPLOY COMPLETE!"
echo "  Live at: http://$SERVER_IP"
echo "========================================"
