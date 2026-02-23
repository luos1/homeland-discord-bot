require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const {
  Client,
  Collection,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} = require('discord.js');

// 레이드 서버 시작 (포트 3001)
require('./raid-server');

const { prisma } = require('./database/client');
const {
  handleCombatButton,
  isCombatButton,
  isCombatEndButton,
  parseCombatEndCustomId,
} = require('./game/combat');
const {
  isBossCombatButton,
  parseBossCombatCustomId,
} = require('./game/boss-combat');
const {
  PROFILE_BUTTON_IDS,
  createProfileActionRow,
  createProfileEmbed,
  getProfileCharacter,
} = require('./commands/profile');
const { getPlayCreateClassChoice } = require('./commands/play');
const { JOBCHANGE_BUTTON_PREFIX } = require('./commands/jobchange');
const { PRODUCTION_JOBCHANGE_BUTTON_PREFIX } = require('./commands/production_jobchange');
const {
  JOB_RESPEC_BUTTON_PREFIX,
  handleJobRespecButton,
} = require('./commands/job_respec');
const { INVENTORY_BUTTON_PREFIX } = require('./commands/inventory');
const { SHOP_BUTTON_PREFIX } = require('./commands/shop');
const { PRODUCTION_BUTTON_PREFIX } = require('./commands/production');
const { GATHER_BUTTON_PREFIX } = require('./commands/gather');
const { CRAFT_BUTTON_PREFIX } = require('./commands/craft');
const { PSKILL_BUTTON_PREFIX } = require('./commands/production_skills');
const { MARKET_BUTTON_PREFIX } = require('./commands/market');
const { ECONOMY_ADMIN_BUTTON_PREFIX } = require('./commands/economy_admin');
const { STATS_BUTTON_PREFIX } = require('./commands/stats');
const { NPC_SHOP_BUTTON_PREFIX } = require('./commands/npc_shop');
const { SELL_RESOURCES_BUTTON_PREFIX } = require('./commands/sell_resources');
const { AUCTION_BUTTON_PREFIX } = require('./commands/auction');
const { RANKING_COMPONENT_PREFIX } = require('./commands/ranking');
const {
  PREMIUM_BUTTON_PREFIX,
  handlePremiumButton,
} = require('./commands/premium');
const { handleVillageButton } = require('./commands/village');
const { buildVillageHomeCustomId, isVillageButton } = require('./utils/village');
const {
  startSessionCleanupJob,
  DEFAULT_CLEANUP_INTERVAL_MS,
} = require('./game/session-cleanup');
const {
  startDailyQuestResetScheduler,
  stopDailyQuestResetScheduler,
} = require('./game/daily-quests');
const {
  resolveEconomyMonitoringConfig,
  startEconomyMonitoringJob,
} = require('./game/economy-scheduler');
const {
  resolveAuctionSettlementConfig,
  startAuctionSettlementJob,
} = require('./game/auction-scheduler');
const {
  resolvePriceAlertConfig,
  startPriceAlertJob,
} = require('./game/price-alerts');
const {
  handleOnboardingEvent,
  maybeSendGuideTip,
  sendOnboardingFeedback,
} = require('./game/onboarding');
const { listZones } = require('./game/monsters');

const REQUIRED_ENV = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DATABASE_URL'];
const PROFILE_ZONE_BUTTON_PREFIX = 'profile_zone:';
const MONSTER_SELECT_PREFIX = 'monster_select:';
const PROFILE_ZONE_KEYS = new Set(listZones().map((zone) => zone.key));
let sessionCleanupJob = null;
let economyMonitoringJob = null;
let auctionSettlementJob = null;
let priceAlertJob = null;

const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`필수 환경 변수가 누락되었습니다: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

const commandData = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if (command.isButtonHandlerOnly) {
    continue;
  }

  if (!command.data || !command.execute) {
    console.warn(`유효하지 않은 명령어 모듈을 건너뜁니다: ${file}`);
    continue;
  }

  client.commands.set(command.data.name, command);
  commandData.push(command.data.toJSON());
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  const route = process.env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

  await rest.put(route, { body: commandData });

  const scope = process.env.DISCORD_GUILD_ID ? '길드' : '전역';
  console.log(`${commandData.length}개의 슬래시 명령어를 등록했습니다 (${scope}).`);
}

function resolveCleanupIntervalMs() {
  const rawMinutes = process.env.SESSION_CLEANUP_INTERVAL_MINUTES;

  if (!rawMinutes) {
    return DEFAULT_CLEANUP_INTERVAL_MS;
  }

  const parsed = Number.parseInt(rawMinutes, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `SESSION_CLEANUP_INTERVAL_MINUTES 값이 잘못되어 기본값(60분)을 사용합니다: ${rawMinutes}`,
    );
    return DEFAULT_CLEANUP_INTERVAL_MS;
  }

  return parsed * 60 * 1000;
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`${readyClient.user.tag} 계정으로 로그인되었습니다.`);

  try {
    await registerCommands();
  } catch (error) {
    console.error('슬래시 명령어 등록에 실패했습니다:', error);
  }

  // 1시간 주기 자동 세션 정리 시작 (시작 시 즉시 1회 실행)
  try {
    if (sessionCleanupJob) {
      sessionCleanupJob.stop();
    }

    const intervalMs = resolveCleanupIntervalMs();
    sessionCleanupJob = startSessionCleanupJob(prisma, {
      intervalMs,
      runOnStart: true,
    });
    console.log(`🕒 자동 세션 정리 작업 시작 (${Math.floor(intervalMs / 60000)}분 주기)`);
  } catch (error) {
    console.error('자동 세션 정리 작업 시작 실패:', error);
  }

  try {
    startDailyQuestResetScheduler(prisma);
  } catch (error) {
    console.error('Daily quest 자정 리셋 스케줄러 시작 실패:', error);
  }

  try {
    if (economyMonitoringJob) {
      economyMonitoringJob.stop();
    }

    const economyConfig = resolveEconomyMonitoringConfig();
    economyMonitoringJob = startEconomyMonitoringJob(prisma, {
      client: readyClient,
      runOnStart: true,
      hourlySnapshotIntervalMs: economyConfig.hourlySnapshotIntervalMs,
      dailySnapshotIntervalMs: economyConfig.dailySnapshotIntervalMs,
      alertCheckIntervalMs: economyConfig.alertCheckIntervalMs,
      dynamicPriceRefreshIntervalMs: economyConfig.dynamicPriceRefreshIntervalMs,
    });

    console.log(
      `📈 경제 모니터링 시작 (hourly=${Math.floor(economyConfig.hourlySnapshotIntervalMs / 60000)}분, `
      + `daily=${Math.floor(economyConfig.dailySnapshotIntervalMs / 60000)}분, `
      + `alerts=${Math.floor(economyConfig.alertCheckIntervalMs / 60000)}분, `
      + `dynamic=${Math.floor(economyConfig.dynamicPriceRefreshIntervalMs / 60000)}분)`,
    );
  } catch (error) {
    console.error('경제 모니터링 시작 실패:', error);
  }

  try {
    if (auctionSettlementJob) {
      auctionSettlementJob.stop();
    }

    const auctionConfig = resolveAuctionSettlementConfig();
    auctionSettlementJob = startAuctionSettlementJob(prisma, {
      runOnStart: true,
      settlementIntervalMs: auctionConfig.settlementIntervalMs,
    });

    console.log(
      `🔨 경매 자동 정산 시작 (${Math.floor(auctionConfig.settlementIntervalMs / 1000)}초 주기)`,
    );
  } catch (error) {
    console.error('경매 자동 정산 시작 실패:', error);
  }

  try {
    if (priceAlertJob) {
      priceAlertJob.stop();
    }

    const alertConfig = resolvePriceAlertConfig();
    priceAlertJob = startPriceAlertJob(prisma, {
      client: readyClient,
      runOnStart: true,
      intervalMs: alertConfig.checkIntervalMs,
      cooldownMs: alertConfig.cooldownMs,
    });

    console.log(
      `🔔 가격 알림 스케줄러 시작 (interval=${Math.floor(alertConfig.checkIntervalMs / 60000)}분, `
      + `cooldown=${Math.floor(alertConfig.cooldownMs / 60000)}분)`,
    );
  } catch (error) {
    console.error('가격 알림 스케줄러 시작 실패:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        await interaction.reply({
          content: '명령어를 찾을 수 없습니다.',
          ephemeral: true,
        });

        return;
      }

      await command.execute(interaction, { prisma, client });

      const onboardingFeedback = await handleOnboardingEvent({
        prisma,
        user: interaction.user,
        eventType: `command_${interaction.commandName}`,
      });
      await sendOnboardingFeedback(interaction, onboardingFeedback);
      return;
    }

    if (interaction.isButton()) {
      if (isVillageButton(interaction.customId)) {
        const handled = await handleVillageButton(interaction, { prisma, client });

        if (handled) {
          return;
        }
      }

      if (interaction.customId.startsWith(PREMIUM_BUTTON_PREFIX)) {
        const handled = await handlePremiumButton(interaction, { prisma });

        if (handled) {
          return;
        }
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
            include: {
              skills: true,
              consumables: true,
            },
          });
          
          if (!character) {
            await interaction.editReply({
              content: '캐릭터를 찾을 수 없습니다.',
              embeds: [],
              components: [],
            });
            return;
          }
          
          if (character.userId !== interaction.user.id) {
            await interaction.followUp({
              content: '다른 사람의 캐릭터입니다.',
              ephemeral: true,
            });
            return;
          }
          
          // 숨겨진 보스 데이터
          const { MONSTERS } = require('./game/monsters');
          const hiddenBoss = MONSTERS.ancientGuardian;
          
          // 숨겨진 보스와의 전투 세션 생성
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
            },
          });
          
          const { createCombatEmbed, createCombatActionRows } = require('./game/combat');
          const { EmbedBuilder } = require('discord.js');
          
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
          
          await interaction.editReply({
            content: null,
            embeds: [embed],
            components,
          });
          
          // 전체 공지
          const announcementEmbed = new EmbedBuilder()
            .setTitle('🗿 숨겨진 보스 발견!')
            .setDescription(
              `**${interaction.user.username}**님이\n` +
              `비밀 통로에서 **고대의 수호자**를 발견했습니다!`
            )
            .setColor(0xfbbf24)
            .setTimestamp();
          
          try {
            await interaction.channel.send({ embeds: [announcementEmbed] });
          } catch (error) {
            console.error('숨겨진 보스 공지 전송 실패:', error);
          }
          
          return;
        }
      }
      if (isCombatButton(interaction.customId)) {
        const handled = await handleCombatButton({ interaction, prisma });
        if (!handled && !interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '유효하지 않은 전투 버튼입니다.',
            ephemeral: true,
          });
        }
        return;
      }

      if (isBossCombatButton(interaction.customId)) {
        const { handleBossCombatAction } = require('./game/boss-combat-handler');
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
        await interaction.update({
          content: '보스 도전을 취소했습니다.',
          components: [],
        });
        return;
      }

      if (interaction.customId === 'boss_list') {
        const bossCommand = client.commands.get('boss');
        if (bossCommand) {
          await bossCommand.execute(
            {
              ...interaction,
              options: {
                getSubcommand: () => 'list',
              },
              reply: (payload) => interaction.update(payload),

      // 숨겨진 퀘스트 버튼
      if (interaction.customId.startsWith('hidden_quest:')) {
        const [, action, questKey] = interaction.customId.split(':');
        const { acceptQuest, rejectQuest } = require('./game/hidden-quest-handler');
        
        if (action === 'accept') {
          await acceptQuest(interaction, prisma, questKey);
          return;
        }
        
        if (action === 'reject') {
          await rejectQuest(interaction, prisma, questKey);
          return;

      // 퀘스트 보상 수령 버튼
      if (interaction.customId.startsWith('quest_claim:')) {
        const questKey = interaction.customId.split(':')[1];
        const { claimQuestReward } = require('./game/hidden-quest-handler');
        await claimQuestReward(interaction, prisma, questKey);
        return;
      }
        }
      }
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
        const combatEndAction = parseCombatEndCustomId(interaction.customId);

        if (!combatEndAction) {
          await interaction.reply({
            content: '유효하지 않은 전투 종료 버튼입니다.',
            ephemeral: true,
          });

          return;
        }

        const exploreCommand = client.commands.get('explore');

        if (!exploreCommand) {
          await interaction.reply({
            content: '탐험 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

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

        return;
      }

      const playCreateClassChoice = getPlayCreateClassChoice(interaction.customId);

      if (playCreateClassChoice) {
        const createCommand = client.commands.get('create');

        if (!createCommand) {
          await interaction.reply({
            content: '캐릭터 생성 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        await createCommand.execute(
          {
            user: interaction.user,
            options: {
              getString(optionName) {
                if (optionName === 'class') {
                  return playCreateClassChoice;
                }

                if (optionName === 'name') {
                  return null;
                }

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

        return;
      }

      if (interaction.customId === PROFILE_BUTTON_IDS.explore) {
        const exploreCommand = client.commands.get('explore');

        if (!exploreCommand) {
          await interaction.reply({
            content: '탐험 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        await exploreCommand.execute(
          {
            user: interaction.user,
            options: {
              getString() {
                return null;
              },
            },
            reply: interaction.reply.bind(interaction),
          },
          { prisma, client },
        );

        return;
      }

      if (interaction.customId === PROFILE_BUTTON_IDS.inventory) {
        const inventoryCommand = client.commands.get('inventory');

        if (!inventoryCommand) {
          await interaction.reply({
            content: '인벤토리 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        await inventoryCommand.execute(interaction, { prisma, client });
        return;
      }

      // 인벤토리 액션 버튼
      if (interaction.customId.startsWith(INVENTORY_BUTTON_PREFIX)) {
        const inventoryCommand = client.commands.get('inventory');

        if (!inventoryCommand) {
          await interaction.reply({
            content: '인벤토리 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await inventoryCommand.handleInventoryButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 인벤토리로 돌아가기 버튼
      if (interaction.customId === 'back_to_inventory') {
        const inventoryCommand = client.commands.get('inventory');

        if (!inventoryCommand) {
          await interaction.reply({
            content: '인벤토리 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        await inventoryCommand.execute(
          {
            user: interaction.user,
            reply: interaction.update.bind(interaction),
          },
          { prisma, client },
        );

        return;
      }

      // 프로필로 돌아가기 버튼
      if (interaction.customId === 'back_to_profile') {
        const character = await getProfileCharacter(prisma, interaction.user.id);

        if (!character) {
          await interaction.reply({
            content: '캐릭터가 없습니다.',
            ephemeral: true,
          });

          return;
        }

        await interaction.update({
          embeds: [createProfileEmbed(character)],
          components: createProfileActionRow({ character }),
        });

        return;
      }

      if (interaction.customId === PROFILE_BUTTON_IDS.boss) {
        // 버튼 interaction은 먼저 defer 처리
        await interaction.deferUpdate();

        const bossCommand = client.commands.get('boss');

        if (!bossCommand) {
          await interaction.followUp({
            content: '보스 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        await bossCommand.execute(
          {
            user: interaction.user,
            options: {
              getSubcommand: () => 'list',
            },
            reply: interaction.followUp.bind(interaction),
          },
          { prisma },
        );

        return;
      }

      if (interaction.customId === PROFILE_BUTTON_IDS.shop) {
        // 버튼 interaction은 먼저 defer 처리
        await interaction.deferUpdate();

        const shopCommand = client.commands.get('shop');

        if (!shopCommand) {
          await interaction.followUp({
            content: '상점 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        await shopCommand.execute(
          {
            user: interaction.user,
            reply: interaction.followUp.bind(interaction),
          },
          { prisma, client },
        );

        return;
      }

      if (interaction.customId === PROFILE_BUTTON_IDS.jobchange) {
        // 버튼 interaction은 먼저 defer 처리
        await interaction.deferUpdate();

        const jobchangeCommand = client.commands.get('jobchange');

        if (!jobchangeCommand) {
          await interaction.followUp({
            content: '전직 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        // followUp으로 전직 화면 표시
        await jobchangeCommand.execute(
          {
            user: interaction.user,
            reply: interaction.followUp.bind(interaction),
          },
          { prisma },
        );

        return;
      }

      // 생산 전직 버튼
      if (interaction.customId === PROFILE_BUTTON_IDS.production_jobchange) {
        // 버튼 interaction은 먼저 defer 처리
        await interaction.deferUpdate();

        const prodJobchangeCommand = client.commands.get('production_jobchange');

        if (!prodJobchangeCommand) {
          await interaction.followUp({
            content: '생산 전직 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        // followUp으로 생산 전직 화면 표시
        await prodJobchangeCommand.execute(
          {
            user: interaction.user,
            reply: interaction.followUp.bind(interaction),
          },
          { prisma },
        );

        return;
      }

      if (interaction.customId === PROFILE_BUTTON_IDS.stats) {
        const character = await getProfileCharacter(prisma, interaction.user.id);

        if (!character) {
          await interaction.reply({
            content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
            ephemeral: true,
          });

          return;
        }

        await interaction.update({
          embeds: [createProfileEmbed(character)],
          components: createProfileActionRow({ character }),
        });

        return;
      }

      if (interaction.customId === PROFILE_BUTTON_IDS.production) {
        const character = await prisma.character.findUnique({
          where: {
            userId: interaction.user.id,
          },
          include: {
            gatherSessions: true,
            craftingSessions: true,
            resources: true,
          },
        });

        if (!character) {
          await interaction.reply({
            content: '캐릭터가 없습니다.',
            ephemeral: true,
          });

          return;
        }

        // 생산 메뉴 임베드 생성
        const { PRODUCTION_CLASSES } = require('./game/production-classes');
        const { getRequiredProductionXP } = require('./game/production-leveling');
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const { EMBED_COLORS, createDivider } = require('./utils/ui');

        let embed;
        const buttons = [];

        if (!character.productionClass) {
          // 생산 직업이 없는 경우
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
            const session = character.gatherSessions[0];
            const now = new Date();
            const completesAt = new Date(session.completesAt);
            const remainingMs = Math.max(0, completesAt - now);
            const remainingMin = Math.ceil(remainingMs / 1000 / 60);

            if (remainingMs > 0) {
              sessionInfo.push(`⏱️ 채집 중... (${remainingMin}분 남음)`);
            } else {
              sessionInfo.push(`✅ 채집 완료! /gather로 수령하세요`);
            }
          }

          if (character.craftingSessions.length > 0) {
            const session = character.craftingSessions[0];
            const now = new Date();
            const completesAt = new Date(session.completesAt);
            const remainingMs = Math.max(0, completesAt - now);
            const remainingMin = Math.ceil(remainingMs / 1000 / 60);

            if (remainingMs > 0) {
              sessionInfo.push(`⏱️ 제작 중... (${remainingMin}분 남음)`);
            } else {
              sessionInfo.push(`✅ 제작 완료! /craft로 수령하세요`);
            }
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
            .setFooter({
              text: '아래 버튼으로 생산 활동을 시작하세요',
            });

          // 버튼 추가
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

        await interaction.update({
          embeds: [embed],
          components,
        });

        await maybeSendGuideTip({
          prisma,
          user: interaction.user,
          interaction,
          category: 'production',
        });

        return;
      }

      if (interaction.customId === PROFILE_BUTTON_IDS.endCombat) {
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
            content: '캐릭터가 없습니다.',
            ephemeral: true,
          });

          return;
        }

        if (!character.combatSession) {
          await interaction.reply({
            content: '진행 중인 전투가 없습니다.',
            ephemeral: true,
          });

          return;
        }

        // 전투 세션 강제 종료 + 체력/마나 완전 회복
        await prisma.$transaction(async (tx) => {
          await tx.combatSession.delete({
            where: {
              id: character.combatSession.id,
            },
          });

          await tx.character.update({
            where: {
              id: character.id,
            },
            data: {
              hp: character.maxHp,
              mana: character.maxMana || 0,
            },
          });
        });

        // 최신 상태 다시 불러오기
        const refreshedCharacter = await getProfileCharacter(prisma, interaction.user.id);

        const { EMBED_COLORS } = require('./utils/ui');
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

        return;
      }

      // 생산 메뉴 버튼 핸들러
      if (interaction.customId === 'production_menu_gather') {
        const gatherCommand = client.commands.get('gather');
        if (gatherCommand) {
          await gatherCommand.execute(interaction, { prisma });
        }
        return;
      }

      if (interaction.customId === 'production_menu_craft') {
        const craftCommand = client.commands.get('craft');
        if (craftCommand) {
          await craftCommand.execute(interaction, { prisma });
        }
        return;
      }

      if (interaction.customId === 'production_menu_resources') {
        const resourcesCommand = client.commands.get('resources');
        if (resourcesCommand) {
          await resourcesCommand.execute(interaction, { prisma });
        }
        return;
      }

      if (interaction.customId === 'production_menu_skills') {
        const pskillCommand = client.commands.get('production_skills');
        if (pskillCommand) {
          await pskillCommand.execute(interaction, { prisma });
        }
        return;
      }

      if (interaction.customId === 'production_menu_back') {
        const character = await getProfileCharacter(prisma, interaction.user.id);

        if (!character) {
          await interaction.reply({
            content: '캐릭터가 없습니다.',
            ephemeral: true,
          });

          return;
        }

        await interaction.update({
          embeds: [createProfileEmbed(character)],
          components: createProfileActionRow({ character }),
        });

        return;
      }

      // 존 정보 보기 버튼
      if (interaction.customId.startsWith('zone_info:')) {
        const zoneKey = interaction.customId.slice('zone_info:'.length);
        const { getZone } = require('./game/monsters');
        const exploreCommand = client.commands.get('explore');

        if (!exploreCommand) {
          await interaction.reply({
            content: '탐험 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const zone = getZone(zoneKey);

        if (!zone) {
          await interaction.reply({
            content: '유효하지 않은 존입니다.',
            ephemeral: true,
          });

          return;
        }

        // 존 상세 정보 embed + 몬스터 선택으로 돌아가기 버튼
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        
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

        return;
      }

      // 뒤로가기 버튼 (Zone 선택 화면으로)
      if (interaction.customId === 'back_to_zones') {
        const exploreCommand = client.commands.get('explore');

        if (!exploreCommand) {
          await interaction.reply({
            content: '탐험 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        await interaction.update({
          embeds: [exploreCommand.createZoneSelectionEmbed()],
          components: exploreCommand.createZoneSelectionActionRows(),
        });

        return;
      }

      // Zone 선택 버튼 (몬스터 선택 화면으로)
      if (interaction.customId.startsWith(PROFILE_ZONE_BUTTON_PREFIX)) {
        const zoneKey = interaction.customId.slice(PROFILE_ZONE_BUTTON_PREFIX.length);

        if (!PROFILE_ZONE_KEYS.has(zoneKey)) {
          await interaction.reply({
            content: '유효하지 않은 탐험지입니다.',
            ephemeral: true,
          });

          return;
        }

        const exploreCommand = client.commands.get('explore');

        if (!exploreCommand) {
          await interaction.reply({
            content: '탐험 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const { getZone } = require('./game/monsters');
        const zone = getZone(zoneKey);

        if (!zone) {
          await interaction.reply({
            content: '유효하지 않은 탐험지입니다.',
            ephemeral: true,
          });

          return;
        }

        // 레벨 체크
        const character = await prisma.character.findUnique({
          where: { userId: interaction.user.id },
        });

        if (!character) {
          await interaction.reply({
            content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
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
        await interaction.update({
          embeds: [exploreCommand.createMonsterSelectionEmbed(zone)],
          components: exploreCommand.createMonsterSelectionActionRows(zoneKey, zone),
        });

        return;
      }

      // 전직 버튼
      if (interaction.customId.startsWith(JOBCHANGE_BUTTON_PREFIX)) {
        const jobchangeCommand = client.commands.get('jobchange');

        if (!jobchangeCommand) {
          await interaction.reply({
            content: '전직 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await jobchangeCommand.handleJobChangeButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 생산 전직 버튼
      if (interaction.customId.startsWith(PRODUCTION_JOBCHANGE_BUTTON_PREFIX)) {
        const prodJobchangeCommand = client.commands.get('production_jobchange');

        if (!prodJobchangeCommand) {
          await interaction.reply({
            content: '생산 전직 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await prodJobchangeCommand.handleProductionJobChangeButton(interaction, {
          prisma,
        });

        if (handled) {
          return;
        }
      }

      if (interaction.customId.startsWith(JOB_RESPEC_BUTTON_PREFIX)) {
        const handled = await handleJobRespecButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 상점 버튼
      if (interaction.customId.startsWith(SHOP_BUTTON_PREFIX)) {
        const shopCommand = client.commands.get('shop');

        if (!shopCommand) {
          await interaction.reply({
            content: '상점 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await shopCommand.handleShopButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 생산 버튼
      if (interaction.customId.startsWith(PRODUCTION_BUTTON_PREFIX)) {
        const productionCommand = client.commands.get('production');

        if (!productionCommand) {
          await interaction.reply({
            content: '생산 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await productionCommand.handleProductionButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 채집 버튼
      if (interaction.customId.startsWith(GATHER_BUTTON_PREFIX)) {
        const gatherCommand = client.commands.get('gather');

        if (!gatherCommand) {
          await interaction.reply({
            content: '채집 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await gatherCommand.handleGatherButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 제작 버튼
      if (interaction.customId.startsWith(CRAFT_BUTTON_PREFIX)) {
        const craftCommand = client.commands.get('craft');

        if (!craftCommand) {
          await interaction.reply({
            content: '제작 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await craftCommand.handleCraftButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 생산 스킬 버튼
      if (interaction.customId.startsWith(PSKILL_BUTTON_PREFIX)) {
        const pskillCommand = client.commands.get('production_skills');

        if (!pskillCommand) {
          await interaction.reply({
            content: '생산 스킬 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await pskillCommand.handleProductionSkillButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 거래소 버튼
      if (interaction.customId.startsWith(MARKET_BUTTON_PREFIX)) {
        const marketCommand = client.commands.get('market');

        if (!marketCommand) {
          await interaction.reply({
            content: '거래소 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await marketCommand.handleMarketButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 경제 관리자 버튼
      if (interaction.customId.startsWith(ECONOMY_ADMIN_BUTTON_PREFIX)) {
        const economyAdminCommand = client.commands.get('economy_admin');

        if (!economyAdminCommand) {
          await interaction.reply({
            content: '경제 관리자 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        if (typeof economyAdminCommand.handleEconomyAdminButton === 'function') {
          const handled = await economyAdminCommand.handleEconomyAdminButton(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // 통계 버튼
      if (interaction.customId.startsWith(STATS_BUTTON_PREFIX)) {
        const statsCommand = client.commands.get('stats');

        if (!statsCommand) {
          await interaction.reply({
            content: '통계 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        if (typeof statsCommand.handleStatsButton === 'function') {
          const handled = await statsCommand.handleStatsButton(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // NPC 상점 버튼
      if (interaction.customId.startsWith(NPC_SHOP_BUTTON_PREFIX)) {
        const npcShopCommand = client.commands.get('npc_shop');

        if (!npcShopCommand) {
          await interaction.reply({
            content: 'NPC 상점 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await npcShopCommand.handleNpcShopButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 자원 판매소 버튼
      if (interaction.customId.startsWith(SELL_RESOURCES_BUTTON_PREFIX)) {
        const sellResourcesCommand = client.commands.get('sell_resources');

        if (!sellResourcesCommand) {
          await interaction.reply({
            content: '자원 판매 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        if (typeof sellResourcesCommand.handleSellResourcesButton === 'function') {
          const handled = await sellResourcesCommand.handleSellResourcesButton(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // 경매장 버튼
      if (interaction.customId.startsWith(AUCTION_BUTTON_PREFIX)) {
        const auctionCommand = client.commands.get('auction');

        if (!auctionCommand) {
          await interaction.reply({
            content: '경매장 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await auctionCommand.handleAuctionButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 랭킹 버튼
      if (interaction.customId.startsWith(RANKING_COMPONENT_PREFIX)) {
        const rankingCommand = client.commands.get('ranking');

        if (!rankingCommand) {
          await interaction.reply({
            content: '랭킹 명령어를 찾을 수 없습니다.',
            ephemeral: true,
          });

          return;
        }

        const handled = await rankingCommand.handleRankingButton(interaction, { prisma });

        if (handled) {
          return;
        }
      }

      // 몬스터 선택 버튼 (전투 시작)
      if (interaction.customId.startsWith(MONSTER_SELECT_PREFIX)) {
        const [zoneKey, monsterKey] = interaction.customId
          .slice(MONSTER_SELECT_PREFIX.length)
          .split(':');

        if (!zoneKey || !monsterKey) {
          await interaction.reply({
            content: '유효하지 않은 선택입니다.',
            ephemeral: true,
          });

          return;
        }

        const {
          getZone,
          getZoneWithTypeData,
          MONSTERS,
          rollRareMonster,
          applyRareModifier,
        } = require('./game/monsters');
        const { createCombatEmbed, createCombatActionRows } = require('./game/combat');
        const { localizeClassName } = require('./utils/ui');

        const zone = getZone(zoneKey);
        const baseMonster = MONSTERS[monsterKey];

        if (!zone || !baseMonster) {
          await interaction.reply({
            content: '유효하지 않은 선택입니다.',
            ephemeral: true,
          });

          return;
        }

        // 존별 능력치 적용 + 레어 체크
        const zoneData = getZoneWithTypeData(zoneKey);
        const statMult = zoneData?.typeData?.statMultiplier || 1.0;
        
        let monster = {
          ...baseMonster,
          hp: Math.floor(baseMonster.hp * statMult),
          attack: Math.floor(baseMonster.attack * statMult),
          defense: Math.floor(baseMonster.defense * statMult),
        };

        // 레어 몬스터 체크 (보스 제외, 존별 확률)
        if (!baseMonster.isBoss) {
          const rareType = rollRareMonster(zoneKey);
          if (rareType) {
            monster = applyRareModifier(monster, rareType);
          }
        }

        const character = await prisma.character.findUnique({
          where: { userId: interaction.user.id },
          include: { 
            combatSession: true,
            skills: true,
          },
        });

        if (!character) {
          await interaction.reply({
            content: '캐릭터가 없습니다.',
            ephemeral: true,
          });

          return;
        }

        if (character.combatSession) {
          await interaction.reply({
            content: '이미 진행 중인 전투가 있습니다.',
            ephemeral: true,
          });

          return;
        }

        // HP 체크 및 부활
        let playerHp = character.hp;
        if (playerHp <= 0) {
          const revived = await prisma.character.update({
            where: { id: character.id },
            data: { hp: character.maxHp },
          });
          playerHp = revived.hp;
        }

        // 전투 세션 생성
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
            monsterFirstStrike: zone.key === 'zone3', // Zone 3 monsters attack first
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

        await interaction.update({
          embeds: [embed],
          components: createCombatActionRows(session.id, { character: { ...character, hp: playerHp } }),
        });

        await maybeSendGuideTip({
          prisma,
          user: interaction.user,
          interaction,
          category: 'combat',
        });

        return;
      }

      // 어떤 버튼 핸들러에도 매칭되지 않은 경우
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '알 수 없는 버튼입니다.',
          ephemeral: true,
        });
      }
      return;
    }

    // StringSelectMenu 핸들러
    if (interaction.isStringSelectMenu()) {
      // 랭킹 셀렉트
      if (interaction.customId.startsWith(RANKING_COMPONENT_PREFIX)) {
        const rankingCommand = client.commands.get('ranking');

        if (rankingCommand) {
          const handled = await rankingCommand.handleRankingSelect(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // 거래소 셀렉트
      if (interaction.customId.startsWith(MARKET_BUTTON_PREFIX)) {
        const marketCommand = client.commands.get('market');

        if (marketCommand) {
          const handled = await marketCommand.handleMarketSelect(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // NPC 상점 셀렉트
      if (interaction.customId.startsWith(NPC_SHOP_BUTTON_PREFIX)) {
        const npcShopCommand = client.commands.get('npc_shop');

        if (npcShopCommand) {
          const handled = await npcShopCommand.handleNpcShopSelect(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // 자원 판매소 셀렉트
      if (interaction.customId.startsWith(SELL_RESOURCES_BUTTON_PREFIX)) {
        const sellResourcesCommand = client.commands.get('sell_resources');

        if (sellResourcesCommand && typeof sellResourcesCommand.handleSellResourcesSelect === 'function') {
          const handled = await sellResourcesCommand.handleSellResourcesSelect(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // 경매장 셀렉트
      if (interaction.customId.startsWith(AUCTION_BUTTON_PREFIX)) {
        const auctionCommand = client.commands.get('auction');

        if (auctionCommand) {
          const handled = await auctionCommand.handleAuctionSelect(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // 미처리 셀렉트 메뉴 fallback
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '알 수 없는 선택입니다.',
          ephemeral: true,
        });
      }
      return;
    }

    // Modal 핸들러
    if (interaction.isModalSubmit()) {
      // 거래소 모달
      if (interaction.customId.startsWith(MARKET_BUTTON_PREFIX)) {
        const marketCommand = client.commands.get('market');

        if (marketCommand) {
          const handled = await marketCommand.handleMarketModal(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // NPC 상점 모달
      if (interaction.customId.startsWith(NPC_SHOP_BUTTON_PREFIX)) {
        const npcShopCommand = client.commands.get('npc_shop');

        if (npcShopCommand) {
          const handled = await npcShopCommand.handleNpcShopModal(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // 자원 판매소 모달
      if (interaction.customId.startsWith(SELL_RESOURCES_BUTTON_PREFIX)) {
        const sellResourcesCommand = client.commands.get('sell_resources');

        if (sellResourcesCommand && typeof sellResourcesCommand.handleSellResourcesModal === 'function') {
          const handled = await sellResourcesCommand.handleSellResourcesModal(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // 경매 모달
      if (interaction.customId.startsWith(AUCTION_BUTTON_PREFIX)) {
        const auctionCommand = client.commands.get('auction');

        if (auctionCommand) {
          const handled = await auctionCommand.handleAuctionModal(interaction, { prisma });

          if (handled) {
            return;
          }
        }
      }

      // 미처리 모달 fallback
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '처리할 수 없는 요청입니다.',
          ephemeral: true,
        });
      }
      return;
    }
  } catch (error) {
    console.error('인터랙션 처리 중 오류:', error);

    const message = '인터랙션 처리 중 오류가 발생했습니다.';

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
      return;
    }

    await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
  }
});

async function shutdown(signal) {
  console.log(`${signal} 신호를 받아 종료를 시작합니다...`);

  stopDailyQuestResetScheduler();

  if (sessionCleanupJob) {
    sessionCleanupJob.stop();
    sessionCleanupJob = null;
  }

  if (economyMonitoringJob) {
    economyMonitoringJob.stop();
    economyMonitoringJob = null;
  }

  if (auctionSettlementJob) {
    auctionSettlementJob.stop();
    auctionSettlementJob = null;
  }

  if (priceAlertJob) {
    priceAlertJob.stop();
    priceAlertJob = null;
  }

  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('unhandledRejection', (error) => {
  console.error('처리되지 않은 프로미스 거부:', error);
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('디스코드 로그인에 실패했습니다:', error);
  process.exit(1);
});
