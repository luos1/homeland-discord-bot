const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { createDivider, EMBED_COLORS, formatNumber } = require('../utils/ui');
const {
  VILLAGE_BUTTON_PREFIX,
  VILLAGE_MENU_KEYS,
  buildVillageMenuCustomId,
  buildVillageOpenCustomId,
  parseVillageCustomId,
  createVillageNavigationRow,
  withVillageNavigation,
} = require('../utils/village');
const {
  VILLAGE_JOB_MANAGE_BUTTON_ID,
  handleJobManageButton,
} = require('./job_respec');

const VILLAGE_MENU_SET = new Set(Object.values(VILLAGE_MENU_KEYS));

const VILLAGE_OPEN_ACTIONS = Object.freeze({
  profile: 'profile',
  tutorial: 'tutorial',
  explore: 'explore',
  boss: 'boss',
  shop: 'shop',
  market: 'market',
  npcShop: 'npc_shop',
  auction: 'auction',
  production: 'production',
  daily: 'daily',
  attendance: 'attendance',
  premiumStatus: 'premium_status',
  premiumSubscribe: 'premium_subscribe',
  gem: 'gem',
  rankingOverview: 'ranking_overview',
  rankingCategory: 'ranking_category',
});

function resolveVillageMenuKey(menuKey) {
  if (VILLAGE_MENU_SET.has(menuKey)) {
    return menuKey;
  }

  return VILLAGE_MENU_KEYS.main;
}

async function getVillageCharacter(prisma, userId) {
  return prisma.character.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      name: true,
      class: true,
      level: true,
      gold: true,
      gems: true,
    },
  });
}

function createVillageMainEmbed(character) {
  const characterLine = character
    ? `👤 ${character.name} | Lv.${character.level} | ${character.class}`
    : '👤 캐릭터 없음 (`/create`로 생성)';
  const currencyLine = character
    ? `💰 ${formatNumber(character.gold)}G | 💠 ${formatNumber(character.gems || 0)}`
    : '💡 캐릭터 생성 후 모든 기능을 사용할 수 있습니다';

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('🏘️ 마을 허브')
    .setDescription(
      [
        createDivider(),
        characterLine,
        currencyLine,
        '',
        '원하는 카테고리를 버튼으로 이동하세요.',
        '',
        '⚔️ 전투 | 🏪 상점 | 📈 거래소 | 🔨 생산',
        '💎 프리미엄 | 📅 일일 | 🏆 랭킹',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '/village 또는 /town으로 언제든지 다시 열 수 있습니다',
    });
}

function createVillageMainComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(buildVillageMenuCustomId(VILLAGE_MENU_KEYS.combat))
        .setLabel('전투')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(buildVillageMenuCustomId(VILLAGE_MENU_KEYS.shop))
        .setLabel('상점')
        .setEmoji('🏪')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(buildVillageMenuCustomId(VILLAGE_MENU_KEYS.market))
        .setLabel('거래소')
        .setEmoji('📈')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(buildVillageMenuCustomId(VILLAGE_MENU_KEYS.production))
        .setLabel('생산')
        .setEmoji('🔨')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(buildVillageMenuCustomId(VILLAGE_MENU_KEYS.premium))
        .setLabel('프리미엄')
        .setEmoji('💎')
        .setStyle(ButtonStyle.Danger),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(buildVillageMenuCustomId(VILLAGE_MENU_KEYS.daily))
        .setLabel('일일')
        .setEmoji('📅')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(buildVillageMenuCustomId(VILLAGE_MENU_KEYS.ranking))
        .setLabel('랭킹')
        .setEmoji('🏆')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(VILLAGE_JOB_MANAGE_BUTTON_ID)
        .setLabel('직업 관리')
        .setEmoji('💼')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.profile))
        .setLabel('프로필')
        .setEmoji('📊')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function createCombatMenu(character) {
  const description = [
    createDivider(),
    character
      ? `👤 ${character.name} | Lv.${character.level}`
      : '캐릭터가 없으면 전투를 시작할 수 없습니다.',
    '',
    '⚔️ 탐험: 일반 몬스터 전투',
    '🐉 보스: 필드 보스 도전',
    '📚 튜토리얼: 튜토리얼 시작/재개',
    createDivider(),
  ].join('\n');

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLORS.combat)
        .setTitle('⚔️ 전투 메뉴')
        .setDescription(description),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.explore))
          .setLabel('탐험 시작')
          .setEmoji('🗺️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.boss))
          .setLabel('보스 목록')
          .setEmoji('🐉')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.tutorial))
          .setLabel('튜토리얼 시작')
          .setEmoji('📚')
          .setStyle(ButtonStyle.Secondary),
      ),
      createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.main }),
    ],
  };
}

function createShopMenu(character) {
  const description = [
    createDivider(),
    character
      ? `👤 ${character.name} | 💰 ${formatNumber(character.gold)}G`
      : '캐릭터가 없으면 상점을 이용할 수 없습니다.',
    '',
    '🏪 상점에서 포션/장비 구매와 판매를 진행합니다.',
    createDivider(),
  ].join('\n');

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLORS.profile)
        .setTitle('🏪 상점 메뉴')
        .setDescription(description),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.shop))
          .setLabel('상점 열기')
          .setEmoji('🛒')
          .setStyle(ButtonStyle.Success),
      ),
      createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.main }),
    ],
  };
}

function createMarketMenu(character) {
  const description = [
    createDivider(),
    character
      ? `👤 ${character.name} | 💰 ${formatNumber(character.gold)}G`
      : '캐릭터가 없으면 거래소를 이용할 수 없습니다.',
    '',
    '📈 거래소에서 자원/장비 거래를 진행합니다.',
    '🏪 NPC 상점에서 동적 시세를 확인합니다.',
    '🔨 경매장에서 실시간 입찰을 진행합니다.',
    createDivider(),
  ].join('\n');

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLORS.profile)
        .setTitle('📈 거래소 메뉴')
        .setDescription(description),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.market))
          .setLabel('거래소 열기')
          .setEmoji('🏪')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.npcShop))
          .setLabel('NPC 상점')
          .setEmoji('🧾')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.auction))
          .setLabel('경매장')
          .setEmoji('🔨')
          .setStyle(ButtonStyle.Danger),
      ),
      createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.main }),
    ],
  };
}

function createProductionMenu(character) {
  const description = [
    createDivider(),
    character
      ? `👤 ${character.name} | Lv.${character.level}`
      : '캐릭터가 없으면 생산을 시작할 수 없습니다.',
    '',
    '🔨 생산 직업 선택/확인과 생산 활동으로 이동합니다.',
    createDivider(),
  ].join('\n');

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLORS.profile)
        .setTitle('🔨 생산 메뉴')
        .setDescription(description),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.production))
          .setLabel('생산 열기')
          .setEmoji('⚒️')
          .setStyle(ButtonStyle.Secondary),
      ),
      createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.main }),
    ],
  };
}

function createPremiumMenu(character) {
  const description = [
    createDivider(),
    character
      ? `👤 ${character.name} | 💠 ${formatNumber(character.gems || 0)}`
      : '캐릭터가 없으면 프리미엄/젬 기능을 사용할 수 없습니다.',
    '',
    '💎 프리미엄 상태 확인/구독',
    '💠 젬 거래소(환율 확인 및 교환)',
    createDivider(),
  ].join('\n');

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLORS.warning)
        .setTitle('💎 프리미엄 메뉴')
        .setDescription(description),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.premiumStatus))
          .setLabel('프리미엄 상태')
          .setEmoji('📄')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.premiumSubscribe))
          .setLabel('구독 시작')
          .setEmoji('💳')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.gem))
          .setLabel('젬 교환')
          .setEmoji('💠')
          .setStyle(ButtonStyle.Primary),
      ),
      createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.main }),
    ],
  };
}

function createDailyMenu(character) {
  const description = [
    createDivider(),
    character
      ? `👤 ${character.name}`
      : '캐릭터가 없으면 일일 보상을 받을 수 없습니다.',
    '',
    '🎁 Daily Quest 확인',
    '📅 출석 체크 진행',
    createDivider(),
  ].join('\n');

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLORS.profile)
        .setTitle('📅 일일 메뉴')
        .setDescription(description),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.daily))
          .setLabel('Daily Quest')
          .setEmoji('🎁')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.attendance))
          .setLabel('출석 체크')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
      ),
      createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.main }),
    ],
  };
}

function createRankingMenu(character) {
  const description = [
    createDivider(),
    character
      ? `👤 ${character.name}`
      : '캐릭터가 없으면 개인 순위는 표시되지 않습니다.',
    '',
    '카테고리를 선택하면 해당 랭킹 화면으로 이동합니다.',
    createDivider(),
  ].join('\n');

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLORS.profile)
        .setTitle('🏆 랭킹 메뉴')
        .setDescription(description),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.rankingCategory, 'level'))
          .setLabel('레벨')
          .setEmoji('📈')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.rankingCategory, 'battle_wins'))
          .setLabel('전투')
          .setEmoji('⚔️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.rankingCategory, 'boss_kills'))
          .setLabel('보스')
          .setEmoji('🐉')
          .setStyle(ButtonStyle.Danger),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.rankingCategory, 'gold'))
          .setLabel('골드')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.rankingCategory, 'production_level'))
          .setLabel('생산')
          .setEmoji('🔨')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.rankingCategory, 'trade_volume'))
          .setLabel('거래')
          .setEmoji('📊')
          .setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(buildVillageOpenCustomId(VILLAGE_OPEN_ACTIONS.rankingOverview))
          .setLabel('전체 랭킹 열기')
          .setEmoji('🏅')
          .setStyle(ButtonStyle.Primary),
      ),
      createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.main }),
    ],
  };
}

function createVillagePayload(menuKey, character) {
  const safeMenuKey = resolveVillageMenuKey(menuKey);

  if (safeMenuKey === VILLAGE_MENU_KEYS.main) {
    return {
      embeds: [createVillageMainEmbed(character)],
      components: createVillageMainComponents(),
    };
  }

  if (safeMenuKey === VILLAGE_MENU_KEYS.combat) {
    return createCombatMenu(character);
  }

  if (safeMenuKey === VILLAGE_MENU_KEYS.shop) {
    return createShopMenu(character);
  }

  if (safeMenuKey === VILLAGE_MENU_KEYS.market) {
    return createMarketMenu(character);
  }

  if (safeMenuKey === VILLAGE_MENU_KEYS.production) {
    return createProductionMenu(character);
  }

  if (safeMenuKey === VILLAGE_MENU_KEYS.premium) {
    return createPremiumMenu(character);
  }

  if (safeMenuKey === VILLAGE_MENU_KEYS.daily) {
    return createDailyMenu(character);
  }

  return createRankingMenu(character);
}

async function showVillageMenu(interaction, { prisma, menuKey, mode = 'reply' }) {
  const character = await getVillageCharacter(prisma, interaction.user.id);
  const payload = createVillagePayload(menuKey, character);

  if (mode === 'update') {
    await interaction.update(payload);
    return;
  }

  await interaction.reply(payload);
}

function createOptionProxy(options = {}) {
  return {
    getString: options.getString || (() => null),
    getBoolean: options.getBoolean || (() => null),
    getSubcommand: options.getSubcommand || (() => null),
    getInteger: options.getInteger || (() => null),
  };
}

async function runCommandFromVillage({
  interaction,
  command,
  prisma,
  client,
  options,
  backTo,
}) {
  if (!command || typeof command.execute !== 'function') {
    await interaction.reply({
      content: '요청한 메뉴 명령어를 찾을 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  const sendPayload = async (payload = {}) => {
    const withNav = withVillageNavigation(payload, { backTo });

    if (withNav.ephemeral) {
      await interaction.reply(withNav);
      return;
    }

    const updatePayload = { ...withNav };
    delete updatePayload.ephemeral;
    await interaction.update(updatePayload);
  };

  const commandInteraction = {
    ...interaction,
    options: createOptionProxy(options),
    reply: sendPayload,
    update: sendPayload,
    followUp: interaction.followUp.bind(interaction),
    editReply: interaction.editReply.bind(interaction),
    deferUpdate: interaction.deferUpdate.bind(interaction),
    showModal: interaction.showModal.bind(interaction),
  };

  await command.execute(commandInteraction, { prisma, client });
}

async function runRankingCategoryFromVillage({
  interaction,
  prisma,
  client,
  categoryKey,
}) {
  const rankingCommand = client.commands.get('ranking');

  if (!rankingCommand || typeof rankingCommand.handleRankingButton !== 'function') {
    await interaction.reply({
      content: '랭킹 명령어를 찾을 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  const proxyInteraction = {
    ...interaction,
    customId: `ranking:refresh:all:${categoryKey}`,
    update: async (payload) => {
      const withNav = withVillageNavigation(payload, {
        backTo: VILLAGE_MENU_KEYS.ranking,
      });
      await interaction.update(withNav);
    },
    reply: interaction.reply.bind(interaction),
  };

  const handled = await rankingCommand.handleRankingButton(proxyInteraction, { prisma });

  if (!handled) {
    await interaction.reply({
      content: '랭킹 카테고리를 열지 못했습니다.',
      ephemeral: true,
    });
  }
}

async function handleVillageOpenAction(interaction, { prisma, client, parsed }) {
  const action = parsed.target;
  const param = parsed.param;

  if (action === VILLAGE_OPEN_ACTIONS.profile) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('profile'),
      prisma,
      client,
      options: {},
      backTo: VILLAGE_MENU_KEYS.main,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.tutorial) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('tutorial'),
      prisma,
      client,
      options: {
        getString: (key) => (key === 'action' ? 'start' : null),
        getBoolean: () => false,
      },
      backTo: VILLAGE_MENU_KEYS.combat,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.explore) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('explore'),
      prisma,
      client,
      options: {
        getString: () => null,
      },
      backTo: VILLAGE_MENU_KEYS.combat,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.boss) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('boss'),
      prisma,
      client,
      options: {
        getSubcommand: () => 'list',
        getString: () => null,
      },
      backTo: VILLAGE_MENU_KEYS.combat,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.shop) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('shop'),
      prisma,
      client,
      options: {},
      backTo: VILLAGE_MENU_KEYS.shop,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.market) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('market'),
      prisma,
      client,
      options: {},
      backTo: VILLAGE_MENU_KEYS.market,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.npcShop) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('npc_shop'),
      prisma,
      client,
      options: {
        getString: () => null,
      },
      backTo: VILLAGE_MENU_KEYS.market,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.auction) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('auction'),
      prisma,
      client,
      options: {},
      backTo: VILLAGE_MENU_KEYS.market,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.production) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('production'),
      prisma,
      client,
      options: {},
      backTo: VILLAGE_MENU_KEYS.production,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.daily) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('daily'),
      prisma,
      client,
      options: {},
      backTo: VILLAGE_MENU_KEYS.daily,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.attendance) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('attendance'),
      prisma,
      client,
      options: {},
      backTo: VILLAGE_MENU_KEYS.daily,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.premiumStatus) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('premium'),
      prisma,
      client,
      options: {
        getSubcommand: () => 'status',
      },
      backTo: VILLAGE_MENU_KEYS.premium,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.premiumSubscribe) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('premium'),
      prisma,
      client,
      options: {
        getSubcommand: () => 'subscribe',
      },
      backTo: VILLAGE_MENU_KEYS.premium,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.gem) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('gem'),
      prisma,
      client,
      options: {
        getSubcommand: () => 'status',
      },
      backTo: VILLAGE_MENU_KEYS.premium,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.rankingOverview) {
    await runCommandFromVillage({
      interaction,
      command: client.commands.get('ranking'),
      prisma,
      client,
      options: {},
      backTo: VILLAGE_MENU_KEYS.ranking,
    });
    return true;
  }

  if (action === VILLAGE_OPEN_ACTIONS.rankingCategory && param) {
    await runRankingCategoryFromVillage({
      interaction,
      prisma,
      client,
      categoryKey: param,
    });
    return true;
  }

  await interaction.reply({
    content: '알 수 없는 마을 메뉴 요청입니다.',
    ephemeral: true,
  });
  return true;
}

async function handleVillageButton(interaction, { prisma, client }) {
  if (interaction.customId === VILLAGE_JOB_MANAGE_BUTTON_ID) {
    return handleJobManageButton(interaction, { prisma });
  }

  const parsed = parseVillageCustomId(interaction.customId);

  if (!parsed) {
    return false;
  }

  if (parsed.action === 'home') {
    await showVillageMenu(interaction, {
      prisma,
      menuKey: VILLAGE_MENU_KEYS.main,
      mode: 'update',
    });
    return true;
  }

  if (parsed.action === 'menu' || parsed.action === 'back') {
    await showVillageMenu(interaction, {
      prisma,
      menuKey: resolveVillageMenuKey(parsed.menuKey),
      mode: 'update',
    });
    return true;
  }

  if (parsed.action === 'open') {
    return handleVillageOpenAction(interaction, { prisma, client, parsed });
  }

  return false;
}

async function executeVillageHub(interaction, { prisma }) {
  await showVillageMenu(interaction, {
    prisma,
    menuKey: VILLAGE_MENU_KEYS.main,
    mode: 'reply',
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('village')
    .setDescription('마을 허브 UI를 열고 버튼으로 메뉴를 이동합니다'),

  async execute(interaction, context) {
    await executeVillageHub(interaction, context);
  },

  executeVillageHub,
  handleVillageButton,
  VILLAGE_BUTTON_PREFIX: `${VILLAGE_BUTTON_PREFIX}:`,
};
