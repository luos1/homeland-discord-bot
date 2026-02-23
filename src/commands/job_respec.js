const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const {
  JOB_TYPES,
  JOB_RESPEC_BASE_COST,
  canRespec,
  getJobRespecCost,
  refreshJobRespecDemand,
  normalizeJobType,
  normalizeCombatClass,
  normalizeProductionClass,
  getCombatRespecClassKeys,
  getProductionRespecClassKeys,
  localizeCombatClassKey,
  getProductionClassName,
  getProductionClassEmoji,
} = require('../game/job-respec');
const {
  EMBED_COLORS,
  createDivider,
  formatNumber,
  localizeClassName,
} = require('../utils/ui');
const {
  createVillageNavigationRow,
  VILLAGE_MENU_KEYS,
} = require('../utils/village');

const VILLAGE_JOB_MANAGE_BUTTON_ID = 'village:job_manage';
const JOB_RESPEC_BUTTON_PREFIX = 'job_respec:';

const JOB_MANAGE_BUTTON_ID = `${JOB_RESPEC_BUTTON_PREFIX}manage`;
const COMBAT_RESPEC_BUTTON_ID = `${JOB_RESPEC_BUTTON_PREFIX}combat`;
const PRODUCTION_RESPEC_BUTTON_ID = `${JOB_RESPEC_BUTTON_PREFIX}production`;

const COMBAT_SELECT_PREFIX = `${JOB_RESPEC_BUTTON_PREFIX}combat_select:`;
const PRODUCTION_SELECT_PREFIX = `${JOB_RESPEC_BUTTON_PREFIX}production_select:`;
const RESPEC_CONFIRM_PREFIX = `${JOB_RESPEC_BUTTON_PREFIX}confirm:`;
const RESPEC_EXECUTE_PREFIX = `${JOB_RESPEC_BUTTON_PREFIX}execute:`;
const RESPEC_CANCEL_PREFIX = `${JOB_RESPEC_BUTTON_PREFIX}cancel:`;

const COMBAT_CLASS_EMOJI = Object.freeze({
  warrior: '⚔️',
  ranger: '🏹',
  sorcerer: '🔮',
});

function toCombatStorageClass(combatClass) {
  const normalized = normalizeCombatClass(combatClass);

  if (!normalized) {
    return combatClass;
  }

  if (normalized === 'warrior') {
    return '전사';
  }

  if (normalized === 'ranger') {
    return '궁수';
  }

  return '마법사';
}

function getCombatClassEmoji(combatClass) {
  const normalized = normalizeCombatClass(combatClass);

  if (!normalized) {
    return '⚔️';
  }

  return COMBAT_CLASS_EMOJI[normalized] || '⚔️';
}

function resolveCurrentClassKey(character, jobType) {
  if (jobType === JOB_TYPES.combat) {
    return normalizeCombatClass(character.class);
  }

  if (jobType === JOB_TYPES.production) {
    return normalizeProductionClass(character.productionClass);
  }

  return null;
}

function resolveClassLabel(jobType, classKey) {
  if (jobType === JOB_TYPES.combat) {
    return localizeCombatClassKey(classKey);
  }

  return getProductionClassName(classKey);
}

function resolveClassEmoji(jobType, classKey) {
  if (jobType === JOB_TYPES.combat) {
    return getCombatClassEmoji(classKey);
  }

  return getProductionClassEmoji(classKey);
}

function chunkButtons(buttons, size = 5) {
  const chunks = [];

  for (let i = 0; i < buttons.length; i += size) {
    chunks.push(buttons.slice(i, i + size));
  }

  return chunks;
}

function getCharacterForRespec(prisma, userId) {
  return prisma.character.findUnique({
    where: {
      userId,
    },
    include: {
      combatSession: true,
      gatherSessions: true,
      craftingSessions: true,
    },
  });
}

function createJobManageEmbed(character, { respecCheck }) {
  const productionClass = character.productionClass
    ? `${getProductionClassEmoji(character.productionClass)} ${getProductionClassName(character.productionClass)}`
    : '미선택';
  const currentCombatMastery = normalizeCombatClass(character.class) === 'warrior'
    ? character.warriorMastery || 0
    : normalizeCombatClass(character.class) === 'ranger'
      ? character.rangerMastery || 0
      : character.mageMastery || 0;

  const statusLine = respecCheck.allowed
    ? '✅ 현재 재전직이 가능합니다.'
    : `⚠️ ${respecCheck.reason}`;

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('💼 직업 관리')
    .setDescription(
      [
        createDivider(),
        `👤 ${character.name}`,
        `💰 보유 골드: ${formatNumber(character.gold)}G`,
        '',
        '현재 직업',
        `⚔️ 전투: ${localizeClassName(character.class)} Lv.${character.level} (숙련도 ${formatNumber(currentCombatMastery)})`,
        `🔨 생산: ${productionClass} Lv.${character.productionLevel}`,
        `🛠️ 숙련도: 📦 ${formatNumber(character.gathererMastery || 0)} | 🔨 ${formatNumber(character.blacksmithMastery || 0)} | 🧪 ${formatNumber(character.alchemistMastery || 0)}`,
        '',
        statusLine,
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '재전직 시 레벨/경험치/숙련도는 그대로 유지됩니다',
    });
}

function createJobManageComponents(character, { combatCost, productionCost, respecCheck }) {
  const canUseProductionRespec = Boolean(character.productionClass) && respecCheck.allowed;

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(COMBAT_RESPEC_BUTTON_ID)
        .setLabel(`전투 변경 (${formatNumber(combatCost)}G)`)
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!respecCheck.allowed),
      new ButtonBuilder()
        .setCustomId(PRODUCTION_RESPEC_BUTTON_ID)
        .setLabel(`생산 변경 (${formatNumber(productionCost)}G)`)
        .setEmoji('🔨')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canUseProductionRespec),
    ),
    createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.main }),
  ];
}

async function buildRespecChoices(prisma, character, jobType) {
  const classKeys = jobType === JOB_TYPES.combat
    ? getCombatRespecClassKeys()
    : getProductionRespecClassKeys();
  const currentClassKey = resolveCurrentClassKey(character, jobType);
  const candidateKeys = classKeys.filter((classKey) => classKey !== currentClassKey);

  const costs = await Promise.all(
    candidateKeys.map((classKey) => getJobRespecCost(jobType, classKey, prisma)),
  );

  return candidateKeys.map((classKey, index) => {
    const fallbackCost = JOB_RESPEC_BASE_COST[jobType] || 0;
    const resolvedCost = Number.isFinite(costs[index]) ? costs[index] : fallbackCost;

    return {
      classKey,
      label: resolveClassLabel(jobType, classKey),
      emoji: resolveClassEmoji(jobType, classKey),
      cost: resolvedCost,
    };
  });
}

function createRespecSelectionEmbed(character, jobType, choices) {
  const currentClassKey = resolveCurrentClassKey(character, jobType);
  const currentClassLabel = resolveClassLabel(jobType, currentClassKey || '');
  const title = jobType === JOB_TYPES.combat ? '⚔️ 전투 직업 변경' : '🔨 생산 직업 변경';
  const warning = jobType === JOB_TYPES.combat
    ? '⚠️ 전투 직업을 변경해도 레벨/경험치/숙련도는 유지됩니다.'
    : '⚠️ 생산 직업을 변경해도 레벨/경험치/숙련도는 유지됩니다.';

  const choiceLines = choices.map((choice, index) => {
    return `${index + 1}. ${choice.emoji} ${choice.label} (${formatNumber(choice.cost)}G)`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle(title)
    .setDescription(
      [
        createDivider(),
        `현재 직업: ${currentClassLabel || '없음'}`,
        `보유 골드: ${formatNumber(character.gold)}G`,
        '',
        warning,
        '변경할 직업을 선택하세요.',
        '',
        ...choiceLines,
        createDivider(),
      ].join('\n'),
    );
}

function createRespecSelectionComponents(jobType, choices) {
  const buttonPrefix = jobType === JOB_TYPES.combat
    ? COMBAT_SELECT_PREFIX
    : PRODUCTION_SELECT_PREFIX;

  const choiceButtons = choices.map((choice) => {
    return new ButtonBuilder()
      .setCustomId(`${buttonPrefix}${choice.classKey}`)
      .setLabel(`${choice.label} (${formatNumber(choice.cost)}G)`)
      .setEmoji(choice.emoji)
      .setStyle(ButtonStyle.Primary);
  });

  const rows = chunkButtons(choiceButtons).map((buttons) => {
    return new ActionRowBuilder().addComponents(buttons);
  });

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(JOB_MANAGE_BUTTON_ID)
        .setLabel('직업 관리로')
        .setEmoji('🔙')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  rows.push(createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.main }));

  return rows.slice(0, 5);
}

function parseClassSelection(customId, prefix) {
  if (!customId.startsWith(prefix)) {
    return null;
  }

  const classKey = customId.slice(prefix.length);
  return classKey || null;
}

function parseConfirmPayload(customId, prefix) {
  if (!customId.startsWith(prefix)) {
    return null;
  }

  const payload = customId.slice(prefix.length);
  const [jobTypeRaw, classKeyRaw] = payload.split(':');
  const jobType = normalizeJobType(jobTypeRaw);
  const classKey = String(classKeyRaw || '').trim().toLowerCase();

  if (!jobType || !classKey) {
    return null;
  }

  return {
    jobType,
    classKey,
  };
}

function createRespecConfirmEmbed(character, {
  jobType,
  fromClassKey,
  toClassKey,
  cost,
}) {
  const fromLabel = resolveClassLabel(jobType, fromClassKey || '');
  const toLabel = resolveClassLabel(jobType, toClassKey);
  const title = jobType === JOB_TYPES.combat
    ? '⚔️ 전투 직업 변경 확인'
    : '🔨 생산 직업 변경 확인';
  const nextGold = character.gold - cost;

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle(title)
    .setDescription(
      [
        createDivider(),
        `정말 ${toLabel}(으)로 변경하시겠습니까?`,
        '',
        `현재: ${fromLabel || '없음'} Lv.${jobType === JOB_TYPES.combat ? character.level : character.productionLevel}`,
        `변경: ${toLabel} Lv.${jobType === JOB_TYPES.combat ? character.level : character.productionLevel}`,
        '',
        `비용: ${formatNumber(cost)}G`,
        `보유: ${formatNumber(character.gold)}G → ${formatNumber(nextGold)}G`,
        createDivider(),
      ].join('\n'),
    );
}

function createRespecConfirmComponents(jobType, toClassKey, canAfford) {
  const confirmButton = new ButtonBuilder()
    .setCustomId(`${RESPEC_EXECUTE_PREFIX}${jobType}:${toClassKey}`)
    .setLabel('확인')
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!canAfford);

  const cancelButton = new ButtonBuilder()
    .setCustomId(`${RESPEC_CANCEL_PREFIX}${jobType}`)
    .setLabel('취소')
    .setEmoji('❌')
    .setStyle(ButtonStyle.Secondary);

  return [
    new ActionRowBuilder().addComponents(confirmButton, cancelButton),
    createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.main }),
  ];
}

async function showRespecSelection(interaction, { prisma, character, jobType }) {
  const check = canRespec(character);

  if (!check.allowed) {
    await interaction.reply({
      content: check.reason,
      ephemeral: true,
    });

    return true;
  }

  if (jobType === JOB_TYPES.production && !character.productionClass) {
    await interaction.reply({
      content: '생산 직업이 없어 생산 재전직을 진행할 수 없습니다.',
      ephemeral: true,
    });

    return true;
  }

  await refreshJobRespecDemand(prisma);

  const choices = await buildRespecChoices(prisma, character, jobType);

  if (choices.length === 0) {
    await interaction.reply({
      content: '현재 선택 가능한 다른 직업이 없습니다.',
      ephemeral: true,
    });

    return true;
  }

  await interaction.update({
    embeds: [createRespecSelectionEmbed(character, jobType, choices)],
    components: createRespecSelectionComponents(jobType, choices),
  });

  return true;
}

async function handleJobManageButton(interaction, { prisma }) {
  if (interaction.customId !== VILLAGE_JOB_MANAGE_BUTTON_ID
    && interaction.customId !== JOB_MANAGE_BUTTON_ID) {
    return false;
  }

  const character = await getCharacterForRespec(prisma, interaction.user.id);

  if (!character) {
    await interaction.reply({
      content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
      ephemeral: true,
    });

    return true;
  }

  await refreshJobRespecDemand(prisma);

  const [combatCost, productionCost] = await Promise.all([
    getJobRespecCost(JOB_TYPES.combat, 'warrior', prisma),
    getJobRespecCost(JOB_TYPES.production, 'blacksmith', prisma),
  ]);

  const resolvedCombatCost = Number.isFinite(combatCost)
    ? combatCost
    : JOB_RESPEC_BASE_COST[JOB_TYPES.combat];
  const resolvedProductionCost = Number.isFinite(productionCost)
    ? productionCost
    : JOB_RESPEC_BASE_COST[JOB_TYPES.production];
  const respecCheck = canRespec(character);

  await interaction.update({
    embeds: [
      createJobManageEmbed(character, {
        respecCheck,
      }),
    ],
    components: createJobManageComponents(character, {
      combatCost: resolvedCombatCost,
      productionCost: resolvedProductionCost,
      respecCheck,
    }),
  });

  return true;
}

async function handleCombatRespecButton(interaction, { prisma }) {
  if (interaction.customId !== COMBAT_RESPEC_BUTTON_ID) {
    return false;
  }

  const character = await getCharacterForRespec(prisma, interaction.user.id);

  if (!character) {
    await interaction.reply({
      content: '캐릭터가 없습니다.',
      ephemeral: true,
    });

    return true;
  }

  return showRespecSelection(interaction, {
    prisma,
    character,
    jobType: JOB_TYPES.combat,
  });
}

async function handleProductionRespecButton(interaction, { prisma }) {
  if (interaction.customId !== PRODUCTION_RESPEC_BUTTON_ID) {
    return false;
  }

  const character = await getCharacterForRespec(prisma, interaction.user.id);

  if (!character) {
    await interaction.reply({
      content: '캐릭터가 없습니다.',
      ephemeral: true,
    });

    return true;
  }

  return showRespecSelection(interaction, {
    prisma,
    character,
    jobType: JOB_TYPES.production,
  });
}

async function showRespecConfirm(interaction, { prisma, jobType, toClassKey }) {
  const character = await getCharacterForRespec(prisma, interaction.user.id);

  if (!character) {
    await interaction.reply({
      content: '캐릭터가 없습니다.',
      ephemeral: true,
    });

    return true;
  }

  const check = canRespec(character);

  if (!check.allowed) {
    await interaction.reply({
      content: check.reason,
      ephemeral: true,
    });

    return true;
  }

  const normalizedTargetClass = jobType === JOB_TYPES.combat
    ? normalizeCombatClass(toClassKey)
    : normalizeProductionClass(toClassKey);

  if (!normalizedTargetClass) {
    await interaction.reply({
      content: '유효하지 않은 직업입니다.',
      ephemeral: true,
    });

    return true;
  }

  const fromClassKey = resolveCurrentClassKey(character, jobType);

  if (!fromClassKey) {
    await interaction.reply({
      content: '현재 직업 정보를 확인할 수 없습니다.',
      ephemeral: true,
    });

    return true;
  }

  if (fromClassKey === normalizedTargetClass) {
    await interaction.reply({
      content: '현재 직업과 동일한 직업은 선택할 수 없습니다.',
      ephemeral: true,
    });

    return true;
  }

  const fallbackCost = JOB_RESPEC_BASE_COST[jobType] || 0;
  const resolvedCost = await getJobRespecCost(jobType, normalizedTargetClass, prisma);
  const cost = Number.isFinite(resolvedCost) ? resolvedCost : fallbackCost;

  if (character.gold < cost) {
    await interaction.reply({
      content: `골드가 부족합니다. 필요 골드: ${formatNumber(cost)}G`,
      ephemeral: true,
    });

    return true;
  }

  await interaction.update({
    embeds: [
      createRespecConfirmEmbed(character, {
        jobType,
        fromClassKey,
        toClassKey: normalizedTargetClass,
        cost,
      }),
    ],
    components: createRespecConfirmComponents(jobType, normalizedTargetClass, true),
  });

  return true;
}

async function executeRespec(interaction, { prisma, jobType, toClassKey }) {
  const character = await getCharacterForRespec(prisma, interaction.user.id);

  if (!character) {
    await interaction.reply({
      content: '캐릭터가 없습니다.',
      ephemeral: true,
    });

    return true;
  }

  const check = canRespec(character);

  if (!check.allowed) {
    await interaction.reply({
      content: check.reason,
      ephemeral: true,
    });

    return true;
  }

  const normalizedTargetClass = jobType === JOB_TYPES.combat
    ? normalizeCombatClass(toClassKey)
    : normalizeProductionClass(toClassKey);

  if (!normalizedTargetClass) {
    await interaction.reply({
      content: '유효하지 않은 직업입니다.',
      ephemeral: true,
    });

    return true;
  }

  const fromClassKey = resolveCurrentClassKey(character, jobType);

  if (!fromClassKey) {
    await interaction.reply({
      content: '현재 직업 정보를 확인할 수 없습니다.',
      ephemeral: true,
    });

    return true;
  }

  if (fromClassKey === normalizedTargetClass) {
    await interaction.reply({
      content: '현재 직업과 동일한 직업은 선택할 수 없습니다.',
      ephemeral: true,
    });

    return true;
  }

  const fallbackCost = JOB_RESPEC_BASE_COST[jobType] || 0;
  const resolvedCost = await getJobRespecCost(jobType, normalizedTargetClass, prisma);
  const cost = Number.isFinite(resolvedCost) ? resolvedCost : fallbackCost;

  if (character.gold < cost) {
    await interaction.reply({
      content: `골드가 부족합니다. 필요 골드: ${formatNumber(cost)}G`,
      ephemeral: true,
    });

    return true;
  }

  const updateData = jobType === JOB_TYPES.combat
    ? {
      class: toCombatStorageClass(normalizedTargetClass),
      gold: {
        decrement: cost,
      },
    }
    : {
      productionClass: normalizedTargetClass,
      gold: {
        decrement: cost,
      },
    };

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: {
        id: character.id,
      },
      data: updateData,
    });

    await tx.jobRespecHistory.create({
      data: {
        characterId: character.id,
        jobType,
        fromClass: fromClassKey,
        toClass: normalizedTargetClass,
        cost,
      },
    });
  });

  await refreshJobRespecDemand(prisma);

  const fromLabel = resolveClassLabel(jobType, fromClassKey);
  const toLabel = resolveClassLabel(jobType, normalizedTargetClass);
  const remainingGold = character.gold - cost;

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLORS.levelUp)
        .setTitle('✅ 재전직 완료')
        .setDescription(
          [
            createDivider(),
            `${resolveClassEmoji(jobType, normalizedTargetClass)} ${fromLabel} → ${toLabel}`,
            `💸 ${formatNumber(cost)}G 차감`,
            `💰 잔액: ${formatNumber(remainingGold)}G`,
            '',
            '📌 레벨, 경험치, 숙련도는 유지되었습니다.',
            createDivider(),
          ].join('\n'),
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(JOB_MANAGE_BUTTON_ID)
          .setLabel('직업 관리')
          .setEmoji('💼')
          .setStyle(ButtonStyle.Primary),
      ),
      createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.main }),
    ],
  });

  return true;
}

async function handleRespecConfirmButton(interaction, { prisma }) {
  const selectedCombatClass = parseClassSelection(interaction.customId, COMBAT_SELECT_PREFIX);

  if (selectedCombatClass) {
    return showRespecConfirm(interaction, {
      prisma,
      jobType: JOB_TYPES.combat,
      toClassKey: selectedCombatClass,
    });
  }

  const selectedProductionClass = parseClassSelection(interaction.customId, PRODUCTION_SELECT_PREFIX);

  if (selectedProductionClass) {
    return showRespecConfirm(interaction, {
      prisma,
      jobType: JOB_TYPES.production,
      toClassKey: selectedProductionClass,
    });
  }

  const confirmPayload = parseConfirmPayload(interaction.customId, RESPEC_CONFIRM_PREFIX);

  if (confirmPayload) {
    return showRespecConfirm(interaction, {
      prisma,
      jobType: confirmPayload.jobType,
      toClassKey: confirmPayload.classKey,
    });
  }

  const executePayload = parseConfirmPayload(interaction.customId, RESPEC_EXECUTE_PREFIX);

  if (executePayload) {
    return executeRespec(interaction, {
      prisma,
      jobType: executePayload.jobType,
      toClassKey: executePayload.classKey,
    });
  }

  if (interaction.customId.startsWith(RESPEC_CANCEL_PREFIX)) {
    const jobType = normalizeJobType(interaction.customId.slice(RESPEC_CANCEL_PREFIX.length));

    if (!jobType) {
      return false;
    }

    const character = await getCharacterForRespec(prisma, interaction.user.id);

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다.',
        ephemeral: true,
      });

      return true;
    }

    return showRespecSelection(interaction, {
      prisma,
      character,
      jobType,
    });
  }

  return false;
}

async function handleJobRespecButton(interaction, { prisma }) {
  if (interaction.customId !== VILLAGE_JOB_MANAGE_BUTTON_ID
    && !interaction.customId.startsWith(JOB_RESPEC_BUTTON_PREFIX)) {
    return false;
  }

  if (await handleJobManageButton(interaction, { prisma })) {
    return true;
  }

  if (await handleCombatRespecButton(interaction, { prisma })) {
    return true;
  }

  if (await handleProductionRespecButton(interaction, { prisma })) {
    return true;
  }

  if (await handleRespecConfirmButton(interaction, { prisma })) {
    return true;
  }

  return false;
}

module.exports = {
  isButtonHandlerOnly: true,
  VILLAGE_JOB_MANAGE_BUTTON_ID,
  JOB_RESPEC_BUTTON_PREFIX,
  JOB_MANAGE_BUTTON_ID,
  COMBAT_RESPEC_BUTTON_ID,
  PRODUCTION_RESPEC_BUTTON_ID,
  handleJobManageButton,
  handleCombatRespecButton,
  handleProductionRespecButton,
  handleRespecConfirmButton,
  handleJobRespecButton,
};
