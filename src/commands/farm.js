/**
 * Farm Command
 * 농장 필드 관리
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');
const {
  FIELD_TYPES,
  CROP_TYPES,
  getAvailableFields,
  getOwnedFields,
} = require('../game/farm-fields');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('farm')
    .setNameLocalizations({ ko: '농장' })
    .setDescription('농장 필드 관리')
    .setDescriptionLocalizations({ ko: '농장 필드 관리' })
    .addSubcommand(sub =>
      sub.setName('status')
        .setNameLocalizations({ ko: '상태' })
        .setDescription('내 농장 필드 확인')
        .setDescriptionLocalizations({ ko: '내 농장 필드 확인' })
    )
    .addSubcommand(sub =>
      sub.setName('discover')
        .setNameLocalizations({ ko: '탐색' })
        .setDescription('새 필드 탐색')
        .setDescriptionLocalizations({ ko: '새 필드 탐색' })
        .addStringOption(opt =>
          opt.setName('zone')
            .setNameLocalizations({ ko: '지역' })
            .setDescription('탐색할 지역')
            .setDescriptionLocalizations({ ko: '탐색할 지역' })
            .setRequired(true)
            .addChoices(
              { name: 'Zone 3 (초급)', value: 'zone3' },
              { name: 'Zone 4 (중급)', value: 'zone4' },
              { name: 'Zone 5 (고급)', value: 'zone5' }
            )
        )
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'status') {
      return await handleStatus(interaction, { prisma });
    }

    if (subcommand === 'discover') {
      return await handleDiscover(interaction, { prisma });
    }
  },
};

async function handleStatus(interaction, { prisma }) {
  const character = await requireCharacter(prisma, interaction, {
    include: { ownedFields: true },
  });
  if (!character) return;

  const fields = await getOwnedFields(character.id);

  if (fields.length === 0) {
    return interaction.reply({
      content: '❌ 소유한 필드가 없습니다.\n💡 `/farm discover`로 필드를 탐색하세요!',
      ephemeral: true,
    });
  }

  const fieldLines = fields.map((field) => {
    const config = FIELD_TYPES[field.fieldType];
    const crop = field.cropType ? CROP_TYPES[field.cropType] : null;

    let status = '🟢 비어있음';
    if (crop) {
      const now = new Date();
      const harvestAt = new Date(field.harvestAt);
      const hoursLeft = Math.ceil((harvestAt - now) / (1000 * 60 * 60));

      if (now >= harvestAt) {
        status = `✅ 수확 가능! ${crop.emoji} ${crop.name}`;
      } else {
        status = `🌱 재배 중... ${crop.emoji} ${crop.name} (${hoursLeft}시간 남음)`;
      }
    }

    return [
      `${config.emoji} **${config.name} #${field.fieldIndex}**`,
      `   ${status}`,
      `   💰 유지비: ${config.dailyFee.toLocaleString()}G/일`,
    ].join('\n');
  });

  const maxFields = character.specialProductionClass === 'druid' ? 4 : 2;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`🌾 ${character.name}의 농장`)
    .setDescription(
      [
        createDivider(),
        ...fieldLines,
        '',
        createDivider(),
        `📊 필드: ${fields.length}/${maxFields}개`,
        character.specialProductionClass === 'druid' ? '✨ 드루이드 보너스: 성장 속도 +50%, 수확량 +30%' : '',
      ]
        .filter(Boolean)
        .join('\n')
    );

  const buttons = [];

  // 수확 가능한 필드 버튼
  const harvestable = fields.filter((f) => f.cropType && new Date() >= new Date(f.harvestAt));
  for (let i = 0; i < Math.min(harvestable.length, 3); i++) {
    const field = harvestable[i];
    const config = FIELD_TYPES[field.fieldType];
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`farm_harvest:${field.id}`)
        .setLabel(`수확 #${field.fieldIndex}`)
        .setEmoji(config.emoji)
        .setStyle(ButtonStyle.Success)
    );
  }

  // 씨앗 심기 버튼
  const empty = fields.filter((f) => !f.cropType);
  if (empty.length > 0) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('farm_plant_menu')
        .setLabel('씨앗 심기')
        .setEmoji('🌱')
        .setStyle(ButtonStyle.Primary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId('farm_abandon_menu')
      .setLabel('필드 포기')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Danger)
  );

  const rows = buttons.length > 0 ? [new ActionRowBuilder().addComponents(buttons)] : [];

  await interaction.reply({ embeds: [embed], components: rows });
}

async function handleDiscover(interaction, { prisma }) {
  const zone = interaction.options.getString('zone');
  const character = await requireCharacter(prisma, interaction, {
    include: { ownedFields: true },
  });
  if (!character) return;

  const available = await getAvailableFields(zone);

  if (available.length === 0) {
    return interaction.reply({
      content: `❌ ${zone}에 점유 가능한 필드가 없습니다.`,
      ephemeral: true,
    });
  }

  const fieldLines = available.slice(0, 10).map((field) => {
    const config = FIELD_TYPES[field.fieldType];
    return `${config.emoji} **${config.name} #${field.fieldIndex}** - 점유비: ${config.claimCost.toLocaleString()}G (유지비: ${config.dailyFee.toLocaleString()}G/일)`;
  });

  const maxFields = character.specialProductionClass === 'druid' ? 4 : 2;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`🔍 ${zone.toUpperCase()} 필드 탐색`)
    .setDescription(
      [
        createDivider(),
        ...fieldLines,
        available.length > 10 ? `... 외 ${available.length - 10}개` : '',
        '',
        createDivider(),
        `💡 현재 필드: ${character.ownedFields.length}/${maxFields}개`,
      ]
        .filter(Boolean)
        .join('\n')
    );

  const buttons = [];
  const claimable = available.slice(0, 5);

  for (let i = 0; i < claimable.length; i++) {
    const field = claimable[i];
    const config = FIELD_TYPES[field.fieldType];
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`farm_claim:${field.id}`)
        .setLabel(`점유 #${field.fieldIndex}`)
        .setEmoji(config.emoji)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(character.ownedFields.length >= maxFields || character.gold < config.claimCost)
    );
  }

  const rows = buttons.length > 0 ? [new ActionRowBuilder().addComponents(buttons)] : [];

  await interaction.reply({ embeds: [embed], components: rows });
}
