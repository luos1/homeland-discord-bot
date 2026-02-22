require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} = require('discord.js');

const { prisma } = require('./database/client');
const {
  handleCombatButton,
  isCombatButton,
  isCombatEndButton,
  parseCombatEndCustomId,
} = require('./game/combat');
const {
  PROFILE_BUTTON_IDS,
  createProfileActionRow,
  createProfileEmbed,
  getProfileCharacter,
} = require('./commands/profile');
const { getPlayCreateClassChoice } = require('./commands/play');
const { JOBCHANGE_BUTTON_PREFIX } = require('./commands/jobchange');
const { INVENTORY_BUTTON_PREFIX } = require('./commands/inventory');

const REQUIRED_ENV = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DATABASE_URL'];
const PROFILE_ZONE_BUTTON_PREFIX = 'profile_zone:';
const MONSTER_SELECT_PREFIX = 'monster_select:';
const PROFILE_ZONE_KEYS = new Set(['zone1', 'zone2', 'zone3']);

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

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`${readyClient.user.tag} 계정으로 로그인되었습니다.`);

  try {
    await registerCommands();
  } catch (error) {
    console.error('슬래시 명령어 등록에 실패했습니다:', error);
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
      return;
    }

    if (interaction.isButton()) {
      if (isCombatButton(interaction.customId)) {
        await handleCombatButton({ interaction, prisma });
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

      if (interaction.customId === PROFILE_BUTTON_IDS.shop) {
        await interaction.reply({
          content: '상점 시스템은 2주차에 구현됩니다.',
          ephemeral: true,
        });

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
          components: [createProfileActionRow()],
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

        const { getZone, MONSTERS } = require('./game/monsters');
        const { createCombatEmbed, createCombatActionRow } = require('./game/combat');
        const { localizeClassName } = require('./utils/ui');

        const zone = getZone(zoneKey);
        const monster = MONSTERS[monsterKey];

        if (!zone || !monster) {
          await interaction.reply({
            content: '유효하지 않은 선택입니다.',
            ephemeral: true,
          });

          return;
        }

        const character = await prisma.character.findUnique({
          where: { userId: interaction.user.id },
          include: { combatSession: true },
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
          components: [createCombatActionRow(session.id, { character: { ...character, hp: playerHp } })],
        });

        return;
      }
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

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('디스코드 로그인에 실패했습니다:', error);
  process.exit(1);
});
