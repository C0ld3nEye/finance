#!/bin/bash
# ============================================================
# Script d'installation PocketBase sur VM Linux ARM64 (aarch64)
# À exécuter sur la VM LifeSync : bash setup-pocketbase.sh
# ============================================================

set -e

PB_VERSION="0.28.2"
PB_DIR="$HOME/pocketbase"
PB_DATA="$PB_DIR/pb_data"

echo "==> Création du dossier PocketBase..."
mkdir -p "$PB_DIR"
cd "$PB_DIR"

echo "==> Téléchargement PocketBase v${PB_VERSION} (linux_arm64)..."
wget -q --show-progress \
  "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_arm64.zip" \
  -O pocketbase.zip

echo "==> Extraction..."
unzip -o pocketbase.zip
rm pocketbase.zip
chmod +x pocketbase

echo "==> Création du service systemd..."
sudo tee /etc/systemd/system/pocketbase.service > /dev/null <<EOF
[Unit]
Description=PocketBase Finance App
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PB_DIR
ExecStart=$PB_DIR/pocketbase serve --http=0.0.0.0:8090
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "==> Activation du service..."
sudo systemctl daemon-reload
sudo systemctl enable pocketbase
sudo systemctl start pocketbase

echo ""
echo "✅ PocketBase installé et démarré !"
echo "   Interface admin : http://192.168.1.110:8090/_/"
echo "   Crée ton compte admin lors du premier accès."
echo ""
echo "⚠️  N'oublie pas d'ouvrir le port 8090 sur ta Freebox"
echo "   (Freebox OS → Réseau → Redirections de ports → 8090 → 192.168.1.110)"
