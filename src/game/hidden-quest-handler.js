// 숨겨진 퀘스트 핸들러

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  HIDDEN_QUESTS,
  checkQuestDiscoveryCondition,
  checkQuestObjectiveComplete,
  incrementQuestProgress,
} = require('./hidden-quests');

/**
 * 숨겨진 퀘스트 트리거 통계 업데이트
 */
async function updateHiddenQuestTriggerStats(prisma, characterId, event) {
  let stats = await prisma.hiddenQuestTriggerStats.findUnique({
    where: { characterId },
  });

  if (!stats) {
    stats = await prisma.hiddenQuestTriggerStats.create({
      data: { characterId },
    });
  }

  const updates = {};

  switch (event.type) {
    case 'monster_kill':
      updates.totalMonsterKills = { increment: 1 };

      if (event.monsterKey) {
        const killField = `${event.monsterKey}Kills`;
        if (stats[killField] !== undefined) {
          updates[killField] = { increment: 1 };
        }
      }
      break;

    case 'zone_visit':
      if (event.zone) {
        const visitField = `${event.zone}Visits`;
        if (stats[visitField] !== undefined) {
          updates[visitField] = { increment: 1 };
        }
      }
      break;

    default:
      return;
  }

  await prisma.hiddenQuestTriggerStats.update({
    where: { characterId },
    data: updates,
  });
}

/**
 * 퀘스트 발견 체크 및 발견 처리
 */
async function checkAndDiscoverQuests(prisma, interaction, characterId) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      hiddenQuestTriggerStats: true,
      attendanceRecords: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!character || !character.hiddenQuestTriggerStats) {
    return [];
  }

  const stats = character.hiddenQuestTriggerStats;
  const attendanceData = character.attendanceRecords[0] || null;
  const discoveries = [];

  for (const questKey of Object.keys(HIDDEN_QUESTS)) {
    const existingProgress = await prisma.hiddenQuestProgress.findUnique({
      where: {
        characterId_questKey: {
          characterId,
          questKey,
        },
      },
    });

    if (existingProgress && existingProgress.discovered) {
      continue;
    }

    const conditionMet = checkQuestDiscoveryCondition(
      character,
      stats,
      attendanceData,
      questKey
    );

    if (conditionMet) {
      const progress = await prisma.hiddenQuestProgress.upsert({
        where: {
          characterId_questKey: {
            characterId,
            questKey,
          },
        },
        create: {
          characterId,
          questKey,
          discovered: true,
          discoveredAt: new Date(),
        },
        update: {
          discovered: true,
          discoveredAt: new Date(),
        },
      });

      discoveries.push({ questKey, progress });
      await sendQuestDiscoveryMessage(interaction, questKey);
    }
  }

  return discoveries;
}

/**
 * 퀘스트 발견 메시지 전송
 */
async function sendQuestDiscoveryMessage(interaction, questKey) {
  const quest = HIDDEN_QUESTS[questKey];
  if (!quest) return;

  const embed = new EmbedBuilder()
    .setTitle(`${quest.emoji} 숨겨진 퀘스트 발견!`)
    .setDescription(quest.description + '\n\n' + quest.npcDialogue.discovery)
    .setColor(0x9333ea)
    .setTimestamp();

  const acceptButton = new ButtonBuilder()
    .setCustomId(`hidden_quest:accept:${questKey}`)
    .setLabel('수락하기')
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);

  const rejectButton = new ButtonBuilder()
    .setCustomId(`hidden_quest:reject:${questKey}`)
    .setLabel('거절하기')
    .setEmoji('❌')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(acceptButton, rejectButton);

  try {
    await interaction.followUp({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  } catch (error) {
    console.error('Hidden quest discovery message send failed:', error);
  }
}

/**
 * 퀘스트 수락 처리
 */
async function acceptQuest(interaction, prisma, questKey) {
  const character = await prisma.character.findUnique({
    where: { userId: interaction.user.id },
  });

  if (!character) {
    await interaction.update({
      content: '캐릭터를 찾을 수 없습니다.',
      embeds: [],
      components: [],
    });
    return;
  }

  const quest = HIDDEN_QUESTS[questKey];
  if (!quest) {
    await interaction.update({
      content: '퀘스트를 찾을 수 없습니다.',
      embeds: [],
      components: [],
    });
    return;
  }

  await prisma.hiddenQuestProgress.update({
    where: {
      characterId_questKey: {
        characterId: character.id,
        questKey,
      },
    },
    data: {
      accepted: true,
      acceptedAt: new Date(),
    },
  });

  const embed = new EmbedBuilder()
    .setTitle(`${quest.emoji} ${quest.name}`)
    .setDescription(quest.npcDialogue.accept)
    .addFields({
      name: '목표',
      value: getObjectiveDescription(quest.objective),
    })
    .setColor(0x22c55e)
    .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: [],
  });
}

/**
 * 퀘스트 거절 처리
 */
async function rejectQuest(interaction, prisma, questKey) {
  const character = await prisma.character.findUnique({
    where: { userId: interaction.user.id },
  });

  if (!character) {
    await interaction.update({
      content: '캐릭터를 찾을 수 없습니다.',
      embeds: [],
      components: [],
    });
    return;
  }

  const quest = HIDDEN_QUESTS[questKey];
  if (!quest) return;

  await prisma.hiddenQuestProgress.delete({
    where: {
      characterId_questKey: {
        characterId: character.id,
        questKey,
      },
    },
  });

  await interaction.update({
    content: quest.npcDialogue.reject,
    embeds: [],
    components: [],
  });
}

/**
 * 퀘스트 목표 설명 생성
 */
function getObjectiveDescription(objective) {
  switch (objective.type) {
    case 'kill':
      const monsterName = objective.monsterType || '몬스터';
      const zoneName = objective.zone ? ` (${objective.zone})` : '';
      return `${monsterName} ${objective.required}마리 처치${zoneName}`;

    case 'total_kills':
      return `몬스터 총 ${objective.required}마리 처치`;

    default:
      return '목표 달성';
  }
}

/**
 * 퀘스트 진행도 업데이트 (전투 승리 시)
 */
async function updateQuestProgress(prisma, characterId, monsterKey, zone) {
  const activeQuests = await prisma.hiddenQuestProgress.findMany({
    where: {
      characterId,
      accepted: true,
      completed: false,
    },
  });

  for (const progress of activeQuests) {
    const quest = HIDDEN_QUESTS[progress.questKey];
    if (!quest) continue;

    const increment = incrementQuestProgress(quest, progress, monsterKey, zone);

    if (increment > 0) {
      const newProgress = progress.progress + increment;

      await prisma.hiddenQuestProgress.update({
        where: { id: progress.id },
        data: {
          progress: newProgress,
        },
      });

      if (checkQuestObjectiveComplete({ ...progress, progress: newProgress }, progress.questKey)) {
        await prisma.hiddenQuestProgress.update({
          where: { id: progress.id },
          data: {
            completed: true,
            completedAt: new Date(),
          },
        });
      }
    }
  }
}

/**
 * 퀘스트 보상 수령
 */
async function claimQuestReward(interaction, prisma, questKey) {
  const character = await prisma.character.findUnique({
    where: { userId: interaction.user.id },
  });

  if (!character) {
    await interaction.reply({
      content: '캐릭터를 찾을 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  const progress = await prisma.hiddenQuestProgress.findUnique({
    where: {
      characterId_questKey: {
        characterId: character.id,
        questKey,
      },
    },
  });

  if (!progress || !progress.completed || progress.claimed) {
    await interaction.reply({
      content: '수령 가능한 퀘스트 보상이 없습니다.',
      ephemeral: true,
    });
    return;
  }

  const quest = HIDDEN_QUESTS[questKey];
  if (!quest) return;

  const rewards = quest.rewards;
  const updates = {};

  if (rewards.gold) {
    updates.gold = { increment: rewards.gold };
  }

  if (rewards.gems) {
    updates.gems = { increment: rewards.gems };
  }

  await prisma.character.update({
    where: { id: character.id },
    data: updates,
  });

  let equipmentReward = null;
  if (rewards.equipment) {
    const { generateEquipment } = require('./equipment');
    equipmentReward = generateEquipment(character.level, {
      rarity: rewards.equipment.rarity,
      type: rewards.equipment.type,
    });

    await prisma.equipment.create({
      data: {
        characterId: character.id,
        ...equipmentReward,
      },
    });
  }

  await prisma.hiddenQuestProgress.update({
    where: { id: progress.id },
    data: {
      claimed: true,
      claimedAt: new Date(),
    },
  });

  const embed = new EmbedBuilder()
    .setTitle(`${quest.emoji} ${quest.name} 완료!`)
    .setDescription(quest.npcDialogue.complete)
    .setColor(0xfbbf24);

  const rewardFields = [];
  if (rewards.gold) {
    rewardFields.push(`💰 골드 +${rewards.gold}G`);
  }
  if (rewards.gems) {
    rewardFields.push(`💎 보석 +${rewards.gems}개`);
  }
  if (equipmentReward) {
    const { RARITIES } = require('./equipment');
    const rarityData = RARITIES[equipmentReward.rarity];
    rewardFields.push(`${rarityData.emoji} ${equipmentReward.name}`);
  }

  embed.addFields({
    name: '보상',
    value: rewardFields.join('\n'),
  });

  await interaction.reply({
    embeds: [embed],
    ephemeral: false,
  });
}

module.exports = {
  updateHiddenQuestTriggerStats,
  checkAndDiscoverQuests,
  sendQuestDiscoveryMessage,
  acceptQuest,
  rejectQuest,
  updateQuestProgress,
  claimQuestReward,
};
