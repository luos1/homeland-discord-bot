# 🎮 HOMELAND - Complete Game Guide

Your comprehensive guide to mastering HOMELAND, from your first battle to becoming a legendary hero.

---

## 📚 Table of Contents

1. [Getting Started](#getting-started)
2. [Character Creation](#character-creation)
3. [Combat System](#combat-system)
4. [Leveling & Skills](#leveling--skills)
5. [Exploration Zones](#exploration-zones)
6. [Economy System](#economy-system-coming-soon)
7. [Premium Benefits](#premium-benefits)
8. [Tips & Tricks](#tips--tricks)
9. [FAQ](#faq)

---

## 🌟 Getting Started

### Your First Steps

**1. Create Your Character**
```
/create
```
You'll be presented with three class choices:
- Click the button matching your preferred playstyle
- Your character is created instantly
- You start at Level 1 with base stats

**2. Check Your Profile**
```
/profile
```
Familiarize yourself with the interface:
- **Stats Tab**: HP, ATK, DEF, Level, XP
- **Navigation Buttons**: Browse different sections
- **Current Status**: Health, experience progress

**3. Begin Your First Battle**
```
/explore
```
- Select **Zone 1** (beginner area)
- A random enemy appears
- Choose your combat action
- Win to earn XP and gold!

**4. Quick Play Shortcut**
```
/play
```
- Automatically creates character if you don't have one
- Shows your profile if character exists
- Fastest way to get started

---

## 🎯 Character Creation

### Choosing Your Class

Understanding class differences is crucial for your playstyle:

#### Warrior 🛡️ - The Immortal Tank

**Starting Stats:**
- HP: 120 (Highest)
- ATK: 12 (Moderate)
- DEF: 8 (High)

**Playstyle:**
- Survive long battles through high HP/DEF
- Use **Defend** action frequently
- Best for cautious, strategic players
- Slower XP gain but very safe

**Best For:**
- Beginners learning combat mechanics
- Players who prefer low-risk gameplay
- Solo grinding without premium

**Combat Strategy:**
- Turn 1-2: Attack to establish damage
- Turn 3: Defend if HP < 50%
- Use potions conservatively (you won't need many)

---

#### Ranger 🏹 - The Balanced Fighter

**Starting Stats:**
- HP: 100 (Moderate)
- ATK: 15 (High)
- DEF: 5 (Moderate)

**Playstyle:**
- Balanced offense and defense
- Versatile combat options
- Most "standard RPG" experience
- Moderate risk, moderate reward

**Best For:**
- Players who want flexibility
- Those unsure of their playstyle
- Balanced progression speed

**Combat Strategy:**
- Attack aggressively early game
- Defend when HP < 40%
- Potions are valuable - use wisely
- Adapt to enemy patterns

---

#### Mage 🔮 - The Glass Cannon

**Starting Stats:**
- HP: 80 (Lowest)
- ATK: 18 (Highest)
- DEF: 3 (Low)

**Playstyle:**
- High-risk, high-reward
- Fastest battles (kill before being killed)
- Highest XP/hour when successful
- Requires strategic potion management

**Best For:**
- Experienced RPG players
- Those with premium (more exploration runs)
- Players who want fast progression
- Risk-takers

**Combat Strategy:**
- Attack relentlessly - end battles ASAP
- Defend is less effective (low DEF)
- Use potions early and often
- Flee if battle goes wrong
- **Pro Tip**: Mage becomes strongest at high levels

---

### Stat Comparison Table

| Class   | HP  | ATK | DEF | Survival | Damage | Speed |
|---------|-----|-----|-----|----------|--------|-------|
| Warrior | 120 | 12  | 8   | ⭐⭐⭐    | ⭐⭐    | ⭐     |
| Ranger  | 100 | 15  | 5   | ⭐⭐     | ⭐⭐⭐   | ⭐⭐    |
| Mage    | 80  | 18  | 3   | ⭐       | ⭐⭐⭐⭐  | ⭐⭐⭐   |

**Note**: You can only have ONE character per Discord account. Choose wisely!

---

## ⚔️ Combat System

### Understanding Turn-Based Combat

HOMELAND uses a classic turn-based system where you and the enemy take turns attacking.

### Your Turn Actions

#### 1. ⚔️ Attack (Primary Action)
**What it does:**
- Deals damage = Your ATK - Enemy DEF
- 15% chance of **Critical Hit** (1.65x damage)
- Standard action for most turns

**When to use:**
- When your HP is safe (>50%)
- To finish low-HP enemies
- When you need to deal damage

**Example:**
```
Your ATK: 15
Enemy DEF: 5
Normal Damage: 15 - 5 = 10 HP
Critical Damage: 10 × 1.65 = 16 HP (15% chance)
```

---

#### 2. 🛡️ Defend (Defensive Action)
**What it does:**
- Reduces incoming damage by 55% this turn
- Does NOT attack the enemy
- Tactical choice for survival

**When to use:**
- When HP is low (<40%)
- Against enemies with high ATK
- To stall while waiting for next potion opportunity
- When you need one more turn to win

**Example:**
```
Enemy Attack: 20 HP
Without Defend: You take 20 damage
With Defend: You take 20 × 0.45 = 9 damage (saved 11 HP!)
```

**Pro Tip**: Defending is often better than using a potion early - save potions for emergencies!

---

#### 3. 💊 Use Potion (Healing Action)
**What it does:**
- Restores 35% of your max HP
- Limited to 3 potions per battle
- Does NOT attack this turn

**When to use:**
- When HP drops below 30-40%
- NEVER use at full HP (wasted)
- Save at least 1 potion for emergencies
- Use early if you're Mage class (low HP pool)

**Example:**
```
Max HP: 100
Current HP: 25
After Potion: 25 + (100 × 0.35) = 60 HP

Max HP: 120 (Warrior)
Current HP: 40
After Potion: 40 + (120 × 0.35) = 82 HP
```

**⚠️ Potion Management Tips:**
- **Warrior**: Rarely need all 3 potions
- **Ranger**: Use 1-2 potions per tough battle
- **Mage**: Expect to use all 3 potions

---

#### 4. 🏃 Flee (Escape Action)
**What it does:**
- 45% chance to escape combat
- No XP or gold rewards if successful
- Enemy still attacks if you fail

**When to use:**
- HP critical (<20%) and no potions left
- Accidentally entered wrong zone
- Emergency escape only

**Flee vs Death:**
- **Flee Success**: No rewards, but no penalty
- **Death**: Lose XP and gold (coming soon)
- Always better to flee than die!

**Example:**
```
Flee Attempt #1: 45% chance → Success! Escaped safely.
Flee Attempt #2: 45% chance → Failed! Enemy attacks, then your turn again.
```

---

### Enemy Turn

After your action, the enemy attacks:

**Enemy Damage Calculation:**
```
Damage = Enemy ATK - Your DEF
(If you used Defend: Damage × 0.45)
```

**Enemy Patterns:**
- Enemies ALWAYS attack (no defend/potion)
- They have fixed ATK/DEF stats
- No critical hits for enemies
- Pure damage race

---

### Winning Combat

**Victory Conditions:**
- Reduce enemy HP to 0
- You receive rewards instantly

**Rewards:**
- **Experience Points (XP)**: Based on enemy level
- **Gold**: For future economy system
- **Level Up**: If you earn enough XP

**After Victory:**
- HP does NOT restore automatically
- You can explore again (daily limit applies)
- Check your profile to see progress

---

### Losing Combat

**Defeat Conditions:**
- Your HP reaches 0
- Enemy wins the battle

**Penalties (Current Version):**
- No penalties yet (in development)

**Penalties (Coming Soon):**
- Lose 10% XP (not enough to de-level)
- Lose gold
- Respawn at full HP

---

### Combat Example (Full Battle)

**Setup:**
- You: Ranger (HP 100, ATK 15, DEF 5)
- Enemy: Orc (HP 80, ATK 12, DEF 4)

**Turn 1:**
- You: Attack → 15 - 4 = 11 damage → Orc HP: 69/80
- Orc: Attack → 12 - 5 = 7 damage → Your HP: 93/100

**Turn 2:**
- You: Attack → Critical Hit! → 11 × 1.65 = 18 damage → Orc HP: 51/80
- Orc: Attack → 7 damage → Your HP: 86/100

**Turn 3:**
- You: Attack → 11 damage → Orc HP: 40/80
- Orc: Attack → 7 damage → Your HP: 79/100

**Turn 4:**
- You: Attack → 11 damage → Orc HP: 29/80
- Orc: Attack → 7 damage → Your HP: 72/100

**Turn 5:**
- You: Attack → 11 damage → Orc HP: 18/80
- Orc: Attack → 7 damage → Your HP: 65/100

**Turn 6:**
- You: Attack → 11 damage → Orc HP: 7/80
- Orc: Attack → 7 damage → Your HP: 58/100

**Turn 7:**
- You: Attack → 11 damage → **Orc HP: 0** ✅ VICTORY!

**Rewards:**
- +150 XP
- +50 Gold

---

## 📈 Leveling & Skills

### Experience System

**How XP Works:**
- Earn XP from winning battles
- XP required increases each level
- Level cap: 50

**XP Formula:**
```
XP to Next Level = 100 × (Current Level ^ 1.5)

Level 1→2: 100 XP
Level 5→6: 280 XP
Level 10→11: 316 XP
Level 20→21: 894 XP
Level 49→50: 3,430 XP
```

### Stat Growth Per Level

When you level up, stats increase automatically:

**Warrior:**
- HP: +8 per level
- ATK: +2 per level
- DEF: +1.5 per level

**Ranger:**
- HP: +6 per level
- ATK: +2.5 per level
- DEF: +1 per level

**Mage:**
- HP: +4 per level
- ATK: +3 per level
- DEF: +0.5 per level

### Level Milestones

| Level | Unlocks |
|-------|---------|
| 1-15  | Zone 1 optimal |
| 16-35 | Zone 2 unlocked |
| 36-50 | Zone 3 unlocked |
| 50    | Max level (endgame content) |

---

## 🗺️ Exploration Zones

### Zone 1: Beginner Grounds

**Recommended Level:** 1-15

**Enemies:**
- **Goblin** (HP 30, ATK 5, DEF 2) - Weakest enemy
- **Wolf** (HP 50, ATK 8, DEF 3) - Fast attacker
- **Bandit** (HP 60, ATK 10, DEF 4) - Moderate challenge

**Rewards:**
- XP: 25-75 per battle
- Gold: 10-30 per battle

**Strategy:**
- Perfect for learning combat mechanics
- Very safe for all classes
- Grind here until level 10-12

---

### Zone 2: Dangerous Wilds

**Recommended Level:** 16-35

**Enemies:**
- **Orc** (HP 120, ATK 18, DEF 7) - Tank enemy
- **Dark Elf** (HP 90, ATK 22, DEF 5) - High damage
- **Troll** (HP 180, ATK 15, DEF 10) - Super tank

**Rewards:**
- XP: 150-400 per battle
- Gold: 75-150 per battle

**Strategy:**
- Use potions liberally
- Defend more frequently
- Mages may struggle vs Trolls

---

### Zone 3: Deadly Frontier

**Recommended Level:** 36-50

**Enemies:**
- **Dragon** (HP 300, ATK 35, DEF 12) - Extreme damage
- **Demon** (HP 250, ATK 40, DEF 8) - Glass cannon boss
- **Undead Knight** (HP 400, ATK 25, DEF 15) - Ultimate tank

**Rewards:**
- XP: 800-2000 per battle
- Gold: 300-600 per battle

**Strategy:**
- Max level recommended
- Premium potions may be needed (coming soon)
- Highest risk, highest reward

---

## 💰 Economy System (Coming Soon)

### Planned Features

**Inventory:**
- Collect equipment drops from battles
- Store up to 50 items (150 with Premium)
- Equip weapons, armor, accessories

**Marketplace:**
- Buy items with gold
- Sell items to other players
- Player-driven economy

**Crafting:**
- Combine materials to create items
- Upgrade equipment
- Craft consumables

---

## 💎 Premium Benefits

### Why Go Premium?

HOMELAND is **free-to-play**, but Premium offers convenience and faster progression.

### Premium Tier ($5.99/month)

**Exploration:**
- 15 daily runs (vs 5 free)
- +50% XP gain
- +10% rare drop rate

**Inventory:**
- 150 slots (vs 50)
- Priority marketplace listings

**Exclusive Content:**
- Premium-only dungeons
- Special events

**Cosmetics:**
- Profile badge
- Custom colors (coming soon)

### Premium Plus Tier ($9.99/month)

**All Premium benefits, plus:**
- **Unlimited** daily explorations
- +100% XP gain (double!)
- +25% rare drop rate
- Unlimited inventory
- Guild boost perks
- Custom profile themes
- Access to raid bosses

### Is Premium Worth It?

**Free Players:**
- Can reach max level (50)
- Access all core content
- Competitive in PvP (coming soon)
- Just takes longer

**Premium Players:**
- Faster progression
- More exploration attempts
- Convenience features
- Support development

**Our Philosophy:** Premium = Time-saver, NOT power advantage.

---

## 🧠 Tips & Tricks

### Beginner Tips

1. **Start with Ranger** - Most forgiving class for new players
2. **Stay in Zone 1 until level 12** - Don't rush to harder zones
3. **Save potions** - Use Defend instead when possible
4. **Check XP requirements** - Know when you're close to leveling
5. **Use /play for quick access** - Fastest command

### Intermediate Tips

6. **Time your level-ups** - Level up restores full HP (plan your battles)
7. **Zone 2 at level 16** - Don't go earlier even if unlocked
8. **Critical hits are RNG** - 15% chance, don't rely on them
9. **Defend is underrated** - Often better than potion
10. **Track your daily runs** - Maximize free explorations

### Advanced Tips

11. **Mage becomes strongest endgame** - High ATK scales best
12. **Flee has no cooldown** - Can attempt multiple times
13. **Min-max stats** - Check stat growth formulas
14. **Premium timing** - Buy Premium when you have time to grind
15. **Zone 3 requires level 40+** - Level 36 is minimum, not recommended

### Pro Strategies

16. **HP management** - Don't waste potions above 60% HP
17. **Defend stacking** - Defend → Defend on consecutive turns is valid
18. **Enemy pattern recognition** - Memorize enemy stats
19. **XP per hour optimization** - Zone 1 at low level, Zone 2 mid, Zone 3 high
20. **Premium maximization** - Use unlimited runs on double XP events

---

## ❓ FAQ

### General Questions

**Q: Can I change my class after creation?**
A: No, your class is permanent. Choose carefully!

**Q: Can I have multiple characters?**
A: No, one character per Discord account.

**Q: Is there PvP?**
A: Not yet, but it's planned for v1.1.

**Q: Can I play solo?**
A: Yes! HOMELAND is fully solo-playable.

**Q: Is there a story?**
A: Not in v1.0, but story/quests are planned.

---

### Combat Questions

**Q: Do I heal between battles?**
A: No, HP persists. Use potions or level up to restore HP.

**Q: What happens if I die?**
A: Currently no penalty. Death penalties coming in v1.1.

**Q: Can enemies critical hit?**
A: No, only players can crit.

**Q: Can I flee multiple times?**
A: Yes, attempt until successful (45% each try).

---

### Progression Questions

**Q: What's the fastest way to level?**
A: Zone 2-3 enemies give most XP, but must be strong enough to win.

**Q: Can I de-level?**
A: No, you never lose levels.

**Q: Is there a level cap?**
A: Yes, level 50 is maximum.

**Q: How long to reach max level?**
A: Free player: ~40-60 hours. Premium: ~20-30 hours.

---

### Premium Questions

**Q: Is Premium pay-to-win?**
A: No, Premium is pay-for-convenience. Free players can access all content.

**Q: Can I cancel anytime?**
A: Yes, cancel anytime. Benefits last until period ends.

**Q: Do Premium benefits stack?**
A: No, only your highest tier applies.

**Q: Can I gift Premium?**
A: Not yet, but gift codes are planned.

---

## 🎯 Next Steps

**Ready to begin your adventure?**

1. Head to your Discord server
2. Type `/create` to make your character
3. Choose your class wisely
4. Read [Combat System](#combat-system) section again
5. Start exploring Zone 1!

**Need more help?**
- Read the [README](./README_EN.md) for setup info
- Check our [Marketing Materials](./MARKETING_EN.md)
- Join the community (coming soon)

---

**Good luck, hero. Your HOMELAND awaits! 🎮⚔️**
