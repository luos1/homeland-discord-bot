const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('progress')
    .setNameLocalizations({ "en-US": 'progress' })
    .setDescription('전체 진행률 및 업적 확인')
    .setDescriptionLocalizations({ "en-US": 'Check overall progress and achievements' }),

  async execute(interaction, { prisma }) {
    const userId = interaction.user.id;

    // 캐릭터 조회
    const character = await prisma.character.findUnique({
      where: { userId },
      include: {
        equipment: true,
        skills: true,
        resources: true
      }
    });

    if (!character) {
      return interaction.reply({
        content: '❌ 먼저 `/create`로 캐릭터를 생성하세요!',
        ephemeral: true
      });
    }

    // 온보딩 진행률
    const onboarding = await prisma.onboardingProgress.findUnique({
      where: { userId }
    });

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`📊 ${character.name}의 진행률`)
      .setDescription('캐릭터의 전체 진행 상황을 확인하세요');

    // 1. 레벨 진행률
    const nextLevelXp = calculateXpForLevel(character.level + 1);
    const levelProgress = Math.floor((character.xp / nextLevelXp) * 100);
    
    embed.addFields({
      name: '⭐ 레벨 진행',
      value: [
        `레벨 ${character.level} → ${character.level + 1}`,
        `${character.xp}/${nextLevelXp} XP (${levelProgress}%)`,
        progressBar(levelProgress, 10)
      ].join('\n'),
      inline: false
    });

    // 2. 전투 업적
    const combatAchievements = getCombatAchievements(character);
    if (combatAchievements.length > 0) {
      embed.addFields({
        name: '⚔️ 전투 업적',
        value: combatAchievements.map(a => 
          `${a.icon} ${a.name}: ${a.progress}/${a.target} (${a.percentage}%)\n${progressBar(a.percentage, 8)}`
        ).join('\n\n'),
        inline: false
      });
    }

    // 3. 생산 진행률
    if (character.productionClass) {
      const productionProgress = getProductionProgress(character);
      embed.addFields({
        name: '🛠️ 생산 진행',
        value: productionProgress.map(p =>
          `${p.icon} ${p.name}: 레벨 ${p.level}\n${progressBar(p.percentage, 8)}`
        ).join('\n\n'),
        inline: false
      });
    }

    // 4. 수집 업적
    const collectionAchievements = getCollectionAchievements(character);
    if (collectionAchievements.length > 0) {
      embed.addFields({
        name: '📦 수집 업적',
        value: collectionAchievements.map(a =>
          `${a.icon} ${a.name}: ${a.count}개\n${progressBar(a.percentage, 8)}`
        ).join('\n\n'),
        inline: false
      });
    }

    // 5. 연속 로그인
    if (character.loginStreak > 0) {
      const streakProgress = getStreakProgress(character.loginStreak);
      embed.addFields({
        name: '🔥 연속 로그인',
        value: [
          `현재: ${character.loginStreak}일`,
          `최장: ${character.longestStreak}일`,
          `다음 마일스톤: ${streakProgress.next}일 (${streakProgress.remaining}일 남음)`
        ].join('\n'),
        inline: false
      });
    }

    // 6. 전체 완성도
    const overallCompletion = calculateOverallCompletion(character, onboarding);
    embed.addFields({
      name: '🏆 전체 완성도',
      value: [
        `${overallCompletion}%`,
        progressBar(overallCompletion, 20)
      ].join('\n'),
      inline: false
    });

    await interaction.reply({ embeds: [embed] });
  }
};

function progressBar(percentage, length = 10) {
  const filled = Math.floor((percentage / 100) * length);
  const empty = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

function calculateXpForLevel(level) {
  // 레벨당 필요 경험치 공식
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function getCombatAchievements(character) {
  const achievements = [];

  // 전투 승리
  achievements.push({
    icon: '🏅',
    name: '전투 승리',
    progress: character.battleWins,
    target: 100,
    percentage: Math.min(100, Math.floor((character.battleWins / 100) * 100))
  });

  // 연승
  if (character.maxWinStreak > 0) {
    achievements.push({
      icon: '🔥',
      name: '최대 연승',
      progress: character.maxWinStreak,
      target: 10,
      percentage: Math.min(100, Math.floor((character.maxWinStreak / 10) * 100))
    });
  }

  // 보스 처치
  if (character.bossKills > 0) {
    achievements.push({
      icon: '👑',
      name: '보스 처치',
      progress: character.bossKills,
      target: 20,
      percentage: Math.min(100, Math.floor((character.bossKills / 20) * 100))
    });
  }

  return achievements;
}

function getProductionProgress(character) {
  const progress = [];

  if (character.productionClass === 'gatherer' || character.productionClass === 'forager') {
    const nextLevel = character.productionLevel + 1;
    const xpNeeded = calculateXpForLevel(nextLevel);
    const percentage = Math.floor((character.productionXp / xpNeeded) * 100);

    progress.push({
      icon: '⛏️',
      name: '채집 레벨',
      level: character.productionLevel,
      percentage
    });
  }

  if (character.productionClass === 'blacksmith' || character.productionClass === 'weaponsmith') {
    const nextLevel = character.productionLevel + 1;
    const xpNeeded = calculateXpForLevel(nextLevel);
    const percentage = Math.floor((character.productionXp / xpNeeded) * 100);

    progress.push({
      icon: '🔨',
      name: '대장장이 레벨',
      level: character.productionLevel,
      percentage
    });
  }

  if (character.productionClass === 'alchemist' || character.productionClass === 'sage') {
    const nextLevel = character.productionLevel + 1;
    const xpNeeded = calculateXpForLevel(nextLevel);
    const percentage = Math.floor((character.productionXp / xpNeeded) * 100);

    progress.push({
      icon: '🧪',
      name: '연금술 레벨',
      level: character.productionLevel,
      percentage
    });
  }

  return progress;
}

function getCollectionAchievements(character) {
  const achievements = [];

  // 장비 수집
  if (character.equipment && character.equipment.length > 0) {
    const equipCount = character.equipment.length;
    achievements.push({
      icon: '⚔️',
      name: '장비 수집',
      count: equipCount,
      percentage: Math.min(100, Math.floor((equipCount / 50) * 100))
    });
  }

  // 스킬 수집
  if (character.skills && character.skills.length > 0) {
    const skillCount = character.skills.length;
    achievements.push({
      icon: '📜',
      name: '스킬 수집',
      count: skillCount,
      percentage: Math.min(100, Math.floor((skillCount / 20) * 100))
    });
  }

  // 자원 수집
  if (character.resources && character.resources.length > 0) {
    const resourceCount = character.resources.length;
    achievements.push({
      icon: '📦',
      name: '자원 수집',
      count: resourceCount,
      percentage: Math.min(100, Math.floor((resourceCount / 30) * 100))
    });
  }

  return achievements;
}

function getStreakProgress(currentStreak) {
  const milestones = [7, 30, 100];
  
  for (const milestone of milestones) {
    if (currentStreak < milestone) {
      return {
        next: milestone,
        remaining: milestone - currentStreak
      };
    }
  }

  return {
    next: 365,
    remaining: 365 - currentStreak
  };
}

function calculateOverallCompletion(character, onboarding) {
  let total = 0;
  let count = 0;

  // 레벨 (최대 100레벨 기준 20% 가중치)
  const levelCompletion = Math.min(100, (character.level / 100) * 100);
  total += levelCompletion * 0.2;
  count += 0.2;

  // 전투 (100승 기준 15% 가중치)
  const battleCompletion = Math.min(100, (character.battleWins / 100) * 100);
  total += battleCompletion * 0.15;
  count += 0.15;

  // 온보딩 (10% 가중치)
  if (onboarding) {
    const onboardingCompletion = onboarding.tutorialCompleted ? 100 : 0;
    total += onboardingCompletion * 0.1;
    count += 0.1;
  }

  // 생산 (10% 가중치)
  if (character.productionClass) {
    const productionCompletion = Math.min(100, (character.productionLevel / 50) * 100);
    total += productionCompletion * 0.1;
    count += 0.1;
  }

  // 장비 (15% 가중치)
  const equipCompletion = Math.min(100, (character.equipment?.length || 0 / 50) * 100);
  total += equipCompletion * 0.15;
  count += 0.15;

  // 스킬 (10% 가중치)
  const skillCompletion = Math.min(100, (character.skills?.length || 0 / 20) * 100);
  total += skillCompletion * 0.1;
  count += 0.1;

  // 연속 로그인 (10% 가중치)
  const streakCompletion = Math.min(100, (character.loginStreak / 30) * 100);
  total += streakCompletion * 0.1;
  count += 0.1;

  // 보스 (10% 가중치)
  const bossCompletion = Math.min(100, (character.bossKills / 20) * 100);
  total += bossCompletion * 0.1;
  count += 0.1;

  return Math.floor(total / count);
}
