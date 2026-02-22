# HOMELAND Discord Bot - Development Brief for Codex

## Mission
Build a Discord game bot called **HOMELAND** - a Diablo 2-style combat + Albion-style economy game.

## Critical Reference
Read `REVENUE_MODEL.md` in this directory - it contains:
- Proven monetization models from successful Discord bots (Dank Memer, Mudae, IdleRPG)
- Complete game design (combat, economy, guilds)
- Revenue structure ($5.99/$9.99 tiers)
- 4-week development roadmap

## Week 1 Goals (Current Focus)
Build the **core combat system**:

### Required Features
1. **Discord Bot Setup**
   - Discord.js v14
   - Slash commands
   - PostgreSQL database
   - Redis (optional, for caching)

2. **Character System**
   - `/create` - Create character (class selection)
   - `/profile` - View character stats
   - Basic stats: HP, Attack, Defense, Level, XP

3. **Combat System (PvE)**
   - `/explore [zone]` - Enter combat zone
   - Turn-based combat with buttons:
     - ⚔️ Attack
     - 🛡️ Defend
     - 💊 Use Potion
     - 🏃 Flee
   - Enemy types: 3-5 monsters with different stats
   - XP/Gold rewards on victory

4. **Leveling System**
   - Experience points
   - Level up (1-50 cap)
   - Stat increases on level up

### Tech Stack
- **Node.js** + Discord.js v14
- **PostgreSQL** (user data, characters, items)
- **Prisma** ORM (recommended)
- **dotenv** for config

### Database Schema (Minimum)
```prisma
model User {
  discordId String @id
  username  String
  character Character?
}

model Character {
  id       Int    @id @default(autoincrement())
  userId   String @unique
  user     User   @relation(fields: [userId], references: [discordId])
  name     String
  class    String
  level    Int    @default(1)
  xp       Int    @default(0)
  hp       Int    @default(100)
  maxHp    Int    @default(100)
  attack   Int    @default(10)
  defense  Int    @default(5)
  gold     Int    @default(0)
}
```

### File Structure
```
homeland-discord-bot/
├── src/
│   ├── commands/
│   │   ├── create.js
│   │   ├── profile.js
│   │   └── explore.js
│   ├── database/
│   │   ├── schema.prisma
│   │   └── client.js
│   ├── game/
│   │   ├── combat.js
│   │   ├── leveling.js
│   │   └── monsters.js
│   └── bot.js (main entry)
├── .env
├── package.json
└── README.md
```

## Development Rules
1. **Use Discord.js v14 slash commands** (not message commands)
2. **Button interactions** for combat (not reactions)
3. **Database persistence** - all data must survive bot restart
4. **Error handling** - graceful failures with user-friendly messages
5. **Code comments** - explain game logic clearly
6. **NO IMAGE GENERATION** - If images needed (character art, monster sprites, icons), create placeholder text/emoji first. List image requirements in a separate IMAGE_REQUESTS.md file. Jerry will generate images via Melchior ComfyUI.

## Testing Checklist (Week 1)
- [ ] Bot connects to Discord
- [ ] `/create` creates a character
- [ ] `/profile` shows character stats
- [ ] `/explore` starts combat
- [ ] Combat buttons work (attack/defend/potion/flee)
- [ ] XP/Gold rewards after victory
- [ ] Level up triggers stat increases
- [ ] Database persists character data

## Success Criteria
By end of Week 1:
- ✅ Basic combat playable
- ✅ 3-5 enemy types
- ✅ Level 1-10 progression working
- ✅ No critical bugs
- ✅ Code is clean and documented

## After Week 1
Weeks 2-4 will add:
- Economy (crafting, market)
- Guilds & PvP
- Premium features & monetization

## When Complete
Run this command to notify:
```bash
openclaw gateway wake --text "Week 1 HOMELAND Discord bot complete: Core combat system working, 3-5 enemies, leveling 1-10" --mode now
```

---

**Go build! 🚀**
