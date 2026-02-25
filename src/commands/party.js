const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('party')
		.setNameLocalizations({ "en-US": "party" })
    .setDescription('파티 시스템')
		.setDescriptionLocalizations({ "en-US": "파티 시스템" })
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('파티 생성')
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('파티 이름 (선택)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('join')
        .setDescription('파티 가입')
        .addIntegerOption(opt =>
          opt
            .setName('party_id')
            .setDescription('파티 ID')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('leave').setDescription('파티 탈퇴')
    )
    .addSubcommand(sub =>
      sub
        .setName('kick')
        .setDescription('파티원 추방 (파티장만 가능)')
        .addUserOption(opt =>
          opt
            .setName('user')
            .setDescription('추방할 유저')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('info').setDescription('파티 정보')
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreate(interaction, prisma);
        break;
      case 'join':
        await handleJoin(interaction, prisma);
        break;
      case 'leave':
        await handleLeave(interaction, prisma);
        break;
      case 'kick':
        await handleKick(interaction, prisma);
        break;
      case 'info':
        await handleInfo(interaction, prisma);
        break;
      default:
        await interaction.reply({
          content: '알 수 없는 명령어입니다.',
          ephemeral: true,
        });
    }
  },
};

/**
 * 파티 생성
 */
async function handleCreate(interaction, prisma) {
  const character = await prisma.character.findUnique({
    where: { userId: interaction.user.id },
  });

  if (!character) {
    await interaction.reply({
      content: '먼저 `/create` 명령어로 캐릭터를 생성해주세요!',
      ephemeral: true,
    });
    return;
  }

  // 이미 파티에 있는지 체크
  const existingMembership = await prisma.partyMember.findFirst({
    where: { userId: interaction.user.id },
    include: { party: true },
  });

  if (existingMembership && existingMembership.party.isActive) {
    await interaction.reply({
      content: `이미 파티에 속해있습니다! (파티 ID: ${existingMembership.partyId})`,
      ephemeral: true,
    });
    return;
  }

  const partyName = interaction.options.getString('name') || `${interaction.user.username}의 파티`;

  const party = await prisma.party.create({
    data: {
      leaderId: interaction.user.id,
      name: partyName,
      members: {
        create: {
          userId: interaction.user.id,
          characterId: character.id,
        },
      },
    },
  });

  const embed = new EmbedBuilder()
    .setTitle('🎉 파티 생성 완료!')
    .setDescription(`**${partyName}**`)
    .addFields(
      { name: '파티 ID', value: `${party.id}`, inline: true },
      { name: '파티장', value: interaction.user.username, inline: true },
      { name: '인원', value: `1 / ${party.maxSize}`, inline: true },
    )
    .setColor(0x10b981)
    .setFooter({ text: '다른 플레이어를 초대하려면 파티 ID를 알려주세요!' });

  await interaction.reply({ embeds: [embed] });
}

/**
 * 파티 가입
 */
async function handleJoin(interaction, prisma) {
  const character = await prisma.character.findUnique({
    where: { userId: interaction.user.id },
  });

  if (!character) {
    await interaction.reply({
      content: '먼저 `/create` 명령어로 캐릭터를 생성해주세요!',
      ephemeral: true,
    });
    return;
  }

  // 이미 파티에 있는지 체크
  const existingMembership = await prisma.partyMember.findFirst({
    where: { userId: interaction.user.id },
    include: { party: true },
  });

  if (existingMembership && existingMembership.party.isActive) {
    await interaction.reply({
      content: '이미 파티에 속해있습니다! 먼저 `/party leave`로 탈퇴하세요.',
      ephemeral: true,
    });
    return;
  }

  const partyId = interaction.options.getInteger('party_id');

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { members: true },
  });

  if (!party || !party.isActive) {
    await interaction.reply({
      content: '존재하지 않는 파티입니다!',
      ephemeral: true,
    });
    return;
  }

  if (party.members.length >= party.maxSize) {
    await interaction.reply({
      content: '파티가 꽉 찼습니다!',
      ephemeral: true,
    });
    return;
  }

  await prisma.partyMember.create({
    data: {
      partyId: party.id,
      userId: interaction.user.id,
      characterId: character.id,
    },
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ 파티 가입 완료!')
    .setDescription(`**${party.name}**에 참가했습니다!`)
    .addFields(
      { name: '파티 ID', value: `${party.id}`, inline: true },
      { name: '현재 인원', value: `${party.members.length + 1} / ${party.maxSize}`, inline: true },
    )
    .setColor(0x10b981);

  await interaction.reply({ embeds: [embed] });
}

/**
 * 파티 탈퇴
 */
async function handleLeave(interaction, prisma) {
  const membership = await prisma.partyMember.findFirst({
    where: { userId: interaction.user.id },
    include: { party: true },
  });

  if (!membership || !membership.party.isActive) {
    await interaction.reply({
      content: '파티에 속해있지 않습니다!',
      ephemeral: true,
    });
    return;
  }

  const party = membership.party;

  // 파티장인 경우
  if (party.leaderId === interaction.user.id) {
    // 다른 멤버가 있으면 파티장 위임
    const otherMembers = await prisma.partyMember.findMany({
      where: {
        partyId: party.id,
        userId: { not: interaction.user.id },
      },
    });

    if (otherMembers.length > 0) {
      await prisma.party.update({
        where: { id: party.id },
        data: { leaderId: otherMembers[0].userId },
      });
    } else {
      // 혼자였으면 파티 해체
      await prisma.party.update({
        where: { id: party.id },
        data: { isActive: false },
      });
    }
  }

  await prisma.partyMember.delete({
    where: { id: membership.id },
  });

  await interaction.reply({
    content: '파티에서 탈퇴했습니다.',
    ephemeral: true,
  });
}

/**
 * 파티원 추방
 */
async function handleKick(interaction, prisma) {
  const membership = await prisma.partyMember.findFirst({
    where: { userId: interaction.user.id },
    include: { party: true },
  });

  if (!membership || !membership.party.isActive) {
    await interaction.reply({
      content: '파티에 속해있지 않습니다!',
      ephemeral: true,
    });
    return;
  }

  const party = membership.party;

  if (party.leaderId !== interaction.user.id) {
    await interaction.reply({
      content: '파티장만 추방할 수 있습니다!',
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser('user');

  const targetMembership = await prisma.partyMember.findFirst({
    where: {
      partyId: party.id,
      userId: targetUser.id,
    },
  });

  if (!targetMembership) {
    await interaction.reply({
      content: '해당 유저는 파티에 없습니다!',
      ephemeral: true,
    });
    return;
  }

  await prisma.partyMember.delete({
    where: { id: targetMembership.id },
  });

  await interaction.reply({
    content: `${targetUser.username}님을 파티에서 추방했습니다.`,
    ephemeral: false,
  });
}

/**
 * 파티 정보
 */
async function handleInfo(interaction, prisma) {
  const membership = await prisma.partyMember.findFirst({
    where: { userId: interaction.user.id },
    include: {
      party: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!membership || !membership.party.isActive) {
    await interaction.reply({
      content: '파티에 속해있지 않습니다!',
      ephemeral: true,
    });
    return;
  }

  const party = membership.party;

  // 멤버 목록
  const memberList = await Promise.all(
    party.members.map(async (m) => {
      const user = await interaction.client.users.fetch(m.userId);
      const isLeader = m.userId === party.leaderId;
      return `${isLeader ? '👑 ' : ''}${user.username}`;
    })
  );

  const embed = new EmbedBuilder()
    .setTitle(`🎭 ${party.name}`)
    .addFields(
      { name: '파티 ID', value: `${party.id}`, inline: true },
      { name: '인원', value: `${party.members.length} / ${party.maxSize}`, inline: true },
      { name: '멤버', value: memberList.join('\n'), inline: false },
    )
    .setColor(0x3b82f6)
    .setFooter({ text: '파티원과 함께 던전을 공략하세요!' });

  await interaction.reply({ embeds: [embed] });
}
