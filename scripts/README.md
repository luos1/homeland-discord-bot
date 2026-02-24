# Homeland Deployment Scripts

One-click deployment automation for Homeland Discord RPG Bot.

**Goal: $2,000/month revenue (200 premium subscribers)**

---

## 🚀 Quick Start

```bash
cd ~/homeland-discord-bot
./scripts/deploy.sh
```

The script will:
1. ✅ Check prerequisites (Node.js, Railway CLI, Git)
2. ✅ Guide you through Discord bot setup
3. ✅ Create Railway project
4. ✅ Add PostgreSQL database
5. ✅ Configure environment variables
6. ✅ Deploy to production
7. ✅ Generate invite link
8. ✅ Verify deployment

**Estimated time:** 5-10 minutes

---

## 📋 Prerequisites

### Required
- [x] Node.js 18+ ([download](https://nodejs.org/))
- [x] npm (comes with Node.js)
- [x] Git ([download](https://git-scm.com/))
- [x] Discord account
- [x] Railway account ([signup](https://railway.app/))

### Optional
- [ ] Stripe account (for premium subscriptions)
- [ ] Custom domain (for payment webhooks)

---

## 🔧 Manual Deployment

If you prefer manual setup or encounter issues:

### 1. Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Name it "Homeland RPG"
4. Go to **"Bot"** tab → **"Add Bot"**
5. Enable these intents:
   - ✅ Server Members Intent
   - ✅ Message Content Intent (optional but recommended)
6. Copy **Bot Token** (keep it secret!)
7. Copy **Application ID** (also called Client ID)

### 2. Railway Project Setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd ~/homeland-discord-bot
railway init

# Add PostgreSQL
railway add --plugin postgresql
```

### 3. Environment Variables

Set in Railway dashboard or via CLI:

```bash
railway variables set DISCORD_TOKEN="YOUR_BOT_TOKEN"
railway variables set DISCORD_CLIENT_ID="YOUR_CLIENT_ID"
railway variables set NODE_ENV="production"

# Optional (for premium subscriptions)
railway variables set STRIPE_SECRET_KEY="sk_live_..."
railway variables set STRIPE_WEBHOOK_SECRET="whsec_..."
railway variables set BASE_URL="https://yourdomain.com"
```

### 4. Deploy

```bash
# Push to Railway
railway up

# Check status
railway status

# View logs
railway logs
```

### 5. Invite Bot

Generate invite URL:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your actual Client ID.

---

## 🐛 Troubleshooting

### Bot Not Responding

**Symptom:** Bot is online but commands don't work

**Solutions:**
1. Wait 5 minutes for slash commands to register
2. Check Railway logs: `railway logs`
3. Verify intents are enabled in Discord Dev Portal
4. Kick and re-invite bot with fresh invite link

### Database Connection Error

**Symptom:** Error connecting to PostgreSQL

**Solutions:**
1. Verify DATABASE_URL is set: `railway variables get DATABASE_URL`
2. Check PostgreSQL plugin is added: `railway add --plugin postgresql`
3. Wait 2-3 minutes for database to provision
4. Restart deployment: `railway up --detach`

### Prisma Migration Failed

**Symptom:** "Can't reach database server" or migration errors

**Solutions:**
```bash
# Run migrations manually
railway run npx prisma migrate deploy

# Generate Prisma client
railway run npx prisma generate

# Restart
railway up
```

### Commands Take Too Long

**Symptom:** Slash commands don't appear after 10+ minutes

**Solutions:**
1. Check bot has `applications.commands` scope in invite URL
2. Verify bot has necessary permissions (Administrator or specific)
3. Try in a different server (test server)
4. Re-deploy: `railway up`

### Environment Variables Not Loading

**Symptom:** Bot can't find DISCORD_TOKEN

**Solutions:**
```bash
# List all variables
railway variables

# Set missing variables
railway variables set DISCORD_TOKEN="your_token"

# Redeploy
railway up
```

### Premium Payments Not Working

**Symptom:** Stripe webhooks failing

**Solutions:**
1. Add webhook URL in Stripe dashboard:
   ```
   https://your-railway-url.up.railway.app/api/stripe/webhook
   ```
2. Events to listen: `customer.subscription.created`, `customer.subscription.deleted`, `customer.subscription.updated`
3. Verify webhook secret matches `STRIPE_WEBHOOK_SECRET`
4. Check logs: `railway logs --tail 50`

### High Memory Usage

**Symptom:** Bot crashes with "out of memory"

**Solutions:**
1. Upgrade Railway plan (Hobby → Pro)
2. Optimize queries in `src/`
3. Add connection pooling in `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
   }
   
   generator client {
     provider = "prisma-client-js"
     previewFeatures = ["fullTextSearch"]
     engineType = "binary"
   }
   ```
4. Monitor metrics: `railway metrics`

---

## 📊 Post-Deployment

### Immediate Testing

Test these commands in your Discord server:

```
/create          - Create character
/profile         - View profile
/hunt            - Battle monsters
/shop            - Open shop
/guild create    - Create a guild
/arena queue     - Queue for PvP
```

### Launch Checklist

After successful deployment:

1. **Marketing**
   ```bash
   cd marketing && ./launch.sh
   ```
   - Submit to Top.gg
   - Post to Reddit (r/discordapp, r/discordbots)
   - Tweet launch announcement

2. **Monitoring**
   ```bash
   cd monitoring && node metrics-tracker.js discord
   ```
   - Set up daily reports to Discord #비서보고
   - Track toward 200 subscribers goal

3. **Support Server**
   - Create support Discord server
   - Follow guide: `marketing/support-server-setup.md`
   - Add bot to support server

4. **Analytics**
   - Monitor Railway metrics
   - Track server count: `railway logs | grep "Logged in"`
   - Watch for errors: `railway logs --tail 100`

### Growth Tracking

**Target:** 200 premium subscribers = $1,998/month

**Milestones:**
- Week 1: 10+ servers, 50+ characters
- Month 1: 50 servers, 5 premium subscribers ($50/mo)
- Month 3: 150 servers, 100 premium subscribers ($999/mo)
- **Month 6: 300 servers, 200 premium subscribers ($1,998/mo)** 🎯

**Daily Monitoring:**
```bash
# Update metrics
cd monitoring && node metrics-tracker.js discord

# Check Railway status
railway status

# View active users
railway logs --tail 50 | grep "Command used"
```

---

## 🔄 Updates & Maintenance

### Update Bot Code

```bash
# Pull latest changes
git pull origin main

# Deploy update
railway up

# Monitor deployment
railway logs
```

### Database Migrations

```bash
# Create migration (local development)
npx prisma migrate dev --name feature_name

# Apply in production
railway run npx prisma migrate deploy
```

### Rollback

```bash
# View deployments
railway deployments

# Rollback to previous
railway rollback [DEPLOYMENT_ID]
```

### Backup Database

```bash
# Export database
railway run pg_dump $DATABASE_URL > backup.sql

# Restore
railway run psql $DATABASE_URL < backup.sql
```

---

## 💰 Revenue Optimization

### Conversion Funnel

1. **Awareness** (Top.gg, Reddit, Twitter)
   - Target: 10,000 views/month
   
2. **Acquisition** (Server invites)
   - Target: 300 servers
   - Conversion: 3%

3. **Activation** (First character created)
   - Target: 80% of users
   
4. **Retention** (7-day return)
   - Target: 40% retention
   
5. **Revenue** (Premium subscription)
   - Target: 15% of active users
   - 200 subscribers = $1,998/month

### A/B Testing

Test these to optimize conversion:

- Premium price points: $7.99 vs $9.99 vs $12.99
- Free trial: 7 days vs 14 days
- Onboarding flow
- Daily quest rewards
- Guild war prizes

### Metrics to Track

- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Premium conversion rate
- Churn rate
- Average Revenue Per User (ARPU)
- Customer Lifetime Value (LTV)

---

## 🔗 Resources

- [Railway Documentation](https://docs.railway.app/)
- [Discord.js Guide](https://discordjs.guide/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Stripe Integration](https://stripe.com/docs/api)

## 🆘 Support

- Discord: [Support Server](https://discord.gg/homeland)
- Issues: [GitHub Issues](https://github.com/luos1/homeland-discord-bot/issues)
- Email: support@homeland.gg

---

**Ready to launch? Run `./scripts/deploy.sh` and let's hit $2,000/month! 🚀**
