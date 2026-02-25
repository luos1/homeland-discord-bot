/**
 * Special Role Command
 * 특수 역할 선택 (드루이드, 경비)
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');

const SPECIAL_ROLES = {
  druid: {
    name: '드루이드',
    emoji: '🌾',
    description: '농장을 운영하는 자연의 수호자',
    benefits: [
      '필드 4개까지 점유 가능 (일반: 2개)',
      '작물 성장 속도 +50%',
      '수확량 +30%',
      '생산 클래스와 병행 가능',
    ],
    cost: 10000,
  },
  guard: {
    name: '경비',
    emoji: '🛡️',
    description: '길드와 필드를 지키는 수호자',
    benefits: [
      '길드 필드 보호 (도적 방어 +50%)',
      '순찰 보상 획득',
      '길드 버프 제공 (방어력 +10%)',
      '전투 클래스와 병행 가능',
    ],
    cost: 10000,
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('specialrole')
		.setNameLocalizations({ "en-US": "specialrole" })
    .setDescription('특수 역할 선택 (드루이드, 경비)')
		.setDescriptionLocalizations({ "en-US": "특수 역할 선택 (드루이드, 경비)" })
    .setDescriptionLocalizations({ ko: '특수 역할 선택 (드루이드, 경비)' })
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('특수 역할 정보')
        .setDescriptionLocalizations({ ko: '특수 역할 정보' })
    )
    .addSubcommand(sub =>
      sub.setName('choose')
        .setDescription('특수 역할 선택')
        .setDescriptionLocalizations({ ko: '특수 역할 선택' })
        .addStringOption(opt =>
          opt.setName('role')
            .setDescription('선택할 역할')
            .setDescriptionLocalizations({ ko: '선택할 역할' })
            .setRequired(true)
            .addChoices(
              { name: '🌾 드루이드', value: 'druid' },
              { name: '🛡️ 경비', value: 'guard' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('특수 역할 해제')
        .setDescriptionLocalizations({ ko: '특수 역할 해제' })
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      return await handleInfo(interaction, { prisma });
    }

    if (subcommand === 'choose') {
      return await handleChoose(interaction, { prisma });
    }

    if (subcommand === 'reset') {
      return await handleReset(interaction, { prisma });
    }
  },
};

async function handleInfo(interaction, { prisma }) {
  const character = await requireCharacter(prisma, interaction);
  if (!character) return;

  const roleLines = Object.entries(SPECIAL_ROLES).map(([key, role]) => {
    const benefits = role.benefits.map(b => `   • ${b}`).join('\n');
    return [
      `${role.emoji} **${role.name}**`,
      `   ${role.description}`,
      benefits,
      `   💰 비용: ${role.cost.toLocaleString()}G`,
    ].join('\n');
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle('🎭 특수 역할')
    .setDescription(
      [
        createDivider(),
        '💡 **전투/생산 클래스와 별개로 선택 가능한 추가 역할입니다!**',
        '',
        ...roleLines,
        '',
        createDivider(),
        character.specialRole
          ? `📌 현재: ${SPECIAL_ROLES[character.specialRole].emoji} ${SPECIAL_ROLES[character.specialRole].name}`
          : '💡 `/specialrole choose` 명령어로 역할을 선택하세요!',
      ]
        .filter(Boolean)
        .join('\n')
    );

  const buttons = [];
  if (!character.specialRole) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('specialrole_choose:druid')
        .setLabel('드루이드')
        .setEmoji('🌾')
        .setStyle(ButtonStyle.Success)
        .setDisabled(character.gold < 10000),
      new ButtonBuilder()
        .setCustomId('specialrole_choose:guard')
        .setLabel('경비')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(character.gold < 10000)
    );
  } else {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('specialrole_reset')
        .setLabel('역할 해제')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Danger)
    );
  }

  const rows = buttons.length > 0 ? [new ActionRowBuilder().addComponents(buttons)] : [];

  await interaction.reply({ embeds: [embed], components: rows });
}

async function handleChoose(interaction, { prisma }) {
  const role = interaction.options.getString('role');
  const userId = interaction.user.id;

  const character = await prisma.character.findUnique({
    where: { userId },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 먼저 생성하세요.', ephemeral: true });
  }

  if (character.specialRole) {
    return interaction.reply({
      content: `❌ 이미 ${SPECIAL_ROLES[character.specialRole].emoji} ${SPECIAL_ROLES[character.specialRole].name} 역할을 선택했습니다.\n💡 \`/specialrole reset\`으로 해제 후 다시 선택하세요.`,
      ephemeral: true,
    });
  }

  const roleData = SPECIAL_ROLES[role];
  if (!roleData) {
    return interaction.reply({ content: '❌ 존재하지 않는 역할입니다.', ephemeral: true });
  }

  if (character.gold < roleData.cost) {
    return interaction.reply({
      content: `❌ 골드가 부족합니다. (${roleData.cost.toLocaleString()}G 필요)`,
      ephemeral: true,
    });
  }

  await prisma.character.update({
    where: { id: character.id },
    data: {
      specialRole: role,
      gold: {
        decrement: roleData.cost,
      },
    },
  });

  const benefits = roleData.benefits.map(b => `• ${b}`).join('\n');

  await interaction.reply({
    content: [
      `✅ ${roleData.emoji} **${roleData.name}** 역할을 선택했습니다!`,
      '',
      '**혜택:**',
      benefits,
      '',
      `💰 ${roleData.cost.toLocaleString()}G 차감`,
    ].join('\n'),
  });
}

async function handleReset(interaction, { prisma }) {
  const userId = interaction.user.id;

  const character = await prisma.character.findUnique({
    where: { userId },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 먼저 생성하세요.', ephemeral: true });
  }

  if (!character.specialRole) {
    return interaction.reply({ content: '❌ 선택한 특수 역할이 없습니다.', ephemeral: true });
  }

  const oldRole = SPECIAL_ROLES[character.specialRole];

  await prisma.character.update({
    where: { id: character.id },
    data: {
      specialRole: null,
    },
  });

  await interaction.reply({
    content: `✅ ${oldRole.emoji} ${oldRole.name} 역할을 해제했습니다.\n💡 다른 역할을 선택하려면 \`/specialrole choose\`를 사용하세요.`,
  });
}
