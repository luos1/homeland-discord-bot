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
  generateEquipment,
  calculateEquipmentStats,
} = require('../game/equipment');
const { EMBED_COLORS, createDivider } = require('../utils/ui');

const INVENTORY_BUTTON_PREFIX = 'inventory:';
const INVENTORY_ACTION = {
  equip: 'equip',
  unequip: 'unequip',
  delete: 'delete',
  use: 'use',
  equipSkill: 'equip_skill',
  unequipSkill: 'unequip_skill',
};

const INVENTORY_TAB = {
  equipment: 'equipment',
  consumable: 'consumable',
  skill: 'skill',
};

function rollAttendanceTicketRarity() {
  const roll = Math.random();

  if (roll < 0.1) {
    return 'legendary';
  }

  if (roll < 0.35) {
    return 'epic';
  }

  return 'rare';
}

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

function createSkillInventoryEmbed(character, skills) {
  const { getAdvancedSkillByKey } = require('../game/advanced-skills');
  
  const equipped = skills.filter((s) => s.equipped);
  const unequipped = skills.filter((s) => !s.equipped);

  const equippedLines = equipped.map((skill) => {
    const skillData = getAdvancedSkillByKey(character.advancedClass, skill.skillKey);
    if (!skillData) return null;
    const levelInfo = skill.skillLevel > 1 ? ` +${skill.skillLevel}` : '';
    return `${skillData.emoji} **${skillData.name}**${levelInfo} (마나: ${skillData.manaCost})`;
  }).filter(Boolean);

  const unequippedLines = unequipped.slice(0, 10).map((skill, index) => {
    const skillData = getAdvancedSkillByKey(character.advancedClass, skill.skillKey);
    if (!skillData) return null;
    const levelInfo = skill.skillLevel > 1 ? ` +${skill.skillLevel}` : '';
    return `${index + 1}. ${skillData.emoji} ${skillData.name}${levelInfo} (마나: ${skillData.manaCost})`;
  }).filter(Boolean);

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`📚 ${character.name}의 스킬`)
    .setDescription(
      [
        createDivider(),
        character.advancedClass ? `💎 전직: ${character.advancedClass}` : '⭐ 기본 스킬만 사용 가능',
        '',
        '✅ 장착 중인 스킬 (최대 3개)',
        equippedLines.length > 0 ? equippedLines.join('\n') : '장착된 스킬이 없습니다',
        `(${equipped.length}/3 슬롯 사용 중)`,
        '',
        createDivider(),
        '📦 보관 중인 스킬',
        unequippedLines.length > 0 ? unequippedLines.join('\n') : '없음',
        unequipped.length > 10 ? `... 외 ${unequipped.length - 10}개` : '',
        '',
        createDivider(),
        '',
        `🔮 총 ${skills.length}개의 스킬 보유`,
        '',
        '💡 전투 시 장착된 스킬만 사용할 수 있습니다',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({
      text: '스킬을 선택하여 장착/해제할 수 있습니다',
    });
}

function createConsumableInventoryEmbed(character, consumables) {
  const consumableLines = consumables.slice(0, 15).map((item, index) => {
    const effectText = {
      heal_hp: `HP +${item.power} 회복`,
      heal_mp: `MP +${item.power} 회복`,
      buff_regen: `HP ${item.power} 재생 (${Math.floor(item.duration / 60)}분)`,
      attendance_ticket: '장비 가챠 1회 사용',
    }[item.effect] || item.effect;

    return `${index + 1}. **${item.name}** x${item.quantity}\n   ${effectText}`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`🎒 ${character.name}의 소비템`)
    .setDescription(
      [
        createDivider(),
        '💊 보유 소비 아이템',
        '',
        consumableLines.length > 0 ? consumableLines.join('\n\n') : '소비 아이템이 없습니다',
        consumables.length > 15 ? `\n... 외 ${consumables.length - 15}개` : '',
        '',
        createDivider(),
        '',
        `💰 총 ${consumables.length}종의 소비템 보유`,
        '',
        '💡 아이템을 선택하여 사용할 수 있습니다',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({
      text: '포션과 음식은 전투 외에서도 사용 가능합니다',
    });
}

function createInventoryActionRow(equipmentList) {
  const rows = [];

  // 첫 번째 행: 장비 장착 버튼 (최대 5개)
  const unequipped = equipmentList.filter((e) => !e.equipped).slice(0, 5);

  if (unequipped.length > 0) {
    const equipButtons = unequipped.map((eq, index) => {
      const typeData = EQUIPMENT_TYPES[eq.type];

      return new ButtonBuilder()
        .setCustomId(`${INVENTORY_BUTTON_PREFIX}equip:${eq.id}`)
        .setLabel(`${index + 1}. 장착`)
        .setEmoji(typeData.emoji)
        .setStyle(ButtonStyle.Primary);
    });

    rows.push(new ActionRowBuilder().addComponents(equipButtons));
  }

  // 두 번째 행: 탭 전환 버튼
  const navButtons = [
    new ButtonBuilder()
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}tab:skill`)
      .setLabel('스킬')
      .setEmoji('📚')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}tab:consumable`)
      .setLabel('소비템')
      .setEmoji('💊')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('back_to_profile')
      .setLabel('프로필로')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
  ];

  rows.push(new ActionRowBuilder().addComponents(navButtons));

  return rows;
}

function createSkillActionRow(skills) {
  const equipped = skills.filter((s) => s.equipped);
  const unequipped = skills.filter((s) => !s.equipped);
  const rows = [];

  // 첫 번째 행: 장착/해제 버튼 (최대 5개)
  const actionButtons = [];

  if (equipped.length < 3 && unequipped.length > 0) {
    // 미장착 스킬 장착 버튼 (최대 3개)
    unequipped.slice(0, Math.min(3, 3 - equipped.length)).forEach((skill, index) => {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId(`${INVENTORY_BUTTON_PREFIX}${INVENTORY_ACTION.equipSkill}:${skill.id}`)
          .setLabel(`${index + 1}. 장착`)
          .setEmoji('✅')
          .setStyle(ButtonStyle.Primary)
      );
    });
  }

  if (equipped.length > 0) {
    // 장착된 스킬 해제 버튼 (최대 3개)
    equipped.slice(0, Math.min(3, 5 - actionButtons.length)).forEach((skill, index) => {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId(`${INVENTORY_BUTTON_PREFIX}${INVENTORY_ACTION.unequipSkill}:${skill.id}`)
          .setLabel(`${index + 1}. 해제`)
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
      );
    });
  }

  if (actionButtons.length > 0) {
    rows.push(new ActionRowBuilder().addComponents(actionButtons));
  }

  // 두 번째 행: 탭 전환 버튼
  const navButtons = [
    new ButtonBuilder()
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}tab:equipment`)
      .setLabel('장비')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}tab:consumable`)
      .setLabel('소비템')
      .setEmoji('💊')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('back_to_profile')
      .setLabel('프로필로')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
  ];

  rows.push(new ActionRowBuilder().addComponents(navButtons));

  return rows;
}

function createConsumableActionRow(consumables) {
  const rows = [];

  // 첫 번째 행: 소비템 사용 버튼 (최대 5개)
  const useButtons = consumables.slice(0, 5).map((item, index) => {
    return new ButtonBuilder()
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}use:${item.id}`)
      .setLabel(`${index + 1}. 사용`)
      .setEmoji('💊')
      .setStyle(ButtonStyle.Primary);
  });

  if (useButtons.length > 0) {
    rows.push(new ActionRowBuilder().addComponents(useButtons));
  }

  // 두 번째 행: 탭 전환 버튼
  const navButtons = [
    new ButtonBuilder()
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}tab:equipment`)
      .setLabel('장비')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}tab:skill`)
      .setLabel('스킬')
      .setEmoji('📚')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('back_to_profile')
      .setLabel('프로필로')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
  ];

  rows.push(new ActionRowBuilder().addComponents(navButtons));

  return rows;
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
        consumables: {
          orderBy: { createdAt: 'desc' },
        },
        skills: {
          orderBy: { level: 'desc' },
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
    const actionRows = createInventoryActionRow(character.equipment);

    await interaction.reply({
      embeds: [embed],
      components: actionRows,
    });
  },

  async handleInventoryButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(INVENTORY_BUTTON_PREFIX)) {
      return false;
    }

    const [action, param] = interaction.customId
      .slice(INVENTORY_BUTTON_PREFIX.length)
      .split(':');

    // 탭 전환
    if (action === 'tab') {
      const character = await prisma.character.findUnique({
        where: {
          userId: interaction.user.id,
        },
        include: {
          equipment: {
            orderBy: [{ equipped: 'desc' }, { rarity: 'desc' }, { createdAt: 'desc' }],
          },
          consumables: {
            orderBy: { createdAt: 'desc' },
          },
          skills: {
            orderBy: { level: 'desc' },
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

      if (param === INVENTORY_TAB.equipment) {
        await interaction.update({
          embeds: [createInventoryEmbed(character, character.equipment)],
          components: createInventoryActionRow(character.equipment),
        });

        return true;
      }

      if (param === INVENTORY_TAB.consumable) {
        await interaction.update({
          embeds: [createConsumableInventoryEmbed(character, character.consumables)],
          components: createConsumableActionRow(character.consumables),
        });

        return true;
      }

      if (param === INVENTORY_TAB.skill) {
        await interaction.update({
          embeds: [createSkillInventoryEmbed(character, character.skills || [])],
          components: createSkillActionRow(character.skills || []),
        });

        return true;
      }
    }

    // 소비템 사용
    if (action === INVENTORY_ACTION.use) {
      const consumableId = parseInt(param, 10);

      const consumable = await prisma.consumable.findUnique({
        where: { id: consumableId },
        include: { character: true },
      });

      if (!consumable || consumable.character.userId !== interaction.user.id) {
        await interaction.reply({
          content: '이 아이템에 접근할 수 없습니다.',
          ephemeral: true,
        });

        return true;
      }

      const character = consumable.character;

      if (consumable.effect === 'attendance_ticket') {
        const rarity = rollAttendanceTicketRarity();
        const newEquipment = generateEquipment(Math.max(character.level, 1), { rarity });

        await prisma.$transaction(async (tx) => {
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

          if (consumable.quantity > 1) {
            await tx.consumable.update({
              where: { id: consumableId },
              data: {
                quantity: consumable.quantity - 1,
              },
            });
          } else {
            await tx.consumable.delete({
              where: { id: consumableId },
            });
          }
        });

        const rarityData = RARITIES[newEquipment.rarity];

        await interaction.reply({
          content: [
            `✅ ${consumable.name} 사용!`,
            '',
            `${rarityData.emoji} **${newEquipment.name}** 획득!`,
            `⚔️ 공격 +${newEquipment.attack} | 🛡️ 방어 +${newEquipment.defense}`,
            `❤️ HP +${newEquipment.hp} | 🔷 MP +${newEquipment.mana}`,
          ].join('\n'),
          ephemeral: true,
        });

        return true;
      }

      // 효과 적용
      let resultMessage = '';
      let hpChange = 0;
      let manaChange = 0;

      if (consumable.effect === 'heal_hp') {
        hpChange = Math.min(consumable.power, character.maxHp - character.hp);
        resultMessage = `❤️ HP +${hpChange} 회복`;
      } else if (consumable.effect === 'heal_mp') {
        manaChange = Math.min(consumable.power, (character.maxMana || 0) - (character.mana || 0));
        resultMessage = `🔷 MP +${manaChange} 회복`;
      } else if (consumable.effect === 'buff_regen') {
        resultMessage = `💚 HP 재생 효과 (${Math.floor(consumable.duration / 60)}분) - 버프는 나중에 구현`;
      } else {
        await interaction.reply({
          content: '아직 사용할 수 없는 아이템입니다.',
          ephemeral: true,
        });

        return true;
      }

      // 트랜잭션: 아이템 소모 & 효과 적용
      await prisma.$transaction(async (tx) => {
        // 캐릭터 상태 업데이트
        await tx.character.update({
          where: { id: character.id },
          data: {
            hp: character.hp + hpChange,
            mana: (character.mana || 0) + manaChange,
          },
        });

        // 아이템 수량 감소
        if (consumable.quantity > 1) {
          await tx.consumable.update({
            where: { id: consumableId },
            data: {
              quantity: consumable.quantity - 1,
            },
          });
        } else {
          await tx.consumable.delete({
            where: { id: consumableId },
          });
        }
      });

      await interaction.reply({
        content: [
          `✅ ${consumable.name} 사용!`,
          '',
          resultMessage,
          '',
          `❤️ HP: ${character.hp + hpChange}/${character.maxHp}`,
          `🔷 MP: ${(character.mana || 0) + manaChange}/${character.maxMana || 0}`,
        ].join('\n'),
        ephemeral: true,
      });

      return true;
    }

    // 스킬 장착 (장비 조회 전에 처리해야 함)
    if (action === INVENTORY_ACTION.equipSkill) {
      const skillId = parseInt(param, 10);

      const skill = await prisma.skill.findUnique({
        where: { id: skillId },
        include: { character: true },
      });

      if (!skill || skill.character.userId !== interaction.user.id) {
        await interaction.reply({
          content: '이 스킬에 접근할 수 없습니다.',
          ephemeral: true,
        });

        return true;
      }

      // 장착된 스킬 개수 확인
      const equippedCount = await prisma.skill.count({
        where: {
          characterId: skill.characterId,
          equipped: true,
        },
      });

      if (equippedCount >= 3) {
        await interaction.reply({
          content: '❌ 스킬 슬롯이 가득 찼습니다. (최대 3개)\n다른 스킬을 해제하고 다시 시도하세요.',
          ephemeral: true,
        });

        return true;
      }

      // 스킬 장착
      await prisma.skill.update({
        where: { id: skillId },
        data: { equipped: true },
      });

      const { getAdvancedSkillByKey } = require('../game/advanced-skills');
      const skillData = getAdvancedSkillByKey(skill.character.advancedClass, skill.skillKey);

      await interaction.reply({
        content: `✅ ${skillData?.emoji || ''} ${skillData?.name || '스킬'}을(를) 장착했습니다!`,
        ephemeral: true,
      });

      return true;
    }

    // 스킬 해제 (장비 조회 전에 처리해야 함)
    if (action === INVENTORY_ACTION.unequipSkill) {
      const skillId = parseInt(param, 10);

      const skill = await prisma.skill.findUnique({
        where: { id: skillId },
        include: { character: true },
      });

      if (!skill || skill.character.userId !== interaction.user.id) {
        await interaction.reply({
          content: '이 스킬에 접근할 수 없습니다.',
          ephemeral: true,
        });

        return true;
      }

      // 스킬 해제
      await prisma.skill.update({
        where: { id: skillId },
        data: { equipped: false },
      });

      const { getAdvancedSkillByKey } = require('../game/advanced-skills');
      const skillData = getAdvancedSkillByKey(skill.character.advancedClass, skill.skillKey);

      await interaction.reply({
        content: `❌ ${skillData?.emoji || ''} ${skillData?.name || '스킬'}을(를) 해제했습니다.`,
        ephemeral: true,
      });

      return true;
    }

    // 이하 장비 관련 액션
    const equipmentId = parseInt(param, 10);

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
      if (equipment.equipped) {
        await interaction.reply({
          content: '⚠️ 장착 중인 장비는 삭제할 수 없습니다. 먼저 해제해주세요.',
          ephemeral: true,
        });

        return true;
      }

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
