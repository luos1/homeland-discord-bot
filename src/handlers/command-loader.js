const fs = require('node:fs');
const path = require('node:path');
const { Collection, REST, Routes } = require('discord.js');

function loadCommands(client) {
  client.commands = new Collection();

  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

  const commandData = [];

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const loadedModule = require(filePath);
    const commands = Array.isArray(loadedModule) ? loadedModule : [loadedModule];

    for (const command of commands) {
      if (!command || typeof command !== 'object') {
        console.warn(`유효하지 않은 명령어 모듈을 건너뜁니다: ${file}`);
        continue;
      }

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
  }

  return commandData;
}

async function registerCommands(commandData) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  const route = process.env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

  await rest.put(route, { body: commandData });

  const scope = process.env.DISCORD_GUILD_ID ? '길드' : '전역';
  console.log(`${commandData.length}개의 슬래시 명령어를 등록했습니다 (${scope}).`);
}

module.exports = {
  loadCommands,
  registerCommands,
};
