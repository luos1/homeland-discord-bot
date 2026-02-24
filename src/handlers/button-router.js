const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const {
  handleCombatButton,
  isCombatButton,
  isCombatEndButton,
  parseCombatEndCustomId,
  createCombatEmbed,
  createCombatActionRows,
} = require('../game/combat');
const {
  isBossCombatButton,
} = require('../game/boss-combat');
const {
  PROFILE_BUTTON_IDS,
  createProfileActionRow,
  createProfileEmbed,
  getProfileCharacter,
} = require('../commands/profile');
const { getPlayCreateClassChoice } = require('../commands/play');
const { JOBCHANGE_BUTTON_PREFIX } = require('../commands/jobchange');
const { PRODUCTION_JOBCHANGE_BUTTON_PREFIX } = require('../commands/production_jobchange');
const {
  JOB_RESPEC_BUTTON_PREFIX,
  handleJobRespecButton,
} = require('../commands/job_respec');
const { INVENTORY_BUTTON_PREFIX } = require('../commands/inventory');
const { SHOP_BUTTON_PREFIX } = require('../commands/shop');
const { PRODUCTION_BUTTON_PREFIX } = require('../commands/production');
const { GATHER_BUTTON_PREFIX } = require('../commands/gather');
const { CRAFT_BUTTON_PREFIX } = require('../commands/craft');
const { PSKILL_BUTTON_PREFIX } = require('../commands/production_skills');
const { MARKET_BUTTON_PREFIX } = require('../commands/market');
const { ECONOMY_ADMIN_BUTTON_PREFIX } = require('../commands/economy_admin');
const { STATS_BUTTON_PREFIX } = require('../commands/stats');
const { NPC_SHOP_BUTTON_PREFIX } = require('../commands/npc_shop');
const { SELL_RESOURCES_BUTTON_PREFIX } = require('../commands/sell_resources');
const { AUCTION_BUTTON_PREFIX } = require('../commands/auction');
const { RANKING_COMPONENT_PREFIX } = require('../commands/ranking');
const {
  PREMIUM_BUTTON_PREFIX,
  handlePremiumButton,
} = require('../commands/premium');
const { handleEnhanceButton } = require('../commands/enhance');
const { handleDailyButton } = require('../commands/daily');
const { leaveQueue } = require('../game/pvp-system');
const { handleSubscribeButton } = require('../commands/subscribe');
const { handleVillageButton } = require('../commands/village');
const { buildVillageHomeCustomId, isVillageButton } = require('../utils/village');
const {
  handleOnboardingEvent,
  maybeSendGuideTip,
  sendOnboardingFeedback,
} = require('../game/onboarding');
const { listZones } = require('../game/monsters');
const { GUILD_BUTTON_PREFIX, isGuildButton, handleGuildButton } = require('../game/guild-buttons');
const { EMBED_COLORS, createDivider, localizeClassName } = require('../utils/ui');
const { requireCharacter, forwardCommandFromButton, navigateToProfile, replyEphemeral } = require('../utils/response-helpers');
const { calculateSessionRemainingTime } = require('../utils/formatting');
const { TRADE_BUTTON_PREFIX, isTradeButton, handleTradeButton } = require('../game/trade-buttons');
const { joinFieldBoss, getEvent } = require('../game/field-boss-event');

const PROFILE_ZONE_BUTTON_PREFIX = 'profile_zone:';
const MONSTER_SELECT_PREFIX = 'monster_select:';
const PROFILE_ZONE_KEYS = new Set(listZones().map((zone) => zone.key));

// 도박 버튼 prefix
const GAMBLE_BUTTON_PREFIXES = [
  'gamble_slot_again:', 'gamble_slot_double:',
  'gamble_vip_again:', 'gamble_vip_double:',
  'gamble_coin_again:', 'gamble_coin_double:',
  'gamble_dice_again:', 'gamble_dice_double:',
  'gamble_stop'
];

function isGambleButton(customId) {
  return GAMBLE_BUTTON_PREFIXES.some(prefix => customId.startsWith(prefix));
}

async function handleButton(interaction, { prisma, client }) {
  // 도박 버튼 처리
  if (isGambleButton(interaction.customId)) {
    const customId = interaction.customId;
    
    // 그만하기 버튼
    if (customId === 'gamble_stop') {
      return interaction.update({ 
        content: '🛑 게임을 종료했습니다. 다음에 또 만나요!', 
        embeds: [], 
        components: [] 
      });
    }
    
    // 슬롯 버튼
    if (customId.startsWith('gamble_slot_')) {
      const slotCommand = client.commands.get('slot');
      if (slotCommand && slotCommand.handleButton) {
        return slotCommand.handleButton(interaction, customId);
      }
    }
    
    // VIP 슬롯 버튼
    if (customId.startsWith('gamble_vip_')) {
      const vipslotCommand = client.commands.get('vipslot');
      if (vipslotCommand && vipslotCommand.handleButton) {
        return vipslotCommand.handleButton(interaction, customId);
      }
    }
    
    // 코인 버튼
    if (customId.startsWith('gamble_coin_')) {
      const coinCommand = client.commands.get('coin');
      if (coinCommand && coinCommand.handleButton) {
        return coinCommand.handleButton(interaction, customId);
      }
    }
    
    // 주사위 버튼
    if (customId.startsWith('gamble_dice_')) {
      const diceCommand = client.commands.get('dice');
      if (diceCommand && diceCommand.handleButton) {
        return diceCommand.handleButton(interaction, customId);
      }
    }
    
    return;
  }

  if (isVillageButton(interaction.customId)) {
    const handled = await handleVillageButton(interaction, { prisma, client });
    if (handled) return;
  }

  if (interaction.customId.startsWith(PREMIUM_BUTTON_PREFIX)) {
    const handled = await handlePremiumButton(interaction, { prisma });
    if (handled) return;
  }

  // 캐릭터 삭제 확인 버튼
  if (interaction.customId === 'confirm_delete_character' || interaction.customId === 'cancel_delete_character') {
    const deleteCommand = client.commands.get('delete_character');
    if (deleteCommand && deleteCommand.handleButton) {
      await deleteCommand.handleButton(interaction, { prisma });
    }
    return;
  }

  // 숨겨진 던전 버튼
  if (interaction.customId.startsWith('hidden_dungeon:')) {
    await handleHiddenDungeonButton(interaction, { prisma });
    return;
  }

  if (isGuildButton(interaction.customId)) {
    return await handleGuildButton(interaction);
  }

  // 도시 버튼
  if (interaction.customId.startsWith('city_')) {
    const { handleCityButton } = require('../game/guild-city-buttons');
    return await handleCityButton(interaction, { prisma });
  }

  // 길드 관리 버튼
  if (interaction.customId === 'guild_manage') {
    const { handleGuildManageButton } = require('../game/guild-manage-buttons');
    return await handleGuildManageButton(interaction, { prisma });
  }

  // NPC 임대 버튼
  if (interaction.customId === 'guild_hire_npc') {
    const { handleGuildHireNPC } = require('../game/guild-manage-buttons');
    return await handleGuildHireNPC(interaction, { prisma });
  }

  // NPC 해고 버튼
  if (interaction.customId === 'guild_fire_npc') {
    const { handleGuildFireNPC } = require('../game/guild-manage-buttons');
    return await handleGuildFireNPC(interaction, { prisma });
  }

  // 길드 정보 버튼
  if (interaction.customId === 'guild_info') {
    const guildCommand = client.commands.get('guild');
    if (guildCommand) {
      // /guild info 명령어 재실행
      const fakeInteraction = {
        ...interaction,
        options: {
          getSubcommand: () => 'info',
        },
        reply: interaction.update.bind(interaction),
      };
      return await guildCommand.execute(fakeInteraction);
    }
  }

  // 농장 버튼
  if (interaction.customId.startsWith('farm_')) {
    const { handleFarmButton } = require('../game/farm-buttons');
    return await handleFarmButton(interaction, { prisma });
  }

  // 특수 역할 버튼
  if (interaction.customId.startsWith('specialrole_')) {
    const specialroleCommand = client.commands.get('specialrole');
    if (specialroleCommand) {
      if (interaction.customId.startsWith('specialrole_choose:')) {
        const role = interaction.customId.split(':')[1];
        const fakeInteraction = {
          ...interaction,
          options: {
            getSubcommand: () => 'choose',
            getString: (name) => (name === 'role' ? role : null),
          },
          reply: interaction.update.bind(interaction),
        };
        return await specialroleCommand.execute(fakeInteraction, { prisma });
      }
      if (interaction.customId === 'specialrole_reset') {
        const fakeInteraction = {
          ...interaction,
          options: {
            getSubcommand: () => 'reset',
          },
          reply: interaction.update.bind(interaction),
        };
        return await specialroleCommand.execute(fakeInteraction, { prisma });
      }
    }
  }

  // 경비 순찰 버튼
  if (interaction.customId === 'guard_patrol') {
    const guardCommand = client.commands.get('guard');
    if (guardCommand) {
      const fakeInteraction = {
        ...interaction,
        options: {
          getSubcommand: () => 'patrol',
        },
        reply: interaction.update.bind(interaction),
      };
      return await guardCommand.execute(fakeInteraction, { prisma });
    }
  }

  // 타워 버튼
  if (interaction.customId.startsWith('tower_')) {
    const { handleTowerButton } = require('../game/tower-buttons');
    return await handleTowerButton(interaction, { prisma });
  }

  if (isTradeButton(interaction.customId)) {
    return await handleTradeButton(interaction);
  }

  // 장비 강화 버튼
  if (interaction.customId.startsWith('enhance_')) {
    const handled = await handleEnhanceButton(interaction, { prisma });
    if (handled) return;
  }

  // 일일 퀘스트 버튼
  if (interaction.customId.startsWith('daily_claim_')) {
    const handled = await handleDailyButton(interaction, { prisma });
    if (handled) return;
  }

  // PvP 매칭 취소 버튼
  if (interaction.customId === 'pvp_cancel') {
    leaveQueue(interaction.user.id);
    await interaction.update({ content: '✅ PvP 매칭이 취소되었습니다.', embeds: [], components: [] });
    return;
  }

  // 구독 버튼
  if (interaction.customId.startsWith('subscribe_')) {
    const handled = await handleSubscribeButton(interaction, { prisma });
    if (handled) return;
  }

  // 필드 보스 참여 버튼
  if (interaction.customId.startsWith('field_boss_join_')) {
    const eventId = interaction.customId.replace('field_boss_join_', '');

    const character = await requireCharacter(prisma, interaction);
    if (!character) return;

    const result = await joinFieldBoss(eventId, interaction.user.id, character);

    if (!result.success) {
      return replyEphemeral(interaction, `❌ ${result.error}`);
    }

    const event = result.event;
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.victory)
      .setTitle('⚔️ 필드 보스 참여 완료!')
      .setDescription([
        `${event.boss.emoji} **${event.boss.name}** 전투에 참여했습니다!`,
        '',
        `👥 현재 참여 인원: **${result.participantCount}/${event.maxParticipants}**`,
        '',
        '전투가 곧 시작됩니다...'
      ].join('\n'));

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (isCombatButton(interaction.customId)) {
    const handled = await handleCombatButton({ interaction, prisma });
    if (!handled && !interaction.replied && !interaction.deferred) {
      await replyEphemeral(interaction, '유효하지 않은 전투 버튼입니다.');
    }
    return;
  }

  if (isBossCombatButton(interaction.customId)) {
    const { handleBossCombatAction } = require('../game/boss-combat-handler');
    await handleBossCombatAction({ interaction, prisma });
    return;
  }

  // 보스 도전 확인 버튼
  if (interaction.customId.startsWith('boss_challenge_confirm:')) {
    const bossId = interaction.customId.split(':')[1];
    const bossCommand = client.commands.get('boss');
    if (bossCommand && bossCommand.handleBossConfirm) {
      await bossCommand.handleBossConfirm(interaction, { prisma, bossId });
    }
    return;
  }

  if (interaction.customId === 'boss_challenge_cancel') {
    await interaction.update({ content: '보스 도전을 취소했습니다.', components: [] });
    return;
  }

  // 숨겨진 퀘스트 버튼
  if (interaction.customId.startsWith('hidden_quest:')) {
    const [, action, questKey] = interaction.customId.split(':');
    const { acceptQuest, rejectQuest } = require('../game/hidden-quest-handler');

    if (action === 'accept') {
      await acceptQuest(interaction, prisma, questKey);
      return;
    }

    if (action === 'reject') {
      await rejectQuest(interaction, prisma, questKey);
      return;
    }
  }

  // 퀘스트 보상 수령 버튼
  if (interaction.customId.startsWith('quest_claim:')) {
    const questKey = interaction.customId.split(':')[1];
    const { claimQuestReward } = require('../game/hidden-quest-handler');
    await claimQuestReward(interaction, prisma, questKey);
    return;
  }

  // 랜덤 NPC 상호작용 버튼
  if (interaction.customId.startsWith('random_npc:')) {
    const [, action, spawnIdStr] = interaction.customId.split(':');
    const spawnId = parseInt(spawnIdStr);

    if (action === 'interact') {
      const { handleNpcInteraction } = require('../game/random-npc-handler');
      await handleNpcInteraction(interaction, prisma, spawnId);
      return;
    }
  }

  // 상인 구매 버튼
  if (interaction.customId.startsWith('npc_merchant:')) {
    const [, action, spawnIdStr, itemIndexStr] = interaction.customId.split(':');
    const spawnId = parseInt(spawnIdStr);
    const itemIndex = parseInt(itemIndexStr);

    if (action === 'buy') {
      const { handleMerchantPurchase } = require('../game/random-npc-actions');
      await handleMerchantPurchase(interaction, prisma, spawnId, itemIndex);
      return;
    }
  }

  // 노인 축복 버튼
  if (interaction.customId.startsWith('npc_elder:')) {
    const [, action, spawnIdStr, blessingIndexStr] = interaction.customId.split(':');
    const spawnId = parseInt(spawnIdStr);
    const blessingIndex = parseInt(blessingIndexStr);

    if (action === 'bless') {
      const { handleElderBlessing } = require('../game/random-npc-actions');
      await handleElderBlessing(interaction, prisma, spawnId, blessingIndex);
      return;
    }
  }

  // 도박꾼 배팅 버튼
  if (interaction.customId.startsWith('npc_gambler:')) {
    const [, action, spawnIdStr, betAmountStr] = interaction.customId.split(':');
    const spawnId = parseInt(spawnIdStr);
    const betAmount = parseInt(betAmountStr);

    if (action === 'bet') {
      const { handleGamblerBet } = require('../game/random-npc-actions');
      await handleGamblerBet(interaction, prisma, spawnId, betAmount);
      return;
    }
  }

  if (interaction.customId === 'boss_list') {
    const bossCommand = client.commands.get('boss');
    if (bossCommand) {
      await bossCommand.execute(
        {
          ...interaction,
          options: { getSubcommand: () => 'list' },
          reply: (payload) => interaction.update(payload),
        },
        { prisma },
      );
    }
    return;
  }

  // 빠른 보스 도전 버튼
  if (interaction.customId.startsWith('boss_quick_challenge:')) {
    const bossId = interaction.customId.split(':')[1];
    const bossCommand = client.commands.get('boss');
    if (bossCommand) {
      await bossCommand.execute(
        {
          ...interaction,
          options: {
            getSubcommand: () => 'challenge',
            getString: (name) => (name === 'boss' ? bossId : null),
          },
          reply: (payload) => interaction.reply(payload),
        },
        { prisma },
      );
    }
    return;
  }

  if (isCombatEndButton(interaction.customId)) {
    await handleCombatEndButton(interaction, { prisma, client });
    return;
  }

  const playCreateClassChoice = getPlayCreateClassChoice(interaction.customId);
  if (playCreateClassChoice) {
    await handlePlayCreateChoice(interaction, { prisma, client, playCreateClassChoice });
    return;
  }

  if (interaction.customId === PROFILE_BUTTON_IDS.explore) {
    await handleProfileExplore(interaction, { prisma, client });
    return;
  }

  if (interaction.customId === PROFILE_BUTTON_IDS.inventory) {
    const inventoryCommand = client.commands.get('inventory');
    if (inventoryCommand) {
      await inventoryCommand.execute(interaction, { prisma, client });
    }
    return;
  }

  if (interaction.customId.startsWith(INVENTORY_BUTTON_PREFIX)) {
    const inventoryCommand = client.commands.get('inventory');
    if (inventoryCommand) {
      const handled = await inventoryCommand.handleInventoryButton(interaction, { prisma });
      if (handled) return;
    }
  }

  if (interaction.customId === 'back_to_inventory') {
    const inventoryCommand = client.commands.get('inventory');
    if (inventoryCommand) {
      await inventoryCommand.execute(
        { user: interaction.user, reply: interaction.update.bind(interaction) },
        { prisma, client },
      );
    }
    return;
  }

  if (interaction.customId === 'back_to_profile') {
    await navigateToProfile(interaction, prisma, { getProfileCharacter, createProfileEmbed, createProfileActionRow });
    return;
  }

  if (interaction.customId === PROFILE_BUTTON_IDS.boss) {
    await handleProfileBoss(interaction, { prisma, client });
    return;
  }

  if (interaction.customId === PROFILE_BUTTON_IDS.shop) {
    await handleProfileShop(interaction, { prisma, client });
    return;
  }

  if (interaction.customId === PROFILE_BUTTON_IDS.jobchange) {
    await handleProfileJobchange(interaction, { prisma, client });
    return;
  }

  if (interaction.customId === PROFILE_BUTTON_IDS.production_jobchange) {
    await handleProfileProductionJobchange(interaction, { prisma, client });
    return;
  }

  if (interaction.customId === PROFILE_BUTTON_IDS.stats) {
    await navigateToProfile(interaction, prisma, { getProfileCharacter, createProfileEmbed, createProfileActionRow });
    return;
  }

  if (interaction.customId === PROFILE_BUTTON_IDS.production) {
    await handleProfileProduction(interaction, { prisma });
    return;
  }

  if (interaction.customId === PROFILE_BUTTON_IDS.endCombat) {
    await handleProfileEndCombat(interaction, { prisma });
    return;
  }

  // 생산 메뉴 버튼 핸들러
  if (interaction.customId === 'production_menu_gather') {
    const cmd = client.commands.get('gather');
    if (cmd) await cmd.execute(interaction, { prisma });
    return;
  }

  if (interaction.customId === 'production_menu_craft') {
    const cmd = client.commands.get('craft');
    if (cmd) await cmd.execute(interaction, { prisma });
    return;
  }

  if (interaction.customId === 'production_menu_resources') {
    const cmd = client.commands.get('resources');
    if (cmd) await cmd.execute(interaction, { prisma });
    return;
  }

  if (interaction.customId === 'production_menu_skills') {
    const cmd = client.commands.get('production_skills');
    if (cmd) await cmd.execute(interaction, { prisma });
    return;
  }

  if (interaction.customId === 'production_menu_back') {
    await navigateToProfile(interaction, prisma, { getProfileCharacter, createProfileEmbed, createProfileActionRow });
    return;
  }

  // 존 정보 보기 버튼
  if (interaction.customId.startsWith('zone_info:')) {
    await handleZoneInfoButton(interaction, { prisma, client });
    return;
  }

  if (interaction.customId === 'back_to_zones') {
    const exploreCommand = client.commands.get('explore');
    if (exploreCommand) {
      await interaction.update({
        embeds: [exploreCommand.createZoneSelectionEmbed()],
        components: exploreCommand.createZoneSelectionActionRows(),
      });
    }
    return;
  }

  // Zone 선택 버튼 (몬스터 선택 화면으로)
  if (interaction.customId.startsWith(PROFILE_ZONE_BUTTON_PREFIX)) {
    await handleZoneSelectButton(interaction, { prisma, client });
    return;
  }

  // Prefix-based command routing
  const prefixRoutes = [
    { prefix: JOBCHANGE_BUTTON_PREFIX, cmdName: 'jobchange', handler: 'handleJobChangeButton' },
    { prefix: PRODUCTION_JOBCHANGE_BUTTON_PREFIX, cmdName: 'production_jobchange', handler: 'handleProductionJobChangeButton' },
    { prefix: SHOP_BUTTON_PREFIX, cmdName: 'shop', handler: 'handleShopButton' },
    { prefix: PRODUCTION_BUTTON_PREFIX, cmdName: 'production', handler: 'handleProductionButton' },
    { prefix: GATHER_BUTTON_PREFIX, cmdName: 'gather', handler: 'handleGatherButton' },
    { prefix: CRAFT_BUTTON_PREFIX, cmdName: 'craft', handler: 'handleCraftButton' },
    { prefix: PSKILL_BUTTON_PREFIX, cmdName: 'production_skills', handler: 'handleProductionSkillButton' },
    { prefix: MARKET_BUTTON_PREFIX, cmdName: 'market', handler: 'handleMarketButton' },
    { prefix: ECONOMY_ADMIN_BUTTON_PREFIX, cmdName: 'economy_admin', handler: 'handleEconomyAdminButton' },
    { prefix: STATS_BUTTON_PREFIX, cmdName: 'stats', handler: 'handleStatsButton' },
    { prefix: NPC_SHOP_BUTTON_PREFIX, cmdName: 'npc_shop', handler: 'handleNpcShopButton' },
    { prefix: SELL_RESOURCES_BUTTON_PREFIX, cmdName: 'sell_resources', handler: 'handleSellResourcesButton' },
    { prefix: AUCTION_BUTTON_PREFIX, cmdName: 'auction', handler: 'handleAuctionButton' },
    { prefix: RANKING_COMPONENT_PREFIX, cmdName: 'ranking', handler: 'handleRankingButton' },
  ];

  if (interaction.customId.startsWith(JOB_RESPEC_BUTTON_PREFIX)) {
    const handled = await handleJobRespecButton(interaction, { prisma });
    if (handled) return;
  }

  for (const route of prefixRoutes) {
    if (interaction.customId.startsWith(route.prefix)) {
      const cmd = client.commands.get(route.cmdName);
      if (cmd && typeof cmd[route.handler] === 'function') {
        const handled = await cmd[route.handler](interaction, { prisma });
        if (handled) return;
      }
      break;
    }
  }

  // 몬스터 선택 버튼 (전투 시작)
  if (interaction.customId.startsWith(MONSTER_SELECT_PREFIX)) {
    await handleMonsterSelectButton(interaction, { prisma, client });
    return;
  }

  // 어떤 버튼 핸들러에도 매칭되지 않은 경우
  if (!interaction.replied && !interaction.deferred) {
    await replyEphemeral(interaction, '알 수 없는 버튼입니다.');
  }
}

// --- Helper functions for complex button handlers ---

async function handleHiddenDungeonButton(interaction, { prisma }) {
  const [, action, characterId] = interaction.customId.split(':');

  if (action === 'ignore') {
    await interaction.update({
      content: '비밀 통로를 무시하고 돌아섰습니다.',
      embeds: [],
      components: [],
    });
    return;
  }

  if (action === 'explore') {
    await interaction.deferUpdate();

    const character = await prisma.character.findUnique({
      where: { id: parseInt(characterId) },
      include: { skills: true, consumables: true },
    });

    if (!character) {
      await interaction.editReply({ content: '캐릭터를 찾을 수 없습니다.', embeds: [], components: [] });
      return;
    }

    if (character.userId !== interaction.user.id) {
      await interaction.followUp({ content: '다른 사람의 캐릭터입니다.', ephemeral: true });
      return;
    }

    const { MONSTERS } = require('../game/monsters');
    const hiddenBoss = MONSTERS.ancientGuardian;

    const session = await prisma.combatSession.create({
      data: {
        characterId: character.id,
        zone: 'zone1',
        monsterName: hiddenBoss.name,
        monsterHp: hiddenBoss.hp,
        monsterMaxHp: hiddenBoss.hp,
        monsterAttack: hiddenBoss.attack,
        monsterDefense: hiddenBoss.defense,
        monsterXpReward: hiddenBoss.xpReward,
        monsterGoldMin: hiddenBoss.goldMin,
        monsterGoldMax: hiddenBoss.goldMax,
        playerHp: character.hp,
        playerDefending: false,
        potionsRemaining: 3,
        turn: 1,
        monsterImageUrl: hiddenBoss.imageUrl || null,
      },
    });

    const embed = createCombatEmbed({
      character,
      session,
      battleLog: [
        '🗿 고대의 수호자가 나타났습니다!',
        '',
        '⚠️ 경고: 이 보스는 매우 강력합니다!',
        '💎 승리 시 전설 등급 장비 확정 드랍!',
      ],
      title: `💀 숨겨진 보스 - ${hiddenBoss.name}`,
      status: 'ongoing',
    });

    const components = createCombatActionRows(session.id, { character });

    await interaction.editReply({ content: null, embeds: [embed], components });

    const announcementEmbed = new EmbedBuilder()
      .setTitle('🗿 숨겨진 보스 발견!')
      .setDescription(
        `**${interaction.user.username}**님이\n`
        + `비밀 통로에서 **고대의 수호자**를 발견했습니다!`,
      )
      .setColor(EMBED_COLORS.amber)
      .setTimestamp();

    try {
      await interaction.channel.send({ embeds: [announcementEmbed] });
    } catch (error) {
      console.error('숨겨진 보스 공지 전송 실패:', error);
    }
  }
}

async function handleCombatEndButton(interaction, { prisma, client }) {
  const combatEndAction = parseCombatEndCustomId(interaction.customId);

  if (!combatEndAction) {
    await replyEphemeral(interaction, '유효하지 않은 전투 종료 버튼입니다.');
    return;
  }

  const exploreCommand = client.commands.get('explore');

  if (!exploreCommand) {
    await replyEphemeral(interaction, '탐험 명령어를 찾을 수 없습니다.');
    return;
  }

  if (combatEndAction.action === 'zones') {
    await interaction.update({
      embeds: [exploreCommand.createZoneSelectionEmbed()],
      components: exploreCommand.createZoneSelectionActionRows(),
    });
    return;
  }

  await exploreCommand.execute(
    {
      user: interaction.user,
      options: {
        getString(optionName) {
          return optionName === 'zone' ? combatEndAction.zoneKey : null;
        },
      },
      reply(payload) {
        if (payload.ephemeral) {
          return interaction.reply(payload);
        }
        return interaction.update(payload);
      },
    },
    { prisma, client },
  );
}

async function handlePlayCreateChoice(interaction, { prisma, client, playCreateClassChoice }) {
  const createCommand = client.commands.get('create');

  if (!createCommand) {
    await replyEphemeral(interaction, '캐릭터 생성 명령어를 찾을 수 없습니다.');
    return;
  }

  await createCommand.execute(
    {
      user: interaction.user,
      options: {
        getString(optionName) {
          if (optionName === 'class') return playCreateClassChoice;
          return null;
        },
      },
      reply(payload) {
        if (payload.ephemeral) {
          return interaction.reply(payload);
        }
        return interaction.update(payload);
      },
    },
    { prisma, client },
  );
}

async function handleProfileExplore(interaction, { prisma, client }) {
  const exploreCommand = client.commands.get('explore');

  if (!exploreCommand) {
    await replyEphemeral(interaction, '탐험 명령어를 찾을 수 없습니다.');
    return;
  }

  await exploreCommand.execute(
    {
      user: interaction.user,
      options: { getString() { return null; } },
      reply: interaction.reply.bind(interaction),
    },
    { prisma, client },
  );
}

async function handleProfileBoss(interaction, { prisma, client }) {
  await forwardCommandFromButton(interaction, { prisma, client }, {
    commandName: 'boss',
    errorLabel: '보스',
    executeOptions: { options: { getSubcommand: () => 'list' } },
  });
}

async function handleProfileShop(interaction, { prisma, client }) {
  await forwardCommandFromButton(interaction, { prisma, client }, {
    commandName: 'shop',
    errorLabel: '상점',
  });
}

async function handleProfileJobchange(interaction, { prisma, client }) {
  await forwardCommandFromButton(interaction, { prisma, client }, {
    commandName: 'jobchange',
    errorLabel: '전직',
  });
}

async function handleProfileProductionJobchange(interaction, { prisma, client }) {
  await forwardCommandFromButton(interaction, { prisma, client }, {
    commandName: 'production_jobchange',
    errorLabel: '생산 전직',
  });
}

async function handleProfileProduction(interaction, { prisma }) {
  const character = await requireCharacter(prisma, interaction, {
    include: { gatherSessions: true, craftingSessions: true, resources: true },
  });
  if (!character) return;

  const { PRODUCTION_CLASSES } = require('../game/production-classes');
  const { getRequiredProductionXP } = require('../game/production-leveling');

  let embed;
  const buttons = [];

  if (!character.productionClass) {
    embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.profile)
      .setTitle('🔨 생산 시스템')
      .setDescription(
        [
          createDivider(),
          '생산 직업을 선택하지 않았습니다',
          '',
          '📦 채집 직업으로 자원을 모으거나',
          '⚒️ 제작 직업으로 아이템을 만들 수 있습니다',
          '',
          '💡 `/production` 명령어로 직업을 선택하세요',
          '',
          createDivider(),
        ].join('\n'),
      );
  } else {
    const classData = PRODUCTION_CLASSES[character.productionClass];
    const nextLevelXp = getRequiredProductionXP(character.productionLevel);
    const progress = Math.floor((character.productionXp / nextLevelXp) * 100);

    const isGathering = classData.category === 'gathering';
    const isCrafting = classData.category === 'crafting';

    const sessionInfo = [];
    if (character.gatherSessions.length > 0) {
      const { remainingMin, isComplete } = calculateSessionRemainingTime(character.gatherSessions[0]);
      sessionInfo.push(isComplete
        ? '✅ 채집 완료! /gather로 수령하세요'
        : `⏱️ 채집 중... (${remainingMin}분 남음)`);
    }

    if (character.craftingSessions.length > 0) {
      const { remainingMin, isComplete } = calculateSessionRemainingTime(character.craftingSessions[0]);
      sessionInfo.push(isComplete
        ? '✅ 제작 완료! /craft로 수령하세요'
        : `⏱️ 제작 중... (${remainingMin}분 남음)`);
    }

    const resourceCount = character.resources.length;

    embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.profile)
      .setTitle(`${classData.emoji} ${classData.name}`)
      .setDescription(
        [
          createDivider(),
          `📊 레벨: ${character.productionLevel}`,
          `📈 경험치: ${character.productionXp}/${nextLevelXp} (${progress}%)`,
          '',
          `📦 보유 자원: ${resourceCount}종`,
          '',
          sessionInfo.length > 0 ? sessionInfo.join('\n') : '💡 현재 진행 중인 작업이 없습니다',
          '',
          createDivider(),
          '',
          '🔨 생산 메뉴',
          isGathering ? '📦 채집 - 자원을 수집합니다' : '',
          isCrafting ? '⚒️ 제작 - 아이템을 만듭니다' : '',
          '📊 자원 - 보유 자원을 확인합니다',
          '✨ 스킬 - 생산 스킬을 배웁니다',
          '👤 프로필 - 돌아가기',
          '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .setFooter({ text: '아래 버튼으로 생산 활동을 시작하세요' });

    if (isGathering) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId('production_menu_gather')
          .setLabel('채집')
          .setEmoji('📦')
          .setStyle(ButtonStyle.Primary),
      );
    }

    if (isCrafting) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId('production_menu_craft')
          .setLabel('제작')
          .setEmoji('⚒️')
          .setStyle(ButtonStyle.Primary),
      );
    }

    buttons.push(
      new ButtonBuilder()
        .setCustomId('production_menu_resources')
        .setLabel('자원')
        .setEmoji('📊')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('production_menu_skills')
        .setLabel('스킬')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Success),
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(buildVillageHomeCustomId())
      .setLabel('마을')
      .setEmoji('🏘️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('production_menu_back')
      .setLabel('프로필')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
  );

  const components = buttons.length > 0 ? [new ActionRowBuilder().addComponents(buttons)] : [];

  await interaction.update({ embeds: [embed], components });

  await maybeSendGuideTip({
    prisma,
    user: interaction.user,
    interaction,
    category: 'production',
  });
}

async function handleProfileEndCombat(interaction, { prisma }) {
  const character = await requireCharacter(prisma, interaction, {
    include: { combatSession: true },
  });
  if (!character) return;

  if (!character.combatSession) {
    await interaction.reply({ content: '진행 중인 전투가 없습니다.', ephemeral: true });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.combatSession.delete({ where: { id: character.combatSession.id } });
    await tx.character.update({
      where: { id: character.id },
      data: { hp: character.maxHp, mana: character.maxMana || 0 },
    });
  });

  const refreshedCharacter = await getProfileCharacter(prisma, interaction.user.id);

  const successEmbed = new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle('🔄 전투 종료 완료')
    .setDescription(
      [
        '✅ 진행 중이던 전투를 종료했습니다.',
        '💊 체력과 마나가 완전히 회복되었습니다.',
        '',
        `❤️ HP: ${character.maxHp}/${character.maxHp}`,
        `🔷 MP: ${character.maxMana || 0}/${character.maxMana || 0}`,
      ].join('\n'),
    );

  await interaction.update({
    embeds: [successEmbed],
    components: createProfileActionRow({ character: refreshedCharacter }),
  });
}

async function handleZoneInfoButton(interaction, { prisma, client }) {
  const zoneKey = interaction.customId.slice('zone_info:'.length);
  const { getZone } = require('../game/monsters');
  const exploreCommand = client.commands.get('explore');

  if (!exploreCommand) {
    await replyEphemeral(interaction, '탐험 명령어를 찾을 수 없습니다.');
    return;
  }

  const zone = getZone(zoneKey);

  if (!zone) {
    await replyEphemeral(interaction, '유효하지 않은 존입니다.');
    return;
  }

  await interaction.update({
    embeds: [exploreCommand.createZoneInfoEmbed(zoneKey)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${PROFILE_ZONE_BUTTON_PREFIX}${zoneKey}`)
          .setLabel('몬스터 선택')
          .setEmoji('👹')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('back_to_zones')
          .setLabel('존 선택')
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

async function handleZoneSelectButton(interaction, { prisma, client }) {
  // Discord 3초 timeout 방지
  await interaction.deferUpdate();
  
  const zoneKey = interaction.customId.slice(PROFILE_ZONE_BUTTON_PREFIX.length);

  if (!PROFILE_ZONE_KEYS.has(zoneKey)) {
    await interaction.followUp({ content: '유효하지 않은 탐험지입니다.', ephemeral: true });
    return;
  }

  const exploreCommand = client.commands.get('explore');

  if (!exploreCommand) {
    await interaction.followUp({ content: '탐험 명령어를 찾을 수 없습니다.', ephemeral: true });
    return;
  }

  const { getZone } = require('../game/monsters');
  const zone = getZone(zoneKey);

  if (!zone) {
    await interaction.followUp({ content: '유효하지 않은 탐험지입니다.', ephemeral: true });
    return;
  }

  const character = await requireCharacter(prisma, interaction);
  if (!character) return;

  if (character.level < zone.minLevel) {
    await interaction.followUp({ content: `${zone.name}은(는) 레벨 ${zone.minLevel}+ 권장 구역입니다. 현재 레벨은 ${character.level}입니다.`, ephemeral: true });
    return;
  }

  await interaction.editReply({
    embeds: [exploreCommand.createMonsterSelectionEmbed(zone)],
    components: exploreCommand.createMonsterSelectionActionRows(zoneKey, zone),
  });
}

async function handleMonsterSelectButton(interaction, { prisma, client }) {
  try {
    // Discord 3초 timeout 방지
    await interaction.deferUpdate();

    const [zoneKey, monsterKey] = interaction.customId
      .slice(MONSTER_SELECT_PREFIX.length)
      .split(':');

    console.log('[DEBUG] Monster select:', { customId: interaction.customId, zoneKey, monsterKey });

    if (!zoneKey || !monsterKey) {
      await interaction.followUp({ content: '유효하지 않은 선택입니다.', ephemeral: true });
      return;
    }

    const {
      getZone,
      getZoneWithTypeData,
      MONSTERS,
      rollRareMonster,
      applyRareModifier,
    } = require('../game/monsters');

    const zone = getZone(zoneKey);
    const baseMonster = MONSTERS[monsterKey];

    console.log('[DEBUG] Zone and monster:', { zone: zone?.key, monster: baseMonster?.name });

    if (!zone || !baseMonster) {
      await interaction.followUp({ content: '유효하지 않은 선택입니다.', ephemeral: true });
      return;
    }

    const zoneData = getZoneWithTypeData(zoneKey);
    const statMult = zoneData?.typeData?.statMultiplier || 1.0;

    let monster = {
      ...baseMonster,
      hp: Math.floor(baseMonster.hp * statMult),
      attack: Math.floor(baseMonster.attack * statMult),
      defense: Math.floor(baseMonster.defense * statMult),
    };

    if (!baseMonster.isBoss) {
      const rareType = rollRareMonster(zoneKey);
      if (rareType) {
        monster = applyRareModifier(monster, rareType);
      }
    }

    const character = await requireCharacter(prisma, interaction, {
      include: { combatSession: true, skills: true },
    });
    if (!character) return;

    if (character.combatSession) {
      await interaction.followUp({ content: '이미 진행 중인 전투가 있습니다.', ephemeral: true });
      return;
    }

    let playerHp = character.hp;
    if (playerHp <= 0) {
      const revived = await prisma.character.update({
        where: { id: character.id },
        data: { hp: character.maxHp },
      });
      playerHp = revived.hp;
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
        monsterFirstStrike: zone.key === 'zone3',
        monsterImageUrl: monster.imageUrl || null,
      },
    });

    const embed = createCombatEmbed({
      character: { ...character, hp: playerHp },
      session,
      battleLog: [
        `${zone.emoji} ${zone.name}에 입장했습니다.`,
        `👹 ${monster.name} 등장!`,
        `🎯 ${localizeClassName(character.class)} ${character.name}, 전투 준비 완료!`,
      ],
      title: '💀 전투 시작!',
      status: 'ongoing',
    });

    await interaction.editReply({
      embeds: [embed],
      components: createCombatActionRows(session.id, { character: { ...character, hp: playerHp } }),
    });

    await maybeSendGuideTip({
      prisma,
      user: interaction.user,
      interaction,
      category: 'combat',
    });
  } catch (error) {
    console.error('[ERROR] Monster select failed:', error);
    console.error('[ERROR] CustomId:', interaction.customId);
    console.error('[ERROR] Stack:', error.stack);
    
    if (interaction.deferred) {
      await interaction.editReply({ content: `❌ 전투 시작 중 오류가 발생했습니다: ${error.message}`, embeds: [], components: [] });
    } else {
      await interaction.followUp({ content: `❌ 전투 시작 중 오류가 발생했습니다: ${error.message}`, ephemeral: true });
    }
  }
}

module.exports = {
  handleButton,
  PROFILE_ZONE_BUTTON_PREFIX,
  MONSTER_SELECT_PREFIX,
};
