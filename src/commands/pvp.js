const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinPvPQueue, leaveQueue, getPvPRankings } = require('../game/pvp-system');
const { requireCharacter } = require('../utils/response-helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pvp')
    .setDescription('PvP 전투')
    .setDescriptionLocalizations({ ko: 'PvP 전투' })
    .addSubcommand(sub =>
      sub.setName('queue')
        .setDescription('PvP 매칭 대기')
        .setDescriptionLocalizations({ ko: 'PvP 매칭 대기' })
    )
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('매칭 취소')
        .setDescriptionLocalizations({ ko: '매칭 취소' })
    )
    .addSubcommand(sub =>
      sub.setName('ranking')
        .setDescription('PvP 랭킹 확인')
        .setDescriptionLocalizations({ ko: 'PvP 랭킹 확인' })
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'queue') {
      return await handleQueue(interaction, { prisma });
    }

    if (subcommand === 'cancel') {
      return await handleCancel(interaction);
    }

    if (subcommand === 'ranking') {
      return await handleRanking(interaction, { prisma });
    }
  }
};

async function handleQueue(interaction, { prisma }) {
  const character = await requireCharacter(prisma, interaction);
  if (!character) return;

  if (character.level < 10) {
    return interaction.reply({ content: 'PvP는 레벨 10 이상부터 가능합니다.', ephemeral: true });
  }

  const result = await joinPvPQueue(interaction.user.id, character);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  if (result.matched) {
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('⚔️ PvP 매칭 성공!')
      .setDescription([
        `상대: **${result.opponent.name}** (Lv.${result.opponent.level})`,
        '',
        '전투가 시작됩니다...',
        '',
        '💡 턴제 전투입니다. 당신의 턴에 행동하세요!'
      ].join('\n'));

    return interaction.reply({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('⏳ PvP 매칭 대기 중...')
    .setDescription([
      '상대를 찾고 있습니다.',
      '',
      `📊 현재 레이팅: ${character.pvpRating || 1000}`,
      `👥 대기열: ${result.queueSize}명`,
      '',
      '매칭이 되면 자동으로 알려드립니다.'
    ].join('\n'));

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('pvp_cancel')
        .setLabel('매칭 취소')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

  return interaction.reply({ embeds: [embed], components: [row] });
}

async function handleCancel(interaction) {
  const result = leaveQueue(interaction.user.id);

  if (!result.success) {
    return interaction.reply({ content: '❌ 매칭 대기 중이 아닙니다.', ephemeral: true });
  }

  return interaction.reply({ content: '✅ PvP 매칭이 취소되었습니다.' });
}

async function handleRanking(interaction, { prisma }) {
  const rankings = await getPvPRankings(10);

  if (rankings.length === 0) {
    return interaction.reply({ content: 'PvP 랭킹 정보가 없습니다.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle('🏆 PvP 랭킹 TOP 10')
    .setDescription([
      '레이팅 순위입니다.',
      ''
    ].join('\n'));

  rankings.forEach((rank, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    embed.addFields({
      name: `${medal} ${rank.name}`,
      value: `📊 레이팅: ${rank.rating} | 🎯 승률: ${rank.winRate}% (${rank.wins}승 ${rank.losses}패)`,
      inline: false
    });
  });

  return interaction.reply({ embeds: [embed] });
}
