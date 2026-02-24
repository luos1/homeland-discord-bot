const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { HIDDEN_QUESTS } = require('../game/hidden-quests');
const { requireCharacter } = require('../utils/response-helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quest')
    .setDescription('숨겨진 퀘스트 확인 및 보상 수령'),

  async execute(interaction, { prisma }) {
    const character = await requireCharacter(prisma, interaction, { include: { hiddenQuests: true } });
    if (!character) return;

    const quests = character.hiddenQuests;

    if (!quests || quests.length === 0) {
      await interaction.reply({
        content: '아직 발견한 숨겨진 퀘스트가 없습니다.\n\n특정 조건을 달성하면 NPC가 당신에게 말을 걸어올 것입니다...',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🗺️ 숨겨진 퀘스트')
      .setColor(0x9333ea)
      .setTimestamp();

    const activeQuests = [];
    const completedQuests = [];
    const claimableQuests = [];

    for (const progress of quests) {
      const quest = HIDDEN_QUESTS[progress.questKey];
      if (!quest) continue;

      const status = getQuestStatus(progress);
      const progressText = getProgressText(progress, quest);

      const questText = [
        `**${quest.emoji} ${quest.name}**`,
        `상태: ${status}`,
        progressText ? `진행: ${progressText}` : null,
      ].filter(Boolean).join('\n');

      if (progress.completed && !progress.claimed) {
        claimableQuests.push({ questKey: progress.questKey, text: questText });
      } else if (progress.accepted && !progress.completed) {
        activeQuests.push(questText);
      } else if (progress.claimed) {
        completedQuests.push(questText);
      }
    }

    if (activeQuests.length > 0) {
      embed.addFields({
        name: '진행 중',
        value: activeQuests.join('\n\n'),
      });
    }

    if (claimableQuests.length > 0) {
      const claimText = claimableQuests.map(q => q.text).join('\n\n');
      embed.addFields({
        name: '✅ 완료 (보상 수령 가능)',
        value: claimText,
      });
    }

    if (completedQuests.length > 0) {
      embed.addFields({
        name: '보상 수령 완료',
        value: completedQuests.join('\n\n'),
      });
    }

    const components = [];
    if (claimableQuests.length > 0) {
      const buttons = claimableQuests.map(q => 
        new ButtonBuilder()
          .setCustomId(`quest_claim:${q.questKey}`)
          .setLabel(`${HIDDEN_QUESTS[q.questKey].name} 보상 수령`)
          .setStyle(ButtonStyle.Success)
      );

      for (let i = 0; i < buttons.length; i += 5) {
        const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
        components.push(row);
      }
    }

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: false,
    });
  },
};

function getQuestStatus(progress) {
  if (progress.claimed) {
    return '✅ 완료';
  }
  if (progress.completed) {
    return '🎁 보상 수령 가능';
  }
  if (progress.accepted) {
    return '⏳ 진행 중';
  }
  if (progress.discovered) {
    return '❔ 발견됨 (미수락)';
  }
  return '❓ 알 수 없음';
}

function getProgressText(progress, quest) {
  if (!progress.accepted || progress.completed) {
    return null;
  }

  const objective = quest.objective;
  const current = progress.progress;
  const required = objective.required;

  return `${current}/${required}`;
}
