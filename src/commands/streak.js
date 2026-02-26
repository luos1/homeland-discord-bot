const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streak')
    .setNameLocalizations({ "en-US": 'streak' })
    .setDescription('연속 로그인 보너스 확인 및 수령')
    .setDescriptionLocalizations({ "en-US": 'Check and claim daily login streak rewards' }),

  async execute(interaction, { prisma }) {
    const userId = interaction.user.id;

    // 캐릭터 조회
    const character = await prisma.character.findUnique({
      where: { userId }
    });

    if (!character) {
      return interaction.reply({
        content: '❌ 먼저 `/create`로 캐릭터를 생성하세요!',
        ephemeral: true
      });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let lastLogin = character.lastLoginDate ? new Date(character.lastLoginDate) : null;
    let lastLoginDay = lastLogin ? new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate()) : null;
    
    let currentStreak = character.loginStreak || 0;
    let longestStreak = character.longestStreak || 0;
    let lastReward = character.lastDailyRewardClaimed ? new Date(character.lastDailyRewardClaimed) : null;
    let lastRewardDay = lastReward ? new Date(lastReward.getFullYear(), lastReward.getMonth(), lastReward.getDate()) : null;

    // 연속 로그인 계산
    let canClaimReward = false;
    let streakBroken = false;

    if (!lastLoginDay) {
      // 첫 로그인
      currentStreak = 1;
      canClaimReward = true;
    } else {
      const dayDiff = Math.floor((today - lastLoginDay) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === 0) {
        // 오늘 이미 로그인함
        if (!lastRewardDay || lastRewardDay < today) {
          canClaimReward = true;
        }
      } else if (dayDiff === 1) {
        // 어제 로그인 → 연속
        currentStreak += 1;
        canClaimReward = true;
      } else {
        // 연속 끊김
        currentStreak = 1;
        canClaimReward = true;
        streakBroken = true;
      }
    }

    // 최장 연속 갱신
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    // 보상 계산
    const rewards = calculateStreakRewards(currentStreak);
    
    // 마일스톤 체크
    const milestones = checkMilestones(currentStreak);

    // 업데이트 (보상 수령 시)
    if (canClaimReward && interaction.options?.getBoolean?.('claim') !== false) {
      await prisma.character.update({
        where: { userId },
        data: {
          loginStreak: currentStreak,
          longestStreak: longestStreak,
          lastLoginDate: now,
          lastDailyRewardClaimed: now,
          gold: { increment: rewards.gold },
          gems: { increment: rewards.gems },
          xp: { increment: rewards.xp }
        }
      });
    } else {
      // 로그인만 기록 (보상 미수령)
      await prisma.character.update({
        where: { userId },
        data: {
          loginStreak: currentStreak,
          longestStreak: longestStreak,
          lastLoginDate: now
        }
      });
    }

    // Embed 생성
    const embed = new EmbedBuilder()
      .setColor(canClaimReward ? 0x2ECC71 : 0x3498DB)
      .setTitle('🔥 연속 로그인')
      .setDescription([
        streakBroken ? '⚠️ 연속 로그인이 끊겼습니다! 다시 시작하세요.' : '',
        '',
        `**현재 연속:** ${currentStreak}일 🔥`,
        `**최장 연속:** ${longestStreak}일 🏆`,
        '',
        canClaimReward && interaction.options?.getBoolean?.('claim') !== false
          ? '**✅ 오늘의 보상을 받았습니다!**'
          : '**⏳ 오늘의 보상을 아직 받지 않았습니다.**'
      ].filter(Boolean).join('\n'));

    // 보상 표시
    if (canClaimReward) {
      embed.addFields({
        name: '🎁 오늘의 보상',
        value: [
          `💰 골드: +${rewards.gold}`,
          `💎 젬: +${rewards.gems}`,
          `⭐ 경험치: +${rewards.xp}`
        ].join('\n'),
        inline: true
      });
    }

    // 마일스톤 표시
    if (milestones.length > 0) {
      embed.addFields({
        name: '🏆 마일스톤 달성!',
        value: milestones.map(m => `${m.emoji} ${m.name}: ${m.reward}`).join('\n'),
        inline: false
      });
    }

    // 다음 마일스톤
    const nextMilestone = getNextMilestone(currentStreak);
    if (nextMilestone) {
      embed.addFields({
        name: '🎯 다음 마일스톤',
        value: `${nextMilestone.day}일차 - ${nextMilestone.reward}`,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};

function calculateStreakRewards(streak) {
  // 기본 보상
  let gold = 100;
  let gems = 10;
  let xp = 50;

  // 연속 일수에 따라 보상 증가 (최대 7배)
  const multiplier = Math.min(1 + (streak - 1) * 0.2, 7);
  
  gold = Math.floor(gold * multiplier);
  gems = Math.floor(gems * multiplier);
  xp = Math.floor(xp * multiplier);

  return { gold, gems, xp };
}

function checkMilestones(streak) {
  const milestones = [];
  
  if (streak === 7) {
    milestones.push({
      emoji: '🎉',
      name: '7일 연속',
      reward: '보너스 500 골드, 100 젬'
    });
  }
  
  if (streak === 30) {
    milestones.push({
      emoji: '🏆',
      name: '30일 연속',
      reward: '전설 상자, 2000 골드, 500 젬'
    });
  }

  if (streak === 100) {
    milestones.push({
      emoji: '👑',
      name: '100일 연속',
      reward: '신화 상자, 10000 골드, 2000 젬'
    });
  }

  return milestones;
}

function getNextMilestone(currentStreak) {
  const milestones = [
    { day: 7, reward: '🎉 보너스 500 골드, 100 젬' },
    { day: 30, reward: '🏆 전설 상자, 2000 골드, 500 젬' },
    { day: 100, reward: '👑 신화 상자, 10000 골드, 2000 젬' }
  ];

  for (const milestone of milestones) {
    if (currentStreak < milestone.day) {
      return milestone;
    }
  }

  return null;
}
