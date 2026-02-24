const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { TradingSystem } = require('../game/trading-system');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setNameLocalizations({ ko: '거래' })
    .setDescription('플레이어 간 거래')
    .setDescriptionLocalizations({ ko: '플레이어 간 거래' })
    .addSubcommand(sub =>
      sub.setName('start')
        .setNameLocalizations({ ko: '시작' })
        .setDescription('거래 시작')
        .setDescriptionLocalizations({ ko: '거래 시작' })
        .addUserOption(opt =>
          opt.setName('user')
            .setNameLocalizations({ ko: '유저' })
            .setDescription('거래할 유저')
            .setDescriptionLocalizations({ ko: '거래할 유저' })
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setNameLocalizations({ ko: '확인' })
        .setDescription('현재 거래 확인')
        .setDescriptionLocalizations({ ko: '현재 거래 확인' })
    )
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setNameLocalizations({ ko: '취소' })
        .setDescription('거래 취소')
        .setDescriptionLocalizations({ ko: '거래 취소' })
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'start':
        return await handleStart(interaction);
      case 'view':
        return await handleView(interaction);
      case 'cancel':
        return await handleCancel(interaction);
      default:
        return interaction.reply({ content: '알 수 없는 명령어입니다.', ephemeral: true });
    }
  }
};

async function handleStart(interaction) {
  const targetUser = interaction.options.getUser('user');
  const userId = interaction.user.id;

  const result = await TradingSystem.startTrade(userId, targetUser.id);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('🤝 거래 시작')
    .setDescription(`${interaction.user}님과 ${targetUser}님의 거래가 시작되었습니다!`)
    .addFields(
      { name: '제한 시간', value: '5분', inline: true },
      { name: '거래 ID', value: `\`${result.tradeId}\``, inline: true }
    )
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`trade_add_item_${result.tradeId}`)
        .setLabel('아이템 추가')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📦'),
      new ButtonBuilder()
        .setCustomId(`trade_set_gold_${result.tradeId}`)
        .setLabel('골드 설정')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💰'),
      new ButtonBuilder()
        .setCustomId(`trade_confirm_${result.tradeId}`)
        .setLabel('확인')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`trade_cancel_${result.tradeId}`)
        .setLabel('취소')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

  await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleView(interaction) {
  const userId = interaction.user.id;
  const result = TradingSystem.getUserTrade(userId);

  if (!result) {
    return interaction.reply({ content: '❌ 진행 중인 거래가 없습니다.', ephemeral: true });
  }

  const { tradeId, trade } = result;

  // 현재 유저가 user1인지 user2인지 확인
  const isUser1 = trade.user1.userId === userId;
  const myData = isUser1 ? trade.user1 : trade.user2;
  const theirData = isUser1 ? trade.user2 : trade.user1;

  const myItemsList = myData.items.map(item => `\`${item.name}\` (${item.tier})`).join('\n') || '_없음_';
  const theirItemsList = theirData.items.map(item => `\`${item.name}\` (${item.tier})`).join('\n') || '_없음_';

  const embed = new EmbedBuilder()
    .setColor(0x00BFFF)
    .setTitle('🤝 거래 내역')
    .addFields(
      { name: '내가 주는 것', value: `**아이템:**\n${myItemsList}\n\n**골드:** ${myData.gold.toLocaleString()}`, inline: true },
      { name: '상대가 주는 것', value: `**아이템:**\n${theirItemsList}\n\n**골드:** ${theirData.gold.toLocaleString()}`, inline: true },
      { name: '확인 상태', value: `나: ${myData.confirmed ? '✅' : '⏳'} | 상대: ${theirData.confirmed ? '✅' : '⏳'}`, inline: false }
    )
    .setFooter({ text: `거래 ID: ${tradeId}` })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`trade_add_item_${tradeId}`)
        .setLabel('아이템 추가')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📦'),
      new ButtonBuilder()
        .setCustomId(`trade_set_gold_${tradeId}`)
        .setLabel('골드 설정')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💰'),
      new ButtonBuilder()
        .setCustomId(`trade_confirm_${tradeId}`)
        .setLabel('확인')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`trade_cancel_${tradeId}`)
        .setLabel('취소')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

  await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleCancel(interaction) {
  const userId = interaction.user.id;
  const userTrade = TradingSystem.getUserTrade(userId);

  if (!userTrade) {
    return interaction.reply({ content: '❌ 진행 중인 거래가 없습니다.', ephemeral: true });
  }

  const result = TradingSystem.cancelTrade(userTrade.tradeId, userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: '✅ 거래가 취소되었습니다.' });
}
