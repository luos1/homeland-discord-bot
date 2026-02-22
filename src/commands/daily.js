const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const {
  QUEST_TYPE_META,
  WEEKLY_ALL_CLEAR_BONUS,
  getSecondsUntilNextDailyReset,
  getDailyQuestStatus,
} = require('../game/daily-quests');
const { EMBED_COLORS, createDivider, createXPBar, formatNumber } = require('../utils/ui');

function formatResetCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  return `${hours}시간 ${minutes}분`;
}

function formatQuestLine(quest, index) {
  const meta = QUEST_TYPE_META[quest.questType] || QUEST_TYPE_META.other;
  const statusIcon = quest.completed ? '✅' : '⬜';
  const progressBar = createXPBar(quest.progress, quest.target, 12);

  return [
    `${statusIcon} ${index + 1}. ${meta.icon} ${quest.title}`,
    `   ${progressBar} ${quest.progress}/${quest.target}`,
    `   🎁 ${formatNumber(quest.rewardGold)}G | ${formatNumber(quest.rewardXp)} XP`,
  ].join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('오늘의 Daily Quest 진행도를 확인합니다'),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
        ephemeral: true,
      });

      return;
    }

    const dailyStatus = await getDailyQuestStatus(prisma, character.id, {
      markLogin: true,
    });

    const { dayKey, quests, profile } = dailyStatus;
    const completedCount = quests.filter((quest) => quest.completed).length;
    const totalCount = quests.length;
    const isAllClear = totalCount > 0 && completedCount === totalCount;

    const totalGoldReward = quests.reduce((acc, quest) => acc + quest.rewardGold, 0);
    const totalXpReward = quests.reduce((acc, quest) => acc + quest.rewardXp, 0);

    const weeklyProgressBar = createXPBar(profile.weeklyCompletedDays, 7, 12);
    const resetIn = formatResetCountdown(getSecondsUntilNextDailyReset());

    const descriptionLines = [
      createDivider(),
      `📅 기준일: ${dayKey}`,
      `⏰ 다음 리셋: ${resetIn} 후`,
      '',
      `📌 진행도: ${completedCount}/${totalCount}`,
      `🔥 연속 올클리어: ${profile.streak}일`,
      `🗓️ 주간 올클리어: ${weeklyProgressBar} ${profile.weeklyCompletedDays}/7`,
      '',
      ...quests.map((quest, index) => formatQuestLine(quest, index)),
      '',
      createDivider(),
      `💰 일일 퀘스트 총 보상: ${formatNumber(totalGoldReward)}G`,
      `✨ 일일 퀘스트 총 경험치: ${formatNumber(totalXpReward)} XP`,
      `🎉 주간 7일 올클리어 보상: ${formatNumber(WEEKLY_ALL_CLEAR_BONUS.gold)}G + ${formatNumber(WEEKLY_ALL_CLEAR_BONUS.xp)} XP`,
      '',
      isAllClear
        ? '🏆 오늘 Daily Quest를 모두 완료했습니다! 스트릭 보너스가 지급되었습니다.'
        : '💡 전투/생산/거래를 진행하면 자동으로 퀘스트가 업데이트됩니다.',
      createDivider(),
    ];

    const embed = new EmbedBuilder()
      .setColor(isAllClear ? EMBED_COLORS.victory : EMBED_COLORS.profile)
      .setTitle('🎁 Daily Quest')
      .setDescription(descriptionLines.join('\n'))
      .setFooter({
        text: 'Daily Quest는 매일 자정(KST)에 갱신됩니다',
      });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};
