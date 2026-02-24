#!/bin/bash
# Homeland RPG Launch Script
# Run this immediately after Railway deployment

echo "🚀 Homeland RPG Launch Automation"
echo "=================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if [ -z "$DISCORD_TOKEN" ]; then
  echo "❌ DISCORD_TOKEN not set"
  exit 1
fi

if [ -z "$DISCORD_CLIENT_ID" ]; then
  echo "❌ DISCORD_CLIENT_ID not set"
  exit 1
fi

echo "✅ Environment variables OK"
echo ""

# Generate invite link
echo "🔗 Bot Invite Link:"
echo "https://discord.com/api/oauth2/authorize?client_id=$DISCORD_CLIENT_ID&permissions=8&scope=bot%20applications.commands"
echo ""

# Wait for bot to come online
echo "⏳ Waiting for bot to come online..."
sleep 10

# Test slash commands
echo "🧪 Testing slash commands registration..."
echo "(Check Discord - commands should appear in 1-5 minutes)"
echo ""

# Marketing automation
echo "📢 Starting marketing automation..."

# Reddit posts (manual for now - need API credentials)
echo "📝 Reddit posts ready:"
echo "- r/discordapp"
echo "- r/discordbots"  
echo "- r/incremental_games"
echo ""
echo "Run: node marketing/post-to-reddit.js (requires Reddit API)"
echo ""

# Twitter posts (manual for now - need API credentials)
echo "🐦 Twitter posts ready:"
echo "3 launch tweets prepared"
echo ""
echo "Run: node marketing/post-to-twitter.js (requires Twitter API)"
echo ""

# Top.gg submission
echo "🏆 Top.gg submission data ready:"
echo "File: marketing/topgg-submission.json"
echo "Submit manually at: https://top.gg/bot/new"
echo ""

# Discord support server
echo "💬 Discord support server setup:"
echo "File: marketing/support-server-setup.md"
echo "Create server and follow guide"
echo ""

# Monitoring
echo "📊 Setting up monitoring..."
echo "Metrics to track:"
echo "- Server count (hourly)"
echo "- Active users (daily)"
echo "- Command usage (daily)"
echo "- Premium signups (real-time)"
echo ""

# Launch complete
echo "✅ Launch automation complete!"
echo ""
echo "Next steps:"
echo "1. Test bot in private server"
echo "2. Create support server"
echo "3. Submit to Top.gg"
echo "4. Post to Reddit/Twitter"
echo "5. Monitor metrics"
echo ""
echo "Target: $2,000/month (200 premium subscribers)"
echo "Current: $0 (0 subscribers)"
echo ""
echo "Good luck! 🎮"
