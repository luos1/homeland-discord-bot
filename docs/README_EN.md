# 🎮 HOMELAND - Discord RPG Bot

A turn-based combat Discord RPG game bot with strategic gameplay and progression systems.

## ✨ What is HOMELAND?

HOMELAND is a text-based RPG game that runs entirely within Discord. Experience classic turn-based combat, character progression, and strategic battles - all through simple slash commands. No downloads, no installation - just invite the bot to your server and start your adventure!

**Key Highlights:**
- 🎯 **3 Unique Classes** - Warrior, Ranger, Mage
- ⚔️ **Turn-Based Combat** - Strategic decision-making in every battle
- 📈 **50 Levels of Progression** - Grow stronger with experience
- 🗺️ **3 Exploration Zones** - Face increasingly challenging enemies
- 🛡️ **Tactical Mechanics** - Critical hits, defense, and resource management
- 💾 **Persistent Data** - Your progress is always saved

---

## 🎯 Features

### Character System
Choose from three distinct classes, each with unique stat distributions:

- **Warrior** 🛡️ - The tank class
  - High HP and Defense
  - Starting Stats: HP 120, ATK 12, DEF 8
  - Best for: Surviving long battles

- **Ranger** 🏹 - The balanced class
  - Balanced stats across the board
  - Starting Stats: HP 100, ATK 15, DEF 5
  - Best for: Versatile playstyle

- **Mage** 🔮 - The damage dealer
  - High attack power, low defense
  - Starting Stats: HP 80, ATK 18, DEF 3
  - Best for: Quick, aggressive gameplay

### Combat Mechanics
Every battle is a strategic decision:

- **⚔️ Attack** - Deal damage to your enemy
  - 15% critical hit chance (1.65x damage)
  - Standard damage = Your ATK - Enemy DEF

- **🛡️ Defend** - Reduce incoming damage
  - 55% damage reduction this turn
  - Tactical choice for high-damage enemies

- **💊 Potion** - Restore health
  - Heals 35% of max HP
  - 3 potions provided per battle

- **🏃 Flee** - Escape from combat
  - 45% success rate
  - No rewards if successful

### Leveling & Progression
- **Experience Points** - Earn XP from each victory
- **Level Cap** - Reach level 50
- **Stat Growth** - Automatic HP/ATK/DEF increases per level
- **Zone Unlocks** - Higher levels access harder zones with better rewards

### Exploration Zones
- **Zone 1** - Beginner area (Levels 1-15)
  - Goblins, Wolves, Bandits
  
- **Zone 2** - Intermediate area (Levels 16-35)
  - Orcs, Dark Elves, Trolls
  
- **Zone 3** - Advanced area (Levels 36+)
  - Dragons, Demons, Undead Knights

---

## 🚀 Quick Start

### For Players

1. **Join a Server with HOMELAND**
   - Ask your server admin to invite the bot
   - OR use this invite link: [Add HOMELAND](#) *(coming soon)*

2. **Create Your Character**
   ```
   /create
   ```
   Choose your class from the button menu

3. **View Your Profile**
   ```
   /profile
   ```
   Check stats, level, and equipment

4. **Start Exploring**
   ```
   /explore
   ```
   Select a zone and engage in combat!

5. **Quick Play**
   ```
   /play
   ```
   Auto-creates character if needed, or shows profile

---

## 📦 Commands Reference

| Command | Description | Usage |
|---------|-------------|-------|
| `/create` | Create your character | Choose class via buttons |
| `/profile` | View character stats | Navigate with buttons |
| `/explore` | Enter exploration zones | Select zone, then battle |
| `/play` | Quick start command | Auto-setup + profile |

### Button Navigation
HOMELAND uses Discord's interactive buttons for seamless gameplay:

- **Profile Navigation**: View Stats → Inventory → Skills
- **Combat Actions**: Attack → Defend → Potion → Flee
- **Zone Selection**: Zone 1 → Zone 2 → Zone 3

---

## 💎 Premium Features

Upgrade your HOMELAND experience with premium tiers:

### Premium ($5.99/month)
- ⭐ 3x Daily Exploration Limit (5 → 15 runs)
- ⭐ +50% Experience Gain
- ⭐ 150 Inventory Slots (vs 50)
- ⭐ +10% Rare Drop Rate
- ⭐ Exclusive Premium Dungeons
- ⭐ Profile Badge

### Premium Plus ($9.99/month)
- 🔥 Unlimited Daily Explorations
- 🔥 +100% Experience Gain
- 🔥 Unlimited Inventory
- 🔥 +25% Rare Drop Rate
- 🔥 Exclusive Raid Bosses
- 🔥 Custom Profile Themes
- 🔥 Guild Boosts

**Note**: Premium features are **pay-for-convenience**, not pay-to-win. Free players can experience all core gameplay!

---

## 🛠️ For Server Admins: Setup

### Invite HOMELAND to Your Server

**Method 1: Easy Deploy (Railway)**

1. Visit [Railway.app](https://railway.app) and sign up
2. Click "Deploy from GitHub"
3. Connect this repository
4. Set environment variables:
   - `DISCORD_TOKEN` - Your bot token
   - `DISCORD_CLIENT_ID` - Your bot's client ID
   - `DATABASE_URL` - `file:./homeland.db`
5. Deploy!

**Method 2: Self-Host**

Requirements:
- Node.js 18+
- npm or yarn

Installation:
```bash
# Clone repository
git clone https://github.com/yourusername/homeland-discord-bot.git
cd homeland-discord-bot

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Discord bot credentials

# Initialize database
npx prisma generate
npx prisma db push

# Start bot
npm start
```

### Get Bot Credentials

1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Create "New Application"
3. Go to "Bot" tab → "Add Bot"
4. Copy **Token** (for `DISCORD_TOKEN`)
5. Go to "OAuth2" → "General"
6. Copy **Client ID** (for `DISCORD_CLIENT_ID`)
7. Go to "OAuth2" → "URL Generator"
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Send Messages`, `Embed Links`, `Use External Emojis`
   - Use generated URL to invite bot

---

## 🎮 Game Systems Deep Dive

### Combat Formula
```
Damage = (Attacker ATK - Defender DEF) × Critical Modifier
Critical Hit = 15% chance → 1.65x damage
Defense Action = Incoming Damage × 0.45 (55% reduction)
Potion Heal = Max HP × 0.35
```

### Leveling Formula
```
XP Required = Base XP × (Level ^ 1.5)
Level 1→2: 100 XP
Level 10→11: 316 XP
Level 49→50: 3,430 XP
```

### Monster Scaling
- Zone 1: Level 1-5 monsters
- Zone 2: Level 15-25 monsters  
- Zone 3: Level 35-45 monsters
- Rewards scale with monster level

---

## 💬 Support & Community

### Get Help
- **Documentation**: [Read Full Guide](./GUIDE_EN.md)
- **Bug Reports**: [GitHub Issues](https://github.com/yourusername/homeland-discord-bot/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/yourusername/homeland-discord-bot/discussions)

### Community
- **Discord Server**: [Join HOMELAND Community](#) *(coming soon)*
- **Reddit**: r/homeland_rpg *(coming soon)*
- **Twitter**: [@HomelandRPG](#) *(coming soon)*

### Contact
- **Developer**: 너구리상회 AI Studio
- **Email**: support@homeland-rpg.com *(example)*

---

## 📝 License

MIT License - Free to use, modify, and distribute.

See [LICENSE](../LICENSE) for full details.

---

## 🗺️ Roadmap

### Current Version (v1.0)
- ✅ Core combat system
- ✅ 3 character classes
- ✅ Leveling 1-50
- ✅ 3 exploration zones

### Coming Soon (v1.1)
- [ ] Inventory & Equipment system
- [ ] Item Marketplace (player trading)
- [ ] Guild System
- [ ] Premium Subscriptions

### Future Plans (v2.0)
- [ ] PvP Battles
- [ ] Raid Bosses
- [ ] Crafting System
- [ ] Random Events (treasure, traps, merchants)
- [ ] Mini-games (dice gambling, etc.)

---

## 🌟 Why HOMELAND?

**For Players:**
- 🎮 Nostalgic turn-based RPG experience
- 🆓 Completely free core gameplay
- 📱 Play anywhere Discord is available
- 👥 Social - compete with friends on leaderboards
- ⏱️ Quick sessions - battles take 2-5 minutes

**For Server Admins:**
- 🎯 Increase server engagement
- 🔧 Easy setup - no maintenance required
- 💾 Lightweight - uses SQLite (no external DB)
- 🚀 Scalable - handles servers of any size
- 🎨 Customizable (coming soon)

---

**Made with ❤️ by 너구리상회 AI Studio**

*Join the adventure. Build your legend. Defend your HOMELAND.*
