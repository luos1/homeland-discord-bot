const { RESOURCES } = require('./production-classes');

const TUTORIAL_STEPS = [
  {
    index: 1,
    key: 'character_creation',
    title: '캐릭터 생성',
    objective: '`/create`로 캐릭터를 생성하세요.',
    rewardLabel: '💰 200G',
  },
  {
    index: 2,
    key: 'first_victory',
    title: '첫 전투 승리',
    objective: '탐험 전투에서 1회 승리하세요.',
    rewardLabel: '💊 초급 체력 포션 x2',
  },
  {
    index: 3,
    key: 'production_practice',
    title: '생산 실습',
    objective: '`/gather` 또는 `/craft`를 1회 시작하세요.',
    rewardLabel: '📦 목재 x3 + 허브 x3',
  },
  {
    index: 4,
    key: 'trade_practice',
    title: '거래 실습',
    objective: '거래소에서 구매 또는 등록을 1회 완료하세요.',
    rewardLabel: '💰 500G',
  },
];

const BEGINNER_QUEST_CHAIN = [
  {
    index: 1,
    key: 'check_profile',
    title: '캐릭터 상태 점검',
    description: '`/profile`을 1회 사용하세요.',
    eventType: 'command_profile',
    target: 1,
    rewardGold: 100,
  },
  {
    index: 2,
    key: 'win_more_battles',
    title: '전투 감각 익히기',
    description: '전투에서 2회 승리하세요.',
    eventType: 'battle_won',
    target: 2,
    rewardGold: 150,
  },
  {
    index: 3,
    key: 'production_loop',
    title: '생산 루틴 체험',
    description: '`/gather` 또는 `/craft`를 2회 시작하세요.',
    eventType: 'production_action',
    target: 2,
    rewardGold: 150,
  },
  {
    index: 4,
    key: 'first_market_trade',
    title: '시장 적응',
    description: '거래소에서 거래를 1회 완료하세요.',
    eventType: 'trade_action',
    target: 1,
    rewardGold: 200,
  },
  {
    index: 5,
    key: 'shop_purchase',
    title: '상점 사용법',
    description: '상점에서 구매를 1회 완료하세요.',
    eventType: 'shop_purchase',
    target: 1,
    rewardGold: 200,
  },
  {
    index: 6,
    key: 'resource_check',
    title: '자원 확인',
    description: '`/resources`를 1회 사용하세요.',
    eventType: 'command_resources',
    target: 1,
    rewardGold: 250,
  },
];

const TUTORIAL_REWARD_FIELDS = {
  1: 'tutorialStep1Reward',
  2: 'tutorialStep2Reward',
  3: 'tutorialStep3Reward',
  4: 'tutorialStep4Reward',
};

const GUIDE_TIPS = {
  combat: {
    field: 'firstCombatTipShown',
    timeField: 'firstCombatAt',
    content: [
      '🧭 첫 전투 팁',
      '• 방어는 피해를 크게 줄입니다.',
      '• 포션은 아껴두지 말고 위험 구간에서 사용하세요.',
      '• 승리하면 경험치와 장비를 얻을 수 있습니다.',
    ].join('\n'),
  },
  production: {
    field: 'firstProductionTipShown',
    timeField: 'firstProductionAt',
    content: [
      '🧭 첫 생산 팁',
      '• 채집 직업은 `/gather`, 제작 직업은 `/craft`를 사용합니다.',
      '• 생산 레벨이 오르면 더 좋은 재료와 레시피가 열립니다.',
      '• `/resources`로 재료를 항상 확인하세요.',
    ].join('\n'),
  },
  trade: {
    field: 'firstTradeTipShown',
    timeField: 'firstTradeAt',
    content: [
      '🧭 첫 거래 팁',
      '• 거래소 등록 시 판매 수수료 10%가 차감됩니다.',
      '• 과도한 가격보다 회전율이 높은 가격이 유리합니다.',
      '• 열린 주문은 `/market`의 내 주문 메뉴에서 관리합니다.',
    ].join('\n'),
  },
};

function createFeedback() {
  return {
    tutorialStepCompleted: [],
    tutorialCompleted: false,
    tutorialSkipped: false,
    tutorialRewards: [],
    questStarted: false,
    questStepCompleted: [],
    questCompleted: false,
    questRewards: [],
  };
}

function normalizeUser(user) {
  return {
    id: user?.id ?? '',
    username: user?.username ?? 'Unknown',
  };
}

function getQuestStep(stepIndex) {
  return BEGINNER_QUEST_CHAIN[stepIndex - 1] ?? null;
}

function isTutorialStepSatisfied(step, state, character) {
  if (step === 1) {
    return Boolean(character);
  }

  if (step === 2) {
    return (state.battleWins ?? 0) >= 1;
  }

  if (step === 3) {
    return (state.productionActions ?? 0) >= 1;
  }

  if (step === 4) {
    return (state.tradeActions ?? 0) >= 1;
  }

  return false;
}

async function ensureUserAndOnboarding(tx, user) {
  await tx.user.upsert({
    where: { discordId: user.id },
    update: { username: user.username },
    create: {
      discordId: user.id,
      username: user.username,
    },
  });

  return tx.onboardingProgress.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
    },
  });
}

async function addGold(tx, characterId, amount) {
  if (!characterId || amount <= 0) {
    return;
  }

  await tx.character.update({
    where: { id: characterId },
    data: {
      gold: {
        increment: amount,
      },
    },
  });
}

async function addResource(tx, characterId, type, quantity) {
  if (!characterId || !type || quantity <= 0) {
    return;
  }

  const resourceMeta = RESOURCES[type];

  if (!resourceMeta) {
    return;
  }

  const existing = await tx.resource.findUnique({
    where: {
      characterId_type: {
        characterId,
        type,
      },
    },
  });

  if (existing) {
    await tx.resource.update({
      where: { id: existing.id },
      data: {
        quantity: {
          increment: quantity,
        },
      },
    });
    return;
  }

  await tx.resource.create({
    data: {
      characterId,
      type,
      name: resourceMeta.name,
      quantity,
    },
  });
}

async function addConsumable(tx, characterId, consumableData) {
  if (!characterId) {
    return;
  }

  const existing = await tx.consumable.findUnique({
    where: {
      characterId_type_effect: {
        characterId,
        type: consumableData.type,
        effect: consumableData.effect,
      },
    },
  });

  if (existing) {
    await tx.consumable.update({
      where: { id: existing.id },
      data: {
        quantity: {
          increment: consumableData.quantity,
        },
      },
    });
    return;
  }

  await tx.consumable.create({
    data: {
      characterId,
      name: consumableData.name,
      type: consumableData.type,
      effect: consumableData.effect,
      power: consumableData.power,
      duration: consumableData.duration ?? null,
      quantity: consumableData.quantity,
    },
  });
}

async function grantTutorialReward(tx, state, step, feedback, character) {
  const rewardField = TUTORIAL_REWARD_FIELDS[step];

  if (!rewardField || state[rewardField]) {
    return state;
  }

  if (!character) {
    return state;
  }

  const updateData = {
    [rewardField]: true,
  };

  if (step === 1) {
    await addGold(tx, character.id, 200);
    feedback.tutorialRewards.push('튜토리얼 1단계 보상: 200G');
  }

  if (step === 2) {
    await addConsumable(tx, character.id, {
      name: '초급 체력 포션',
      type: 'potion',
      effect: 'heal_hp',
      power: 50,
      quantity: 2,
    });
    feedback.tutorialRewards.push('튜토리얼 2단계 보상: 초급 체력 포션 x2');
  }

  if (step === 3) {
    await addResource(tx, character.id, 'wood', 3);
    await addResource(tx, character.id, 'herb', 3);
    feedback.tutorialRewards.push('튜토리얼 3단계 보상: 목재 x3, 허브 x3');
  }

  if (step === 4) {
    await addGold(tx, character.id, 500);
    feedback.tutorialRewards.push('튜토리얼 4단계 보상: 500G');
  }

  return tx.onboardingProgress.update({
    where: { userId: state.userId },
    data: updateData,
  });
}

async function grantQuestStepReward(tx, character, questStep, feedback) {
  if (!character) {
    return;
  }

  if (!questStep.rewardGold || questStep.rewardGold <= 0) {
    return;
  }

  await addGold(tx, character.id, questStep.rewardGold);
  feedback.questRewards.push(`초보자 퀘스트 ${questStep.index}단계 보상: ${questStep.rewardGold}G`);
}

async function grantBeginnerSetReward(tx, character, feedback) {
  if (!character) {
    return;
  }

  const starterItems = [
    {
      name: '초보자의 훈련검',
      type: 'weapon',
      rarity: 'common',
      attack: 8,
      defense: 0,
      hp: 0,
      mana: 0,
    },
    {
      name: '초보자의 견습 갑옷',
      type: 'armor',
      rarity: 'common',
      attack: 0,
      defense: 6,
      hp: 25,
      mana: 0,
    },
    {
      name: '초보자의 반지',
      type: 'ring',
      rarity: 'common',
      attack: 2,
      defense: 2,
      hp: 0,
      mana: 15,
    },
  ];

  const existing = await tx.equipment.findMany({
    where: {
      characterId: character.id,
      name: {
        in: starterItems.map((item) => item.name),
      },
    },
    select: {
      name: true,
    },
  });

  const existingNames = new Set(existing.map((item) => item.name));

  for (const item of starterItems) {
    if (existingNames.has(item.name)) {
      continue;
    }

    await tx.equipment.create({
      data: {
        characterId: character.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        attack: item.attack,
        defense: item.defense,
        hp: item.hp,
        mana: item.mana,
        equipped: false,
      },
    });
  }

  await addGold(tx, character.id, 1200);
  feedback.questRewards.push('초보자 퀘스트 완료 보상: 초보 장비 세트 + 1,200G');
}

async function maybeStartQuestChain(tx, state, feedback, now) {
  if (state.questChainStarted) {
    return state;
  }

  feedback.questStarted = true;

  return tx.onboardingProgress.update({
    where: { userId: state.userId },
    data: {
      questChainStarted: true,
      questStep: 1,
      questProgress: 0,
      questStartedAt: now,
    },
  });
}

async function progressTutorial(tx, state, character, feedback, now) {
  if (!state || !state.tutorialStarted || state.tutorialCompleted) {
    return state;
  }

  let current = state;

  while (!current.tutorialCompleted) {
    const step = current.tutorialStep;

    if (!isTutorialStepSatisfied(step, current, character)) {
      break;
    }

    current = await grantTutorialReward(tx, current, step, feedback, character);
    feedback.tutorialStepCompleted.push(step);

    if (step >= TUTORIAL_STEPS.length) {
      current = await tx.onboardingProgress.update({
        where: { userId: current.userId },
        data: {
          tutorialCompleted: true,
          tutorialCompletedAt: now,
          tutorialStep: TUTORIAL_STEPS.length,
        },
      });
      feedback.tutorialCompleted = true;
      current = await maybeStartQuestChain(tx, current, feedback, now);
      break;
    }

    current = await tx.onboardingProgress.update({
      where: { userId: current.userId },
      data: {
        tutorialStep: step + 1,
      },
    });
  }

  return current;
}

async function progressQuestChain(tx, state, character, eventType, feedback, now) {
  if (!eventType || !state || !state.questChainStarted || state.questChainCompleted) {
    return state;
  }

  const activeQuest = getQuestStep(state.questStep);

  if (!activeQuest || activeQuest.eventType !== eventType) {
    return state;
  }

  const nextProgress = Math.min(activeQuest.target, (state.questProgress ?? 0) + 1);

  let current = await tx.onboardingProgress.update({
    where: { userId: state.userId },
    data: {
      questProgress: nextProgress,
    },
  });

  if (nextProgress < activeQuest.target) {
    return current;
  }

  feedback.questStepCompleted.push(activeQuest.index);
  await grantQuestStepReward(tx, character, activeQuest, feedback);

  if (activeQuest.index >= BEGINNER_QUEST_CHAIN.length) {
    if (!current.questRewardClaimed) {
      await grantBeginnerSetReward(tx, character, feedback);
    }

    current = await tx.onboardingProgress.update({
      where: { userId: state.userId },
      data: {
        questChainCompleted: true,
        questCompletedAt: now,
        questRewardClaimed: true,
        questProgress: activeQuest.target,
      },
    });
    feedback.questCompleted = true;
    return current;
  }

  return tx.onboardingProgress.update({
    where: { userId: state.userId },
    data: {
      questStep: activeQuest.index + 1,
      questProgress: 0,
    },
  });
}

function buildCounterUpdates(eventType, now) {
  const updates = {};

  if (eventType === 'battle_won') {
    updates.battleWins = { increment: 1 };
  }

  if (eventType === 'production_action') {
    updates.productionActions = { increment: 1 };
  }

  if (eventType === 'trade_action') {
    updates.tradeActions = { increment: 1 };
  }

  if (eventType === 'battle_started') {
    updates.firstCombatAt = now;
  }

  if (eventType === 'production_started') {
    updates.firstProductionAt = now;
  }

  if (eventType === 'trade_started') {
    updates.firstTradeAt = now;
  }

  return updates;
}

function shouldApplyUpdates(updateData) {
  return Object.keys(updateData).length > 0;
}

async function handleOnboardingEvent({
  prisma,
  user,
  eventType = null,
  startTutorial = false,
}) {
  const normalizedUser = normalizeUser(user);

  if (!normalizedUser.id) {
    return createFeedback();
  }

  const feedback = createFeedback();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    let state = await ensureUserAndOnboarding(tx, normalizedUser);
    const character = await tx.character.findUnique({
      where: {
        userId: normalizedUser.id,
      },
    });

    if (startTutorial && (!state || !state.tutorialStarted)) {
      state = await tx.onboardingProgress.update({
        where: { userId: normalizedUser.id },
        data: {
          tutorialStarted: true,
        },
      });
    }

    if (eventType) {
      const updateData = buildCounterUpdates(eventType, now);

      if (shouldApplyUpdates(updateData)) {
        state = await tx.onboardingProgress.update({
          where: { userId: normalizedUser.id },
          data: updateData,
        });
      }
    }

    state = await progressTutorial(tx, state, character, feedback, now);
    state = await progressQuestChain(tx, state, character, eventType, feedback, now);

    if (state?.tutorialCompleted && !state.questChainStarted) {
      await maybeStartQuestChain(tx, state, feedback, now);
    }
  });

  return feedback;
}

async function getOnboardingSnapshot({ prisma, user }) {
  const normalizedUser = normalizeUser(user);

  if (!normalizedUser.id) {
    return null;
  }

  await prisma.user.upsert({
    where: { discordId: normalizedUser.id },
    update: { username: normalizedUser.username },
    create: {
      discordId: normalizedUser.id,
      username: normalizedUser.username,
    },
  });

  const onboarding = await prisma.onboardingProgress.upsert({
    where: {
      userId: normalizedUser.id,
    },
    update: {},
    create: {
      userId: normalizedUser.id,
    },
  });

  const character = await prisma.character.findUnique({
    where: {
      userId: normalizedUser.id,
    },
    select: {
      id: true,
      name: true,
      level: true,
      gold: true,
      productionClass: true,
    },
  });

  return {
    onboarding,
    character,
  };
}

async function skipTutorial({ prisma, user }) {
  const normalizedUser = normalizeUser(user);
  const feedback = createFeedback();
  const now = new Date();

  if (!normalizedUser.id) {
    return feedback;
  }

  await prisma.$transaction(async (tx) => {
    let state = await ensureUserAndOnboarding(tx, normalizedUser);
    const character = await tx.character.findUnique({
      where: { userId: normalizedUser.id },
    });

    if (character) {
      await addGold(tx, character.id, 500);
      feedback.tutorialRewards.push('튜토리얼 스킵 보상: 빠른 시작 500G');
    }

    state = await tx.onboardingProgress.update({
      where: { userId: normalizedUser.id },
      data: {
        tutorialStarted: true,
        tutorialCompleted: true,
        tutorialSkipped: true,
        tutorialStep: TUTORIAL_STEPS.length,
        tutorialCompletedAt: now,
      },
    });

    feedback.tutorialSkipped = true;
    feedback.tutorialCompleted = true;

    if (!state.questChainStarted) {
      await maybeStartQuestChain(tx, state, feedback, now);
    }
  });

  return feedback;
}

function getTutorialStepState(step, onboarding) {
  if (onboarding.tutorialCompleted) {
    return 'completed';
  }

  if (step.index < onboarding.tutorialStep) {
    return 'completed';
  }

  if (step.index === onboarding.tutorialStep) {
    return 'active';
  }

  return 'locked';
}

function getQuestProgressSummary(onboarding) {
  if (!onboarding.questChainStarted) {
    return null;
  }

  if (onboarding.questChainCompleted) {
    return {
      label: '완료',
      description: '초보자 퀘스트 체인을 모두 완료했습니다.',
    };
  }

  const activeQuest = getQuestStep(onboarding.questStep);

  if (!activeQuest) {
    return {
      label: '대기',
      description: '초보자 퀘스트를 불러오지 못했습니다.',
    };
  }

  return {
    label: `진행 중 (${activeQuest.index}/${BEGINNER_QUEST_CHAIN.length})`,
    description: `${activeQuest.title} - ${onboarding.questProgress}/${activeQuest.target}`,
    activeQuest,
  };
}

async function sendEphemeral(interaction, content) {
  if (!interaction || !content) {
    return false;
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({
      content,
      ephemeral: true,
    });
    return true;
  }

  await interaction.reply({
    content,
    ephemeral: true,
  });
  return true;
}

async function sendOnboardingFeedback(interaction, feedback) {
  if (!feedback) {
    return false;
  }

  const lines = [];

  if (feedback.tutorialSkipped) {
    lines.push('⏭️ 튜토리얼을 스킵했습니다. 빠른 시작 모드가 적용되었습니다.');
  }

  for (const stepIndex of feedback.tutorialStepCompleted) {
    const step = TUTORIAL_STEPS[stepIndex - 1];
    if (step) {
      lines.push(`✅ 튜토리얼 ${stepIndex}단계 완료: ${step.title}`);
    }
  }

  for (const reward of feedback.tutorialRewards) {
    lines.push(`🎁 ${reward}`);
  }

  if (feedback.tutorialCompleted) {
    lines.push('🎉 튜토리얼이 완료되었습니다.');
  }

  if (feedback.questStarted) {
    lines.push('📜 초보자 퀘스트 체인이 자동으로 시작되었습니다.');
  }

  for (const questStep of feedback.questStepCompleted) {
    const step = BEGINNER_QUEST_CHAIN[questStep - 1];
    if (step) {
      lines.push(`✅ 초보자 퀘스트 ${questStep}단계 완료: ${step.title}`);
    }
  }

  for (const reward of feedback.questRewards) {
    lines.push(`🎁 ${reward}`);
  }

  if (feedback.questCompleted) {
    lines.push('🏁 초보자 퀘스트 체인을 모두 완료했습니다.');
  }

  if (lines.length === 0) {
    return false;
  }

  await sendEphemeral(interaction, lines.join('\n'));
  return true;
}

async function maybeSendGuideTip({ prisma, user, interaction, category }) {
  const tip = GUIDE_TIPS[category];

  if (!tip) {
    return false;
  }

  const normalizedUser = normalizeUser(user);

  if (!normalizedUser.id) {
    return false;
  }

  const now = new Date();
  let shouldSend = false;

  await prisma.$transaction(async (tx) => {
    const state = await ensureUserAndOnboarding(tx, normalizedUser);

    if (state[tip.field]) {
      return;
    }

    await tx.onboardingProgress.update({
      where: {
        userId: normalizedUser.id,
      },
      data: {
        [tip.field]: true,
        [tip.timeField]: now,
      },
    });

    shouldSend = true;
  });

  if (!shouldSend) {
    return false;
  }

  await sendEphemeral(interaction, tip.content);
  return true;
}

module.exports = {
  TUTORIAL_STEPS,
  BEGINNER_QUEST_CHAIN,
  getQuestStep,
  getTutorialStepState,
  getQuestProgressSummary,
  handleOnboardingEvent,
  getOnboardingSnapshot,
  skipTutorial,
  sendOnboardingFeedback,
  maybeSendGuideTip,
};
