'use strict';

async function safeInteractionReply(interaction, message) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  } catch (error) {
    console.error('인터랙션 응답 실패:', error);
  }
}

function wrapCommandExecute(fn) {
  return async (interaction, deps) => {
    try {
      await fn(interaction, deps);
    } catch (error) {
      console.error('명령어 실행 중 오류:', error);
      await safeInteractionReply(interaction, '명령어 실행 중 오류가 발생했습니다.');
    }
  };
}

module.exports = {
  safeInteractionReply,
  wrapCommandExecute,
};
