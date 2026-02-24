async function replyEphemeral(interaction, content) {
  return interaction.reply({ content, ephemeral: true });
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.followUp(payload);
    }
    return await interaction.reply(payload);
  } catch (error) {
    console.error('응답 전송 실패:', error);
    return null;
  }
}

async function updateOrReply(interaction, payload) {
  try {
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      return await interaction.update(payload);
    }
    return await interaction.reply(payload);
  } catch (error) {
    console.error('응답 전송 실패:', error);
    return null;
  }
}

async function replyNoCharacter(interaction) {
  return interaction.reply({
    content: '캐릭터가 없습니다. `/create` 명령어로 캐릭터를 생성해주세요.',
    ephemeral: true,
  });
}

async function requireCharacter(prisma, interaction, options = {}) {
  const where = options.where || { userId: interaction.user.id };
  const queryOptions = { where };

  if (options.include) {
    queryOptions.include = options.include;
  }

  const character = await prisma.character.findUnique(queryOptions);

  if (!character) {
    const message = '캐릭터가 없습니다. `/create` 명령어로 캐릭터를 생성해주세요.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
    return null;
  }

  return character;
}

async function forwardCommandFromButton(interaction, { prisma, client }, config) {
  await interaction.deferUpdate();

  const cmd = client.commands.get(config.commandName);
  if (!cmd) {
    await interaction.followUp({
      content: `${config.errorLabel} 명령어를 찾을 수 없습니다.`,
      ephemeral: true,
    });
    return;
  }

  await cmd.execute(
    {
      user: interaction.user,
      ...(config.executeOptions || {}),
      reply: interaction.followUp.bind(interaction),
    },
    { prisma, ...(config.extraDeps || {}), client },
  );
}

async function navigateToProfile(interaction, prisma, { getProfileCharacter, createProfileEmbed, createProfileActionRow }) {
  const character = await getProfileCharacter(prisma, interaction.user.id);
  if (!character) {
    await interaction.reply({ content: '캐릭터가 없습니다.', ephemeral: true });
    return false;
  }
  await interaction.update({
    embeds: [createProfileEmbed(character)],
    components: createProfileActionRow({ character }),
  });
  return true;
}

module.exports = {
  replyEphemeral,
  safeReply,
  updateOrReply,
  replyNoCharacter,
  requireCharacter,
  forwardCommandFromButton,
  navigateToProfile,
};
