const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { EMBED_COLORS, createDivider } = require('../utils/ui');

const COMMAND_GROUPS = [
  {
    title: '🎮 기본',
    names: ['play', 'create', 'profile', 'tutorial', 'invite', 'help'],
  },
  {
    title: '⚔️ 전투/성장',
    names: ['explore', 'boss', 'jobchange', 'production_jobchange', 'ranking', 'reset'],
  },
  {
    title: '🔨 생산',
    names: ['production', 'gather', 'craft', 'resources', 'production_skills'],
  },
  {
    title: '💰 경제/인벤토리',
    names: ['shop', 'shop_skills', 'market', 'npc_shop', 'sell_resources', 'auction', 'alert', 'gem', 'stats', 'premium', 'inventory'],
  },
  {
    title: '🎰 도박',
    names: ['slot', 'freespin', 'vipslot', 'coin', 'dice'],
  },
  {
    title: '🏆 업적/수집',
    names: ['achievements'],
  },
  {
    title: '📅 시즌/이벤트',
    names: ['daily', 'attendance'],
  },
  {
    title: '🛠️ 관리',
    names: ['cleanup', 'economy_admin', 'delete_character'],
  },
];

function buildGroupLines(clientCommands, names) {
  return names
    .filter((name) => clientCommands.has(name))
    .map((name) => {
      const command = clientCommands.get(name);
      const description = command?.data?.description ?? '설명 없음';
      return `• \`/${name}\` - ${description}`;
    });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
		.setNameLocalizations({ "en-US": "help" })
    .setDescription('전체 명령어와 사용 방법을 확인합니다')
		.setDescriptionLocalizations({ "en-US": "View 전체 명령어와 사용 방법" }),

  async execute(interaction, { client }) {
    const fields = COMMAND_GROUPS.map((group) => {
      const lines = buildGroupLines(client.commands, group.names);
      return {
        name: group.title,
        value: lines.length > 0 ? lines.join('\n') : '사용 가능한 명령어가 없습니다.',
      };
    }).filter((field) => field.value.length > 0);

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.profile)
      .setTitle('📘 HOMELAND 명령어 안내')
      .setDescription(
        [
          createDivider(),
          '처음 시작은 `/play` 또는 `/tutorial`을 추천합니다.',
          '전투 중에는 버튼으로 액션(공격/방어/스킬)을 선택할 수 있습니다.',
          '문제가 생기면 `/reset`으로 상태를 초기화하세요.',
          createDivider(),
        ].join('\n'),
      )
      .addFields(fields);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};
