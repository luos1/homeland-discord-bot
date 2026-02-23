const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { RARITIES, generateEquipment } = require('../game/equipment');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { getAdvancedSkillByKey } = require('../game/advanced-skills');
const {
  createSkillShopEmbed,
  createSkillShopActionRow,
  createSkillUpgradeShopEmbed,
  createSkillUpgradeActionRow,
  calculateSkillUpgradeCost,
} = require('../game/shop-skills');
const {
  handleOnboardingEvent,
  sendOnboardingFeedback,
} = require('../game/onboarding');
const { createBackButton, createVillageHomeButton } = require('../utils/village');

const SHOP_BUTTON_PREFIX = 'shop:';
const SHOP_ACTIONS = {
  potions: 'potions',
  equipment: 'equipment',
  sell: 'sell',
  upgrade: 'upgrade',
  skills: 'skills',
  upgradeSkill: 'upgrade_skill_menu',
  buyPotion: 'buy_potion',
  buyEquipment: 'buy_equipment',
  sellEquipment: 'sell_equipment',
  upgradeEquipment: 'upgrade_equipment',
  buySkill: 'buy_skill',
  upgradeSkillAction: 'upgrade_skill',
};

// 가격 설정
const PRICES = {
  healthPotion: 50,
  manaPotion: 40,
  equipmentCommon: 100,
  equipmentUncommon: 300,
  equipmentRare: 800,
  equipmentEpic: 2000,
  equipmentLegendary: 5000,
  upgradeBase: 200, // 강화 기본 가격
};

// 판매 가격 (구매가의 30%)
const SELL_RATIO = 0.3;

// 강화 성공 확률
const UPGRADE_SUCCESS_RATE = 0.65;

function createShopMainEmbed(character) {
  const hasAdvancedClass = !!character.advancedClass;
  
  const description = [
    createDivider(),
    `💰 보유 골드: ${character.gold}G`,
    '',
    '📦 상점 메뉴',
    '',
    '🧪 **포션 상점**',
    '체력 회복 포션과 마나 회복 포션을 구매하세요',
    '',
    '⚔️ **장비 뽑기**',
    '등급별 랜덤 장비를 획득하세요',
    '',
    '💰 **장비 판매**',
    '보유한 장비를 골드로 판매하세요',
    '',
    '✨ **장비 강화**',
    '장비를 강화하여 능력치를 향상시키세요',
  ];

  if (hasAdvancedClass) {
    description.push(
      '',
      '📚 **스킬 상점**',
      '전직 전용 스킬을 구매하고 강화하세요',
    );
  }

  description.push('', createDivider());

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('🏪 홈랜드 상점')
    .setDescription(description.join('\n'))
    .setFooter({
      text: hasAdvancedClass ? '원하는 메뉴를 선택하세요' : '전직 후 스킬 상점을 이용할 수 있습니다',
    });
}

function createShopMainActionRow(character) {
  const row1Buttons = [
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.potions}`)
      .setLabel('포션')
      .setEmoji('🧪')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.equipment}`)
      .setLabel('장비 뽑기')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.sell}`)
      .setLabel('판매')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.upgrade}`)
      .setLabel('장비 강화')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Primary),
  ];

  const row2Buttons = [];

  if (character.advancedClass) {
    row2Buttons.push(
      new ButtonBuilder()
        .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.skills}`)
        .setLabel('스킬 상점')
        .setEmoji('📚')
        .setStyle(ButtonStyle.Primary),
    );
  }

  row2Buttons.push(
    createVillageHomeButton(),
    new ButtonBuilder()
      .setCustomId('back_to_profile')
      .setLabel('나가기')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
  );

  return [
    new ActionRowBuilder().addComponents(row1Buttons),
    new ActionRowBuilder().addComponents(row2Buttons),
  ];
}

function createPotionShopEmbed(character) {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('🧪 포션 상점')
    .setDescription(
      [
        createDivider(),
        `💰 보유 골드: ${character.gold}G`,
        '',
        '💊 **체력 회복 포션** - 50G',
        '전투 중 체력을 35% 회복합니다',
        '(최소 20 HP)',
        '',
        '🔷 **마나 회복 포션** - 40G',
        '전투 중 마나를 50% 회복합니다',
        '(최소 30 MP)',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '포션은 즉시 인벤토리에 추가됩니다',
    });
}

function createPotionShopActionRow(character) {
  const canBuyHealth = character.gold >= PRICES.healthPotion;
  const canBuyMana = character.gold >= PRICES.manaPotion;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.buyPotion}:health`)
      .setLabel('체력 포션 구매 (50G)')
      .setEmoji('💊')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canBuyHealth),
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.buyPotion}:mana`)
      .setLabel('마나 포션 구매 (40G)')
      .setEmoji('🔷')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canBuyMana),
    createBackButton({ customId: `${SHOP_BUTTON_PREFIX}main` }),
  );
}

function createEquipmentShopEmbed(character) {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('⚔️ 장비 뽑기')
    .setDescription(
      [
        createDivider(),
        `💰 보유 골드: ${character.gold}G`,
        '',
        '📦 등급 구간 뽑기 (확률형)',
        '',
        `🎲 **일반 뽑기** - 100G`,
        `   일반 80% | 고급 20%`,
        '',
        `🎲 **고급 뽑기** - 300G`,
        `   일반 40% | 고급 45% | 희귀 15%`,
        '',
        `🎲 **희귀 뽑기** - 800G`,
        `   고급 30% | 희귀 50% | 영웅 20%`,
        '',
        `🎲 **영웅 뽑기** - 2,000G`,
        `   희귀 30% | 영웅 60% | 전설 10%`,
        '',
        '💡 캐릭터 레벨에 맞는 장비가 생성됩니다',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '장비는 즉시 인벤토리에 추가됩니다',
    });
}

function createEquipmentShopActionRow(character) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.buyEquipment}:common`)
      .setLabel('일반 (100G)')
      .setEmoji(RARITIES.common.emoji)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(character.gold < PRICES.equipmentCommon),
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.buyEquipment}:uncommon`)
      .setLabel('고급 (300G)')
      .setEmoji(RARITIES.uncommon.emoji)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(character.gold < PRICES.equipmentUncommon),
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.buyEquipment}:rare`)
      .setLabel('희귀 (800G)')
      .setEmoji(RARITIES.rare.emoji)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(character.gold < PRICES.equipmentRare),
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.buyEquipment}:epic`)
      .setLabel('영웅 (2,000G)')
      .setEmoji(RARITIES.epic.emoji)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(character.gold < PRICES.equipmentEpic),
    createBackButton({ customId: `${SHOP_BUTTON_PREFIX}main` }),
  );
}

function createSellShopEmbed(character, equipment) {
  const unequipped = equipment.filter((e) => !e.equipped);

  const equipmentLines = unequipped.slice(0, 5).map((eq, index) => {
    const rarityData = RARITIES[eq.rarity];
    const sellPrice = calculateSellPrice(eq);
    return `${index + 1}. ${rarityData.emoji} ${eq.name} - ${sellPrice}G`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('💰 장비 판매')
    .setDescription(
      [
        createDivider(),
        `💰 보유 골드: ${character.gold}G`,
        '',
        '📦 판매 가능한 장비 (구매가의 30%)',
        '',
        equipmentLines.length > 0 ? equipmentLines.join('\n') : '판매할 장비가 없습니다',
        unequipped.length > 5 ? `... 외 ${unequipped.length - 5}개` : '',
        '',
        '⚠️ 장착 중인 장비는 판매할 수 없습니다',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '판매할 장비를 선택하세요',
    });
}

function createSellShopActionRow(equipment) {
  const unequipped = equipment.filter((e) => !e.equipped).slice(0, 4);

  const buttons = unequipped.map((eq, index) => {
    const rarityData = RARITIES[eq.rarity];
    return new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.sellEquipment}:${eq.id}`)
      .setLabel(`${index + 1}번 판매`)
      .setEmoji(rarityData.emoji)
      .setStyle(ButtonStyle.Danger);
  });

  buttons.push(
    createBackButton({ customId: `${SHOP_BUTTON_PREFIX}main` }),
  );

  return new ActionRowBuilder().addComponents(buttons);
}

function createUpgradeShopEmbed(character, equipment) {
  const unequipped = equipment.filter((e) => !e.equipped && (!e.upgradeLevel || e.upgradeLevel < 5));

  const equipmentLines = unequipped.slice(0, 5).map((eq, index) => {
    const rarityData = RARITIES[eq.rarity];
    const upgradeLevel = eq.upgradeLevel || 0;
    const upgradeCost = calculateUpgradeCost(eq);
    return `${index + 1}. ${rarityData.emoji} ${eq.name} +${upgradeLevel} - ${upgradeCost}G`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('✨ 장비 강화')
    .setDescription(
      [
        createDivider(),
        `💰 보유 골드: ${character.gold}G`,
        '',
        `📦 강화 가능한 장비 (성공 확률: ${Math.floor(UPGRADE_SUCCESS_RATE * 100)}%)`,
        '',
        equipmentLines.length > 0 ? equipmentLines.join('\n') : '강화할 장비가 없습니다',
        unequipped.length > 5 ? `... 외 ${unequipped.length - 5}개` : '',
        '',
        '⚠️ 강화 실패 시 장비는 파괴됩니다',
        '💡 최대 +5까지 강화 가능',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '강화할 장비를 선택하세요',
    });
}

function createUpgradeShopActionRow(character, equipment) {
  const unequipped = equipment.filter((e) => !e.equipped && (!e.upgradeLevel || e.upgradeLevel < 5)).slice(0, 4);

  const buttons = unequipped.map((eq, index) => {
    const rarityData = RARITIES[eq.rarity];
    const upgradeCost = calculateUpgradeCost(eq);
    return new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.upgradeEquipment}:${eq.id}`)
      .setLabel(`${index + 1}번 강화`)
      .setEmoji(rarityData.emoji)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(character.gold < upgradeCost);
  });

  buttons.push(
    createBackButton({ customId: `${SHOP_BUTTON_PREFIX}main` }),
  );

  return new ActionRowBuilder().addComponents(buttons);
}

function calculateSellPrice(equipment) {
  const rarityPrices = {
    common: PRICES.equipmentCommon,
    uncommon: PRICES.equipmentUncommon,
    rare: PRICES.equipmentRare,
    epic: PRICES.equipmentEpic,
    legendary: PRICES.equipmentLegendary,
  };

  const basePrice = rarityPrices[equipment.rarity] || 100;
  const upgradeLevel = equipment.upgradeLevel || 0;
  const upgradeBonus = upgradeLevel * 100;

  return Math.floor((basePrice + upgradeBonus) * SELL_RATIO);
}

function calculateUpgradeCost(equipment) {
  const upgradeLevel = equipment.upgradeLevel || 0;
  const rarityMultiplier = {
    common: 1,
    uncommon: 1.5,
    rare: 2,
    epic: 3,
    legendary: 5,
  };

  const multiplier = rarityMultiplier[equipment.rarity] || 1;
  return Math.floor(PRICES.upgradeBase * multiplier * (upgradeLevel + 1));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('상점에서 포션과 장비를 구매하거나 판매합니다'),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        equipment: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
        ephemeral: true,
      });

      return;
    }

    const embed = createShopMainEmbed(character);

    await interaction.reply({
      embeds: [embed],
      components: createShopMainActionRow(character),
    });
  },

  async handleShopButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(SHOP_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(SHOP_BUTTON_PREFIX.length);
    const [action, param] = customId.split(':');

    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        equipment: {
          orderBy: [{ equipped: 'desc' }, { rarity: 'desc' }],
        },
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터를 찾을 수 없습니다.',
        ephemeral: true,
      });

      return true;
    }

    // 메인 메뉴
    if (action === 'main') {
      await interaction.update({
        embeds: [createShopMainEmbed(character)],
        components: createShopMainActionRow(character),
      });

      return true;
    }

    // 스킬 상점
    if (action === SHOP_ACTIONS.skills) {
      const learnedSkills = await prisma.skill.findMany({
        where: {
          characterId: character.id,
        },
      });

      await interaction.update({
        embeds: [createSkillShopEmbed(character, learnedSkills)],
        components: [createSkillShopActionRow(character, learnedSkills)],
      });

      return true;
    }

    // 스킬 강화 메뉴
    if (action === SHOP_ACTIONS.upgradeSkill) {
      const learnedSkills = await prisma.skill.findMany({
        where: {
          characterId: character.id,
        },
      });

      await interaction.update({
        embeds: [createSkillUpgradeShopEmbed(character, learnedSkills)],
        components: [createSkillUpgradeActionRow(character, learnedSkills)],
      });

      return true;
    }

    // 포션 상점
    if (action === SHOP_ACTIONS.potions) {
      await interaction.update({
        embeds: [createPotionShopEmbed(character)],
        components: [createPotionShopActionRow(character)],
      });

      return true;
    }

    // 장비 뽑기
    if (action === SHOP_ACTIONS.equipment) {
      await interaction.update({
        embeds: [createEquipmentShopEmbed(character)],
        components: [createEquipmentShopActionRow(character)],
      });

      return true;
    }

    // 장비 판매
    if (action === SHOP_ACTIONS.sell) {
      await interaction.update({
        embeds: [createSellShopEmbed(character, character.equipment)],
        components: [createSellShopActionRow(character.equipment)],
      });

      return true;
    }

    // 장비 강화
    if (action === SHOP_ACTIONS.upgrade) {
      await interaction.update({
        embeds: [createUpgradeShopEmbed(character, character.equipment)],
        components: [createUpgradeShopActionRow(character, character.equipment)],
      });

      return true;
    }

    // 포션 구매
    if (action === SHOP_ACTIONS.buyPotion) {
      const potionType = param;

      if (potionType !== 'health' && potionType !== 'mana') {
        await interaction.reply({
          content: '❌ 유효하지 않은 포션 종류입니다.',
          ephemeral: true,
        });

        return true;
      }

      const price = potionType === 'health' ? PRICES.healthPotion : PRICES.manaPotion;

      if (character.gold < price) {
        await interaction.reply({
          content: '💰 골드가 부족합니다.',
          ephemeral: true,
        });

        return true;
      }

      const potionConfig = potionType === 'health'
        ? {
          name: '💊 체력 회복 포션',
          type: 'potion',
          effect: 'heal_hp',
          power: 35,
        }
        : {
          name: '🔷 마나 회복 포션',
          type: 'potion',
          effect: 'heal_mp',
          power: 50,
        };

      await prisma.$transaction(async (tx) => {
        await tx.character.update({
          where: {
            id: character.id,
          },
          data: {
            gold: { decrement: price },
          },
        });

        await tx.consumable.upsert({
          where: {
            characterId_type_effect: {
              characterId: character.id,
              type: potionConfig.type,
              effect: potionConfig.effect,
            },
          },
          update: {
            quantity: { increment: 1 },
            name: potionConfig.name,
            power: potionConfig.power,
          },
          create: {
            characterId: character.id,
            name: potionConfig.name,
            type: potionConfig.type,
            effect: potionConfig.effect,
            power: potionConfig.power,
            duration: null,
            quantity: 1,
          },
        });
      });

      await interaction.reply({
        content: `✅ ${potionConfig.name}을(를) 구매했습니다! (-${price}G)\n💡 소비템 인벤토리에 추가되었습니다.`,
        ephemeral: true,
      });

      const onboardingFeedback = await handleOnboardingEvent({
        prisma,
        user: interaction.user,
        eventType: 'shop_purchase',
      });
      await sendOnboardingFeedback(interaction, onboardingFeedback);

      return true;
    }

    // 장비 구매
    if (action === SHOP_ACTIONS.buyEquipment) {
      const tier = param; // common, uncommon, rare, epic

      // 확률형 뽑기
      const rarityPools = {
        common: [
          { rarity: 'common', weight: 80 },
          { rarity: 'uncommon', weight: 20 },
        ],
        uncommon: [
          { rarity: 'common', weight: 40 },
          { rarity: 'uncommon', weight: 45 },
          { rarity: 'rare', weight: 15 },
        ],
        rare: [
          { rarity: 'uncommon', weight: 30 },
          { rarity: 'rare', weight: 50 },
          { rarity: 'epic', weight: 20 },
        ],
        epic: [
          { rarity: 'rare', weight: 30 },
          { rarity: 'epic', weight: 60 },
          { rarity: 'legendary', weight: 10 },
        ],
      };

      if (!rarityPools[tier]) {
        await interaction.reply({
          content: '❌ 유효하지 않은 장비 뽑기 등급입니다.',
          ephemeral: true,
        });

        return true;
      }

      const priceKey = `equipment${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
      const price = PRICES[priceKey];

      if (!Number.isFinite(price)) {
        await interaction.reply({
          content: '❌ 장비 가격 정보를 불러오지 못했습니다.',
          ephemeral: true,
        });

        return true;
      }

      if (character.gold < price) {
        await interaction.reply({
          content: '💰 골드가 부족합니다.',
          ephemeral: true,
        });

        return true;
      }

      const pool = rarityPools[tier];
      const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
      let random = Math.random() * totalWeight;
      let selectedRarity = 'common';

      for (const item of pool) {
        random -= item.weight;
        if (random <= 0) {
          selectedRarity = item.rarity;
          break;
        }
      }

      // 장비 생성
      const newEquipment = generateEquipment(character.level, { rarity: selectedRarity });

      await prisma.$transaction(async (tx) => {
        await tx.character.update({
          where: {
            id: character.id,
          },
          data: {
            gold: { decrement: price },
          },
        });

        await tx.equipment.create({
          data: {
            characterId: character.id,
            name: newEquipment.name,
            type: newEquipment.type,
            rarity: newEquipment.rarity,
            attack: newEquipment.attack,
            defense: newEquipment.defense,
            hp: newEquipment.hp,
            mana: newEquipment.mana,
            effect: newEquipment.effect,
            equipped: false,
          },
        });
      });

      const rarityData = RARITIES[selectedRarity];

      await interaction.reply({
        content: [
          `✨ 장비 뽑기 성공! (-${price}G)`,
          '',
          `${rarityData.emoji} **${newEquipment.name}** 획득!`,
          `공격 +${newEquipment.attack} | 방어 +${newEquipment.defense}`,
          `HP +${newEquipment.hp} | MP +${newEquipment.mana}`,
        ].join('\n'),
        ephemeral: true,
      });

      const onboardingFeedback = await handleOnboardingEvent({
        prisma,
        user: interaction.user,
        eventType: 'shop_purchase',
      });
      await sendOnboardingFeedback(interaction, onboardingFeedback);

      return true;
    }

    // 장비 판매
    if (action === SHOP_ACTIONS.sellEquipment) {
      const equipmentId = parseInt(param, 10);

      if (!Number.isInteger(equipmentId)) {
        await interaction.reply({
          content: '❌ 유효하지 않은 장비 ID입니다.',
          ephemeral: true,
        });

        return true;
      }

      const equipment = await prisma.equipment.findUnique({
        where: {
          id: equipmentId,
        },
      });

      if (!equipment || equipment.characterId !== character.id) {
        await interaction.reply({
          content: '❌ 장비를 찾을 수 없습니다.',
          ephemeral: true,
        });

        return true;
      }

      if (equipment.equipped) {
        await interaction.reply({
          content: '⚠️ 장착 중인 장비는 판매할 수 없습니다.',
          ephemeral: true,
        });

        return true;
      }

      const sellPrice = calculateSellPrice(equipment);

      await prisma.$transaction(async (tx) => {
        await tx.equipment.delete({
          where: {
            id: equipmentId,
          },
        });

        await tx.character.update({
          where: {
            id: character.id,
          },
          data: {
            gold: { increment: sellPrice },
          },
        });
      });

      await interaction.reply({
        content: `💰 ${equipment.name}을(를) ${sellPrice}G에 판매했습니다!`,
        ephemeral: true,
      });

      return true;
    }

    // 장비 강화
    if (action === SHOP_ACTIONS.upgradeEquipment) {
      const equipmentId = parseInt(param, 10);

      if (!Number.isInteger(equipmentId)) {
        await interaction.reply({
          content: '❌ 유효하지 않은 장비 ID입니다.',
          ephemeral: true,
        });

        return true;
      }

      const equipment = await prisma.equipment.findUnique({
        where: {
          id: equipmentId,
        },
      });

      if (!equipment || equipment.characterId !== character.id) {
        await interaction.reply({
          content: '❌ 장비를 찾을 수 없습니다.',
          ephemeral: true,
        });

        return true;
      }

      if (equipment.equipped) {
        await interaction.reply({
          content: '⚠️ 장착 중인 장비는 강화할 수 없습니다. 먼저 해제해주세요.',
          ephemeral: true,
        });

        return true;
      }

      const upgradeLevel = equipment.upgradeLevel || 0;

      if (upgradeLevel >= 5) {
        await interaction.reply({
          content: '⚠️ 이미 최대 강화 레벨입니다. (+5)',
          ephemeral: true,
        });

        return true;
      }

      const upgradeCost = calculateUpgradeCost(equipment);

      if (character.gold < upgradeCost) {
        await interaction.reply({
          content: '💰 골드가 부족합니다.',
          ephemeral: true,
        });

        return true;
      }

      const success = Math.random() < UPGRADE_SUCCESS_RATE;

      if (success) {
        const newLevel = upgradeLevel + 1;
        const statBonus = Math.floor((equipment.attack + equipment.defense) * 0.1) + 1;

        await prisma.$transaction(async (tx) => {
          await tx.character.update({
            where: { id: character.id },
            data: { gold: { decrement: upgradeCost } },
          });

          await tx.equipment.update({
            where: { id: equipmentId },
            data: {
              upgradeLevel: newLevel,
              attack: equipment.attack + statBonus,
              defense: equipment.defense + statBonus,
            },
          });
        });

        await interaction.reply({
          content: [
            `✨ 강화 성공! (-${upgradeCost}G)`,
            '',
            `${equipment.name} +${upgradeLevel} → +${newLevel}`,
            `공격력/방어력 +${statBonus}`,
          ].join('\n'),
          ephemeral: true,
        });
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.character.update({
            where: { id: character.id },
            data: { gold: { decrement: upgradeCost } },
          });

          await tx.equipment.delete({
            where: { id: equipmentId },
          });
        });

        await interaction.reply({
          content: [
            `💔 강화 실패... (-${upgradeCost}G)`,
            '',
            `${equipment.name} +${upgradeLevel}이(가) 파괴되었습니다...`,
          ].join('\n'),
          ephemeral: true,
        });
      }

      return true;
    }

    // 스킬 구매
    if (action === SHOP_ACTIONS.buySkill) {
      const skillKey = param;

      if (!skillKey) {
        await interaction.reply({
          content: '❌ 유효하지 않은 스킬 정보입니다.',
          ephemeral: true,
        });

        return true;
      }

      if (!character.advancedClass) {
        await interaction.reply({
          content: '⚠️ 전직 후에 스킬을 구매할 수 있습니다.',
          ephemeral: true,
        });

        return true;
      }

      const skillData = getAdvancedSkillByKey(character.advancedClass, skillKey);

      if (!skillData || skillData.type !== 'shop') {
        await interaction.reply({
          content: '❌ 구매할 수 없는 스킬입니다.',
          ephemeral: true,
        });

        return true;
      }

      // 이미 배웠는지 확인
      const existing = await prisma.skill.findUnique({
        where: {
          characterId_skillKey: {
            characterId: character.id,
            skillKey,
          },
        },
      });

      if (existing) {
        await interaction.reply({
          content: '⚠️ 이미 배운 스킬입니다.',
          ephemeral: true,
        });

        return true;
      }

      if (character.gold < skillData.shopPrice) {
        await interaction.reply({
          content: `💰 골드가 부족합니다. (필요: ${skillData.shopPrice}G)`,
          ephemeral: true,
        });

        return true;
      }

      // 스킬 구매
      await prisma.$transaction(async (tx) => {
        await tx.character.update({
          where: {
            id: character.id,
          },
          data: {
            gold: { decrement: skillData.shopPrice },
          },
        });

        await tx.skill.create({
          data: {
            characterId: character.id,
            skillKey,
            skillLevel: 1,
            equipped: false,
          },
        });
      });

      await interaction.reply({
        content: [
          `✨ 스킬 습득 성공! (-${skillData.shopPrice}G)`,
          '',
          `${skillData.emoji} **${skillData.name}** 습득!`,
          `${skillData.description}`,
          `마나 소모: ${skillData.manaCost}`,
        ].join('\n'),
        ephemeral: true,
      });

      return true;
    }

    // 스킬 강화
    if (action === SHOP_ACTIONS.upgradeSkillAction) {
      const skillId = parseInt(param, 10);

      if (!Number.isInteger(skillId)) {
        await interaction.reply({
          content: '❌ 유효하지 않은 스킬 ID입니다.',
          ephemeral: true,
        });

        return true;
      }

      const skill = await prisma.skill.findUnique({
        where: {
          id: skillId,
        },
      });

      if (!skill || skill.characterId !== character.id) {
        await interaction.reply({
          content: '❌ 스킬을 찾을 수 없습니다.',
          ephemeral: true,
        });

        return true;
      }

      if (skill.skillLevel >= 5) {
        await interaction.reply({
          content: '⚠️ 이미 최대 레벨입니다. (+5)',
          ephemeral: true,
        });

        return true;
      }

      const upgradeCost = calculateSkillUpgradeCost(skill.skillLevel);

      if (character.gold < upgradeCost) {
        await interaction.reply({
          content: `💰 골드가 부족합니다. (필요: ${upgradeCost}G)`,
          ephemeral: true,
        });

        return true;
      }

      const skillData = getAdvancedSkillByKey(character.advancedClass, skill.skillKey);

      if (!skillData) {
        await interaction.reply({
          content: '❌ 스킬 정보를 불러오지 못했습니다.',
          ephemeral: true,
        });

        return true;
      }

      await prisma.$transaction(async (tx) => {
        await tx.character.update({
          where: {
            id: character.id,
          },
          data: {
            gold: { decrement: upgradeCost },
          },
        });

        await tx.skill.update({
          where: {
            id: skillId,
          },
          data: {
            skillLevel: skill.skillLevel + 1,
          },
        });
      });

      await interaction.reply({
        content: [
          `✨ 스킬 강화 성공! (-${upgradeCost}G)`,
          '',
          `${skillData.emoji} ${skillData.name} +${skill.skillLevel} → +${skill.skillLevel + 1}`,
          `효과 20% 증가!`,
        ].join('\n'),
        ephemeral: true,
      });

      return true;
    }

    return false;
  },

  SHOP_BUTTON_PREFIX,
  SHOP_ACTIONS,
};
