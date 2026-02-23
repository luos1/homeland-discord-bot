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

module.exports = {
  replyEphemeral,
  safeReply,
  updateOrReply,
  replyNoCharacter,
};
