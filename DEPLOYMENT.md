# 🚀 Homeland Deployment Guide

## Railway Deployment

### Prerequisites
- Railway account (https://railway.app)
- Discord bot created on Discord Developer Portal
- PostgreSQL database (Railway provides one)

### Step 1: Railway Setup

1. **Install Railway CLI** (optional)
```bash
npm install -g railway
railway login
```

2. **Create New Project**
- Go to https://railway.app/new
- Click "Deploy from GitHub repo"
- Select `homeland-discord-bot` repository
- Or: `railway init` in project directory

3. **Add PostgreSQL Database**
- In Railway project dashboard
- Click "New" → "Database" → "Add PostgreSQL"
- Copy the `DATABASE_URL` from the PostgreSQL service

### Step 2: Environment Variables

Set these in Railway dashboard (Settings → Variables):

#### Required
```
DISCORD_TOKEN=your_bot_token_from_discord_developer_portal
DISCORD_CLIENT_ID=your_client_id_from_discord
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Auto-filled by Railway
NODE_ENV=production
```

#### Optional (Stripe Premium)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
BASE_URL=https://your-domain.com
```

### Step 3: Discord Bot Setup

1. **Create Bot on Discord Developer Portal**
   - Go to https://discord.com/developers/applications
   - Create New Application
   - Bot tab → Add Bot
   - Copy bot token → Set as `DISCORD_TOKEN`
   - Copy Application ID → Set as `DISCORD_CLIENT_ID`

2. **Set Bot Permissions**
   - Bot tab → Privileged Gateway Intents:
     - ✅ Server Members Intent
     - ✅ Message Content Intent (if needed)
   - OAuth2 → URL Generator:
     - Scopes: `bot`, `applications.commands`
     - Permissions: `Administrator` (or specific permissions)

3. **Invite Bot to Test Server**
   - Copy generated URL
   - Open in browser
   - Select test server
   - Authorize

### Step 4: Deploy

#### Option A: Railway Dashboard
1. Push code to GitHub
2. Railway auto-deploys on push
3. Check logs in Railway dashboard

#### Option B: Railway CLI
```bash
cd ~/homeland-discord-bot
railway link  # Link to your project
railway up    # Deploy
```

### Step 5: Database Migration

Railway automatically runs on startup:
```bash
npx prisma db push --accept-data-loss
```

Check logs to confirm migration success.

### Step 6: Verify Deployment

1. **Check Railway Logs**
```
✅ Prisma Client generated
✅ Database connected
✅ Bot logged in as [Bot Name]
✅ Field Boss System initialized
✅ Guild War System initialized
```

2. **Test in Discord**
```
/create  # Create test character
/hunt    # Test combat
/profile # Check stats
```

### Step 7: Register Slash Commands

Commands auto-register on bot startup. If not:

```bash
# In Railway logs, you should see:
"Slash commands registered successfully"
```

If commands don't appear:
- Wait 1-5 minutes (Discord propagation)
- Reinvite bot with updated permissions
- Check bot has `applications.commands` scope

## Production Checklist

### Before Launch
- [ ] All environment variables set
- [ ] Database migrated successfully
- [ ] Bot online in Railway logs
- [ ] Slash commands working
- [ ] Test character creation
- [ ] Test combat system
- [ ] Test guild creation
- [ ] Test premium subscription (if enabled)

### Security
- [ ] `.env` file in `.gitignore`
- [ ] No secrets in code
- [ ] PostgreSQL SSL enabled
- [ ] Bot token rotated if exposed
- [ ] GM user IDs set in `src/commands/gm.js`

### Performance
- [ ] Railway plan: Hobby ($5/month) or Pro ($20/month)
- [ ] Database plan: adequate for user base
- [ ] Monitor memory usage
- [ ] Set up error logging

## Monitoring

### Railway Logs
```bash
railway logs  # Stream logs
railway logs --tail 100  # Last 100 lines
```

### Key Metrics
- **Response time**: <2 seconds
- **Memory usage**: <512MB (Hobby plan)
- **Database connections**: <100
- **Uptime**: 99.9%

### Error Handling
- Railway auto-restarts on crashes
- Max retries: 10 (set in `railway.json`)
- Check logs for errors:
  ```
  railway logs | grep "Error"
  ```

## Scaling

### User Growth
- **0-1,000 users**: Hobby plan ($5/month)
- **1,000-10,000 users**: Pro plan ($20/month)
- **10,000+ users**: Custom/Enterprise

### Database Scaling
- Monitor query performance
- Add indexes if needed
- Consider read replicas for heavy load

## Updates & Maintenance

### Deploy Updates
```bash
git push origin main  # Railway auto-deploys
```

### Database Schema Changes
```bash
# Update schema.prisma
# Railway runs migration on deploy
# Or manually:
railway run npx prisma db push
```

### Rollback
```bash
railway rollback  # Revert to previous deployment
```

## Troubleshooting

### Bot Not Online
1. Check Railway logs for errors
2. Verify `DISCORD_TOKEN` is correct
3. Check bot permissions in Discord
4. Ensure Railway service is running

### Commands Not Appearing
1. Wait 5 minutes for Discord propagation
2. Reinvite bot with `applications.commands` scope
3. Check bot has required permissions
4. Try in private DM with bot

### Database Errors
1. Verify `DATABASE_URL` is set
2. Check PostgreSQL service is running
3. Review migration logs
4. Ensure SSL is enabled

### Performance Issues
1. Check Railway metrics
2. Monitor database query times
3. Review error logs
4. Consider upgrading plan

## Cost Estimation

### Railway Costs
- **Hobby Plan**: $5/month
  - 500 hours execution time
  - 512MB RAM
  - 1GB disk
  - Good for 0-1,000 users

- **Pro Plan**: $20/month
  - 2,000 hours execution time
  - 8GB RAM
  - 100GB disk
  - Good for 1,000-10,000 users

### PostgreSQL Costs
- **Starter**: $5/month (1GB)
- **Developer**: $15/month (10GB)
- **Production**: $50/month (50GB)

### Total Monthly Cost
- **Launch**: $10-15/month (Hobby + Starter DB)
- **Growth**: $35/month (Pro + Developer DB)
- **Scale**: $70+/month (Pro + Production DB)

## Revenue vs. Costs

### Break-even
- **2 premium subscribers** ($19.98/month) covers hosting
- **4 premium subscribers** ($39.96/month) = profitability

### Target: $2,000/month
- **200 premium subscribers** @ $9.99/month
- **Hosting cost**: ~$70/month
- **Net profit**: $1,930/month
- **Margin**: 96.5%

## Support

### Issues
- Check Railway logs first
- Review Discord bot permissions
- Test database connection
- Verify environment variables

### Resources
- Railway Docs: https://docs.railway.app
- Discord.js Guide: https://discordjs.guide
- Prisma Docs: https://www.prisma.io/docs

---

**Ready to deploy?** Follow the steps above and launch Homeland! 🚀
