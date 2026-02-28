const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { requireCharacter } = require('../utils/response-helpers');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { generateEquipment } = require('../game/equipment');

/**
 * 🎯 신규 유저 온보딩 퀘스트 3개
 * 목표: 신규 유저 리텐션 74% 달성 (Mudae 사례)
 * 
 * 퀘스트 1: 캐릭터 생성하기 → 골드 100
 * 퀘스트 2: 첫 전투 시작하기 → 레어 장비
 * 퀘스트 3: 친구에게 아이템 선물하기 → 프리미엄 3일
 */

const ONBOARDING_QUESTS = [
  {
    id: 'character_created',
    title: '🎭 캐릭터 생성하기',
    description: '홈랜드 모험을 시작하세요!',
    checkField: null, // 캐릭터 존재 여부로 자동 체크
    rewardGold: 100,
    rewardText: '💰 골드 100',
  },
  {
    id: 'first_battle',
    title: '⚔️ 첫 전투 시작하기',
    description: '탐험에서 전투를 1회 시작하세요',
    checkField: 'battleWins',
    checkValue: 1,
    rewardEquipmentRarity: 'rare',
    rewardText: '✨ 레어 장비 1개',
  },
  {
    id: 'gift_sent',
    title: '🎁 친구에게 선물하기',
    description: '/trade 명령어로 친구에게 아이템을 선물하세요',
    checkField: 'giftSent',
    checkValue: true,
    rewardPremiumDays: 3,
    rewardText: '👑 프리미엄 3일',
  },
];

async function getOnboardingQuestProgress(prisma, userId, characterId) {
  const onboarding = await prisma.onboardingProgress.findUnique({
    where: { userId },
  });

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: {
      id: true,
      battleWins: true,
    },
  });

  const progress = ONBOARDING_QUESTS.map((quest) => {
    let completed = false;
    let claimed = false;

    if (quest.id === 'character_created') {
      completed = Boolean(character);
      claimed = onboarding?.tutorialStep1Reward || false;
    } else if (quest.id === 'first_battle') {
      completed = (character?.battleWins || 0) >= (quest.checkValue || 1);
      claimed = onboarding?.tutorialStep2Reward || false;
    } else if (quest.id === 'gift_sent') {
      completed = onboarding?.giftSent || false;
      claimed = onboarding?.tutorialStep3Reward || false;
    }

    return {
      ...quest,
      completed,
      claimed,
      canClaim: completed && !claimed,
    };
  });

  return progress;
}

async function claimOnboardingQuest(prisma, userId, characterId, questId) {
  const quest = ONBOARDING_QUESTS.find((q) => q.id === questId);
  if (!quest) {
    return { success: false, error: '퀘스트를 찾을 수 없습니다.' };
  }

  const progress = await getOnboardingQuestProgress(prisma, userId, characterId);
  const questProgress = progress.find((p) => p.id === questId);

  if (!questProgress?.canClaim) {
    return { success: false, error: '아직 보상을 받을 수 없습니다.' };
  }

  const result = await prisma.$transaction(async (tx) => {
    // 보상 지급
    const updateData = {};
    let rewardDescription = [];

    if (quest.rewardGold) {
      await tx.character.update({
        where: { id: characterId },
        data: { gold: { increment: quest.rewardGold } },
      });
      rewardDescription.push(`💰 골드 +${quest.rewardGold}`);
    }

    if (quest.rewardEquipmentRarity) {
      const equipment = generateEquipment(1, { rarity: quest.rewardEquipmentRarity });
      await tx.equipment.create({
        data: {
          characterId,
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
      rewardDescription.push(`✨ ${equipment.name} (레어)`);
    }

    if (quest.rewardPremiumDays) {
      const now = new Date();
      const endDate = new Date(now.getTime() + quest.rewardPremiumDays * 24 * 60 * 60 * 1000);
      
      const existingSub = await tx.premiumSubscription.findUnique({
        where: { userId },
      });

      if (existingSub) {
        // 기존 프리미엄 연장
        const currentEnd = new Date(existingSub.endDate);
        const newEnd = new Date(Math.max(currentEnd.getTime(), now.getTime()) + quest.rewardPremiumDays * 24 * 60 * 60 * 1000);
        await tx.premiumSubscription.update({
          where: { userId },
          data: { endDate: newEnd },
        });
      } else {
        // 새 프리미엄 생성
        await tx.premiumSubscription.create({
          data: {
            userId,
            planId: 'onboarding_gift',
            tier: 'bronze',
            startDate: now,
            endDate,
          },
        });
      }
      rewardDescription.push(`👑 프리미엄 ${quest.rewardPremiumDays}일`);
    }

    // 보상 수령 표시
    if (questId === 'character_created') {
      updateData.tutorialStep1Reward = true;
    } else if (questId === 'first_battle') {
      updateData.tutorialStep2Reward = true;
    } else if (questId === 'gift_sent') {
      updateData.tutorialStep3Reward = true;
    }

    await tx.onboardingProgress.update({
      where: { userId },
      data: updateData,
    });

    return { rewardDescription };
  });

  return {
    success: true,
    quest,
    rewardDescription: result.rewardDescription,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('onboarding')
    .setNameLocalizations({ 'en-US': 'onboarding' })
    .setDescription('신규 유저 온보딩 퀘스트 확인 및 보상 수령')
    .setDescriptionLocalizations({ 'en-US': 'Check onboarding quests and claim rewards' })
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('온보딩 퀘스트 진행 상황 확인')
        .setDescriptionLocalizations({ 'en-US': 'Check onboarding quest progress' })
    )
    .addSubcommand((sub) =>
      sub
        .setName('claim')
        .setDescription('온보딩 퀘스트 보상 수령')
        .setDescriptionLocalizations({ 'en-US': 'Claim onboarding quest rewards' })
        .addStringOption((opt) =>
          opt
            .setName('quest')
            .setDescription('수령할 퀘스트 선택')
            .setRequired(true)
            .addChoices(
              { name: '캐릭터 생성하기', value: 'character_created' },
              { name: '첫 전투 시작하기', value: 'first_battle' },
              { name: '친구에게 선물하기', value: 'gift_sent' }
            )
        )
    ),

  async execute(interaction, { prisma }) {
    const character = await requireCharacter(prisma, interaction);
    if (!character) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'status') {
      const progress = await getOnboardingQuestProgress(prisma, interaction.user.id, character.id);

      const questLines = progress.map((quest, index) => {
        const statusEmoji = quest.claimed ? '✅' : quest.completed ? '🎁' : '⏳';
        const statusText = quest.claimed ? '완료' : quest.completed ? '보상 대기' : '진행 중';
        
        return [
          `${statusEmoji} **${quest.title}**`,
          `   ${quest.description}`,
          `   보상: ${quest.rewardText} | 상태: ${statusText}`,
        ].join('\n');
      });

      const completedCount = progress.filter((q) => q.claimed).length;
      const allCompleted = completedCount === ONBOARDING_QUESTS.length;

      const embed = new EmbedBuilder()
        .setColor(allCompleted ? EMBED_COLORS.victory : EMBED_COLORS.profile)
        .setTitle('🎯 신규 유저 온보딩 퀘스트')
        .setDescription(
          [
            createDivider(),
            `진행도: ${completedCount}/${ONBOARDING_QUESTS.length}`,
            createDivider(),
            '',
            ...questLines,
            '',
            createDivider(),
            allCompleted
              ? '🎉 모든 온보딩 퀘스트를 완료했습니다!'
              : '💡 퀘스트를 완료하고 `/onboarding claim`으로 보상을 받으세요!',
          ].join('\n')
        )
        .setFooter({ text: '홈랜드 신규 유저 가이드' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'claim') {
      const questId = interaction.options.getString('quest', true);
      const result = await claimOnboardingQuest(prisma, interaction.user.id, character.id, questId);

      if (!result.success) {
        await interaction.reply({
          content: `❌ ${result.error}`,
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.victory)
        .setTitle('🎉 온보딩 퀘스트 보상 수령!')
        .setDescription(
          [
            createDivider(),
            `**${result.quest.title}** 완료!`,
            '',
            '🎁 보상:',
            ...result.rewardDescription.map((r) => `  • ${r}`),
            createDivider(),
          ].join('\n')
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    await interaction.reply({
      content: '알 수 없는 하위 명령입니다.',
      ephemeral: true,
    });
  },

  ONBOARDING_QUESTS,
  getOnboardingQuestProgress,
  claimOnboardingQuest,
};
