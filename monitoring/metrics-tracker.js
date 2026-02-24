#!/usr/bin/env node
/**
 * Homeland Metrics Tracker
 * 
 * 목표: $2,000/월 달성 추적
 * - 서버 수
 * - 유저 수
 * - 프리미엄 구독자
 * - 일일 수익
 * - 목표 달성률
 * 
 * Discord #비서보고 채널에 자동 리포트
 */

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// 설정
const CONFIG = {
  // Discord 리포트 채널
  reportChannelId: '1466630279732133988', // #비서보고
  
  // 목표
  goals: {
    monthlyRevenue: 2000, // $2,000/월
    premiumPrice: 9.99, // $9.99/월
    requiredSubscribers: 200, // 200명
    profitMargin: 0.93, // 93% (Stripe 3% + 호스팅 $70)
    
    milestones: [
      { subscribers: 5, revenue: 49.95, label: '첫 수익!' },
      { subscribers: 20, revenue: 199.80, label: '호스팅 비용 회수' },
      { subscribers: 50, revenue: 499.50, label: '25% 달성' },
      { subscribers: 100, revenue: 999.00, label: '50% 달성' },
      { subscribers: 150, revenue: 1498.50, label: '75% 달성' },
      { subscribers: 200, revenue: 1998.00, label: '🎯 목표 달성!' }
    ]
  },
  
  // 데이터 파일
  dataFile: path.join(__dirname, 'metrics-data.json'),
  historyFile: path.join(__dirname, 'metrics-history.json')
};

class MetricsTracker {
  constructor() {
    this.data = this.loadData();
    this.history = this.loadHistory();
  }
  
  // 데이터 로드
  loadData() {
    try {
      if (fs.existsSync(CONFIG.dataFile)) {
        return JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf8'));
      }
    } catch (error) {
      console.error('Data load error:', error);
    }
    
    return {
      servers: 0,
      totalUsers: 0,
      activeUsers: 0,
      premiumSubscribers: 0,
      totalCharacters: 0,
      totalGuilds: 0,
      totalCommands: 0,
      lastUpdated: null
    };
  }
  
  // 히스토리 로드
  loadHistory() {
    try {
      if (fs.existsSync(CONFIG.historyFile)) {
        return JSON.parse(fs.readFileSync(CONFIG.historyFile, 'utf8'));
      }
    } catch (error) {
      console.error('History load error:', error);
    }
    
    return [];
  }
  
  // 데이터 저장
  saveData() {
    try {
      fs.writeFileSync(CONFIG.dataFile, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Data save error:', error);
    }
  }
  
  // 히스토리 저장
  saveHistory() {
    try {
      // 최근 90일만 유지
      if (this.history.length > 90) {
        this.history = this.history.slice(-90);
      }
      fs.writeFileSync(CONFIG.historyFile, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error('History save error:', error);
    }
  }
  
  // 메트릭 업데이트
  async updateMetrics(client) {
    console.log('📊 Updating metrics...');
    
    // Discord 클라이언트에서 데이터 수집
    this.data.servers = client.guilds.cache.size;
    this.data.totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    
    // TODO: 데이터베이스에서 가져오기
    // const db = await getDatabase();
    // this.data.totalCharacters = await db.character.count();
    // this.data.totalGuilds = await db.guild.count();
    // this.data.premiumSubscribers = await db.subscription.count({ where: { active: true } });
    // this.data.activeUsers = await db.character.count({
    //   where: { lastActive: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    // });
    
    this.data.lastUpdated = Date.now();
    this.saveData();
    
    // 히스토리에 추가 (일일 스냅샷)
    const today = new Date().toISOString().split('T')[0];
    const lastEntry = this.history[this.history.length - 1];
    
    if (!lastEntry || lastEntry.date !== today) {
      this.history.push({
        date: today,
        ...this.data
      });
      this.saveHistory();
    }
    
    console.log('✅ Metrics updated');
  }
  
  // 수익 계산
  calculateRevenue() {
    const monthlyRevenue = this.data.premiumSubscribers * CONFIG.goals.premiumPrice;
    const stripeFee = monthlyRevenue * 0.03; // 3%
    const hostingCost = 70; // $70/월
    const netProfit = monthlyRevenue - stripeFee - hostingCost;
    
    return {
      gross: monthlyRevenue,
      stripeFee,
      hostingCost,
      net: Math.max(0, netProfit),
      margin: monthlyRevenue > 0 ? (netProfit / monthlyRevenue) * 100 : 0
    };
  }
  
  // 목표 달성률
  calculateProgress() {
    const { requiredSubscribers, monthlyRevenue } = CONFIG.goals;
    const subscriberProgress = (this.data.premiumSubscribers / requiredSubscribers) * 100;
    const revenue = this.calculateRevenue();
    const revenueProgress = (revenue.gross / monthlyRevenue) * 100;
    
    return {
      subscribers: subscriberProgress,
      revenue: revenueProgress
    };
  }
  
  // 다음 마일스톤
  getNextMilestone() {
    const { milestones } = CONFIG.goals;
    return milestones.find(m => m.subscribers > this.data.premiumSubscribers);
  }
  
  // 성장률 계산 (전일 대비)
  calculateGrowth() {
    if (this.history.length < 2) {
      return null;
    }
    
    const today = this.history[this.history.length - 1];
    const yesterday = this.history[this.history.length - 2];
    
    return {
      servers: today.servers - yesterday.servers,
      users: today.totalUsers - yesterday.totalUsers,
      subscribers: today.premiumSubscribers - yesterday.premiumSubscribers,
      characters: today.totalCharacters - yesterday.totalCharacters
    };
  }
  
  // 리포트 생성
  generateReport() {
    const revenue = this.calculateRevenue();
    const progress = this.calculateProgress();
    const nextMilestone = this.getNextMilestone();
    const growth = this.calculateGrowth();
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Homeland RPG - Daily Metrics')
      .setColor(progress.revenue >= 100 ? 0x00ff00 : 0x00aaff)
      .setTimestamp();
    
    // 목표 진행률
    embed.addFields({
      name: '🎯 목표 달성률',
      value: [
        `**수익:** $${revenue.gross.toFixed(2)} / $${CONFIG.goals.monthlyRevenue} (${progress.revenue.toFixed(1)}%)`,
        `**구독자:** ${this.data.premiumSubscribers} / ${CONFIG.goals.requiredSubscribers}명 (${progress.subscribers.toFixed(1)}%)`,
        `**순이익:** $${revenue.net.toFixed(2)} (마진 ${revenue.margin.toFixed(1)}%)`
      ].join('\n'),
      inline: false
    });
    
    // 다음 마일스톤
    if (nextMilestone) {
      const needed = nextMilestone.subscribers - this.data.premiumSubscribers;
      embed.addFields({
        name: '🏆 다음 마일스톤',
        value: [
          `**${nextMilestone.label}**`,
          `${nextMilestone.subscribers}명 구독 ($${nextMilestone.revenue.toFixed(2)}/월)`,
          `${needed}명 더 필요`
        ].join('\n'),
        inline: false
      });
    }
    
    // 현재 지표
    embed.addFields(
      {
        name: '🖥 서버',
        value: this.data.servers.toString(),
        inline: true
      },
      {
        name: '👥 유저',
        value: `${this.data.totalUsers} (활성 ${this.data.activeUsers})`,
        inline: true
      },
      {
        name: '⚔️ 캐릭터',
        value: this.data.totalCharacters.toString(),
        inline: true
      },
      {
        name: '🏰 길드',
        value: this.data.totalGuilds.toString(),
        inline: true
      },
      {
        name: '💎 프리미엄',
        value: `${this.data.premiumSubscribers}명`,
        inline: true
      },
      {
        name: '⚡ 명령어',
        value: this.data.totalCommands.toString(),
        inline: true
      }
    );
    
    // 전일 대비 성장
    if (growth) {
      const growthText = [
        growth.servers !== 0 ? `서버 ${growth.servers > 0 ? '+' : ''}${growth.servers}` : null,
        growth.users !== 0 ? `유저 ${growth.users > 0 ? '+' : ''}${growth.users}` : null,
        growth.subscribers !== 0 ? `구독 ${growth.subscribers > 0 ? '+' : ''}${growth.subscribers}` : null,
        growth.characters !== 0 ? `캐릭 ${growth.characters > 0 ? '+' : ''}${growth.characters}` : null
      ].filter(Boolean).join(' | ');
      
      if (growthText) {
        embed.addFields({
          name: '📈 전일 대비',
          value: growthText,
          inline: false
        });
      }
    }
    
    // 예상 목표 달성 시점
    if (this.data.premiumSubscribers > 0 && this.data.premiumSubscribers < CONFIG.goals.requiredSubscribers) {
      const daysOfData = this.history.length;
      if (daysOfData >= 7) {
        const weekAgo = this.history[this.history.length - 7];
        const weeklyGrowth = this.data.premiumSubscribers - weekAgo.premiumSubscribers;
        const dailyAvgGrowth = weeklyGrowth / 7;
        
        if (dailyAvgGrowth > 0) {
          const remaining = CONFIG.goals.requiredSubscribers - this.data.premiumSubscribers;
          const daysToGoal = Math.ceil(remaining / dailyAvgGrowth);
          const goalDate = new Date(Date.now() + daysToGoal * 24 * 60 * 60 * 1000);
          
          embed.addFields({
            name: '📅 예상 목표 달성',
            value: [
              `현재 속도: +${dailyAvgGrowth.toFixed(1)}명/일`,
              `예상 날짜: ${goalDate.toISOString().split('T')[0]} (${daysToGoal}일 후)`
            ].join('\n'),
            inline: false
          });
        }
      }
    }
    
    return embed;
  }
  
  // Discord에 리포트 전송
  async sendReport(client) {
    try {
      const channel = await client.channels.fetch(CONFIG.reportChannelId);
      if (!channel) {
        console.error('Report channel not found');
        return;
      }
      
      const embed = this.generateReport();
      await channel.send({ embeds: [embed] });
      
      console.log('✅ Report sent to Discord');
    } catch (error) {
      console.error('Failed to send report:', error);
    }
  }
  
  // 수동 메트릭 설정 (테스트용)
  setMetrics(data) {
    Object.assign(this.data, data);
    this.data.lastUpdated = Date.now();
    this.saveData();
  }
}

// CLI 실행
async function main() {
  const tracker = new MetricsTracker();
  
  // 인자 파싱
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'set') {
    // 테스트용 메트릭 설정
    // node metrics-tracker.js set servers=5 users=150 premium=3
    const updates = {};
    args.slice(1).forEach(arg => {
      const [key, value] = arg.split('=');
      updates[key] = parseInt(value) || 0;
    });
    
    tracker.setMetrics(updates);
    console.log('✅ Metrics updated:', updates);
    
  } else if (command === 'report') {
    // 리포트 출력 (Discord 전송 없이)
    const report = tracker.generateReport();
    console.log('\n' + JSON.stringify(report.toJSON(), null, 2));
    
  } else if (command === 'discord') {
    // Discord에 리포트 전송
    console.log('🤖 Connecting to Discord...');
    
    const client = new Client({
      intents: [GatewayIntentBits.Guilds]
    });
    
    client.once('ready', async () => {
      console.log('✅ Connected');
      await tracker.updateMetrics(client);
      await tracker.sendReport(client);
      client.destroy();
      process.exit(0);
    });
    
    client.login(process.env.DISCORD_TOKEN).catch(error => {
      console.error('Login failed:', error);
      process.exit(1);
    });
    
  } else {
    // 현재 상태 출력
    console.log('\n📊 Homeland RPG Metrics\n');
    
    const revenue = tracker.calculateRevenue();
    const progress = tracker.calculateProgress();
    const nextMilestone = tracker.getNextMilestone();
    
    console.log('🎯 목표 달성률:');
    console.log(`  수익: $${revenue.gross.toFixed(2)} / $${CONFIG.goals.monthlyRevenue} (${progress.revenue.toFixed(1)}%)`);
    console.log(`  구독자: ${tracker.data.premiumSubscribers} / ${CONFIG.goals.requiredSubscribers}명 (${progress.subscribers.toFixed(1)}%)`);
    console.log(`  순이익: $${revenue.net.toFixed(2)} (마진 ${revenue.margin.toFixed(1)}%)\n`);
    
    if (nextMilestone) {
      const needed = nextMilestone.subscribers - tracker.data.premiumSubscribers;
      console.log('🏆 다음 마일스톤:');
      console.log(`  ${nextMilestone.label}`);
      console.log(`  ${nextMilestone.subscribers}명 구독 ($${nextMilestone.revenue.toFixed(2)}/월)`);
      console.log(`  ${needed}명 더 필요\n`);
    }
    
    console.log('📈 현재 지표:');
    console.log(`  서버: ${tracker.data.servers}`);
    console.log(`  유저: ${tracker.data.totalUsers} (활성 ${tracker.data.activeUsers})`);
    console.log(`  캐릭터: ${tracker.data.totalCharacters}`);
    console.log(`  길드: ${tracker.data.totalGuilds}`);
    console.log(`  프리미엄: ${tracker.data.premiumSubscribers}명`);
    console.log(`  명령어: ${tracker.data.totalCommands}\n`);
    
    console.log('Commands:');
    console.log('  node metrics-tracker.js               - Show current metrics');
    console.log('  node metrics-tracker.js set [key=val] - Set test metrics');
    console.log('  node metrics-tracker.js report        - Generate report JSON');
    console.log('  node metrics-tracker.js discord       - Send report to Discord');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MetricsTracker, CONFIG };
