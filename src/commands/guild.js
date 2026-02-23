const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { GuildSystem, GUILD_CREATION_COST } = require('../game/guild-system');
const { prisma } = require('../database/prisma');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guild')
    .setNameLocalizations({ ko: '길드' })
    .setDescription('길드 관리')
    .setDescriptionLocalizations({ ko: '길드 관리' })
    .addSubcommand(sub =>
      sub.setName('create')
        .setNameLocalizations({ ko: '생성' })
        .setDescription('길드 생성')
        .setDescriptionLocalizations({ ko: '길드 생성' })
        .addStringOption(opt =>
          opt.setName('name')
            .setNameLocalizations({ ko: '이름' })
            .setDescription('길드 이름')
            .setDescriptionLocalizations({ ko: '길드 이름' })
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('tag')
            .setNameLocalizations({ ko: '태그' })
            .setDescription('길드 태그 (예: CLAN)')
            .setDescriptionLocalizations({ ko: '길드 태그 (예: CLAN)' })
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setNameLocalizations({ ko: '정보' })
        .setDescription('길드 정보')
        .setDescriptionLocalizations({ ko: '길드 정보' })
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setNameLocalizations({ ko: '목록' })
        .setDescription('모집 중인 길드 목록')
        .setDescriptionLocalizations({ ko: '모집 중인 길드 목록' })
    )
    .addSubcommand(sub =>
      sub.setName('invite')
        .setNameLocalizations({ ko: '초대' })
        .setDescription('멤버 초대')
        .setDescriptionLocalizations({ ko: '멤버 초대' })
        .addUserOption(opt =>
          opt.setName('user')
            .setNameLocalizations({ ko: '유저' })
            .setDescription('초대할 유저')
            .setDescriptionLocalizations({ ko: '초대할 유저' })
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('leave')
        .setNameLocalizations({ ko: '탈퇴' })
        .setDescription('길드 탈퇴')
        .setDescriptionLocalizations({ ko: '길드 탈퇴' })
    )
    .addSubcommand(sub =>
      sub.setName('kick')
        .setNameLocalizations({ ko: '추방' })
        .setDescription('멤버 추방')
        .setDescriptionLocalizations({ ko: '멤버 추방' })
        .addUserOption(opt =>
          opt.setName('user')
            .setNameLocalizations({ ko: '유저' })
            .setDescription('추방할 유저')
            .setDescriptionLocalizations({ ko: '추방할 유저' })
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('promote')
        .setNameLocalizations({ ko: '승진' })
        .setDescription('멤버 승진 (Officer)')
        .setDescriptionLocalizations({ ko: '멤버 승진 (Officer)' })
        .addUserOption(opt =>
          opt.setName('user')
            .setNameLocalizations({ ko: '유저' })
            .setDescription('승진시킬 유저')
            .setDescriptionLocalizations({ ko: '승진시킬 유저' })
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('demote')
        .setNameLocalizations({ ko: '강등' })
        .setDescription('멤버 강등 (Member)')
        .setDescriptionLocalizations({ ko: '멤버 강등 (Member)' })
        .addUserOption(opt =>
          opt.setName('user')
            .setNameLocalizations({ ko: '유저' })
            .setDescription('강등시킬 유저')
            .setDescriptionLocalizations({ ko: '강등시킬 유저' })
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('transfer')
        .setNameLocalizations({ ko: '위임' })
        .setDescription('마스터 위임')
        .setDescriptionLocalizations({ ko: '마스터 위임' })
        .addUserOption(opt =>
          opt.setName('user')
            .setNameLocalizations({ ko: '유저' })
            .setDescription('새 마스터')
            .setDescriptionLocalizations({ ko: '새 마스터' })
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('donate')
        .setNameLocalizations({ ko: '기부' })
        .setDescription('길드에 골드 기부')
        .setDescriptionLocalizations({ ko: '길드에 골드 기부' })
        .addIntegerOption(opt =>
          opt.setName('gold')
            .setNameLocalizations({ ko: '골드' })
            .setDescription('기부할 골드')
            .setDescriptionLocalizations({ ko: '기부할 골드' })
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub.setName('disband')
        .setNameLocalizations({ ko: '해체' })
        .setDescription('길드 해체 (마스터만)')
        .setDescriptionLocalizations({ ko: '길드 해체 (마스터만)' })
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    switch (subcommand) {
      case 'create':
        return await handleCreate(interaction);
      case 'info':
        return await handleInfo(interaction);
      case 'list':
        return await handleList(interaction);
      case 'invite':
        return await handleInvite(interaction);
      case 'leave':
        return await handleLeave(interaction);
      case 'kick':
        return await handleKick(interaction);
      case 'promote':
        return await handlePromote(interaction);
      case 'demote':
        return await handleDemote(interaction);
      case 'transfer':
        return await handleTransfer(interaction);
      case 'donate':
        return await handleDonate(interaction);
      case 'disband':
        return await handleDisband(interaction);
      default:
        return interaction.reply({ content: '알 수 없는 명령어입니다.', ephemeral: true });
    }
  }
};

// ==========================================
// Handlers
// ==========================================

async function handleCreate(interaction) {
  const name = interaction.options.getString('name');
  const tag = interaction.options.getString('tag');
  const userId = interaction.user.id;

  const result = await GuildSystem.createGuild(userId, name, tag);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('🏰 길드 생성 완료!')
    .setDescription(`**${result.guild.name}** 길드가 생성되었습니다!`)
    .addFields(
      { name: '길드 레벨', value: `${result.guild.level}`, inline: true },
      { name: '최대 인원', value: `${result.guild.maxMembers}명`, inline: true },
      { name: '생성 비용', value: `${GUILD_CREATION_COST.toLocaleString()} 골드`, inline: true }
    )
    .setTimestamp();

  if (tag) {
    embed.addFields({ name: '길드 태그', value: `[${tag}]`, inline: true });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleInfo(interaction) {
  const userId = interaction.user.id;
  const guild = await GuildSystem.getUserGuild(userId);

  if (!guild) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const rankEmoji = { MASTER: '👑', OFFICER: '⭐', MEMBER: '👤' };
  const memberList = guild.members
    .map(m => `${rankEmoji[m.rank]} <@${m.userId}> (기여: ${m.contributedXp.toLocaleString()} XP)`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(`🏰 ${guild.name}`)
    .setDescription(guild.description || '_길드 설명 없음_')
    .addFields(
      { name: '길드 레벨', value: `${guild.level}`, inline: true },
      { name: '길드 자금', value: `${guild.gold.toLocaleString()} 골드`, inline: true },
      { name: '인원', value: `${guild.members.length} / ${guild.maxMembers}명`, inline: true },
      { name: '멤버 목록', value: memberList || '_멤버 없음_' }
    )
    .setTimestamp();

  if (guild.tag) {
    embed.setFooter({ text: `[${guild.tag}]` });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`guild_donate_${guild.id}`)
        .setLabel('골드 기부')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💰'),
      new ButtonBuilder()
        .setCustomId(`guild_leave_${guild.id}`)
        .setLabel('탈퇴')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚪')
    );

  await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleList(interaction) {
  const guilds = await GuildSystem.getRecruitingGuilds(10);

  if (!guilds || guilds.length === 0) {
    return interaction.reply({ content: '❌ 모집 중인 길드가 없습니다.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(0x00BFFF)
    .setTitle('🏰 모집 중인 길드 목록')
    .setDescription('가입할 길드를 선택하세요!')
    .setTimestamp();

  for (const guild of guilds) {
    const tagText = guild.tag ? `[${guild.tag}] ` : '';
    embed.addFields({
      name: `${tagText}${guild.name} (Lv.${guild.level})`,
      value: `인원: ${guild.members.length}/${guild.maxMembers} | 최소 레벨: ${guild.minLevel}`,
      inline: false
    });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleInvite(interaction) {
  const targetUser = interaction.options.getUser('user');
  const userId = interaction.user.id;

  const membership = await GuildSystem.getUserMembership(userId);

  if (!membership) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const result = await GuildSystem.inviteMember(membership.guildId, targetUser.id, userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: `✅ ${targetUser}님을 길드에 초대했습니다!` });
}

async function handleLeave(interaction) {
  const userId = interaction.user.id;

  const result = await GuildSystem.leaveGuild(userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: '✅ 길드를 탈퇴했습니다.' });
}

async function handleKick(interaction) {
  const targetUser = interaction.options.getUser('user');
  const userId = interaction.user.id;

  const membership = await GuildSystem.getUserMembership(userId);

  if (!membership) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const result = await GuildSystem.kickMember(membership.guildId, targetUser.id, userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: `✅ ${targetUser}님을 길드에서 추방했습니다.` });
}

async function handlePromote(interaction) {
  const targetUser = interaction.options.getUser('user');
  const userId = interaction.user.id;

  const membership = await GuildSystem.getUserMembership(userId);

  if (!membership) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const result = await GuildSystem.changeRank(membership.guildId, targetUser.id, 'OFFICER', userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: `✅ ${targetUser}님을 Officer로 승진시켰습니다!` });
}

async function handleDemote(interaction) {
  const targetUser = interaction.options.getUser('user');
  const userId = interaction.user.id;

  const membership = await GuildSystem.getUserMembership(userId);

  if (!membership) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const result = await GuildSystem.changeRank(membership.guildId, targetUser.id, 'MEMBER', userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: `✅ ${targetUser}님을 Member로 강등시켰습니다.` });
}

async function handleTransfer(interaction) {
  const targetUser = interaction.options.getUser('user');
  const userId = interaction.user.id;

  const membership = await GuildSystem.getUserMembership(userId);

  if (!membership) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const result = await GuildSystem.transferMaster(membership.guildId, targetUser.id, userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: `✅ ${targetUser}님에게 길드 마스터를 위임했습니다!` });
}

async function handleDonate(interaction) {
  const gold = interaction.options.getInteger('gold');
  const userId = interaction.user.id;

  const result = await GuildSystem.contributeGold(userId, gold);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: `✅ 길드에 ${gold.toLocaleString()} 골드를 기부했습니다!` });
}

async function handleDisband(interaction) {
  const userId = interaction.user.id;

  const membership = await GuildSystem.getUserMembership(userId);

  if (!membership) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  // 확인 버튼
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('⚠️ 길드 해체 확인')
    .setDescription('정말로 길드를 해체하시겠습니까?\n\n**모든 길드 자산이 삭제되며 복구할 수 없습니다!**')
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`guild_disband_confirm_${membership.guildId}`)
        .setLabel('해체')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💥'),
      new ButtonBuilder()
        .setCustomId(`guild_disband_cancel`)
        .setLabel('취소')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌')
    );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
