/**
 * Field Boss Bidding System
 * 
 * Features:
 * - Random boss spawn (3-6h interval)
 * - 30min bidding period
 * - Highest bidder wins boss challenge
 * - Premium bonus (lower minimum bid)
 * - Rare rewards
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class FieldBossSystem {
  constructor(client) {
    this.client = client;
    this.activeEvent = null;
    this.bidCheckInterval = null;
  }

  /**
   * Start the field boss scheduler
   */
  async start() {
    console.log('[FieldBoss] System starting...');
    
    // Check for active event
    await this.loadActiveEvent();
    
    // Schedule next spawn if no active event
    if (!this.activeEvent) {
      this.scheduleNextSpawn();
    } else {
      // Resume bidding check
      this.startBiddingCheck();
    }
  }

  /**
   * Load active event from DB
   */
  async loadActiveEvent() {
    const event = await prisma.fieldBossEvent.findFirst({
      where: { status: 'BIDDING' },
      include: {
        bids: {
          orderBy: { amount: 'desc' },
          take: 10
        }
      }
    });

    if (event) {
      this.activeEvent = event;
      console.log(`[FieldBoss] Loaded active event: ${event.bossName}`);
    }
  }

  /**
   * Schedule next boss spawn (3-6 hours)
   */
  scheduleNextSpawn() {
    const delay = (3 + Math.random() * 3) * 60 * 60 * 1000; // 3-6h
    const spawnTime = Date.now() + delay;
    
    console.log(`[FieldBoss] Next spawn in ${Math.floor(delay / 1000 / 60)} minutes`);
    
    setTimeout(() => {
      this.spawnBoss();
    }, delay);
  }

  /**
   * Spawn a field boss and start bidding
   */
  async spawnBoss() {
    const boss = this.generateBoss();
    const biddingEnd = new Date(Date.now() + 30 * 60 * 1000); // 30min

    const event = await prisma.fieldBossEvent.create({
      data: {
        bossName: boss.name,
        bossLevel: boss.level,
        bossHp: boss.hp,
        bossAttack: boss.attack,
        minBid: boss.minBid,
        biddingEnd,
        status: 'BIDDING',
        rewards: JSON.stringify(boss.rewards)
      }
    });

    this.activeEvent = event;

    // Announce to all servers
    await this.announceSpawn(boss, biddingEnd);

    // Start bidding check
    this.startBiddingCheck();

    console.log(`[FieldBoss] Spawned: ${boss.name} (Level ${boss.level})`);
  }

  /**
   * Generate random field boss
   */
  generateBoss() {
    const bosses = [
      {
        name: '🔥 Ancient Fire Drake',
        level: 50,
        hp: 100000,
        attack: 5000,
        minBid: 5000,
        rewards: [
          { type: 'EQUIPMENT', name: 'Dragon Scale Armor', rarity: 'LEGENDARY' },
          { type: 'GOLD', amount: 50000 },
          { type: 'XP', amount: 10000 }
        ]
      },
      {
        name: '❄️ Frost Giant King',
        level: 45,
        hp: 80000,
        attack: 4500,
        minBid: 4000,
        rewards: [
          { type: 'EQUIPMENT', name: 'Glacial Hammer', rarity: 'LEGENDARY' },
          { type: 'GOLD', amount: 40000 },
          { type: 'XP', amount: 8000 }
        ]
      },
      {
        name: '⚡ Storm Wyvern',
        level: 55,
        hp: 120000,
        attack: 5500,
        minBid: 6000,
        rewards: [
          { type: 'EQUIPMENT', name: 'Thunder Wings', rarity: 'MYTHIC' },
          { type: 'GOLD', amount: 60000 },
          { type: 'XP', amount: 12000 }
        ]
      },
      {
        name: '💀 Lich Emperor',
        level: 60,
        hp: 150000,
        attack: 6000,
        minBid: 8000,
        rewards: [
          { type: 'EQUIPMENT', name: 'Staff of Necromancy', rarity: 'MYTHIC' },
          { type: 'GOLD', amount: 80000 },
          { type: 'XP', amount: 15000 }
        ]
      },
      {
        name: '🌊 Leviathan',
        level: 65,
        hp: 200000,
        attack: 7000,
        minBid: 10000,
        rewards: [
          { type: 'EQUIPMENT', name: 'Trident of the Depths', rarity: 'MYTHIC' },
          { type: 'GOLD', amount: 100000 },
          { type: 'XP', amount: 20000 }
        ]
      }
    ];

    return bosses[Math.floor(Math.random() * bosses.length)];
  }

  /**
   * Announce boss spawn
   */
  async announceSpawn(boss, biddingEnd) {
    const guilds = this.client.guilds.cache;
    
    const embed = {
      title: '🚨 FIELD BOSS APPEARED! 🚨',
      description: `**${boss.name}** has appeared!\n\n` +
        `**Level:** ${boss.level}\n` +
        `**HP:** ${boss.hp.toLocaleString()}\n` +
        `**Attack:** ${boss.attack.toLocaleString()}\n\n` +
        `**Minimum Bid:** ${boss.minBid.toLocaleString()} 💰\n` +
        `**Bidding Ends:** <t:${Math.floor(biddingEnd.getTime() / 1000)}:R>\n\n` +
        `**Rewards:**\n` +
        boss.rewards.map(r => 
          r.type === 'EQUIPMENT' ? `• ${r.name} (${r.rarity})` :
          r.type === 'GOLD' ? `• ${r.amount.toLocaleString()} 💰` :
          `• ${r.amount.toLocaleString()} XP`
        ).join('\n') +
        `\n\n**Use \`/fieldboss bid <amount>\` to place your bid!**`,
      color: 0xff0000,
      timestamp: new Date(),
      footer: { text: 'Highest bidder wins the challenge!' }
    };

    for (const [, guild] of guilds) {
      try {
        // Find general or first available channel
        const channel = guild.channels.cache.find(
          ch => ch.name.includes('general') || ch.name.includes('announcements')
        ) || guild.channels.cache.find(ch => ch.isTextBased());

        if (channel && channel.isTextBased()) {
          await channel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error(`[FieldBoss] Failed to announce in guild ${guild.name}:`, error);
      }
    }
  }

  /**
   * Start bidding period check
   */
  startBiddingCheck() {
    if (this.bidCheckInterval) {
      clearInterval(this.bidCheckInterval);
    }

    this.bidCheckInterval = setInterval(async () => {
      await this.checkBiddingEnd();
    }, 60 * 1000); // Check every minute
  }

  /**
   * Check if bidding period ended
   */
  async checkBiddingEnd() {
    if (!this.activeEvent) return;

    const now = new Date();
    if (now >= this.activeEvent.biddingEnd) {
      await this.endBidding();
    }
  }

  /**
   * End bidding and start boss fight
   */
  async endBidding() {
    console.log('[FieldBoss] Bidding ended');

    // Get highest bid
    const winningBid = await prisma.fieldBossBid.findFirst({
      where: { eventId: this.activeEvent.id },
      orderBy: { amount: 'desc' },
      include: { character: true }
    });

    if (!winningBid) {
      // No bids - cancel event
      await prisma.fieldBossEvent.update({
        where: { id: this.activeEvent.id },
        data: { status: 'CANCELLED' }
      });

      this.activeEvent = null;
      this.scheduleNextSpawn();
      return;
    }

    // Update event
    await prisma.fieldBossEvent.update({
      where: { id: this.activeEvent.id },
      data: {
        winnerId: winningBid.characterId,
        winningBid: winningBid.amount,
        status: 'FIGHTING'
      }
    });

    // Notify winner
    await this.notifyWinner(winningBid);

    // Return bids to losers
    await this.refundLosers(winningBid.characterId);

    // Clear active event
    this.activeEvent = null;

    // Clear interval
    if (this.bidCheckInterval) {
      clearInterval(this.bidCheckInterval);
      this.bidCheckInterval = null;
    }

    // Schedule next spawn
    this.scheduleNextSpawn();
  }

  /**
   * Notify winning bidder
   */
  async notifyWinner(winningBid) {
    try {
      const user = await this.client.users.fetch(winningBid.character.userId);
      const event = await prisma.fieldBossEvent.findUnique({
        where: { id: this.activeEvent.id }
      });

      const embed = {
        title: '🏆 YOU WON THE BID!',
        description: `Congratulations! You won the bid for **${event.bossName}**!\n\n` +
          `**Your Bid:** ${winningBid.amount.toLocaleString()} 💰\n\n` +
          `The boss battle will begin in 5 minutes.\n` +
          `Prepare your best equipment and skills!\n\n` +
          `Use \`/fieldboss challenge\` when ready.`,
        color: 0x00ff00,
        timestamp: new Date()
      };

      await user.send({ embeds: [embed] });
    } catch (error) {
      console.error('[FieldBoss] Failed to notify winner:', error);
    }
  }

  /**
   * Refund losing bids
   */
  async refundLosers(winnerId) {
    const losingBids = await prisma.fieldBossBid.findMany({
      where: {
        eventId: this.activeEvent.id,
        characterId: { not: winnerId }
      }
    });

    for (const bid of losingBids) {
      await prisma.character.update({
        where: { id: bid.characterId },
        data: { gold: { increment: bid.amount } }
      });
    }

    console.log(`[FieldBoss] Refunded ${losingBids.length} losing bids`);
  }

  /**
   * Place a bid
   */
  async placeBid(characterId, amount) {
    if (!this.activeEvent) {
      return { success: false, message: 'No active field boss event!' };
    }

    const now = new Date();
    if (now >= this.activeEvent.biddingEnd) {
      return { success: false, message: 'Bidding period has ended!' };
    }

    // Get player
    const player = await prisma.character.findUnique({
      where: { id: characterId }
    });

    if (!player) {
      return { success: false, message: 'Player not found!' };
    }

    // Check minimum bid
    let minBid = this.activeEvent.minBid;
    if (character.premiumUntil && character.premiumUntil > now) {
      minBid = Math.floor(minBid * 0.8); // 20% discount for premium
    }

    if (amount < minBid) {
      return { 
        success: false, 
        message: `Minimum bid is ${minBid.toLocaleString()} 💰` +
          (character.premiumUntil && character.premiumUntil > now ? ' (Premium discount applied!)' : '')
      };
    }

    // Check highest bid
    const highestBid = await prisma.fieldBossBid.findFirst({
      where: { eventId: this.activeEvent.id },
      orderBy: { amount: 'desc' }
    });

    if (highestBid && amount <= highestBid.amount) {
      return { 
        success: false, 
        message: `Current highest bid is ${highestBid.amount.toLocaleString()} 💰. You must bid higher!`
      };
    }

    // Check player gold
    if (character.gold < amount) {
      return { 
        success: false, 
        message: `You don't have enough gold! You have ${character.gold.toLocaleString()} 💰`
      };
    }

    // Check if player has existing bid
    const existingBid = await prisma.fieldBossBid.findFirst({
      where: {
        eventId: this.activeEvent.id,
        characterId: character.id
      }
    });

    if (existingBid) {
      // Refund old bid
      await prisma.character.update({
        where: { id: character.id },
        data: { gold: { increment: existingBid.amount } }
      });

      // Update bid
      await prisma.fieldBossBid.update({
        where: { id: existingBid.id },
        data: { amount }
      });
    } else {
      // Create new bid
      await prisma.fieldBossBid.create({
        data: {
          eventId: this.activeEvent.id,
          characterId: character.id,
          amount
        }
      });
    }

    // Deduct gold
    await prisma.character.update({
      where: { id: character.id },
      data: { gold: { decrement: amount } }
    });

    return { success: true, amount };
  }

  /**
   * Get current event info
   */
  async getEventInfo() {
    if (!this.activeEvent) {
      return null;
    }

    const bids = await prisma.fieldBossBid.findMany({
      where: { eventId: this.activeEvent.id },
      orderBy: { amount: 'desc' },
      take: 10,
      include: { character: true }
    });

    return {
      event: this.activeEvent,
      bids
    };
  }
}

module.exports = FieldBossSystem;
