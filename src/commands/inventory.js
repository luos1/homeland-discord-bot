const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const {
  EQUIPMENT_TYPES,
  RARITIES,
  EFFECTS,
  calculateEquipmentStats,
} = require('../game/equipment');
const { EMBED_COLORS, createDivider } = require('../utils/ui');

const INVENTORY_BUTTON_PREFIX = 'inventory:';
const INVENTORY_ACTION = {
  equip: 'equip',
  unequip: 'unequip',
  delete: 'delete',
};

function createInventoryEmbed(character, equipmentList) {
  const equipped = equipmentList.filter((e) => e.equipped);
  const unequipped = equipmentList.filter((e) => !e.equipped);

  const equippedStats = calculateEquipmentStats(equipmentList);

  const equippedLines = equipped.map((eq) => {
    const rarityData = RARITIES[eq.rarity];
    const typeData = EQUIPMENT_TYPES[eq.type];
    const stats = [];
    if (eq.attack > 0) stats.push(`공격 +${eq.attack}`);
    if (eq.defense > 0) stats.push(`방어 +${eq.defense}`);
    if (eq.hp > 0) stats.push(`HP +${eq.hp}`);
    if (eq.mana > 0) stats.push(`MP +${eq.mana}`);

    return `${rarityData.emoji} ${typeData.emoji} **${eq.name}** (${stats.join(', ')})`;
  });

  const unequippedLines = unequipped.slice(0, 10).map((eq, index) => {
    const rarityData = RARITIES[eq.rarity];
    const typeData = EQUIPMENT_TYPES[eq.type];
    const stats = [];
    if (eq.attack > 0) stats.push(`공격 +${eq.attack}`);
    if (eq.defense > 0) stats.push(`방어 +${eq.defense}`);
    if (eq.hp > 0) stats.push(`HP +${eq.hp}`);
    if (eq.mana > 0) stats.push(`MP +${eq.mana}`);

    return `${index + 1}. ${rarityData.emoji} ${typeData.emoji} ${eq.name} (${stats.join(', ')})`;
  });

  const effectLines = equippedStats.effects.map((effectKey) => {
    const effectData = EFFECTS[effectKey];
    return `${effectData.emoji} ${effectData.name}`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`🎒 ${character.name}의 인벤토리`)
    .setDescription(
      [
        createDivider(),
        '📊 장착 중인 장비',
        equippedLines.length > 0 ? equippedLines.join('\n') : '없음',
        '',
        '💪 장비 보너스',
        `⚔️ 공격력 +${equippedStats.attack}`,
        `🛡️ 방어력 +${equippedStats.defense}`,
        `❤️ 최대 체력 +${equippedStats.hp}`,
        `🔷 최대 마나 +${equippedStats.mana}`,
        effectLines.length > 0 ? `✨ 특수 효과: ${effectLines.join(', ')}` : '',
        '',
        createDivider(),
        '📦 보관 중인 장비',
        unequippedLines.length > 0 ? unequippedLines.join('\n') : '없음',
        unequipped.length > 10 ? `... 외 ${unequipped.length - 10}개` : '',
        '',
        `💰 총 ${equipmentList.length}개의 장비 보유`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({
      text: '장비를 선택하여 장착/해제할 수 있습니다',
    });
}

function createInventoryActionRow(equipmentList) {
  const unequipped = equipmentList.filter((e) => !e.equipped).slice(0, 4);

  const buttons = unequipped.map((eq, index) => {
    const rarityData = RARITIES[eq.rarity];
    const typeData = EQUIPMENT_TYPES[eq.type];

    return new ButtonBuilder()
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}equip:${eq.id}`)
      .setLabel(`${index + 1}. 장착`)
      .setEmoji(typeData.emoji)
      .setStyle(ButtonStyle.Primary);
  });

  // 항상 뒤로가기 버튼 추가
  buttons.push(
    new ButtonBuilder()
      .setCustomId('back_to_profile')
      .setLabel('프로필로')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary)
  );

  return new ActionRowBuilder().addComponents(buttons);
}

function createEquipmentDetailEmbed(equipment) {
  const typeData = EQUIPMENT_TYPES[equipment.type];
  const rarityData = RARITIES[equipment.rarity];
  const effectData = equipment.effect ? EFFECTS[equipment.effect] : null;

  const stats = [];
  if (equipment.attack > 0) stats.push(`⚔️ 공격력 +${equipment.attack}`);
  if (equipment.defense > 0) stats.push(`🛡️ 방어력 +${equipment.defense}`);
  if (equipment.hp > 0) stats.push(`❤️ 최대 체력 +${equipment.hp}`);
  if (equipment.mana > 0) stats.push(`🔷 최대 마나 +${equipment.mana}`);

  return new EmbedBuilder()
    .setColor(rarityData.color)
    .setTitle(`${rarityData.emoji} ${equipment.name}`)
    .setDescription(
      [
        createDivider(),
        `${typeData.emoji} ${typeData.name} | ${rarityData.name}`,
        '',
        '📊 능력치',
        ...stats,
        effectData ? '' : null,
        effectData ? `✨ ${effectData.emoji} ${effectData.name}` : null,
        effectData ? `   ${effectData.description}` : null,
        '',
        createDivider(),
        equipment.equipped ? '✅ 현재 장착 중' : '📦 인벤토리에 보관 중',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({
      text: '장비 관리',
    });
}

function createEquipmentActionRow(equipment) {
  if (equipment.equipped) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${INVENTORY_BUTTON_PREFIX}unequip:${equipment.id}`)
        .setLabel('해제')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('back_to_inventory')
        .setLabel('인벤토리로')
        .setEmoji('🎒')
        .setStyle(ButtonStyle.Secondary),
    );
  }

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}equip:${equipment.id}`)
      .setLabel('장착')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}delete:${equipment.id}`)
      .setLabel('삭제')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('back_to_inventory')
      .setLabel('인벤토리로')
      .setEmoji('🎒')
      .setStyle(ButtonStyle.Secondary),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('보유한 장비를 확인하고 관리합니다'),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        equipment: {
          orderBy: [{ equipped: 'desc' }, { rarity: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
        ephemeral: true,
      });

      return;
    }

    const embed = createInventoryEmbed(character, character.equipment);
    const actionRow = createInventoryActionRow(character.equipment);

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
    });
  },

  async handleInventoryButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(INVENTORY_BUTTON_PREFIX)) {
      return false;
    }

    const [action, equipmentIdStr] = interaction.customId
      .slice(INVENTORY_BUTTON_PREFIX.length)
      .split(':');

    const equipmentId = parseInt(equipmentIdStr, 10);

    if (!equipmentId) {
      await interaction.reply({
        content: '유효하지 않은 장비입니다.',
        ephemeral: true,
      });

      return true;
    }

    const equipment = await prisma.equipment.findUnique({
      where: {
        id: equipmentId,
      },
      include: {
        character: true,
      },
    });

    if (!equipment || equipment.character.userId !== interaction.user.id) {
      await interaction.reply({
        content: '이 장비에 접근할 수 없습니다.',
        ephemeral: true,
      });

      return true;
    }

    if (action === INVENTORY_ACTION.equip) {
      // 같은 슬롯의 장비 해제
      await prisma.equipment.updateMany({
        where: {
          characterId: equipment.characterId,
          type: equipment.type,
          equipped: true,
        },
        data: {
          equipped: false,
        },
      });

      // 새 장비 장착
      await prisma.equipment.update({
        where: {
          id: equipmentId,
        },
        data: {
          equipped: true,
        },
      });

      await interaction.reply({
        content: `✅ ${equipment.name}을(를) 장착했습니다!`,
        ephemeral: true,
      });

      return true;
    }

    if (action === INVENTORY_ACTION.unequip) {
      await prisma.equipment.update({
        where: {
          id: equipmentId,
        },
        data: {
          equipped: false,
        },
      });

      await interaction.reply({
        content: `❌ ${equipment.name}을(를) 해제했습니다.`,
        ephemeral: true,
      });

      return true;
    }

    if (action === INVENTORY_ACTION.delete) {
      await prisma.equipment.delete({
        where: {
          id: equipmentId,
        },
      });

      await interaction.reply({
        content: `🗑️ ${equipment.name}을(를) 삭제했습니다.`,
        ephemeral: true,
      });

      return true;
    }

    return false;
  },

  INVENTORY_BUTTON_PREFIX,
  createInventoryEmbed,
  createInventoryActionRow,
};
