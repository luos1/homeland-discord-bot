# Support Server Setup Guide

## 1. Server Structure

### Channels

**📢 Announcements**
- #announcements - Bot updates and news
- #changelog - Detailed patch notes
- #maintenance - Scheduled downtime notices

**💬 Community**
- #general - General chat
- #help - User support
- #feedback - Feature requests and suggestions
- #bugs - Bug reports

**🎮 Game**
- #guilds - Guild recruitment
- #trading - Trading posts
- #pvp - Arena challenges
- #leaderboards - Top players

**📊 Stats**
- #server-count - Live server count
- #user-stats - User milestones
- #premium-perks - Premium features showcase

**🛠 Admin**
- #mod-chat (private)
- #bot-logs (private)
- #support-tickets (private)

### Roles

**Staff:**
- 👑 Owner
- 🛡 Admin
- 🔨 Moderator
- 📞 Support

**Community:**
- 💎 Premium (auto-assigned)
- ⭐ Early Adopter (first 100 members)
- 🏆 Top Player (level 50+)
- 🎯 Guild Leader
- 🤝 Helper (active support)

**Booster:**
- 💗 Server Booster (Discord boost)

### Rules

1. Be respectful to all members
2. No spam or self-promotion
3. Use appropriate channels
4. No cheating or exploits
5. Follow Discord ToS
6. English only in main channels
7. No NSFW content
8. No begging for premium/gold

### Welcome Message

Welcome to Homeland RPG! 🎮

To get started:
1. Invite the bot: <invite link>
2. Use `/create` in your server
3. Read #help for commands
4. Join #guilds to find a guild
5. Ask questions in #help

Have fun! ⚔️

## 2. Moderation Setup

### Auto-mod Rules
- Delete messages with invite links (except #guilds)
- Timeout on excessive mentions
- Block banned words
- Rate limit messages (5/10s)

### Support Ticket System
Use a ticket bot or reaction roles to create support tickets.

### FAQ Bot
Set up common Q&A:
- How do I get started?
- How does premium work?
- How do guilds work?
- How do I report a bug?
- What are the drop rates?

## 3. Bots to Add

- **Carl-bot** - Reaction roles, auto-mod
- **Statbot** - Server statistics
- **Ticket Tool** - Support tickets
- **MEE6** - Leveling and XP (optional)

## 4. Webhooks

### Bot Updates Webhook
POST to #announcements when:
- New version deployed
- New features added
- Maintenance scheduled

### Server Count Webhook
POST to #server-count every hour:
- Current server count
- Total users
- Active players (24h)

## 5. Server Invite

Create permanent invite:
- Never expires
- Unlimited uses
- No temporary membership

## 6. Verification

Set verification level to Medium:
- Must have verified email
- Must be on Discord for 5+ minutes

## 7. Vanity URL (if partnered)

discord.gg/homeland-rpg

---

**Launch Checklist:**
- [ ] All channels created
- [ ] Roles configured
- [ ] Rules posted
- [ ] Welcome message set
- [ ] Auto-mod enabled
- [ ] Support system ready
- [ ] Bots invited
- [ ] Permanent invite created
