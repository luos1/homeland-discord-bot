const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const {
  getCraftableRecipes,
  calculateCraftTime,
  PRODUCTION_CLASSES,
  RESOURCES,
} = require('../game/production-classes');
const { canCraftRecipe } = require('../game/production-skills');
const { EMBED_COLORS, createDivider } = require('../utils/ui');

const CRAFT_BUTTON_PREFIX = 'craft:';

function createCraftSelectEmbed(character, recipes, resources) {
  const classData = PRODUCTION_CLASSES[character.productionClass];

  const recipeLines = recipes.map((r, index) => {
    const craftTime = Math.floor(calculateCraftTime(character.productionClass, character.productionLevel, r.craftTime) / 60);
    
    // 재료 체크
    const materialList = Object.entries(r.materials).map(([resType, needed]) => {
      const resourceData = RESOURCES[resType];
      const owned = resources.find((res) => res.type === resType)?.quantity || 0;
      const hasEnough = owned >= needed;
      const statusIcon = hasEnough ? '✅' : '❌';
      
      return `${statusIcon} ${resourceData.emoji} ${resourceData.name} ${owned}/${needed}`;
    });

    const canCraft = Object.entries(r.materials).every(([resType, needed]) => {
      const owned = resources.find((res) => res.type === resType)?.quantity || 0;
      return owned >= needed;
    });

    return [
      `${index + 1}. ${r.emoji} **${r.name}** ${canCraft ? '' : '(재료 부족)'}`,
      `   ⏱️ ${craftTime}분 | 📊 요구 레벨: ${r.requiredLevel}`,
      `   ${materialList.join(' | ')}`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`${classData.emoji} 제작 레시피`)
    .setDescription(
      [
        createDivider(),
        `💼 ${classData.name} Lv.${character.productionLevel}`,
        '',
        '📜 제작 가능한 레시피',
        '',
        ...recipeLines,
        '',
        '💡 제작을 시작하려면 레시피를 선택하세요',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '제작 시간이 지나면 다시 /craft를 입력하세요',
    });
}

function createCraftSelectActionRow(recipes, resources) {
  const buttons = recipes.slice(0, 4).map((r, index) => {
    // 재료 충분한지 확인
    const canCraft = Object.entries(r.materials).every(([resType, needed]) => {
      const owned = resources.find((res) => res.type === resType)?.quantity || 0;
      return owned >= needed;
    });

    return new ButtonBuilder()
      .setCustomId(`${CRAFT_BUTTON_PREFIX}start:${r.key}`)
      .setLabel(`${index + 1}. ${r.name}`)
      .setEmoji(r.emoji)
      .setStyle(canCraft ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!canCraft);
  });

  return new ActionRowBuilder().addComponents(buttons);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('craft')
    .setDescription('아이템을 제작합니다'),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        craftingSessions: true,
        resources: true,
        skills: true,
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

    if (classData.category !== 'crafting') {
      await interaction.reply({
        content: `${classData.name}은(는) 제작 직업이 아닙니다. 채집 직업입니다.`,
        ephemeral: true,
      });

      return;
    }

    // 진행 중인 제작 확인
    if (character.craftingSessions.length > 0) {
      const session = character.craftingSessions[0];
      const now = new Date();
      const completesAt = new Date(session.completesAt);

      if (now < completesAt) {
        const remainingMs = completesAt - now;
        const remainingMin = Math.ceil(remainingMs / 1000 / 60);

        await interaction.reply({
          content: `⏱️ 이미 제작 중입니다. ${remainingMin}분 후에 완료됩니다.`,
          ephemeral: true,
        });

        return;
      }

      // 제작 완료 - 보상 지급
      const { RECIPES } = require('../game/production-classes');
      const recipe = RECIPES[session.recipeKey];

      if (!recipe) {
        await interaction.reply({
          content: '❌ 레시피를 찾을 수 없습니다.',
          ephemeral: true,
        });

        return;
      }

      await prisma.$transaction(async (tx) => {
        // 제작물 추가
        if (recipe.result.type === 'equipment') {
          // 장비 생성 (생산 레벨 보너스 적용)
          const { generateEquipmentFromRecipe } = require('../game/equipment');
          const equipment = generateEquipmentFromRecipe(recipe, character.productionLevel);

          await tx.equipment.create({
            data: {
              characterId: character.id,
              name: equipment.name,
              type: equipment.type,
              rarity: equipment.rarity,
              attack: equipment.attack,
              defense: equipment.defense,
              hp: equipment.hp || 0,
              mana: equipment.mana || 0,
              effect: equipment.effect || null,
              equipped: false,
            },
          });
        } else if (recipe.result.type === 'consumable') {
          // 소비 아이템은 나중에 구현 (일단 골드로 대체)
          await tx.character.update({
            where: {
              id: character.id,
            },
            data: {
              gold: character.gold + 50, // 임시
            },
          });
        }

        // 세션 삭제
        await tx.craftingSession.delete({
          where: {
            id: session.id,
          },
        });

        // 생산 경험치 획득
        const xpGain = Math.floor(recipe.craftTime / 60); // 1분당 1 경험치
        const { applyProductionExperience, getProductionLevelUpRewards } = require('../game/production-leveling');
        
        const levelingResult = applyProductionExperience(character, xpGain);
        
        await tx.character.update({
          where: {
            id: character.id,
          },
          data: {
            productionLevel: levelingResult.productionLevel,
            productionXp: levelingResult.productionXp,
            gold: levelingResult.levelsGained > 0 
              ? character.gold + getProductionLevelUpRewards(levelingResult.productionLevel).gold
              : character.gold + (recipe.result.type === 'consumable' ? 50 : 0),
          },
        });
      });

      // 레벨업 체크
      const { applyProductionExperience, getProductionLevelUpRewards } = require('../game/production-leveling');
      const xpGain = Math.floor(recipe.craftTime / 60);
      const levelingResult = applyProductionExperience(character, xpGain);

      const resultText =
        recipe.result.type === 'equipment'
          ? `${recipe.emoji} **${recipe.name}** 제작 완료! (인벤토리에 추가)`
          : `${recipe.emoji} **${recipe.name}** 제작 완료! (+50G)`;

      const messages = [
        `✅ 제작 완료!`,
        '',
        resultText,
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

    // 새로운 제작 시작
    const allRecipes = getCraftableRecipes(character.productionClass, character.productionLevel);
    
    // 스킬 필터링
    const recipes = allRecipes.filter((recipe) => canCraftRecipe(recipe, character));

    if (recipes.length === 0) {
      await interaction.reply({
        content: '제작 가능한 레시피가 없습니다. 생산 스킬을 배워 더 많은 레시피를 잠금 해제하세요!',
        ephemeral: true,
      });

      return;
    }

    await interaction.reply({
      embeds: [createCraftSelectEmbed(character, recipes, character.resources)],
      components: [createCraftSelectActionRow(recipes, character.resources)],
    });
  },

  async handleCraftButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(CRAFT_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(CRAFT_BUTTON_PREFIX.length);
    const [action, recipeKey] = customId.split(':');

    if (action !== 'start') {
      return false;
    }

    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        craftingSessions: true,
        resources: true,
        skills: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터를 찾을 수 없습니다.',
        ephemeral: true,
      });

      return true;
    }

    if (character.craftingSessions.length > 0) {
      await interaction.reply({
        content: '⏱️ 이미 제작 중입니다.',
        ephemeral: true,
      });

      return true;
    }

    const { RECIPES } = require('../game/production-classes');
    const recipe = RECIPES[recipeKey];

    if (!recipe) {
      await interaction.reply({
        content: '❌ 유효하지 않은 레시피입니다.',
        ephemeral: true,
      });

      return true;
    }

    // 재료 확인
    const materialCheck = Object.entries(recipe.materials).every(([resType, needed]) => {
      const owned = character.resources.find((res) => res.type === resType)?.quantity || 0;
      return owned >= needed;
    });

    if (!materialCheck) {
      await interaction.reply({
        content: '❌ 재료가 부족합니다.',
        ephemeral: true,
      });

      return true;
    }

    const craftTime = calculateCraftTime(character.productionClass, character.productionLevel, recipe.craftTime);
    const now = new Date();
    const completesAt = new Date(now.getTime() + craftTime * 1000);

    // 트랜잭션: 재료 소모 + 제작 세션 생성
    await prisma.$transaction(async (tx) => {
      // 재료 소모
      for (const [resType, needed] of Object.entries(recipe.materials)) {
        const resource = character.resources.find((res) => res.type === resType);
        if (resource) {
          await tx.resource.update({
            where: {
              id: resource.id,
            },
            data: {
              quantity: resource.quantity - needed,
            },
          });
        }
      }

      // 제작 세션 생성
      await tx.craftingSession.create({
        data: {
          characterId: character.id,
          recipeKey,
          startedAt: now,
          completesAt,
          quantity: 1,
        },
      });
    });

    const craftTimeMin = Math.floor(craftTime / 60);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLORS.profile)
          .setTitle('⚒️ 제작 시작!')
          .setDescription(
            [
              createDivider(),
              `${recipe.emoji} **${recipe.name}** 제작 중...`,
              '',
              `⏱️ 소요 시간: ${craftTimeMin}분`,
              '',
              `💡 ${craftTimeMin}분 후 다시 \`/craft\`를 입력하세요`,
              '',
              createDivider(),
            ].join('\n'),
          ),
      ],
      components: [],
    });

    return true;
  },

  CRAFT_BUTTON_PREFIX,
};
