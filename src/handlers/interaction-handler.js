const {
  handleOnboardingEvent,
  sendOnboardingFeedback,
} = require('../game/onboarding');
const { handleButton } = require('./button-router');
const { handleSelectMenu } = require('./select-router');
const { handleModal } = require('./modal-router');
const { logger } = require('../utils/server-logger');

async function handleInteraction(interaction, { prisma, client }) {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        await interaction.reply({
          content: '명령어를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return;
      }

      await command.execute(interaction, { prisma, client });

      const onboardingFeedback = await handleOnboardingEvent({
        prisma,
        user: interaction.user,
        eventType: `command_${interaction.commandName}`,
      });
      await sendOnboardingFeedback(interaction, onboardingFeedback);
      return;
    }

    if (interaction.isButton()) {
      await handleButton(interaction, { prisma, client });
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction, { prisma, client });
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModal(interaction, { prisma, client });
      return;
    }
  } catch (error) {
    console.error('인터랙션 처리 중 오류:', error);

    // Discord 로그 채널에 에러 전송
    const context = interaction.isChatInputCommand() 
      ? `명령어: /${interaction.commandName}`
      : interaction.isButton()
      ? `버튼: ${interaction.customId}`
      : `기타: ${interaction.type}`;
    
    logger.logError(error, `${context} | User: ${interaction.user.tag}`).catch(() => {});

    const message = '인터랙션 처리 중 오류가 발생했습니다.';

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
      return;
    }

    await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
  }
}

module.exports = {
  handleInteraction,
};
