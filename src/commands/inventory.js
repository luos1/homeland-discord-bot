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
const { RESOURCES } = require('../game/production-classes');
const { getResourceDynamicPrice } = require('../game/dynamic-pricing');
const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');

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
  resource: 'resource',
};

const MAX_BUTTONS_PER_ROW = 5;
const PRICE_HISTORY_LOOKBACK_HOURS = 48;
const PRICE_HISTORY_COMPARE_HOURS = 1;
const PRICE_HISTORY_RESOURCE_TYPE = 'resource';
const FALLBACK_RARITY = {
  name: '일반',
  emoji: '⚪',
  color: EMBED_COLORS.neutral,
};
const FALLBACK_EQUIPMENT_TYPE = {
  name: '장비',
  emoji: '📦',
};

function toSafeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(Boolean);
}

function toSafeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCharacterCollections(character) {
  return {
    equipment: toSafeArray(character?.equipment),
    consumables: toSafeArray(character?.consumables),
    skills: toSafeArray(character?.skills),
    resources: toSafeArray(character?.resources),
  };
}

function sortResourceInventory(resources) {
  return toSafeArray(resources)
    .filter((resource) => resource && Number(resource.quantity) > 0)
    .sort((a, b) => {
      const tierA = RESOURCES[a.type]?.tier || 0;
      const tierB = RESOURCES[b.type]?.tier || 0;
      if (tierA !== tierB) {
        return tierA - tierB;
      }

      const nameA = RESOURCES[a.type]?.name || a.name || a.type;
      const nameB = RESOURCES[b.type]?.name || b.name || b.type;
      return nameA.localeCompare(nameB, 'ko-KR');
    });
}

function resolvePriceTrendEmoji(changeRate) {
  if (!Number.isFinite(changeRate)) {
    return '➖';
  }

  if (changeRate > 0) {
    return '📈';
  }

  if (changeRate < 0) {
    return '📉';
  }

  return '➖';
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) {
    return '데이터 부족';
  }

  const rounded = Math.round(value * 100) / 100;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(2)}%`;
}

function buildResourceHistoryMap(rows, oneHourAgoMs) {
  const grouped = new Map();

  toSafeArray(rows).forEach((row) => {
    if (!row?.itemKey) {
      return;
    }

    const list = grouped.get(row.itemKey) || [];
    list.push(row);
    grouped.set(row.itemKey, list);
  });

  const historyMap = {};

  grouped.forEach((list, itemKey) => {
    const previous = list.find((row) => {
      const recordedAtMs = new Date(row.recordedAt).getTime();
      return Number.isFinite(recordedAtMs) && recordedAtMs <= oneHourAgoMs;
    });

    historyMap[itemKey] = {
      previous1hPrice: Number(previous?.avgPrice) > 0 ? Number(previous.avgPrice) : null,
    };
  });

  return historyMap;
}

async function getResourceHistoryMap(prisma, resourceKeys, now = new Date()) {
  const keys = toSafeArray(resourceKeys).filter(Boolean);
  if (keys.length === 0) {
    return {};
  }

  if (!prisma?.itemPriceHistory?.findMany) {
    return {};
  }

  const lookbackStart = new Date(now.getTime() - PRICE_HISTORY_LOOKBACK_HOURS * 60 * 60 * 1000);
  const oneHourAgoMs = now.getTime() - PRICE_HISTORY_COMPARE_HOURS * 60 * 60 * 1000;

  const rows = await prisma.itemPriceHistory.findMany({
    where: {
      itemType: PRICE_HISTORY_RESOURCE_TYPE,
      itemKey: {
        in: keys,
      },
      recordedAt: {
        gte: lookbackStart,
        lte: now,
      },
    },
    select: {
      itemKey: true,
      avgPrice: true,
      recordedAt: true,
    },
    orderBy: [
      {
        itemKey: 'asc',
      },
      {
        recordedAt: 'desc',
      },
    ],
  });

  return buildResourceHistoryMap(rows, oneHourAgoMs);
}

async function createResourceInventoryEmbed(character, resources, prisma) {
  const sortedResources = sortResourceInventory(resources);

  if (sortedResources.length === 0) {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.profile)
      .setTitle(`📦 ${character?.name || '모험가'}의 자원`)
      .setDescription(
        [
          createDivider(),
          '보유한 자원이 없습니다.',
          '',
          '💡 `/gather`로 자원을 채집하세요',
          createDivider(),
        ].join('\n'),
      )
      .setFooter({
        text: '자원은 제작과 판매에 사용됩니다',
      });
  }

  const now = new Date();
  const itemKeys = sortedResources.map((resource) => resource.type);
  const [historyMap, priceRows] = await Promise.all([
    getResourceHistoryMap(prisma, itemKeys, now),
    Promise.all(
      sortedResources.map((resource) => getResourceDynamicPrice(prisma, resource.type, { now })),
    ),
  ]);

  const lines = sortedResources.slice(0, 15).map((resource, index) => {
    const info = RESOURCES[resource.type] || {};
    const name = info.name || resource.name || resource.type;
    const emoji = info.emoji || '📦';
    const quantity = Math.max(0, Number(resource.quantity) || 0);
    const rawNpcBuyPrice = Number(priceRows[index]?.npcBuyPrice);
    const currentNpcBuyPrice = Number.isFinite(rawNpcBuyPrice) && rawNpcBuyPrice > 0
      ? Math.floor(rawNpcBuyPrice)
      : 0;
    const previous1hPrice = Number(historyMap[resource.type]?.previous1hPrice) || 0;

    let trendEmoji = '➖';
    let trendText = '1h 데이터 부족';

    if (currentNpcBuyPrice > 0 && previous1hPrice > 0) {
      const changeRate = ((currentNpcBuyPrice - previous1hPrice) / previous1hPrice) * 100;
      trendEmoji = resolvePriceTrendEmoji(changeRate);
      trendText = `${formatSignedPercent(changeRate)} (1h)`;
    }

    const npcPriceText = currentNpcBuyPrice > 0
      ? `${formatNumber(currentNpcBuyPrice)}G`
      : '조회 실패';

    return [
      `${index + 1}. ${emoji} **${name}** x${formatNumber(quantity)}`,
      `   💰 NPC 매입가: ${npcPriceText} | ${trendEmoji} ${trendText}`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`📦 ${character?.name || '모험가'}의 자원`)
    .setDescription(
      [
        createDivider(),
        '보유 자원 시세',
        '',
        lines.join('\n\n'),
        sortedResources.length > 15 ? `... 외 ${sortedResources.length - 15}종` : '',
        '',
        createDivider(),
        '💡 `/sell_resources`로 NPC 매입가에 빠르게 판매할 수 있습니다',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({
      text: '1시간 등락률은 ItemPriceHistory 스냅샷 기준입니다',
    });
}

function createSafeActionRow(buttons) {
  const safeButtons = toSafeArray(buttons).slice(0, MAX_BUTTONS_PER_ROW);

  if (safeButtons.length === 0) {
    return null;
  }

  return new ActionRowBuilder().addComponents(safeButtons);
}

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
  const safeEquipmentList = toSafeArray(equipmentList);
  const equipped = safeEquipmentList.filter((e) => e.equipped);
  const unequipped = safeEquipmentList.filter((e) => !e.equipped);

  const equippedStats = calculateEquipmentStats(safeEquipmentList);

  const equippedLines = equipped.map((eq) => {
    const rarityData = RARITIES[eq.rarity] || FALLBACK_RARITY;
    const typeData = EQUIPMENT_TYPES[eq.type] || FALLBACK_EQUIPMENT_TYPE;
    const attack = toSafeNumber(eq.attack);
    const defense = toSafeNumber(eq.defense);
    const hp = toSafeNumber(eq.hp);
    const mana = toSafeNumber(eq.mana);
    const stats = [];
    if (attack > 0) stats.push(`공격 +${attack}`);
    if (defense > 0) stats.push(`방어 +${defense}`);
    if (hp > 0) stats.push(`HP +${hp}`);
    if (mana > 0) stats.push(`MP +${mana}`);

    return `${rarityData.emoji} ${typeData.emoji} **${eq.name || '이름 없는 장비'}** (${stats.join(', ')})`;
  });

  const unequippedLines = unequipped.slice(0, 10).map((eq, index) => {
    const rarityData = RARITIES[eq.rarity] || FALLBACK_RARITY;
    const typeData = EQUIPMENT_TYPES[eq.type] || FALLBACK_EQUIPMENT_TYPE;
    const attack = toSafeNumber(eq.attack);
    const defense = toSafeNumber(eq.defense);
    const hp = toSafeNumber(eq.hp);
    const mana = toSafeNumber(eq.mana);
    const stats = [];
    if (attack > 0) stats.push(`공격 +${attack}`);
    if (defense > 0) stats.push(`방어 +${defense}`);
    if (hp > 0) stats.push(`HP +${hp}`);
    if (mana > 0) stats.push(`MP +${mana}`);

    return `${index + 1}. ${rarityData.emoji} ${typeData.emoji} ${eq.name || '이름 없는 장비'} (${stats.join(', ')})`;
  });

  const effectLines = toSafeArray(equippedStats.effects)
    .map((effectKey) => EFFECTS[effectKey])
    .filter(Boolean)
    .map((effectData) => `${effectData.emoji} ${effectData.name}`);

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`🎒 ${character?.name || '모험가'}의 인벤토리`)
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
        `💰 총 ${safeEquipmentList.length}개의 장비 보유`,
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
  const safeSkills = toSafeArray(skills);
  const equipped = safeSkills.filter((s) => s.equipped);
  const unequipped = safeSkills.filter((s) => !s.equipped);

  const equippedLines = equipped.map((skill) => {
    const skillData = getAdvancedSkillByKey(character?.advancedClass, skill.skillKey);
    if (!skillData) return null;
    const skillLevel = toSafeNumber(skill.skillLevel);
    const levelInfo = skillLevel > 1 ? ` +${skillLevel}` : '';
    return `${skillData.emoji} **${skillData.name}**${levelInfo} (마나: ${skillData.manaCost})`;
  }).filter(Boolean);

  const unequippedLines = unequipped.slice(0, 10).map((skill, index) => {
    const skillData = getAdvancedSkillByKey(character?.advancedClass, skill.skillKey);
    if (!skillData) return null;
    const skillLevel = toSafeNumber(skill.skillLevel);
    const levelInfo = skillLevel > 1 ? ` +${skillLevel}` : '';
    return `${index + 1}. ${skillData.emoji} ${skillData.name}${levelInfo} (마나: ${skillData.manaCost})`;
  }).filter(Boolean);

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`📚 ${character?.name || '모험가'}의 스킬`)
    .setDescription(
      [
        createDivider(),
        character?.advancedClass ? `💎 전직: ${character.advancedClass}` : '⭐ 기본 스킬만 사용 가능',
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
        `🔮 총 ${safeSkills.length}개의 스킬 보유`,
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
  const safeConsumables = toSafeArray(consumables);
  const consumableLines = safeConsumables.slice(0, 15).map((item, index) => {
    const effectText = {
      heal_hp: `HP +${toSafeNumber(item.power)} 회복`,
      heal_mp: `MP +${toSafeNumber(item.power)} 회복`,
      buff_regen: `HP ${toSafeNumber(item.power)} 재생 (${Math.floor(toSafeNumber(item.duration) / 60)}분)`,
      attendance_ticket: '장비 가챠 1회 사용',
    }[item.effect] || item.effect;

    return `${index + 1}. **${item.name || '이름 없는 아이템'}** x${toSafeNumber(item.quantity)}\n   ${effectText || '효과 없음'}`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`🎒 ${character?.name || '모험가'}의 소비템`)
    .setDescription(
      [
        createDivider(),
        '💊 보유 소비 아이템',
        '',
        consumableLines.length > 0 ? consumableLines.join('\n\n') : '소비 아이템이 없습니다',
        safeConsumables.length > 15 ? `\n... 외 ${safeConsumables.length - 15}개` : '',
        '',
        createDivider(),
        '',
        `💰 총 ${safeConsumables.length}종의 소비템 보유`,
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
  const safeEquipmentList = toSafeArray(equipmentList);

  // 첫 번째 행: 장비 장착 버튼 (최대 5개)
  const unequipped = safeEquipmentList
    .filter((e) => !e.equipped)
    .slice(0, MAX_BUTTONS_PER_ROW);

  if (unequipped.length > 0) {
    const equipButtons = unequipped.map((eq, index) => {
      const typeData = EQUIPMENT_TYPES[eq.type] || FALLBACK_EQUIPMENT_TYPE;

      return new ButtonBuilder()
        .setCustomId(`${INVENTORY_BUTTON_PREFIX}equip:${eq.id}`)
        .setLabel(`${index + 1}. 장착`)
        .setEmoji(typeData.emoji)
        .setStyle(ButtonStyle.Primary);
    });

    const equipRow = createSafeActionRow(equipButtons);
    if (equipRow) {
      rows.push(equipRow);
    }
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
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}tab:resource`)
      .setLabel('자원')
      .setEmoji('📦')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('back_to_profile')
      .setLabel('프로필로')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
  ];

  const navRow = createSafeActionRow(navButtons);
  if (navRow) {
    rows.push(navRow);
  }

  return rows;
}

function createSkillActionRow(skills) {
  const safeSkills = toSafeArray(skills);
  const equipped = safeSkills.filter((s) => s.equipped);
  const unequipped = safeSkills.filter((s) => !s.equipped);
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
    const actionRow = createSafeActionRow(actionButtons);
    if (actionRow) {
      rows.push(actionRow);
    }
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
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}tab:resource`)
      .setLabel('자원')
      .setEmoji('📦')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('back_to_profile')
      .setLabel('프로필로')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
  ];

  const navRow = createSafeActionRow(navButtons);
  if (navRow) {
    rows.push(navRow);
  }

  return rows;
}

function createConsumableActionRow(consumables) {
  const rows = [];
  const safeConsumables = toSafeArray(consumables);

  // 첫 번째 행: 소비템 사용 버튼 (최대 5개)
  const useButtons = safeConsumables.slice(0, MAX_BUTTONS_PER_ROW).map((item, index) => {
    return new ButtonBuilder()
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}use:${item.id}`)
      .setLabel(`${index + 1}. 사용`)
      .setEmoji('💊')
      .setStyle(ButtonStyle.Primary);
  });

  if (useButtons.length > 0) {
    const useRow = createSafeActionRow(useButtons);
    if (useRow) {
      rows.push(useRow);
    }
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
      .setCustomId(`${INVENTORY_BUTTON_PREFIX}tab:resource`)
      .setLabel('자원')
      .setEmoji('📦')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('back_to_profile')
      .setLabel('프로필로')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
  ];

  const navRow = createSafeActionRow(navButtons);
  if (navRow) {
    rows.push(navRow);
  }

  return rows;
}

function createEquipmentDetailEmbed(equipment) {
  if (!equipment) {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.neutral)
      .setTitle('📦 장비 정보')
      .setDescription('장비 정보를 불러올 수 없습니다.');
  }

  const typeData = EQUIPMENT_TYPES[equipment.type] || FALLBACK_EQUIPMENT_TYPE;
  const rarityData = RARITIES[equipment.rarity] || FALLBACK_RARITY;
  const effectData = equipment.effect ? EFFECTS[equipment.effect] : null;
  const attack = toSafeNumber(equipment.attack);
  const defense = toSafeNumber(equipment.defense);
  const hp = toSafeNumber(equipment.hp);
  const mana = toSafeNumber(equipment.mana);

  const stats = [];
  if (attack > 0) stats.push(`⚔️ 공격력 +${attack}`);
  if (defense > 0) stats.push(`🛡️ 방어력 +${defense}`);
  if (hp > 0) stats.push(`❤️ 최대 체력 +${hp}`);
  if (mana > 0) stats.push(`🔷 최대 마나 +${mana}`);
  if (stats.length === 0) stats.push('기본 능력치 없음');

  return new EmbedBuilder()
    .setColor(rarityData.color)
    .setTitle(`${rarityData.emoji} ${equipment.name || '이름 없는 장비'}`)
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

function createResourceActionRow() {
  return [
    new ActionRowBuilder().addComponents(
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
        .setCustomId(`${INVENTORY_BUTTON_PREFIX}tab:skill`)
        .setLabel('스킬')
        .setEmoji('📚')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('back_to_profile')
        .setLabel('프로필로')
        .setEmoji('👤')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function createEquipmentActionRow(equipment) {
  if (!equipment || !equipment.id) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_inventory')
        .setLabel('인벤토리로')
        .setEmoji('🎒')
        .setStyle(ButtonStyle.Secondary),
    );
  }

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
    if (!interaction?.user?.id || typeof interaction.reply !== 'function') {
      return;
    }

    if (!prisma?.character?.findUnique) {
      await interaction.reply({
        content: '인벤토리를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true,
      });

      return;
    }

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
          orderBy: { skillLevel: 'desc' },
        },
        resources: {
          orderBy: { type: 'asc' },
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

    const collections = normalizeCharacterCollections(character);
    const normalizedCharacter = { ...character, ...collections };
    const embed = createInventoryEmbed(normalizedCharacter, normalizedCharacter.equipment);
    const actionRows = createInventoryActionRow(normalizedCharacter.equipment);

    await interaction.reply({
      embeds: [embed],
      components: actionRows,
    });
  },

  async handleInventoryButton(interaction, { prisma }) {
    if (!interaction?.customId || !interaction.customId.startsWith(INVENTORY_BUTTON_PREFIX)) {
      return false;
    }

    if (!prisma?.character?.findUnique) {
      if (typeof interaction.reply === 'function') {
        await interaction.reply({
          content: '인벤토리를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          ephemeral: true,
        });
      }

      return false;
    }

    const [action, ...params] = interaction.customId
      .slice(INVENTORY_BUTTON_PREFIX.length)
      .split(':');
    const param = params.join(':');

    if (!action) {
      return false;
    }

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
            orderBy: { skillLevel: 'desc' },
          },
          resources: {
            orderBy: { type: 'asc' },
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

      const collections = normalizeCharacterCollections(character);
      const normalizedCharacter = { ...character, ...collections };

      if (param === INVENTORY_TAB.equipment) {
        await interaction.update({
          embeds: [createInventoryEmbed(normalizedCharacter, normalizedCharacter.equipment)],
          components: createInventoryActionRow(normalizedCharacter.equipment),
        });

        return true;
      }

      if (param === INVENTORY_TAB.consumable) {
        await interaction.update({
          embeds: [createConsumableInventoryEmbed(normalizedCharacter, normalizedCharacter.consumables)],
          components: createConsumableActionRow(normalizedCharacter.consumables),
        });

        return true;
      }

      if (param === INVENTORY_TAB.skill) {
        await interaction.update({
          embeds: [createSkillInventoryEmbed(normalizedCharacter, normalizedCharacter.skills)],
          components: createSkillActionRow(normalizedCharacter.skills),
        });

        return true;
      }

      if (param === INVENTORY_TAB.resource) {
        await interaction.update({
          embeds: [
            await createResourceInventoryEmbed(
              normalizedCharacter,
              normalizedCharacter.resources,
              prisma,
            ),
          ],
          components: createResourceActionRow(),
        });

        return true;
      }

      await interaction.reply({
        content: '유효하지 않은 인벤토리 탭입니다.',
        ephemeral: true,
      });

      return true;
    }

    // 소비템 사용
    if (action === INVENTORY_ACTION.use) {
      const consumableId = Number.parseInt(param, 10);

      if (!Number.isInteger(consumableId)) {
        await interaction.reply({
          content: '유효하지 않은 소비 아이템입니다.',
          ephemeral: true,
        });

        return true;
      }

      const consumable = await prisma.consumable.findUnique({
        where: { id: consumableId },
        include: { character: true },
      });

      if (!consumable || !consumable.character || consumable.character.userId !== interaction.user.id) {
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
      const currentHp = toSafeNumber(character.hp);
      const currentMana = toSafeNumber(character.mana);
      const maxHp = toSafeNumber(character.maxHp);
      const maxMana = toSafeNumber(character.maxMana);
      const power = toSafeNumber(consumable.power);

      if (consumable.effect === 'heal_hp') {
        hpChange = Math.min(power, Math.max(maxHp - currentHp, 0));
        resultMessage = `❤️ HP +${hpChange} 회복`;
      } else if (consumable.effect === 'heal_mp') {
        manaChange = Math.min(power, Math.max(maxMana - currentMana, 0));
        resultMessage = `🔷 MP +${manaChange} 회복`;
      } else if (consumable.effect === 'buff_regen') {
        resultMessage = `💚 HP 재생 효과 (${Math.floor(toSafeNumber(consumable.duration) / 60)}분) - 버프는 나중에 구현`;
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
            hp: currentHp + hpChange,
            mana: currentMana + manaChange,
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
          `❤️ HP: ${currentHp + hpChange}/${maxHp}`,
          `🔷 MP: ${currentMana + manaChange}/${maxMana}`,
        ].join('\n'),
        ephemeral: true,
      });

      return true;
    }

    // 스킬 장착 (장비 조회 전에 처리해야 함)
    if (action === INVENTORY_ACTION.equipSkill) {
      const skillId = Number.parseInt(param, 10);

      if (!Number.isInteger(skillId)) {
        await interaction.reply({
          content: '유효하지 않은 스킬입니다.',
          ephemeral: true,
        });

        return true;
      }

      const skill = await prisma.skill.findUnique({
        where: { id: skillId },
        include: { character: true },
      });

      if (!skill || !skill.character || skill.character.userId !== interaction.user.id) {
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
      const skillId = Number.parseInt(param, 10);

      if (!Number.isInteger(skillId)) {
        await interaction.reply({
          content: '유효하지 않은 스킬입니다.',
          ephemeral: true,
        });

        return true;
      }

      const skill = await prisma.skill.findUnique({
        where: { id: skillId },
        include: { character: true },
      });

      if (!skill || !skill.character || skill.character.userId !== interaction.user.id) {
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
    const equipmentId = Number.parseInt(param, 10);

    if (!Number.isInteger(equipmentId)) {
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

    if (!equipment || !equipment.character || equipment.character.userId !== interaction.user.id) {
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
