# Game Balance Guide

## Combat Balance

### Monster Stats by Level
| Level | HP | Attack | Defense | Gold | XP |
|-------|-----|--------|---------|------|-----|
| 1 | 50 | 5 | 2 | 10 | 20 |
| 5 | 150 | 15 | 6 | 50 | 100 |
| 10 | 350 | 35 | 15 | 150 | 300 |
| 20 | 800 | 80 | 35 | 500 | 1000 |
| 30 | 1500 | 150 | 65 | 1200 | 2500 |
| 40 | 2500 | 250 | 110 | 2500 | 5000 |
| 50 | 4000 | 400 | 180 | 5000 | 10000 |

### Player Stat Growth
**Base Stats (Level 1):**
- HP: 100
- MP: 40
- Attack: 10
- Defense: 5

**Per Level:**
- HP: +10
- MP: +5
- Attack: +2
- Defense: +1

**Class Bonuses:**
- Warrior: +5 HP, +1 Defense per level
- Ranger: +2 Attack, +3 MP per level
- Mage: +10 MP, +1 Attack per level

### Skill Damage Multipliers
| Skill Type | Base | Combo (3x) | Critical |
|------------|------|------------|----------|
| Basic Attack | 1.0x | 4.0x | 2.0x |
| Skill | 1.5-3.0x | 6.0-12.0x | 3.0-6.0x |
| Ultimate | 5.0x | 20.0x | 10.0x |

### Win Streak Bonuses
| Streak | Gold Bonus | XP Bonus | Drop Rate |
|--------|------------|----------|-----------|
| 5 | 2x | 1x | 1x |
| 10 | 2x | 2x | 1.2x |
| 20 | 3x | 3x | 1.5x |
| 50 | 5x | 5x | 2.0x |

## Equipment Balance

### Base Equipment Stats
**Weapons:**
| Tier | Attack | Price | Drop Level |
|------|--------|-------|------------|
| Common | 5-10 | 50G | 1-10 |
| Uncommon | 15-25 | 200G | 10-20 |
| Rare | 30-50 | 1000G | 20-35 |
| Epic | 60-100 | 5000G | 35-50 |
| Legendary | 120-200 | 25000G | 45+ |

**Armor:**
| Tier | Defense | HP | Price | Drop Level |
|------|---------|-----|-------|------------|
| Common | 3-6 | 20 | 40G | 1-10 |
| Uncommon | 8-15 | 50 | 150G | 10-20 |
| Rare | 18-30 | 100 | 800G | 20-35 |
| Epic | 35-60 | 200 | 4000G | 35-50 |
| Legendary | 70-120 | 400 | 20000G | 45+ |

### Enhancement Success Rates
| Level | Success Rate | Cost | Penalty on Fail |
|-------|--------------|------|-----------------|
| +0 → +1 | 100% | 100G | None |
| +1 → +2 | 95% | 200G | None |
| +2 → +3 | 90% | 400G | None |
| +3 → +4 | 80% | 800G | None |
| +4 → +5 | 70% | 1600G | None |
| +5 → +6 | 60% | 3200G | -1 Level |
| +6 → +7 | 50% | 6400G | -1 Level |
| +7 → +8 | 40% | 12800G | -1 Level |
| +8 → +9 | 30% | 25600G | -1 Level |
| +9 → +10 | 20% | 51200G | -1 Level |
| +10 → +11 | 10% | 102400G | -1 Level |

**Stat Increase per Level:** +10%

## Economy Balance

### Gold Sources (per hour)
| Activity | Gold/hour | Notes |
|----------|-----------|-------|
| Low Level Hunting (1-10) | 200-500G | Slow but steady |
| Mid Level Hunting (20-30) | 1000-2000G | Optimal for most |
| High Level Hunting (40-50) | 3000-5000G | Requires good gear |
| Boss Hunting | 5000-10000G | Rare spawns |
| Trading | Variable | Player economy |
| Daily Quests | 2000-5000G | 3 quests per day |

### Gold Sinks (major expenses)
| Item | Cost | Frequency |
|------|------|-----------|
| Equipment (Epic) | 4000-5000G | Every 10-15 levels |
| Enhancement (+0 → +10) | ~160,000G | Per equipment piece |
| Guild Creation | 10,000G | One-time |
| Guild Upgrades | 5000-50000G | Per level |
| Skill Learning | 500-5000G | Per skill |

### Target Economy Loop
- Player earns 2000G/hour average
- Spends 1500G/hour on upgrades
- Net gain: 500G/hour
- Daily net: 2-4 hours play = 1000-2000G saved

## Premium Balance

### Free vs Premium XP/Gold Rates
| Tier | XP Rate | Gold Rate | Effective Gain |
|------|---------|-----------|----------------|
| Free | 1.0x | 1.0x | Baseline |
| Bronze | 1.25x | 1.25x | 25% faster |
| Silver | 1.5x | 1.5x | 50% faster |
| Gold | 2.0x | 2.0x | 100% faster (2x) |

### Premium Value Analysis
**Free Player (50 hours to max):**
- 50 hours × 2000 XP/hour = 100,000 XP total
- 50 hours × 2000G/hour = 100,000G total

**Gold Member (25 hours to max):**
- 25 hours × 4000 XP/hour = 100,000 XP total
- 25 hours × 4000G/hour = 100,000G total
- **Saves 25 hours** (worth $20/month if time = $1/hour)

### Auto-Battle Limits
| Tier | Daily Limit | Effective Time Saved |
|------|-------------|----------------------|
| Free | 0 | 0 hours |
| Bronze | 10 battles | ~20 minutes |
| Silver | 30 battles | ~1 hour |
| Gold | Unlimited | 2-3 hours |

## PvP Balance

### Rating System (ELO)
- Starting Rating: 1000
- Win: +20-30 (vs similar rating)
- Loss: -15-25 (vs similar rating)
- Win vs Higher: +30-50
- Loss vs Lower: -5-10

### Matchmaking Range
| Rating Difference | Match Quality |
|-------------------|---------------|
| 0-100 | Perfect match |
| 100-200 | Good match |
| 200-400 | Acceptable |
| 400+ | Avoid if possible |

### Season Rewards
| Rank | Rating | Reward |
|------|--------|--------|
| Bronze | 800-1199 | 500 gems |
| Silver | 1200-1599 | 1000 gems |
| Gold | 1600-1999 | 2000 gems |
| Platinum | 2000-2499 | 5000 gems |
| Diamond | 2500+ | 10000 gems + Exclusive Skin |

## Daily Quest Balance

### Quest Rewards
| Quest Type | Difficulty | Gold | XP | Gems |
|------------|------------|------|-----|------|
| Kill 5 Monsters | Easy | 500G | 200 | 0 |
| Kill 10 Monsters | Medium | 1500G | 500 | 0 |
| Level Up | Easy | 1000G | 0 | 0 |
| Enhance 3x | Medium | 2000G | 300 | 0 |
| Trade 1x | Easy | 800G | 150 | 0 |
| 3 Win Streak | Medium | 1200G | 400 | 0 |

### Total Daily Quest Value
- Minimum: 3000G + 600 XP
- Maximum: 4500G + 1000 XP
- Average: 3750G + 800 XP

## Field Boss Balance

### Boss Stats
| Boss | HP | Attack | Players | Time | Rewards |
|------|-----|--------|---------|------|---------|
| Drake | 5000 | 100 | 5-10 | 5min | 3x normal |
| Demon King | 10000 | 150 | 5-10 | 5min | 4x normal |
| World Eater | 20000 | 200 | 5-10 | 5min | 5x normal |

### Spawn Rate
- Every 4-6 hours (random)
- 5-minute window to join
- Channel-wide announcement

## Balancing Targets

### Player Retention
- D1: >40% (good onboarding)
- D7: >30% (compelling mid-game)
- D30: >20% (endgame content)

### Progression Pacing
- Level 1-10: 2-3 hours (tutorial + early game)
- Level 10-30: 10-15 hours (mid game)
- Level 30-50: 30-50 hours (endgame)
- **Total to Max: ~45-70 hours**

### Premium Conversion
- Target: 17-25% of active players
- Value Proposition: 50-100% faster progression
- Retention: Premium players stay 2-3x longer

## Tuning Recommendations

### If Players Progress Too Fast
- Reduce XP/Gold rates by 10-20%
- Increase monster HP by 20%
- Reduce drop rates by 15%

### If Players Progress Too Slow
- Increase XP/Gold rates by 15-25%
- Add more daily quest slots
- Improve drop rates by 20%

### If Economy is Deflating (too much gold)
- Increase equipment costs by 20%
- Add gold sinks (cosmetics, renames, etc.)
- Reduce gold drops by 10%

### If Economy is Inflating (not enough gold)
- Reduce equipment costs by 15%
- Increase quest rewards by 20%
- Add more gold sources

---

**Balance Philosophy:** Fun > Perfect Balance

Players should feel progression every session, but not complete the game in 1-2 days. Premium should feel valuable but not mandatory.
