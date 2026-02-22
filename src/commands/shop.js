const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { RARITIES, generateEquipment } = require('../game/equipment');
const { EMBED_COLORS, createDivider } = require('../utils/ui');

const SHOP_BUTTON_PREFIX = 'shop:';
const SHOP_ACTIONS = {
  potions: 'potions',
  equipment: 'equipment',
  sell: 'sell',
  upgrade: 'upgrade',
  buyPotion: 'buy_potion',
  buyEquipment: 'buy_equipment',
  sellEquipment: 'sell_equipment',
  upgradeEquipment: 'upgrade_equipment',
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
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('🏪 홈랜드 상점')
    .setDescription(
      [
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
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '원하는 메뉴를 선택하세요',
    });
}

function createShopMainActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.potions}`)
      .setLabel('포션 상점')
      .setEmoji('🧪')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.equipment}`)
      .setLabel('장비 뽑기')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.sell}`)
      .setLabel('장비 판매')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}${SHOP_ACTIONS.upgrade}`)
      .setLabel('장비 강화')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Primary),
  );
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
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}main`)
      .setLabel('뒤로가기')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary),
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
        '📦 등급별 장비 뽑기',
        '',
        `${RARITIES.common.emoji} **일반 장비** - 100G`,
        `${RARITIES.uncommon.emoji} **고급 장비** - 300G`,
        `${RARITIES.rare.emoji} **희귀 장비** - 800G`,
        `${RARITIES.epic.emoji} **영웅 장비** - 2,000G`,
        `${RARITIES.legendary.emoji} **전설 장비** - 5,000G`,
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
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}main`)
      .setLabel('뒤로')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary),
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
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}main`)
      .setLabel('뒤로')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary),
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
    new ButtonBuilder()
      .setCustomId(`${SHOP_BUTTON_PREFIX}main`)
      .setLabel('뒤로')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary),
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
      components: [createShopMainActionRow()],
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
        components: [createShopMainActionRow()],
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
      const price = potionType === 'health' ? PRICES.healthPotion : PRICES.manaPotion;

      if (character.gold < price) {
        await interaction.reply({
          content: '💰 골드가 부족합니다.',
          ephemeral: true,
        });

        return true;
      }

      // TODO: 포션 인벤토리 시스템 구현 필요
      // 현재는 골드만 차감
      await prisma.character.update({
        where: {
          id: character.id,
        },
        data: {
          gold: character.gold - price,
        },
      });

      const potionName = potionType === 'health' ? '💊 체력 회복 포션' : '🔷 마나 회복 포션';

      await interaction.reply({
        content: `✅ ${potionName}을(를) 구매했습니다! (-${price}G)\n💡 포션은 전투 중 사용할 수 있습니다.`,
        ephemeral: true,
      });

      return true;
    }

    // 장비 구매
    if (action === SHOP_ACTIONS.buyEquipment) {
      const rarity = param;
      const priceKey = `equipment${rarity.charAt(0).toUpperCase()}${rarity.slice(1)}`;
      const price = PRICES[priceKey];

      if (character.gold < price) {
        await interaction.reply({
          content: '💰 골드가 부족합니다.',
          ephemeral: true,
        });

        return true;
      }

      // 장비 생성
      const newEquipment = generateEquipment(character.level, { rarity });

      await prisma.$transaction(async (tx) => {
        await tx.character.update({
          where: {
            id: character.id,
          },
          data: {
            gold: character.gold - price,
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

      const rarityData = RARITIES[rarity];

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

      return true;
    }

    // 장비 판매
    if (action === SHOP_ACTIONS.sellEquipment) {
      const equipmentId = parseInt(param, 10);

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
            gold: character.gold + sellPrice,
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

      await prisma.character.update({
        where: {
          id: character.id,
        },
        data: {
          gold: character.gold - upgradeCost,
        },
      });

      if (success) {
        const newLevel = upgradeLevel + 1;
        const statBonus = Math.floor((equipment.attack + equipment.defense) * 0.1) + 1;

        await prisma.equipment.update({
          where: {
            id: equipmentId,
          },
          data: {
            upgradeLevel: newLevel,
            attack: equipment.attack + statBonus,
            defense: equipment.defense + statBonus,
          },
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
        await prisma.equipment.delete({
          where: {
            id: equipmentId,
          },
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

    return false;
  },

  SHOP_BUTTON_PREFIX,
  SHOP_ACTIONS,
};
