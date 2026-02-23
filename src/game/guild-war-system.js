/**
 * Guild War System
 * 
 * Weekend guild competition event:
 * - Saturday 20:00 - Sunday 22:00 (26h)
 * - Guild vs Guild scoring
 * - Member contributions (kills, boss defeats, resources)
 * - Real-time leaderboard
 * - Rewards for top guilds
 */

const { PrismaClient } = require('@prisma/client');
const { EmbedBuilder } = require('discord.js');
const prisma = new PrismaClient();

class GuildWarSystem {
  constructor(client) {
    this.client = client;
    this.activeWar = null;
    this.checkInterval = null;
  }

  /**
   * Start the guild war scheduler
   */
  async start() {
    console.log('[GuildWar] System starting...');
    
    // Check for active war
    await this.loadActiveWar();
    
    // Start scheduler
    this.scheduleCheck();
  }

  /**
   * Load active war from DB
   */
  async loadActiveWar() {
    const war = await prisma.guildWar.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        participants: {
          include: {
            guild: true,
            contributions: true
          }
        }
      }
    });

    if (war) {
      this.activeWar = war;
      console.log(`[GuildWar] Active war found: ${war.season}`);
    }
  }

  /**
   * Schedule periodic checks (every 5 minutes)
   */
  scheduleCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.checkWarTiming();
    }, 5 * 60 * 1000); // 5 minutes

    // Also check immediately
    this.checkWarTiming();
  }

  /**
   * Check if war should start or end
   */
  async checkWarTiming() {
    const now = new Date();
    const day = now.getDay(); // 0=Sunday, 6=Saturday
    const hour = now.getHours();

    // Start: Saturday 20:00 KST
    if (day === 6 && hour === 20 && !this.activeWar) {
      await this.startWar();
    }

    // End: Sunday 22:00 KST
    if (this.activeWar && day === 0 && hour === 22) {
      await this.endWar();
    }
  }

  /**
   * Start a new guild war
   */
  async startWar() {
    const now = new Date();
    const endTime = new Date(now);
    endTime.setDate(endTime.getDate() + 1); // Tomorrow
    endTime.setHours(22, 0, 0, 0); // 22:00

    // Create season identifier (Year-Week)
    const season = `${now.getFullYear()}-W${this.getWeekNumber(now)}`;

    const war = await prisma.guildWar.create({
      data: {
        season,
        startTime: now,
        endTime,
        status: 'ACTIVE'
      }
    });

    this.activeWar = war;

    // Register all guilds
    await this.registerGuilds(war.id);

    // Announce to all servers
    await this.announceWarStart(war);

    console.log(`[GuildWar] Started: ${season}`);
  }

  /**
   * Register all guilds for the war
   */
  async registerGuilds(warId) {
    const guilds = await prisma.guild.findMany({
      where: { memberCount: { gt: 0 } }
    });

    for (const guild of guilds) {
      await prisma.guildWarParticipant.create({
        data: {
          warId,
          guildId: guild.id,
          score: 0
        }
      });
    }

    console.log(`[GuildWar] Registered ${guilds.length} guilds`);
  }

  /**
   * Announce war start
   */
  async announceWarStart(war) {
    const guilds = this.client.guilds.cache;

    const embed = new EmbedBuilder()
      .setTitle('⚔️ GUILD WAR HAS BEGUN! ⚔️')
      .setDescription(
        `**Season:** ${war.season}\n` +
        `**Duration:** <t:${Math.floor(war.startTime.getTime() / 1000)}:F> - <t:${Math.floor(war.endTime.getTime() / 1000)}:F>\n\n` +
        `**How to Participate:**\n` +
        `• Hunt monsters and bosses\n` +
        `• Gather resources\n` +
        `• Complete daily quests\n` +
        `• Donate gold to guild\n\n` +
        `All activities contribute to your guild's score!\n\n` +
        `**Rewards for Top 3 Guilds:**\n` +
        `🥇 1st Place: 100,000 💰 + Legendary Guild Chest\n` +
        `🥈 2nd Place: 50,000 💰 + Epic Guild Chest\n` +
        `🥉 3rd Place: 25,000 💰 + Rare Guild Chest\n\n` +
        `Use \`/guildwar status\` to check current standings!`
      )
      .setColor(0xff0000)
      .setTimestamp()
      .setFooter({ text: 'May the strongest guild win!' });

    for (const [, guild] of guilds) {
      try {
        const channel = guild.channels.cache.find(
          ch => ch.name.includes('general') || ch.name.includes('announcements')
        ) || guild.channels.cache.find(ch => ch.isTextBased());

        if (channel && channel.isTextBased()) {
          await channel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error(`[GuildWar] Failed to announce in guild ${guild.name}:`, error);
      }
    }
  }

  /**
   * End the current war
   */
  async endWar() {
    if (!this.activeWar) return;

    console.log('[GuildWar] War ending...');

    // Calculate final scores
    await this.calculateFinalScores();

    // Determine winners
    const winners = await this.getTopGuilds(3);

    // Distribute rewards
    await this.distributeRewards(winners);

    // Update war status
    await prisma.guildWar.update({
      where: { id: this.activeWar.id },
      data: { status: 'COMPLETED' }
    });

    // Announce results
    await this.announceWarEnd(winners);

    this.activeWar = null;

    console.log('[GuildWar] War ended');
  }

  /**
   * Calculate final scores for all participants
   */
  async calculateFinalScores() {
    const participants = await prisma.guildWarParticipant.findMany({
      where: { warId: this.activeWar.id },
      include: {
        guild: {
          include: {
            members: {
              include: { character: true }
            }
          }
        },
        contributions: true
      }
    });

    for (const participant of participants) {
      let totalScore = 0;

      // Sum all contributions
      for (const contrib of participant.contributions) {
        totalScore += contrib.points;
      }

      // Update participant score
      await prisma.guildWarParticipant.update({
        where: { id: participant.id },
        data: { score: totalScore }
      });
    }
  }

  /**
   * Get top N guilds
   */
  async getTopGuilds(limit) {
    return await prisma.guildWarParticipant.findMany({
      where: { warId: this.activeWar.id },
      include: { guild: true },
      orderBy: { score: 'desc' },
      take: limit
    });
  }

  /**
   * Distribute rewards to winning guilds
   */
  async distributeRewards(winners) {
    const rewards = [
      { gold: 100000, chest: 'Legendary Guild Chest' },
      { gold: 50000, chest: 'Epic Guild Chest' },
      { gold: 25000, chest: 'Rare Guild Chest' }
    ];

    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i];
      const reward = rewards[i];

      // Add gold to guild storage
      await prisma.guild.update({
        where: { id: winner.guildId },
        data: { gold: { increment: reward.gold } }
      });

      // Add chest to guild inventory (assuming guild storage system exists)
      // TODO: Implement guild storage chest addition

      console.log(`[GuildWar] Rewarded ${winner.guild.name}: ${reward.gold} gold + ${reward.chest}`);
    }
  }

  /**
   * Announce war end and winners
   */
  async announceWarEnd(winners) {
    const guilds = this.client.guilds.cache;

    const rankings = winners.map((w, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      return `${medals[i]} **${w.guild.name}** - ${w.score.toLocaleString()} points`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 GUILD WAR CONCLUDED! 🏆')
      .setDescription(
        `**Season:** ${this.activeWar.season}\n\n` +
        `**Final Rankings:**\n${rankings}\n\n` +
        `**Rewards have been distributed!**\n` +
        `Check your guild storage with \`/guild storage\`\n\n` +
        `See you next weekend for another epic battle!`
      )
      .setColor(0xffd700)
      .setTimestamp()
      .setFooter({ text: 'Congratulations to all participants!' });

    for (const [, guild] of guilds) {
      try {
        const channel = guild.channels.cache.find(
          ch => ch.name.includes('general') || ch.name.includes('announcements')
        ) || guild.channels.cache.find(ch => ch.isTextBased());

        if (channel && channel.isTextBased()) {
          await channel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error(`[GuildWar] Failed to announce results in guild ${guild.name}:`, error);
      }
    }
  }

  /**
   * Record a contribution
   */
  async recordContribution(characterId, type, value) {
    if (!this.activeWar) return;

    // Get character's guild
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: { guildMember: { include: { guild: true } } }
    });

    if (!character || !character.guildMember) {
      return; // Not in a guild
    }

    // Get participant
    const participant = await prisma.guildWarParticipant.findFirst({
      where: {
        warId: this.activeWar.id,
        guildId: character.guildMember.guildId
      }
    });

    if (!participant) {
      console.error('[GuildWar] Participant not found');
      return;
    }

    // Calculate points based on contribution type
    const points = this.calculatePoints(type, value);

    // Record contribution
    await prisma.guildWarContribution.create({
      data: {
        participantId: participant.id,
        characterId,
        type,
        value,
        points
      }
    });

    // Update participant score
    await prisma.guildWarParticipant.update({
      where: { id: participant.id },
      data: { score: { increment: points } }
    });

    console.log(`[GuildWar] ${character.name} contributed ${points} points (${type}: ${value})`);
  }

  /**
   * Calculate points from contribution
   */
  calculatePoints(type, value) {
    const multipliers = {
      MONSTER_KILL: 1,
      BOSS_KILL: 50,
      RESOURCE_GATHER: 0.1,
      GOLD_DONATE: 0.01,
      QUEST_COMPLETE: 10
    };

    return Math.floor((multipliers[type] || 1) * value);
  }

  /**
   * Get current leaderboard
   */
  async getLeaderboard() {
    if (!this.activeWar) {
      return null;
    }

    const participants = await prisma.guildWarParticipant.findMany({
      where: { warId: this.activeWar.id },
      include: { guild: true },
      orderBy: { score: 'desc' },
      take: 10
    });

    return {
      war: this.activeWar,
      participants
    };
  }

  /**
   * Get guild's rank and contribution details
   */
  async getGuildStatus(guildId) {
    if (!this.activeWar) {
      return null;
    }

    const participant = await prisma.guildWarParticipant.findFirst({
      where: {
        warId: this.activeWar.id,
        guildId
      },
      include: {
        guild: true,
        contributions: {
          include: { character: true },
          orderBy: { points: 'desc' },
          take: 10
        }
      }
    });

    if (!participant) {
      return null;
    }

    // Get rank
    const rank = await prisma.guildWarParticipant.count({
      where: {
        warId: this.activeWar.id,
        score: { gt: participant.score }
      }
    }) + 1;

    return {
      war: this.activeWar,
      participant,
      rank
    };
  }

  /**
   * Get week number for season identifier
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
}

module.exports = GuildWarSystem;
