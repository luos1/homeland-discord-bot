const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { createCombatActionRows, createCombatEmbed } = require('../game/combat');
const {
  MONSTERS,
  getZone,
  listZoneChoices,
  listZones,
  ZONE_TYPES,
} = require('../game/monsters');
const { PROFILE_BUTTON_IDS } = require('./profile');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { createVillageHomeButton } = require('../utils/village');
const { cleanupOldSessions } = require('../game/session-cleanup');
const { requireCharacter } = require('../utils/response-helpers');

const zoneChoices = listZoneChoices();
const PROFILE_ZONE_BUTTON_PREFIX = 'profile_zone:';
const MONSTER_SELECT_PREFIX = 'monster_select:';
const ZONE_BUTTON_STYLES = {
  zone1: ButtonStyle.Primary,
  zone2: ButtonStyle.Secondary,
  zone3: ButtonStyle.Success,
  zone4: ButtonStyle.Primary,
};

function createZoneInfoEmbed(zoneKey) {
  const zone = getZone(zoneKey);
  
  if (!zone) {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.combat)
      .setTitle('❌ 존을 찾을 수 없습니다')
      .setDescription('유효하지 않은 존입니다.');
  }

  const monsterNames = zone.monsterKeys.map((key) => MONSTERS[key].name).join(', ');
  const bossNames = (zone.bossKeys || []).map((key) => MONSTERS[key].name).join(', ');
  const zoneTypeData = ZONE_TYPES[zone.zoneType];
  
  const typeInfo = zoneTypeData
    ? `${zoneTypeData.emoji} **${zoneTypeData.name}**\n${zoneTypeData.description}`
    : '';

  const statInfo = zoneTypeData
    ? [
        `⚔️ 몬스터 능력치: **x${zoneTypeData.statMultiplier}**`,
        `💰 골드 보상: **x${zoneTypeData.goldMultiplier}**`,
        `⭐ 경험치 보상: **x${zoneTypeData.xpMultiplier}**`,
        `✨ 레어 확률: **x${zoneTypeData.rareChanceMultiplier}**`,
      ].join('\n')
    : '';

  const resourceInfo = zone.resourceDrops && zone.resourceDrops.length > 0
    ? `**드롭 확률**: ${Math.floor(zone.dropChance * 100)}%\n**자원 종류**: ${zone.resourceDrops.join(', ')}`
    : '';

  const specialMechanic = zone.specialMechanic || '';

  const monsterList = zone.monsterKeys
    .map((key) => {
      const monster = MONSTERS[key];
      const traitText = monster.trait ? ` | ${monster.trait}` : '';
      return `👹 **${monster.name}** (Lv.${monster.level}) - HP ${monster.hp}, ATK ${monster.attack}, DEF ${monster.defense}${traitText}`;
    })
    .join('\n');

  const bossList = (zone.bossKeys || [])
    .map((key) => {
      const boss = MONSTERS[key];
      const dropText = boss.guaranteedDrop ? `${boss.guaranteedDrop.rarity} 장비 확정 드롭` : '';
      const patternText = boss.skillPatterns && boss.skillPatterns.length > 0
        ? `   🧠 스킬 패턴: ${boss.skillPatterns.map((pattern) => pattern.name).join(', ')}`
        : '';
      return [
        `💀 **${boss.name}** (Lv.${boss.level})`,
        `   HP ${boss.hp}, ATK ${boss.attack}, DEF ${boss.defense}`,
        patternText,
        dropText ? `   ✨ ${dropText}` : '',
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.combat)
    .setTitle(`${zone.emoji} ${zone.name} - 상세 정보`)
    .setDescription([
      createDivider(),
      `📍 **${zone.description}**`,
      `📊 권장 레벨: **${zone.recommendedLevel}**`,
      '',
      typeInfo,
      '',
      '**📈 보상 배율**',
      statInfo,
      '',
      '**🎁 자원 드롭**',
      resourceInfo,
      specialMechanic ? '\n' + specialMechanic : '',
      '',
      createDivider(),
      '**👹 일반 몬스터**',
      monsterList,
      bossList ? '\n' + createDivider() + '\n**💀 필드 보스**\n' + bossList : '',
      createDivider(),
    ].filter(Boolean).join('\n'));
}

function createZoneSelectionEmbed() {
  const zoneDescriptions = listZones()
    .map((zone) => {
      const monsterNames = zone.monsterKeys.map((key) => MONSTERS[key].name).join(', ');
      const bossNames = (zone.bossKeys || []).map((key) => MONSTERS[key].name).join(', ');
      const zoneTypeData = ZONE_TYPES[zone.zoneType];
      
      const typeInfo = zoneTypeData
        ? `${zoneTypeData.emoji} **${zoneTypeData.name}** - ${zoneTypeData.description}`
        : '';

      const statInfo = zoneTypeData
        ? `능력치: **x${zoneTypeData.statMultiplier}** | 골드: **x${zoneTypeData.goldMultiplier}** | 경험치: **x${zoneTypeData.xpMultiplier}** | 레어: **x${zoneTypeData.rareChanceMultiplier}**`
        : '';

      // 자원 드롭 정보
      const resourceInfo = zone.resourceDrops && zone.resourceDrops.length > 0
        ? `자원 드롭 (${Math.floor(zone.dropChance * 100)}%): ${zone.resourceDrops.join(', ')}`
        : '';

      const specialMechanic = zone.specialMechanic
        ? zone.specialMechanic.replace(/\n/g, ' ')
        : '';

      return [
        `${zone.emoji} **${zone.name}** (${zone.label})`,
        typeInfo ? `   ${typeInfo}` : '',
        `   ${zone.description}`,
        `   📊 권장 레벨: **${zone.recommendedLevel}**`,
        statInfo ? `   📈 ${statInfo}` : '',
        `   👹 일반 몬스터: ${monsterNames}`,
        bossNames ? `   💀 필드 보스: ${bossNames}` : '',
        resourceInfo ? `   🎁 ${resourceInfo}` : '',
        specialMechanic ? `   ${specialMechanic}` : '',
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.combat)
    .setTitle('⚔️ 어디로 탐험을 떠날까요?')
    .setDescription([createDivider(), zoneDescriptions, createDivider()].join('\n'));
}

function createZoneSelectionActionRows() {
  const zoneButtons = listZones().map((zone) =>
    new ButtonBuilder()
      .setCustomId(`${PROFILE_ZONE_BUTTON_PREFIX}${zone.key}`)
      .setLabel(zone.name)
      .setEmoji(zone.emoji)
      .setStyle(ZONE_BUTTON_STYLES[zone.key] ?? ButtonStyle.Secondary),
  );

  return [
    new ActionRowBuilder().addComponents(zoneButtons),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(PROFILE_BUTTON_IDS.stats)
        .setLabel('프로필')
        .setEmoji('📊')
        .setStyle(ButtonStyle.Secondary),
      createVillageHomeButton(),
    ),
  ];
}

function createMonsterSelectionEmbed(zone) {
  const monsterDescriptions = zone.monsterKeys
    .map((key) => {
      const monster = MONSTERS[key];
      return [
        `👹 **${monster.name}** (Lv.${monster.level})`,
        `   ❤️ 체력: ${monster.hp}`,
        `   ⚔️ 공격력: ${monster.attack}`,
        `   🛡️ 방어력: ${monster.defense}`,
        monster.trait ? `   🧬 특성: ${monster.trait}` : '',
        `   🎁 보상: 경험치 ${monster.xpReward}, 골드 ${monster.goldMin}-${monster.goldMax}`,
      ].join('\n');
    })
    .join('\n\n');

  const bossDescriptions = (zone.bossKeys || [])
    .map((key) => {
      const boss = MONSTERS[key];
      const dropText = boss.guaranteedDrop
        ? `${boss.guaranteedDrop.rarity} 장비 확정 드롭`
        : '';
      const patternText = boss.skillPatterns && boss.skillPatterns.length > 0
        ? `스킬 패턴: ${boss.skillPatterns.map((pattern) => pattern.name).join(', ')}`
        : '';
      return [
        `💀 **${boss.name}** (Lv.${boss.level}) ⚠️ 필드 보스`,
        `   ${boss.description || ''}`,
        patternText ? `   🧠 ${patternText}` : '',
        `   ❤️ 체력: ${boss.hp}`,
        `   ⚔️ 공격력: ${boss.attack}`,
        `   🛡️ 방어력: ${boss.defense}`,
        `   🎁 보상: 경험치 ${boss.xpReward}, 골드 ${boss.goldMin}-${boss.goldMax}`,
        dropText ? `   ✨ ${dropText}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.combat)
    .setTitle(`${zone.emoji} ${zone.name} - 전투 대상 선택`)
    .setDescription([
      createDivider(),
      `📍 ${zone.description}`,
      `⚠️ 권장 레벨: ${zone.recommendedLevel}`,
      createDivider(),
      '👹 일반 몬스터',
      monsterDescriptions,
      bossDescriptions ? '\n' + createDivider() + '\n💀 필드 보스\n' + bossDescriptions : '',
      createDivider(),
      '💡 전투할 대상을 선택하세요!',
    ].join('\n'));
}

function createMonsterSelectionActionRows(zoneKey, zone) {
  const monsterButtons = zone.monsterKeys.map((monsterKey) => {
    const monster = MONSTERS[monsterKey];
    return new ButtonBuilder()
      .setCustomId(`${MONSTER_SELECT_PREFIX}${zoneKey}:${monsterKey}`)
      .setLabel(`${monster.name} (Lv.${monster.level})`)
      .setEmoji('👹')
      .setStyle(ButtonStyle.Danger);
  });

  const bossButtons = (zone.bossKeys || []).map((bossKey) => {
    const boss = MONSTERS[bossKey];
    return new ButtonBuilder()
      .setCustomId(`${MONSTER_SELECT_PREFIX}${zoneKey}:${bossKey}`)
      .setLabel(`${boss.name} (Lv.${boss.level})`)
      .setEmoji('💀')
      .setStyle(ButtonStyle.Danger);
  });

  const rows = [];

  // 일반 몬스터 버튼
  if (monsterButtons.length > 0) {
    rows.push(new ActionRowBuilder().addComponents(monsterButtons));
  }

  // 보스 버튼
  if (bossButtons.length > 0) {
    rows.push(new ActionRowBuilder().addComponents(bossButtons));
  }

  // 존 정보 + 뒤로가기 버튼
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`zone_info:${zoneKey}`)
        .setLabel('존 정보 보기')
        .setEmoji('ℹ️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('back_to_zones')
        .setLabel('뒤로 가기')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return rows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('explore')
    .setDescription('탐험지를 선택해 전투를 시작합니다')
    .addStringOption((option) =>
      option
        .setName('zone')
        .setDescription('탐험할 존을 선택하세요')
        .setRequired(false)
        .addChoices(...zoneChoices),
    ),

  async execute(interaction, { prisma }) {
    const zoneKey = interaction.options.getString('zone');

    if (!zoneKey) {
      await interaction.reply({
        embeds: [createZoneSelectionEmbed()],
        components: createZoneSelectionActionRows(),
        ephemeral: true,
      });

      return;
    }

    const zone = getZone(zoneKey);

    if (!zone) {
      await interaction.reply({
        content: '유효하지 않은 탐험지입니다.',
        ephemeral: true,
      });

      return;
    }

    // 오래된 세션 자동 정리 (30분 이상)
    const cleaned = await cleanupOldSessions(prisma, interaction.user.id);
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} old session(s) for user ${interaction.user.id}`);
    }

    const character = await requireCharacter(prisma, interaction, { include: { combatSession: true, skills: true } });
    if (!character) return;

    if (character.combatSession) {
      const embed = createCombatEmbed({
        character,
        session: character.combatSession,
        battleLog: ['이미 진행 중인 전투가 있습니다.'],
        title: `⚔️ 진행 중 전투 - ${character.combatSession.monsterName}`,
        status: 'ongoing',
      });

      await interaction.reply({
        embeds: [embed],
        components: createCombatActionRows(character.combatSession.id, { character }),
        ephemeral: true,
      });

      return;
    }

    if (character.level < zone.minLevel) {
      await interaction.reply({
        content: `${zone.name}은(는) 레벨 ${zone.minLevel}+ 권장 구역입니다. 현재 레벨은 ${character.level}입니다.`,
        ephemeral: true,
      });

      return;
    }

    // 몬스터 선택 화면 보여주기
    await interaction.reply({
      embeds: [createMonsterSelectionEmbed(zone)],
      components: createMonsterSelectionActionRows(zoneKey, zone),
      ephemeral: true,
    });
  },
  createZoneSelectionEmbed,
  createZoneSelectionActionRows,
  createZoneInfoEmbed,
  createMonsterSelectionEmbed,
  createMonsterSelectionActionRows,
  MONSTER_SELECT_PREFIX,
  PROFILE_ZONE_BUTTON_PREFIX,
};
