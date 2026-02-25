const { SlashCommandBuilder } = require('discord.js');

const villageCommand = require('./village');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('town')
		.setNameLocalizations({ "en-US": "town" })
    .setDescription('마을 허브 UI를 열고 버튼으로 메뉴를 이동합니다')
		.setDescriptionLocalizations({ "en-US": "마을 허브 UI를 열고 버튼으로 메뉴를 이동합니다" }),

  async execute(interaction, context) {
    await villageCommand.executeVillageHub(interaction, context);
  },
};
