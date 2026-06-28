#!/bin/bash
set -e

# 1. جيب الـ IP الحالي
IP=$(ip addr show | grep "inet " | grep -v "127.0.0.1" | grep -v "172\." | awk '{print $2}' | cut -d'/' -f1 | head -1)
echo "✅ IP الحالي: $IP"

# 2. عمل certificate جديد
cd ~/Downloads/nabgha
mkcert $IP localhost 127.0.0.1

# 3. تحديد اسم الـ certificate
CERT_FILE=$(ls -t ~/Downloads/nabgha/${IP}+*.pem | grep -v key | head -1)
KEY_FILE=$(ls -t ~/Downloads/nabgha/${IP}+*-key.pem | head -1)
echo "✅ Certificate: $CERT_FILE"

# 4. تحديث nginx
sudo sed -i "s|ssl_certificate .*|ssl_certificate $CERT_FILE;|" /etc/nginx/sites-available/nabgha
sudo sed -i "s|ssl_certificate_key .*|ssl_certificate_key $KEY_FILE;|" /etc/nginx/sites-available/nabgha

# 5. تحديث VITE_APP_URL
sed -i "s|VITE_APP_URL=.*|VITE_APP_URL=https://$IP|" ~/Downloads/nabgha/apps/web/.env

# 6. Build الفرونت
cd ~/Downloads/nabgha/apps/web
pnpm build
cp $(mkcert -CAROOT)/rootCA.pem dist/rootCA.pem

# 7. Restart nginx
sudo nginx -t && sudo systemctl restart nginx

echo ""
echo "🚀 تم التحديث بنجاح!"
echo "📱 افتح على الموبايل: https://$IP/rootCA.pem (ثبّت الشهادة)"
echo "🌐 الرابط: https://$IP"
