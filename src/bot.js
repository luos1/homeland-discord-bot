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
const { handleCombatButton, isCombatButton } = require('./game/combat');
const {
  PROFILE_BUTTON_IDS,
  createProfileActionRow,
  createProfileEmbed,
  getProfileCharacter,
} = require('./commands/profile');
const { getPlayCreateClassChoice } = require('./commands/play');

const REQUIRED_ENV = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DATABASE_URL'];
const PROFILE_ZONE_BUTTON_PREFIX = 'profile_zone:';
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
        await interaction.reply({
          content: '인벤토리 시스템은 2주차에 구현됩니다.',
          ephemeral: true,
        });

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

        await exploreCommand.execute(
          {
            user: interaction.user,
            options: {
              getString(optionName) {
                return optionName === 'zone' ? zoneKey : null;
              },
            },
            reply: interaction.reply.bind(interaction),
          },
          { prisma, client },
        );
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
