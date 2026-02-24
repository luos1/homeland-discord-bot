/**
 * Farm Button Handlers
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const {
  FIELD_TYPES,
  CROP_TYPES,
  claimField,
  plantCrop,
  harvestCrop,
  getOwnedFields,
} = require('./farm-fields');

const prisma = new PrismaClient();

async function handleFarmButton(interaction, { prisma }) {
  const customId = interaction.customId;

  // 필드 점유
  if (customId.startsWith('farm_claim:')) {
    return await handleClaimField(interaction);
  }

  // 수확
  if (customId.startsWith('farm_harvest:')) {
    return await handleHarvest(interaction);
  }

  // 씨앗 심기 메뉴
  if (customId === 'farm_plant_menu') {
    return await handlePlantMenu(interaction);
  }

  // 씨앗 심기
  if (customId.startsWith('farm_plant:')) {
    return await handlePlant(interaction);
  }

  // 필드 포기 메뉴
  if (customId === 'farm_abandon_menu') {
    return await handleAbandonMenu(interaction);
  }

  // 필드 포기
  if (customId.startsWith('farm_abandon:')) {
    return await handleAbandon(interaction);
  }

  // 작물 심기 확정
  if (customId.startsWith('farm_plant_crop:')) {
    return await handlePlantCrop(interaction);
  }

  return interaction.reply({ content: '알 수 없는 농장 버튼입니다.', ephemeral: true });
}

// ===== 필드 점유 =====

async function handleClaimField(interaction) {
  const fieldId = parseInt(interaction.customId.split(':')[1]);
  const userId = interaction.user.id;

  const character = await prisma.character.findUnique({
    where: { userId },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 먼저 생성하세요.', ephemeral: true });
  }

  const result = await claimField(character.id, fieldId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: result.message, ephemeral: true });
}

// ===== 수확 =====

async function handleHarvest(interaction) {
  const fieldId = parseInt(interaction.customId.split(':')[1]);
  const userId = interaction.user.id;

  const field = await prisma.farmField.findUnique({
    where: { id: fieldId },
    include: { owner: true },
  });

  if (!field || !field.owner || field.owner.userId !== userId) {
    return interaction.reply({ content: '❌ 권한이 없습니다.', ephemeral: true });
  }

  const result = await harvestCrop(fieldId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: result.message, ephemeral: true });
}

// ===== 씨앗 심기 메뉴 =====

async function handlePlantMenu(interaction) {
  const userId = interaction.user.id;

  const character = await prisma.character.findUnique({
    where: { userId },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 먼저 생성하세요.', ephemeral: true });
  }

  const fields = await getOwnedFields(character.id);
  const emptyFields = fields.filter((f) => !f.cropType);

  if (emptyFields.length === 0) {
    return interaction.reply({ content: '❌ 비어있는 필드가 없습니다.', ephemeral: true });
  }

  const fieldLines = emptyFields.map((field) => {
    const config = FIELD_TYPES[field.fieldType];
    return `${config.emoji} **${config.name} #${field.fieldIndex}**`;
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle('🌱 씨앗 심기')
    .setDescription(
      [
        createDivider(),
        '필드를 선택하세요:',
        '',
        ...fieldLines,
        '',
        createDivider(),
      ].join('\n')
    );

  const buttons = [];
  for (let i = 0; i < Math.min(emptyFields.length, 5); i++) {
    const field = emptyFields[i];
    const config = FIELD_TYPES[field.fieldType];
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`farm_plant:${field.id}`)
        .setLabel(`#${field.fieldIndex}`)
        .setEmoji(config.emoji)
        .setStyle(ButtonStyle.Primary)
    );
  }

  const rows = [new ActionRowBuilder().addComponents(buttons)];

  await interaction.update({ embeds: [embed], components: rows });
}

// ===== 씨앗 심기 =====

async function handlePlant(interaction) {
  const fieldId = parseInt(interaction.customId.split(':')[1]);
  const userId = interaction.user.id;

  const field = await prisma.farmField.findUnique({
    where: { id: fieldId },
    include: { owner: true },
  });

  if (!field || !field.owner || field.owner.userId !== userId) {
    return interaction.reply({ content: '❌ 권한이 없습니다.', ephemeral: true });
  }

  // 해당 필드 타입에 맞는 작물 목록
  const crops = Object.entries(CROP_TYPES).filter(
    ([, crop]) => crop.fieldType === field.fieldType
  );

  const cropLines = crops.map(([key, crop]) => {
    return `${crop.emoji} **${crop.name}** - 씨앗: ${crop.seedCost.toLocaleString()}G | 성장: ${crop.growthHours}h | 수확: x${crop.harvestAmount}`;
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`🌱 ${FIELD_TYPES[field.fieldType].name} #${field.fieldIndex}`)
    .setDescription(
      [
        createDivider(),
        '작물을 선택하세요:',
        '',
        ...cropLines,
        '',
        createDivider(),
        `💰 보유 골드: ${field.owner.gold.toLocaleString()}G`,
      ].join('\n')
    );

  const buttons = [];
  for (let i = 0; i < Math.min(crops.length, 5); i++) {
    const [key, crop] = crops[i];
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`farm_plant_crop:${fieldId}:${key}`)
        .setLabel(crop.name)
        .setEmoji(crop.emoji)
        .setStyle(ButtonStyle.Success)
        .setDisabled(field.owner.gold < crop.seedCost)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId('farm_plant_menu')
      .setLabel('뒤로')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary)
  );

  const rows = [new ActionRowBuilder().addComponents(buttons.slice(0, 5))];

  await interaction.update({ embeds: [embed], components: rows });
}

// ===== 작물 심기 확정 =====

async function handlePlantCrop(interaction) {
  const [, fieldId, cropType] = interaction.customId.split(':');
  const userId = interaction.user.id;

  const field = await prisma.farmField.findUnique({
    where: { id: parseInt(fieldId) },
    include: { owner: true },
  });

  if (!field || !field.owner || field.owner.userId !== userId) {
    return interaction.reply({ content: '❌ 권한이 없습니다.', ephemeral: true });
  }

  const result = await plantCrop(parseInt(fieldId), cropType);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: result.message, ephemeral: true });
}

// ===== 필드 포기 메뉴 =====

async function handleAbandonMenu(interaction) {
  const userId = interaction.user.id;

  const character = await prisma.character.findUnique({
    where: { userId },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 먼저 생성하세요.', ephemeral: true });
  }

  const fields = await getOwnedFields(character.id);

  if (fields.length === 0) {
    return interaction.reply({ content: '❌ 소유한 필드가 없습니다.', ephemeral: true });
  }

  const fieldLines = fields.map((field) => {
    const config = FIELD_TYPES[field.fieldType];
    return `${config.emoji} **${config.name} #${field.fieldIndex}**`;
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle('🚪 필드 포기')
    .setDescription(
      [
        createDivider(),
        '⚠️ 포기할 필드를 선택하세요',
        '심어진 작물은 모두 사라집니다!',
        '',
        ...fieldLines,
        '',
        createDivider(),
      ].join('\n')
    );

  const buttons = [];
  for (let i = 0; i < Math.min(fields.length, 5); i++) {
    const field = fields[i];
    const config = FIELD_TYPES[field.fieldType];
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`farm_abandon:${field.id}`)
        .setLabel(`#${field.fieldIndex}`)
        .setEmoji(config.emoji)
        .setStyle(ButtonStyle.Danger)
    );
  }

  const rows = [new ActionRowBuilder().addComponents(buttons)];

  await interaction.update({ embeds: [embed], components: rows });
}

// ===== 필드 포기 =====

async function handleAbandon(interaction) {
  const fieldId = parseInt(interaction.customId.split(':')[1]);
  const userId = interaction.user.id;

  const field = await prisma.farmField.findUnique({
    where: { id: fieldId },
    include: { owner: true },
  });

  if (!field || !field.owner || field.owner.userId !== userId) {
    return interaction.reply({ content: '❌ 권한이 없습니다.', ephemeral: true });
  }

  await prisma.farmField.update({
    where: { id: fieldId },
    data: {
      ownerId: null,
      claimedAt: null,
      lastPaid: null,
      cropType: null,
      plantedAt: null,
      harvestAt: null,
      waterCount: 0,
    },
  });

  const config = FIELD_TYPES[field.fieldType];

  await interaction.reply({
    content: `✅ ${config.emoji} ${config.name} #${field.fieldIndex}를 포기했습니다.`,
    ephemeral: true,
  });
}

module.exports = {
  handleFarmButton,
};
