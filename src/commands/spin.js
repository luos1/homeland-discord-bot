const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { EMBED_COLORS, formatNumber, createDivider } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');
const { resolvePremiumBenefits } = require('../game/premium');
const { generateEquipment, RARITIES } = require('../game/equipment');

// KST timezone offset
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getDateKeyInKST(now = new Date()) {
  const kstDate = new Date(now.getTime() + KST_OFFSET_MS);
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 룰렛 보상 확률 테이블
const ROULETTE_REWARDS = [
  { type: 'gold', amount: 100, weight: 40, emoji: '💰', label: '골드 100G' },
  { type: 'gold', amount: 500, weight: 30, emoji: '💰', label: '골드 500G' },
  { type: 'gold', amount: 1000, weight: 15, emoji: '💵', label: '골드 1,000G' },
  { type: 'gems', amount: 10, weight: 10, emoji: '💎', label: '젬 10개' },
  { type: 'box', rarity: 'rare', weight: 4, emoji: '🎁', label: '레어 상자' },
  { type: 'box', rarity: 'epic', weight: 0.9, emoji: '✨', label: '에픽 상자' },
  { type: 'box', rarity: 'legendary', weight: 0.1, emoji: '🌟', label: '레전더리 상자' },
];

// 가중치 기반 랜덤 선택
function selectReward(isPremium = false) {
  const rewards = [...ROULETTE_REWARDS];
  
  // 프리미엄 사용자는 확률 20% 증가
  if (isPremium) {
    rewards.forEach(reward => {
      if (reward.type === 'gems' || reward.type === 'box') {
        reward.weight *= 1.2;
      }
    });
  }

  const totalWeight = rewards.reduce((sum, reward) => sum + reward.weight, 0);
  let random = Math.random() * totalWeight;

  for (const reward of rewards) {
    random -= reward.weight;
    if (random <= 0) {
      return reward;
    }
  }

  return rewards[0]; // fallback
}

// 룰렛 애니메이션 생성
function createRouletteAnimation() {
  const symbols = ['💰', '💵', '💎', '🎁', '✨', '🌟', '🍀', '⭐'];
  const frames = [];
  
  // 8프레임 애니메이션
  for (let i = 0; i < 8; i++) {
    const shuffled = [...symbols].sort(() => Math.random() - 0.5);
    frames.push(`🎰 [ ${shuffled[0]} | ${shuffled[1]} | ${shuffled[2]} ] 🎰`);
  }
  
  return frames;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spin')
    .setDescription('하루 1회 무료 행운의 룰렛을 돌립니다 (프리미엄: 3회)')
    .setDescriptionLocalizations({ ko: '하루 1회 무료 행운의 룰렛을 돌립니다 (프리미엄: 3회)' }),

  async execute(interaction, { prisma }) {
    const character = await requireCharacter(prisma, interaction);
    if (!character) return;

    const todayDateKey = getDateKeyInKST();

    // 프리미엄 혜택 확인
    const premiumSubscription = await prisma.premiumSubscription.findUnique({
      where: { userId: interaction.user.id },
    });
    const premiumBenefits = resolvePremiumBenefits(premiumSubscription);
    const maxSpins = premiumBenefits.dailySpins || 1;
    const isPremium = !!premiumSubscription;

    // 오늘 스핀 기록 확인
    const dailySpin = await prisma.dailySpin.findUnique({
      where: {
        userId_date: {
          userId: interaction.user.id,
          date: todayDateKey,
        },
      },
    });

    const currentSpins = dailySpin?.spinCount || 0;

    if (currentSpins >= maxSpins) {
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.error)
        .setTitle('🎰 행운의 룰렛')
        .setDescription([
          `❌ 오늘의 스핀 횟수를 모두 사용했습니다!`,
          '',
          `📊 오늘 스핀: ${currentSpins}/${maxSpins}`,
          '',
          isPremium
            ? '🌟 프리미엄 회원은 하루 3회 스핀 가능!'
            : '💡 **프리미엄 회원**이 되면 하루 3회 스핀 가능!',
          '',
          '⏰ 자정(00:00 KST)에 초기화됩니다.',
        ].join('\n'))
        .setFooter({ text: '매일 자정 초기화 (Asia/Seoul)' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 룰렛 돌리기 시작
    await interaction.deferReply();

    // 애니메이션 프레임 생성
    const frames = createRouletteAnimation();
    const animationEmbed = new EmbedBuilder()
      .setColor(EMBED_COLORS.primary)
      .setTitle('🎰 행운의 룰렛')
      .setDescription([
        '🎲 룰렛을 돌리고 있습니다...',
        '',
        frames[0],
      ].join('\n'));

    await interaction.editReply({ embeds: [animationEmbed] });

    // 애니메이션 효과 (여러 프레임 빠르게 변경)
    for (let i = 1; i < frames.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      animationEmbed.setDescription([
        '🎲 룰렛을 돌리고 있습니다...',
        '',
        frames[i],
      ].join('\n'));
      await interaction.editReply({ embeds: [animationEmbed] });
    }

    // 최종 결과 선택
    const reward = selectReward(isPremium);

    // 보상 지급
    const result = await prisma.$transaction(async (tx) => {
      // 스핀 기록 업데이트
      await tx.dailySpin.upsert({
        where: {
          userId_date: {
            userId: interaction.user.id,
            date: todayDateKey,
          },
        },
        update: {
          spinCount: { increment: 1 },
          lastSpinAt: new Date(),
        },
        create: {
          userId: interaction.user.id,
          characterId: character.id,
          date: todayDateKey,
          spinCount: 1,
          lastSpinAt: new Date(),
        },
      });

      let grantedItem = null;

      // 보상 타입별 처리
      if (reward.type === 'gold') {
        await tx.character.update({
          where: { id: character.id },
          data: { gold: { increment: reward.amount } },
        });
      } else if (reward.type === 'gems') {
        await tx.character.update({
          where: { id: character.id },
          data: { gems: { increment: reward.amount } },
        });
      } else if (reward.type === 'box') {
        // 장비 생성
        const equipment = generateEquipment(character.level, {
          rarity: reward.rarity,
        });

        grantedItem = await tx.equipment.create({
          data: {
            characterId: character.id,
            name: equipment.name,
            type: equipment.type,
            rarity: equipment.rarity,
            attack: equipment.attack,
            defense: equipment.defense,
            hp: equipment.hp,
            mana: equipment.mana,
            effect: equipment.effect,
            equipped: false,
          },
        });
      }

      // 스핀 히스토리 기록
      await tx.spinHistory.create({
        data: {
          userId: interaction.user.id,
          characterId: character.id,
          rewardType: reward.type === 'box' ? `${reward.rarity}_box` : reward.type,
          rewardAmount: reward.amount || 1,
          spunAt: new Date(),
        },
      });

      return { grantedItem };
    });

    // 결과 임베드 생성
    const resultLines = [
      createDivider(),
      '🎊 **룰렛 결과** 🎊',
      createDivider(),
      '',
      `🎰 ${reward.emoji} ${reward.emoji} ${reward.emoji}`,
      '',
    ];

    if (reward.type === 'gold') {
      resultLines.push(`💰 **골드 ${formatNumber(reward.amount)}G** 획득!`);
    } else if (reward.type === 'gems') {
      resultLines.push(`💎 **젬 ${reward.amount}개** 획득!`);
    } else if (reward.type === 'box' && result.grantedItem) {
      const rarity = RARITIES[result.grantedItem.rarity];
      const rarityLabel = rarity ? `${rarity.emoji} ${rarity.name}` : result.grantedItem.rarity;
      resultLines.push(
        `${rarityLabel} 장비 획득!`,
        `✨ **${result.grantedItem.name}**`,
      );
    }

    resultLines.push(
      '',
      createDivider(),
      `📊 오늘 스핀: ${currentSpins + 1}/${maxSpins}`,
      '',
      '⏰ 자정(00:00 KST)에 초기화됩니다.',
    );

    if (!isPremium) {
      resultLines.push(
        '',
        '💡 **프리미엄 회원**이 되면:',
        '  • 하루 3회 스핀 가능',
        '  • 고급 보상 확률 +20%',
      );
    }

    const finalEmbed = new EmbedBuilder()
      .setColor(EMBED_COLORS.success)
      .setTitle('🎰 행운의 룰렛')
      .setDescription(resultLines.join('\n'))
      .setFooter({ text: '매일 자정 초기화 (Asia/Seoul)' });

    await new Promise(resolve => setTimeout(resolve, 500));
    await interaction.editReply({ embeds: [finalEmbed] });
  },
};
