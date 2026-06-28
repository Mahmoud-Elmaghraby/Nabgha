#!/bin/bash
echo "🚀 تشغيل نبغة..."
sudo systemctl start docker
docker compose -f ~/Downloads/nabgha/infra/docker/docker-compose.yml up -d
sleep 2
cd ~/Downloads/nabgha/apps/api
fuser -k 3001/tcp 2>/dev/null; sleep 1
nohup node dist/main.js > /tmp/nabgha-api.log 2>&1 &
sleep 3
tail -2 /tmp/nabgha-api.log
echo "✅ نبغة شغالة على https://localhost"
