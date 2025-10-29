#!/bin/bashNow add it to frontend devvit allow and run

echo "🌐 Setting up Cloudflare Tunnel after authorization..."

# Create the tunnel
echo "📝 Creating tunnel..."
cloudflared tunnel create dumdoors-backend

# Get the tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep dumdoors-backend | awk '{print $1}')
echo "🔑 Tunnel ID: $TUNNEL_ID"

# Create config file with the actual tunnel ID
cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /home/sksai/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: api.dumdoors.tech
    service: http://localhost:8080
  - service: http_status:404
EOF

echo "✅ Configuration created!"
echo "🌐 Now you need to:"
echo "1. Set up DNS record: cloudflared tunnel route dns dumdoors-backend api.dumdoors.tech"
echo "2. Run the tunnel: cloudflared tunnel run dumdoors-backend"
echo ""
echo "Or for a quick test without custom domain:"
echo "cloudflared tunnel --url http://localhost:8080"