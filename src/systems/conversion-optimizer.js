/**
 * Premium Conversion Optimizer
 * 
 * 목표: 15% 프리미엄 전환율 달성
 * - 신규 유저 자동 온보딩
 * - 프리미엄 가치 제안 타이밍 최적화
 * - 이탈 방지 리텐션 시스템
 * - 전환 퍼널 추적
 * 
 * Target: 200 premium subscribers = $2,000/month
 */

const { EmbedBuilder } = require('discord.js');
const prisma = require('../database');

class ConversionOptimizer {
  constructor(client) {
    this.client = client;
    
    // 전환 퍼널 단계
    this.funnelStages = {
      JOINED: 'joined',               // 서버 가입
      CREATED: 'created_character',   // 캐릭터 생성
      FIRST_HUNT: 'first_hunt',        // 첫 사냥
      LEVEL_5: 'reached_level_5',      // 레벨 5 달성
      JOINED_GUILD: 'joined_guild',    // 길드 가입
      FIRST_PVP: 'first_pvp',          // 첫 PvP
      PREMIUM_SHOWN: 'premium_shown',  // 프리미엄 홍보 노출
      PREMIUM_SUBSCRIBED: 'premium_subscribed'  // 프리미엄 구독
    };
    
    // 프리미엄 홍보 트리거 (최적 타이밍)
    this.premiumTriggers = [
      { stage: 'LEVEL_5', message: 'level5_premium', delay: 0 },
      { stage: 'FIRST_DEATH', message: 'death_premium', delay: 5000 },
      { stage: 'SHOP_EXPENSIVE', message: 'shop_premium', delay: 0 },
      { stage: 'DAILY_STREAK_7', message: 'streak_premium', delay: 0 },
      { stage: 'GUILD_WAR_LOSS', message: 'guildwar_premium', delay: 10000 }
    ];
  }
  
  /**
   * 신규 유저 온보딩 시작
   */
  async onUserJoin(userId, guildId) {
    try {
      await this.trackFunnelStage(userId, this.funnelStages.JOINED);
      
      // 환영 메시지 (DM)
      const user = await this.client.users.fetch(userId);
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('🎮 Welcome to Homeland RPG!')
        .setDescription(
          'Transform your Discord server into an epic RPG adventure!\n\n' +
          '**Get started in 3 easy steps:**\n' +
          '1️⃣ Use `/create` to create your character\n' +
          '2️⃣ Try `/hunt` to battle your first monster\n' +
          '3️⃣ Join a guild with `/guild create` or `/guild join`\n\n' +
          '**🎁 New Player Bonus:**\n' +
          '• 1,000 starting gold\n' +
          '• Free beginner equipment\n' +
          '• 7-day daily login rewards\n\n' +
          '**💎 Premium Features Available:**\n' +
          'Unlock exclusive perks for $9.99/month (details: `/premium`)'
        )
        .setColor(0x00ff00)
        .setFooter({ text: 'Type /help anytime for assistance' });
      
      await user.send({ embeds: [welcomeEmbed] }).catch(() => {
        // User has DMs disabled - no problem
      });
      
      // 24시간 후 팔로우업 (캐릭터 생성 안 했으면)
      setTimeout(() => this.followUpNewUser(userId), 24 * 60 * 60 * 1000);
      
    } catch (error) {
      console.error('Onboarding error:', error);
    }
  }
  
  /**
   * 캐릭터 생성 완료
   */
  async onCharacterCreated(userId, characterId) {
    await this.trackFunnelStage(userId, this.funnelStages.CREATED);
    
    // 축하 메시지 + 다음 단계 안내
    const user = await this.client.users.fetch(userId);
    const guideEmbed = new EmbedBuilder()
      .setTitle('✅ Character Created!')
      .setDescription(
        'Your adventure begins now!\n\n' +
        '**What to do next:**\n' +
        '🗡️ `/hunt` - Battle monsters and gain XP\n' +
        '🏪 `/shop` - Buy better equipment\n' +
        '🏰 `/guild` - Join or create a guild\n' +
        '⚔️ `/arena` - Challenge other players\n\n' +
        '**Tips for success:**\n' +
        '• Fight monsters close to your level\n' +
        '• Upgrade equipment regularly\n' +
        '• Join a guild for bonus XP\n' +
        '• Complete daily quests for rewards'
      )
      .setColor(0x00aaff);
    
    await user.send({ embeds: [guideEmbed] }).catch(() => {});
  }
  
  /**
   * 레벨 5 달성 - 첫 프리미엄 홍보
   */
  async onLevelReached(userId, level) {
    if (level === 5) {
      await this.trackFunnelStage(userId, this.funnelStages.LEVEL_5);
      await this.showPremiumOffer(userId, 'level5_premium');
    }
  }
  
  /**
   * 프리미엄 제안 (타이밍 최적화)
   */
  async showPremiumOffer(userId, triggerType) {
    try {
      // 이미 프리미엄이면 스킵
      const subscription = await prisma.subscription.findUnique({
        where: { userId: BigInt(userId) }
      });
      
      if (subscription && subscription.active) {
        return;
      }
      
      // 프리미엄 홍보 노출 추적
      await this.trackFunnelStage(userId, this.funnelStages.PREMIUM_SHOWN, {
        trigger: triggerType
      });
      
      const user = await this.client.users.fetch(userId);
      
      // 트리거별 맞춤 메시지
      const messages = {
        level5_premium: {
          title: '🎉 Congratulations on Level 5!',
          description: 
            'You\'re making great progress! Ready to level up **even faster**?\n\n' +
            '**💎 Homeland Premium - $9.99/month**\n\n' +
            '**Exclusive Benefits:**\n' +
            '✨ **20% XP Boost** - Level up faster\n' +
            '💰 **15% Gold Boost** - Get richer quicker\n' +
            '💎 **Daily Gems** - 100 gems every day\n' +
            '🎯 **Reduced Bidding Costs** - 50% off field boss bids\n' +
            '🏆 **Premium Field Bosses** - Exclusive legendary loot\n' +
            '📅 **No Attendance Cooldown** - Daily rewards anytime\n\n' +
            '**Limited Time:** First month 20% off!\n\n' +
            '> 💡 **Not pay-to-win** - Premium = convenience, not power'
        },
        
        death_premium: {
          title: '💀 Tough Battle!',
          description:
            'That was a close one! Want to **bounce back faster**?\n\n' +
            '**💎 Premium Perks:**\n' +
            '• 20% XP Boost - Re-level quickly\n' +
            '• Better shop prices - Upgrade gear\n' +
            '• Daily gems - Buy healing potions\n\n' +
            'Only $9.99/month\n\n' +
            '`/premium` to learn more!'
        },
        
        shop_premium: {
          title: '💰 Need More Gold?',
          description:
            'That item is pricey! **Premium members** earn gold 15% faster.\n\n' +
            '**💎 Premium Benefits:**\n' +
            '• 15% Gold Boost\n' +
            '• 15% Better shop prices\n' +
            '• Daily 100 gems\n\n' +
            'Just $9.99/month\n\n' +
            '`/premium` for details'
        },
        
        streak_premium: {
          title: '🔥 7-Day Streak!',
          description:
            'You\'re dedicated! **Premium members** never miss rewards.\n\n' +
            '**💎 Premium Perk:**\n' +
            '• Use `/attend` anytime (no 20-hour cooldown)\n' +
            '• Never miss daily rewards\n' +
            '• 2x daily quest rewards\n\n' +
            '$9.99/month\n\n' +
            '`/premium` to subscribe'
        }
      };
      
      const msg = messages[triggerType] || messages.level5_premium;
      
      const premiumEmbed = new EmbedBuilder()
        .setTitle(msg.title)
        .setDescription(msg.description)
        .setColor(0xffd700)
        .setFooter({ text: 'Use /premium to subscribe • Cancel anytime' });
      
      await user.send({ embeds: [premiumEmbed] }).catch(() => {});
      
    } catch (error) {
      console.error('Premium offer error:', error);
    }
  }
  
  /**
   * 이탈 방지 - 3일 미접속 유저
   */
  async retentionCheck() {
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      
      // 3일 미접속 유저 찾기
      const inactiveUsers = await prisma.character.findMany({
        where: {
          lastActive: {
            lt: threeDaysAgo,
            gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7일 이내
          }
        },
        include: {
          subscription: true
        }
      });
      
      for (const char of inactiveUsers) {
        // 프리미엄 유저는 더 적극적으로 리텐션
        if (char.subscription && char.subscription.active) {
          await this.winBackPremiumUser(char.userId.toString());
        } else {
          await this.winBackFreeUser(char.userId.toString());
        }
      }
      
    } catch (error) {
      console.error('Retention check error:', error);
    }
  }
  
  /**
   * 무료 유저 복귀 유도
   */
  async winBackFreeUser(userId) {
    try {
      const user = await this.client.users.fetch(userId);
      
      const winbackEmbed = new EmbedBuilder()
        .setTitle('🎮 Miss You in Homeland!')
        .setDescription(
          'Haven\'t seen you in a few days! Here\'s what you\'re missing:\n\n' +
          '**🎁 Comeback Bonus:**\n' +
          '• 500 bonus gold\n' +
          '• Free healing potion\n' +
          '• Double XP for next 10 battles\n\n' +
          '**New This Week:**\n' +
          '• New field boss: Ice Dragon\n' +
          '• Guild war event this weekend\n' +
          '• Limited time shop discounts\n\n' +
          'Jump back in: `/hunt` to start!'
        )
        .setColor(0x00ff00);
      
      await user.send({ embeds: [winbackEmbed] }).catch(() => {});
      
    } catch (error) {
      console.error('Winback error:', error);
    }
  }
  
  /**
   * 프리미엄 유저 복귀 유도 (더 적극적)
   */
  async winBackPremiumUser(userId) {
    try {
      const user = await this.client.users.fetch(userId);
      
      const vipEmbed = new EmbedBuilder()
        .setTitle('💎 VIP - We Miss You!')
        .setDescription(
          'Hey Premium member! Your subscription is still active.\n\n' +
          '**🎁 VIP Comeback Gift:**\n' +
          '• 1,000 bonus gold\n' +
          '• 200 gems\n' +
          '• Legendary loot box\n' +
          '• 3x XP boost (24 hours)\n\n' +
          '**Exclusive This Week:**\n' +
          '• Premium-only field boss\n' +
          '• VIP guild war rewards\n' +
          '• Limited mythic equipment\n\n' +
          'Your premium perks are waiting!'
        )
        .setColor(0xffd700);
      
      await user.send({ embeds: [vipEmbed] }).catch(() => {});
      
    } catch (error) {
      console.error('VIP winback error:', error);
    }
  }
  
  /**
   * 퍼널 단계 추적
   */
  async trackFunnelStage(userId, stage, metadata = {}) {
    try {
      await prisma.funnelEvent.create({
        data: {
          userId: BigInt(userId),
          stage,
          metadata: JSON.stringify(metadata),
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Funnel tracking error:', error);
    }
  }
  
  /**
   * 전환율 분석
   */
  async analyzeConversionRate() {
    try {
      const totalUsers = await prisma.character.count();
      const premiumUsers = await prisma.subscription.count({
        where: { active: true }
      });
      
      const conversionRate = totalUsers > 0 
        ? (premiumUsers / totalUsers * 100).toFixed(2) 
        : 0;
      
      // 퍼널별 전환율
      const funnelStats = {};
      for (const [key, stage] of Object.entries(this.funnelStages)) {
        const count = await prisma.funnelEvent.count({
          where: { stage },
          distinct: ['userId']
        });
        funnelStats[key] = count;
      }
      
      return {
        totalUsers,
        premiumUsers,
        conversionRate: parseFloat(conversionRate),
        funnelStats,
        targetRate: 15.0,
        targetUsers: 200,
        revenue: premiumUsers * 9.99
      };
    } catch (error) {
      console.error('Conversion analysis error:', error);
      return null;
    }
  }
  
  /**
   * 24시간 후 팔로우업
   */
  async followUpNewUser(userId) {
    try {
      const character = await prisma.character.findUnique({
        where: { userId: BigInt(userId) }
      });
      
      // 캐릭터 생성 안 했으면 리마인더
      if (!character) {
        const user = await this.client.users.fetch(userId);
        const reminderEmbed = new EmbedBuilder()
          .setTitle('👋 Ready to Start Your Adventure?')
          .setDescription(
            'You haven\'t created your character yet!\n\n' +
            '**It only takes 10 seconds:**\n' +
            '1. Use `/create`\n' +
            '2. Choose your class\n' +
            '3. Start hunting!\n\n' +
            '**New player bonus waiting:**\n' +
            '• 1,000 gold\n' +
            '• Free equipment\n' +
            '• 7-day rewards\n\n' +
            'Start now: `/create`'
          )
          .setColor(0xff6600);
        
        await user.send({ embeds: [reminderEmbed] }).catch(() => {});
      }
    } catch (error) {
      console.error('Follow-up error:', error);
    }
  }
  
  /**
   * 매일 실행 - 리텐션 체크
   */
  startDailyRetention() {
    // 매일 오전 10시에 실행
    setInterval(() => {
      this.retentionCheck();
    }, 24 * 60 * 60 * 1000);
    
    // 즉시 한 번 실행
    this.retentionCheck();
  }
}

module.exports = ConversionOptimizer;
