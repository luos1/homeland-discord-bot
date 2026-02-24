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
      title: '🚨 필드 보스 출현! 🚨',
      description: `⚡ **${boss.name}** 출현!\n\n` +
        `**레벨:** ${boss.level}\n` +
        `**HP:** ${boss.hp.toLocaleString()}\n` +
        `**공격력:** ${boss.attack.toLocaleString()}\n\n` +
        `**최소 입찰:** ${boss.minBid.toLocaleString()} 💰\n` +
        `**입찰 마감:** <t:${Math.floor(biddingEnd.getTime() / 1000)}:R>\n\n` +
        `**보상:**\n` +
        boss.rewards.map(r => 
          r.type === 'EQUIPMENT' ? `• ${r.name} (${r.rarity})` :
          r.type === 'GOLD' ? `• ${r.amount.toLocaleString()} 💰` :
          `• ${r.amount.toLocaleString()} XP`
        ).join('\n') +
        `\n\n**\`/fieldboss bid <금액>\` 으로 입찰하세요!**`,
      color: 0xff0000,
      timestamp: new Date(),
      footer: { text: '최고 입찰자가 보스에 도전합니다!' }
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
      include: { player: true }
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
        winnerId: winningBid.playerId,
        winningBid: winningBid.amount,
        status: 'FIGHTING'
      }
    });

    // Notify winner
    await this.notifyWinner(winningBid);

    // Return bids to losers
    await this.refundLosers(winningBid.playerId);

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
      const user = await this.client.users.fetch(winningBid.player.userId);
      const event = await prisma.fieldBossEvent.findUnique({
        where: { id: this.activeEvent.id }
      });

      const embed = {
        title: '🏆 입찰 성공!',
        description: `축하합니다! **${event.bossName}** 입찰에 성공했습니다!\n\n` +
          `**입찰 금액:** ${winningBid.amount.toLocaleString()} 💰\n\n` +
          `5분 후 보스전이 시작됩니다.\n` +
          `최고의 장비와 스킬을 준비하세요!\n\n` +
          `준비되면 \`/fieldboss challenge\` 사용!`,
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
        playerId: { not: winnerId }
      }
    });

    for (const bid of losingBids) {
      await prisma.character.update({
        where: { id: bid.playerId },
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
      return { success: false, message: '현재 진행 중인 필드보스가 없습니다!' };
    }

    const now = new Date();
    if (now >= this.activeEvent.biddingEnd) {
      return { success: false, message: '입찰 기간이 종료되었습니다!' };
    }

    // Get player
    const player = await prisma.character.findUnique({
      where: { id: characterId }
    });

    if (!player) {
      return { success: false, message: '플레이어를 찾을 수 없습니다!' };
    }

    // Check minimum bid
    let minBid = this.activeEvent.minBid;
    if (character.premiumUntil && character.premiumUntil > now) {
      minBid = Math.floor(minBid * 0.8); // 20% discount for premium
    }

    if (amount < minBid) {
      return { 
        success: false, 
        message: `최소 입찰가는 ${minBid.toLocaleString()} 💰입니다` +
          (character.premiumUntil && character.premiumUntil > now ? ' (프리미엄 할인 적용!)' : '')
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
        message: `현재 최고 입찰가는 ${highestBid.amount.toLocaleString()} 💰입니다. 더 높게 입찰하세요!`
      };
    }

    // Check player gold
    if (character.gold < amount) {
      return { 
        success: false, 
        message: `골드가 부족합니다! 보유: ${character.gold.toLocaleString()} 💰`
      };
    }

    // Check if player has existing bid
    const existingBid = await prisma.fieldBossBid.findFirst({
      where: {
        eventId: this.activeEvent.id,
        playerId: character.id
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
          playerId: character.id,
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
      include: { player: true }
    });

    return {
      event: this.activeEvent,
      bids
    };
  }
}

module.exports = FieldBossSystem;
