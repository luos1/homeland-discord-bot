const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const {
  TUTORIAL_STEPS,
  getTutorialStepState,
  getQuestProgressSummary,
  handleOnboardingEvent,
  getOnboardingSnapshot,
  skipTutorial,
  sendOnboardingFeedback,
} = require('../game/onboarding');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { createVillageNavigationRow, VILLAGE_MENU_KEYS } = require('../utils/village');

const STEP_STATUS_LABELS = {
  completed: '✅ 완료',
  active: '🎯 진행 중',
  locked: '🔒 잠금',
};

function createTutorialEmbed(snapshot) {
  const onboarding = snapshot.onboarding;
  const character = snapshot.character;

  const tutorialStatus = onboarding.tutorialCompleted
    ? onboarding.tutorialSkipped
      ? '스킵 완료'
      : '완료'
    : onboarding.tutorialStarted
      ? `진행 중 (${onboarding.tutorialStep}/${TUTORIAL_STEPS.length})`
      : '시작 전';

  const stepLines = TUTORIAL_STEPS.map((step) => {
    const state = getTutorialStepState(step, onboarding);
    return [
      `**${step.index}. ${step.title}** - ${STEP_STATUS_LABELS[state]}`,
      `실습: ${step.objective}`,
      `보상: ${step.rewardLabel}`,
    ].join('\n');
  });

  const questSummary = getQuestProgressSummary(onboarding);
  const questText = questSummary
    ? `📜 초보자 퀘스트: ${questSummary.label}\n${questSummary.description}`
    : '📜 초보자 퀘스트: 튜토리얼 완료 후 자동 시작';

  const activeStep = onboarding.tutorialCompleted
    ? null
    : TUTORIAL_STEPS[onboarding.tutorialStep - 1] ?? null;

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('📚 온보딩 튜토리얼')
    .setDescription(
      [
        createDivider(),
        character
          ? `👤 캐릭터: **${character.name}** (Lv.${character.level})`
          : '👤 캐릭터가 없습니다. `/create`로 먼저 생성하세요.',
        `📌 튜토리얼 상태: **${tutorialStatus}**`,
        questText,
        '',
        activeStep
          ? `현재 단계 안내: **${activeStep.title}**\n${activeStep.objective}`
          : '현재 단계 안내: 튜토리얼이 완료되었습니다.',
        '',
        '⏭️ 경험자는 `/tutorial action:skip confirm:true`로 빠른 시작이 가능합니다.',
        createDivider(),
      ].join('\n'),
    )
    .addFields({
      name: '단계별 진행',
      value: stepLines.join('\n\n'),
    });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tutorial')
    .setDescription('인터랙티브 튜토리얼 진행 상태를 확인하고 관리합니다')
    .addStringOption((option) =>
      option
        .setName('action')
        .setDescription('튜토리얼 액션')
        .setRequired(false)
        .addChoices(
          { name: '시작/다음 단계', value: 'start' },
          { name: '진행 상태 확인', value: 'status' },
          { name: '튜토리얼 스킵', value: 'skip' },
        ),
    )
    .addBooleanOption((option) =>
      option
        .setName('confirm')
        .setDescription('스킵 실행 확인 (skip 선택 시 true 필요)')
        .setRequired(false),
    ),

  async execute(interaction, { prisma }) {
    const action = interaction.options.getString('action') ?? 'start';
    const confirm = interaction.options.getBoolean('confirm') ?? false;

    if (action === 'skip' && !confirm) {
      await interaction.reply({
        content: '튜토리얼을 스킵하려면 `confirm:true`를 함께 입력하세요.',
        ephemeral: true,
      });
      return;
    }

    let feedback = null;

    if (action === 'skip') {
      feedback = await skipTutorial({
        prisma,
        user: interaction.user,
      });
    } else if (action === 'start') {
      feedback = await handleOnboardingEvent({
        prisma,
        user: interaction.user,
        startTutorial: true,
      });
    }

    const snapshot = await getOnboardingSnapshot({
      prisma,
      user: interaction.user,
    });

    if (!snapshot) {
      await interaction.reply({
        content: '튜토리얼 정보를 불러오지 못했습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [createTutorialEmbed(snapshot)],
      components: [createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.combat })],
      ephemeral: true,
    });

    if (feedback) {
      await sendOnboardingFeedback(interaction, feedback);
    }
  },
};
