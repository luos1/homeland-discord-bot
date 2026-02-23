const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const {
  getGatherableResources,
  calculateGatherTime,
  calculateGatherQuantity,
  PRODUCTION_CLASSES,
} = require('../game/production-classes');
const { DAILY_QUEST_EVENTS, recordDailyQuestProgress } = require('../game/daily-quests');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const {
  handleOnboardingEvent,
  sendOnboardingFeedback,
} = require('../game/onboarding');

const GATHER_BUTTON_PREFIX = 'gather:';

function createGatherSelectEmbed(character, resources) {
  const classData = PRODUCTION_CLASSES[character.productionClass];

  const resourceLines = resources.map((r, index) => {
    const gatherTime = Math.floor(calculateGatherTime(character.productionClass, character.productionLevel) / 60);
    const quantity = calculateGatherQuantity(character.productionClass, character.productionLevel, r.tier);
    
    return `${index + 1}. ${r.emoji} **${r.name}** (티어 ${r.tier})\n   시간: ${gatherTime}분 | 수량: ${quantity}개`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`${classData.emoji} 자원 채집`)
    .setDescription(
      [
        createDivider(),
        `💼 ${classData.name} Lv.${character.productionLevel}`,
        '',
        '📦 채집 가능한 자원',
        '',
        ...resourceLines,
        '',
        '💡 채집을 시작하면 일정 시간 후 자원을 획득합니다',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '채집할 자원을 선택하세요',
    });
}

function createGatherSelectActionRow(resources) {
  const buttons = resources.slice(0, 4).map((r, index) => {
    return new ButtonBuilder()
      .setCustomId(`${GATHER_BUTTON_PREFIX}start:${r.type}`)
      .setLabel(`${index + 1}. ${r.name}`)
      .setEmoji(r.emoji)
      .setStyle(ButtonStyle.Primary);
  });

  return new ActionRowBuilder().addComponents(buttons);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gather')
    .setDescription('자원을 채집합니다'),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        gatherSessions: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
        ephemeral: true,
      });

      return;
    }

    if (!character.productionClass) {
      await interaction.reply({
        content: '생산 직업이 없습니다. 먼저 `/production`으로 직업을 선택하세요.',
        ephemeral: true,
      });

      return;
    }

    const classData = PRODUCTION_CLASSES[character.productionClass];

    if (classData.category !== 'gathering') {
      await interaction.reply({
        content: `${classData.name}은(는) 채집 직업이 아닙니다. 제작 직업입니다.`,
        ephemeral: true,
      });

      return;
    }

    // 진행 중인 채집 확인
    if (character.gatherSessions.length > 0) {
      const session = character.gatherSessions[0];
      const now = new Date();
      const completesAt = new Date(session.completesAt);

      if (now < completesAt) {
        const remainingMs = completesAt - now;
        const remainingMin = Math.ceil(remainingMs / 1000 / 60);

        await interaction.reply({
          content: `⏱️ 이미 채집 중입니다. ${remainingMin}분 후에 완료됩니다.`,
          ephemeral: true,
        });

        return;
      }

      // 채집 완료 - 보상 지급
      const resourceData = require('../game/production-classes').RESOURCES[session.resourceType];

      await prisma.$transaction(async (tx) => {
        // 자원 추가/업데이트
        const existing = await tx.resource.findUnique({
          where: {
            characterId_type: {
              characterId: character.id,
              type: session.resourceType,
            },
          },
        });

        if (existing) {
          await tx.resource.update({
            where: {
              id: existing.id,
            },
            data: {
              quantity: existing.quantity + session.quantity,
            },
          });
        } else {
          await tx.resource.create({
            data: {
              characterId: character.id,
              type: session.resourceType,
              name: resourceData.name,
              quantity: session.quantity,
            },
          });
        }

        // 세션 삭제
        await tx.gatherSession.delete({
          where: {
            id: session.id,
          },
        });

        // 생산 경험치 획득 (티어 × 10)
        const xpGain = resourceData.tier * 10;
        const { applyProductionExperience, getProductionLevelUpRewards } = require('../game/production-leveling');
        
        const levelingResult = applyProductionExperience(character, xpGain);
        
        await tx.character.update({
          where: {
            id: character.id,
          },
          data: {
            productionLevel: levelingResult.productionLevel,
            productionXp: levelingResult.productionXp,
            ...levelingResult.masteryUpdates,
            gold: levelingResult.levelsGained > 0 
              ? character.gold + getProductionLevelUpRewards(levelingResult.productionLevel).gold
              : character.gold,
          },
        });
      });

      try {
        await recordDailyQuestProgress(
          prisma,
          character.id,
          DAILY_QUEST_EVENTS.GATHER_RESOURCE,
          session.quantity,
        );
      } catch (error) {
        console.error('Daily quest progress update failed (gather):', error);
      }

      // 레벨업 체크
      const { applyProductionExperience, getProductionLevelUpRewards } = require('../game/production-leveling');
      const xpGain = resourceData.tier * 10;
      const levelingResult = applyProductionExperience(character, xpGain);

      const messages = [
        `✅ 채집 완료!`,
        '',
        `${resourceData.emoji} **${resourceData.name}** x${session.quantity} 획득!`,
        `📈 생산 경험치 +${xpGain}`,
      ];

      if (levelingResult.levelsGained > 0) {
        const rewards = getProductionLevelUpRewards(levelingResult.productionLevel);
        messages.push('');
        messages.push(`🎊 생산 레벨 업! Lv.${character.productionLevel} → Lv.${levelingResult.productionLevel}`);
        messages.push(`💰 보상 골드 +${rewards.gold}G`);
        
        if (rewards.message.length > 0) {
          messages.push('');
          messages.push(...rewards.message);
        }
      }

      await interaction.reply({
        content: messages.join('\n'),
        ephemeral: true,
      });

      return;
    }

    // 새로운 채집 시작
    const resources = getGatherableResources(character.productionClass);

    await interaction.reply({
      embeds: [createGatherSelectEmbed(character, resources)],
      components: [createGatherSelectActionRow(resources)],
    });
  },

  async handleGatherButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(GATHER_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(GATHER_BUTTON_PREFIX.length);
    const [action, resourceType] = customId.split(':');

    if (action !== 'start') {
      return false;
    }

    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        gatherSessions: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터를 찾을 수 없습니다.',
        ephemeral: true,
      });

      return true;
    }

    if (character.gatherSessions.length > 0) {
      await interaction.reply({
        content: '⏱️ 이미 채집 중입니다.',
        ephemeral: true,
      });

      return true;
    }

    const resourceData = require('../game/production-classes').RESOURCES[resourceType];

    if (!resourceData) {
      await interaction.reply({
        content: '❌ 유효하지 않은 자원입니다.',
        ephemeral: true,
      });

      return true;
    }

    const gatherTime = calculateGatherTime(character.productionClass, character.productionLevel);
    const quantity = calculateGatherQuantity(character.productionClass, character.productionLevel, resourceData.tier);

    const now = new Date();
    const completesAt = new Date(now.getTime() + gatherTime * 1000);

    // 채집 세션 생성
    await prisma.gatherSession.create({
      data: {
        characterId: character.id,
        resourceType,
        startedAt: now,
        completesAt,
        quantity,
      },
    });

    const gatherTimeMin = Math.floor(gatherTime / 60);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLORS.profile)
          .setTitle('⏱️ 채집 시작!')
          .setDescription(
            [
              createDivider(),
              `${resourceData.emoji} **${resourceData.name}** 채집 중...`,
              '',
              `⏱️ 소요 시간: ${gatherTimeMin}분`,
              `📦 예상 수량: ${quantity}개`,
              '',
              `💡 ${gatherTimeMin}분 후 다시 \`/gather\`를 입력하세요`,
              '',
              createDivider(),
            ].join('\n'),
          ),
      ],
      components: [],
    });

    const onboardingFeedback = await handleOnboardingEvent({
      prisma,
      user: interaction.user,
      eventType: 'production_action',
    });
    await sendOnboardingFeedback(interaction, onboardingFeedback);

    return true;
  },

  GATHER_BUTTON_PREFIX,
};
