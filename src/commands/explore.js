const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { createCombatActionRow, createCombatEmbed } = require('../game/combat');
const {
  MONSTERS,
  getZone,
  listZoneChoices,
  listZones,
  spawnMonster,
} = require('../game/monsters');
const { PROFILE_BUTTON_IDS } = require('./profile');
const { EMBED_COLORS, createDivider, localizeClassName } = require('../utils/ui');

const zoneChoices = listZoneChoices();
const PROFILE_ZONE_BUTTON_PREFIX = 'profile_zone:';
const ZONE_BUTTON_STYLES = {
  zone1: ButtonStyle.Primary,
  zone2: ButtonStyle.Secondary,
  zone3: ButtonStyle.Success,
};

function createZoneSelectionEmbed() {
  const zoneDescriptions = listZones()
    .map((zone) => {
      const monsterNames = zone.monsterKeys.map((key) => MONSTERS[key].name).join(', ');

      return [
        `${zone.emoji} ${zone.name} (${zone.label})`,
        `   설명: ${zone.description}`,
        `   권장 레벨: ${zone.recommendedLevel}`,
        `   몬스터: ${monsterNames}`,
        `   보상: ${zone.rewardStars}`,
      ].join('\n');
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
    ),
  ];
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

    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        combatSession: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
        ephemeral: true,
      });

      return;
    }

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
        components: [createCombatActionRow(character.combatSession.id)],
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

    let playerHp = character.hp;

    if (playerHp <= 0) {
      const revived = await prisma.character.update({
        where: {
          id: character.id,
        },
        data: {
          hp: character.maxHp,
        },
      });

      playerHp = revived.hp;
    }

    const monster = spawnMonster(zone.key);

    if (!monster) {
      await interaction.reply({
        content: '몬스터 생성에 실패했습니다. 다시 시도해주세요.',
        ephemeral: true,
      });

      return;
    }

    const session = await prisma.combatSession.create({
      data: {
        characterId: character.id,
        zone: zone.key,
        monsterName: monster.name,
        monsterHp: monster.hp,
        monsterMaxHp: monster.hp,
        monsterAttack: monster.attack,
        monsterDefense: monster.defense,
        monsterXpReward: monster.xpReward,
        monsterGoldMin: monster.goldMin,
        monsterGoldMax: monster.goldMax,
        playerHp,
        potionsRemaining: 3,
      },
    });

    const embed = createCombatEmbed({
      character: {
        ...character,
        hp: playerHp,
      },
      session,
      battleLog: [
        `${zone.emoji} ${zone.name}에 입장했습니다.`,
        `👹 ${monster.name} 등장!`,
        `🎯 ${localizeClassName(character.class)} ${character.name}, 전투 준비 완료!`,
      ],
      title: '💀 전투 시작!',
      status: 'ongoing',
    });

    await interaction.reply({
      embeds: [embed],
      components: [createCombatActionRow(session.id)],
    });
  },
};
