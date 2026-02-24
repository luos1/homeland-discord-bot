#!/bin/bash
###############################################################################
# Homeland Discord Bot - One-Click Deployment Script
# 
# This script automates the entire deployment process:
# 1. Discord bot setup
# 2. Railway project creation
# 3. Environment variables configuration
# 4. Database setup
# 5. Deployment
# 6. Verification
# 
# Target: $2,000/month (200 premium subscribers @ $9.99)
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Banner
clear
echo -e "${GREEN}"
cat << "EOF"
 _   _                      _                 _ 
| | | | ___  _ __ ___   ___| | __ _ _ __   __| |
| |_| |/ _ \| '_ ` _ \ / _ \ |/ _` | '_ \ / _` |
|  _  | (_) | | | | | |  __/ | (_| | | | | (_| |
|_| |_|\___/|_| |_| |_|\___|_|\__,_|_| |_|\__,_|
                                                  
      Discord RPG Bot - Deployment Wizard
          Target: $2,000/month Revenue
EOF
echo -e "${NC}\n"

# Check prerequisites
print_header "Checking Prerequisites"

# Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    echo "Install from: https://nodejs.org/"
    exit 1
fi
print_success "Node.js $(node -v) installed"

# npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm $(npm -v) installed"

# Railway CLI
if ! command -v railway &> /dev/null; then
    print_warning "Railway CLI not found"
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
    print_success "Railway CLI installed"
else
    print_success "Railway CLI installed"
fi

# Git
if ! command -v git &> /dev/null; then
    print_error "Git is not installed"
    exit 1
fi
print_success "Git installed"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Not in Homeland project directory"
    echo "Run this script from the homeland-discord-bot directory"
    exit 1
fi
print_success "In project directory"

# Interactive setup
print_header "Step 1: Discord Bot Setup"

echo "Have you created a Discord bot on Discord Developer Portal?"
echo "  1. Go to: https://discord.com/developers/applications"
echo "  2. Click 'New Application'"
echo "  3. Go to 'Bot' tab → 'Add Bot'"
echo "  4. Enable 'Server Members Intent' and 'Message Content Intent'"
echo "  5. Copy the Bot Token and Client ID"
echo ""

read -p "Do you have a Discord Bot Token? (y/n): " has_token

if [ "$has_token" != "y" ]; then
    print_warning "Please create a Discord bot first:"
    echo "  https://discord.com/developers/applications"
    echo ""
    echo "After creating, run this script again."
    exit 0
fi

read -p "Enter Discord Bot Token: " DISCORD_TOKEN
read -p "Enter Discord Client ID: " DISCORD_CLIENT_ID

if [ -z "$DISCORD_TOKEN" ] || [ -z "$DISCORD_CLIENT_ID" ]; then
    print_error "Bot Token and Client ID are required"
    exit 1
fi

print_success "Discord credentials saved"

# Optional Stripe setup
print_header "Step 2: Payment Setup (Optional)"

echo "Do you want to enable premium subscriptions now?"
echo "  (You can add this later via Railway environment variables)"
echo ""

read -p "Configure Stripe now? (y/n): " setup_stripe

if [ "$setup_stripe" = "y" ]; then
    read -p "Enter Stripe Secret Key: " STRIPE_SECRET_KEY
    read -p "Enter Stripe Webhook Secret: " STRIPE_WEBHOOK_SECRET
    read -p "Enter Base URL (e.g., https://yourdomain.com): " BASE_URL
    print_success "Stripe credentials saved"
else
    print_info "Stripe setup skipped (can be configured later)"
    STRIPE_SECRET_KEY=""
    STRIPE_WEBHOOK_SECRET=""
    BASE_URL=""
fi

# Railway login
print_header "Step 3: Railway Setup"

echo "Logging into Railway..."
railway login

print_success "Logged into Railway"

# Create project
echo ""
echo "Creating Railway project..."

if railway init; then
    print_success "Railway project created"
else
    print_error "Failed to create Railway project"
    exit 1
fi

# Add PostgreSQL
print_header "Step 4: Database Setup"

echo "Adding PostgreSQL database..."
railway add --plugin postgresql

# Wait for database to be ready
echo "Waiting for database to provision..."
sleep 5

print_success "PostgreSQL database added"

# Set environment variables
print_header "Step 5: Environment Configuration"

echo "Setting environment variables..."

railway variables set DISCORD_TOKEN="$DISCORD_TOKEN"
railway variables set DISCORD_CLIENT_ID="$DISCORD_CLIENT_ID"
railway variables set NODE_ENV="production"

if [ -n "$STRIPE_SECRET_KEY" ]; then
    railway variables set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
    railway variables set STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET"
    railway variables set BASE_URL="$BASE_URL"
fi

print_success "Environment variables configured"

# Deploy
print_header "Step 6: Deployment"

echo "Deploying to Railway..."

# Ensure latest code is committed
git add -A
if git diff-index --quiet HEAD --; then
    print_info "No changes to commit"
else
    git commit -m "Deploy: Railway production setup"
    print_success "Changes committed"
fi

# Push to Railway
if railway up; then
    print_success "Deployed successfully!"
else
    print_error "Deployment failed"
    exit 1
fi

# Wait for deployment to complete
echo "Waiting for deployment to complete..."
sleep 10

# Get deployment URL
RAILWAY_URL=$(railway variables get DATABASE_URL | grep -o 'https://[^"]*' | head -1 || echo "")

# Generate invite link
print_header "Step 7: Bot Invite Link"

INVITE_URL="https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands"

echo "Bot Invite URL:"
echo -e "${GREEN}${INVITE_URL}${NC}"
echo ""
echo "Copy this URL and invite the bot to your test server."
echo ""

# Verify deployment
print_header "Step 8: Verification"

echo "Checking deployment status..."
railway status

# Show logs
echo ""
echo "Recent logs:"
railway logs --tail 20

# Final instructions
print_header "🎉 Deployment Complete!"

cat << EOF
${GREEN}Success! Homeland is now deployed on Railway.${NC}

📋 Next Steps:

1. Invite Bot to Server
   ${INVITE_URL}

2. Test Basic Commands
   - /create - Create a character
   - /profile - View profile
   - /hunt - Start hunting

3. Monitor Performance
   - Railway Dashboard: $(railway open)
   - Logs: railway logs

4. Launch Marketing
   cd marketing && ./launch.sh

5. Track Revenue
   Target: 200 subscribers × $9.99 = $1,998/month
   Current: 0 subscribers
   
   Monitor: discord.com/channels/YOUR_SERVER/1466630279732133988

🔗 Important Links:

- Railway Dashboard: https://railway.app/
- Discord Dev Portal: https://discord.com/developers/applications
- Top.gg (after launch): https://top.gg/bot/${DISCORD_CLIENT_ID}

💡 Tips:

- Commands take 1-5 minutes to register
- Monitor "railway logs" for errors
- Add Stripe webhooks: ${BASE_URL}/api/stripe/webhook
- Set up daily metrics: cd monitoring && node metrics-tracker.js discord

🚀 Ready to launch!

Run marketing automation:
  cd marketing && ./launch.sh

Track metrics:
  cd monitoring && node metrics-tracker.js

Good luck reaching $2,000/month! 🎮
EOF

echo ""
print_success "All done! Happy launching! 🎉"
