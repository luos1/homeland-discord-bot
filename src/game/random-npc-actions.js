// 랜덤 NPC 액션 핸들러

const { EmbedBuilder } = require('discord.js');
const { RANDOM_NPCS } = require('./random-npcs');

/**
 * 상인 아이템 구매
 */
async function handleMerchantPurchase(interaction, prisma, spawnId, itemIndex) {
  const spawn = await prisma.randomNpcSpawn.findUnique({
    where: { id: spawnId },
  });

  if (!spawn || !spawn.isActive || spawn.expiresAt < new Date()) {
    await interaction.update({
      content: 'NPC가 이미 떠났습니다...',
      components: [],
    });
    return;
  }

  if (spawn.interactedUserIds.includes(interaction.user.id)) {
    await interaction.update({
      content: '이미 이 NPC와 상호작용했습니다!',
      components: [],
    });
    return;
  }

  const character = await prisma.character.findUnique({
    where: { userId: interaction.user.id },
  });

  if (!character) {
    await interaction.update({
      content: '캐릭터를 찾을 수 없습니다.',
      components: [],
    });
    return;
  }

  const npc = RANDOM_NPCS.wandering_merchant;
  const item = npc.items[itemIndex];

  if (!item) {
    await interaction.update({
      content: '아이템을 찾을 수 없습니다.',
      components: [],
    });
    return;
  }

  if (character.gold < item.discountPrice) {
    await interaction.update({
      content: `골드가 부족합니다! (필요: ${item.discountPrice}G, 보유: ${character.gold}G)`,
      components: [],
    });
    return;
  }

  // 골드 차감
  await prisma.character.update({
    where: { id: character.id },
    data: {
      gold: { decrement: item.discountPrice },
    },
  });

  // TODO: 실제 아이템/버프 지급 (consumable 또는 buff 시스템 연동)
  // 지금은 골드만 차감

  // 상호작용 기록
  await prisma.randomNpcSpawn.update({
    where: { id: spawnId },
    data: {
      interactedUserIds: {
        push: interaction.user.id,
      },
    },
  });

  const embed = new EmbedBuilder()
    .setTitle(`${item.emoji} ${item.name} 구매 완료!`)
    .setDescription(npc.dialogue.purchase + '\n\n' + item.description)
    .setColor(0x10b981)
    .addFields({
      name: '지불 금액',
      value: `💰 ${item.discountPrice}G`,
    });

  await interaction.update({
    embeds: [embed],
    components: [],
  });
}

/**
 * 노인 축복 선택
 */
async function handleElderBlessing(interaction, prisma, spawnId, blessingIndex) {
  const spawn = await prisma.randomNpcSpawn.findUnique({
    where: { id: spawnId },
  });

  if (!spawn || !spawn.isActive || spawn.expiresAt < new Date()) {
    await interaction.update({
      content: 'NPC가 이미 떠났습니다...',
      components: [],
    });
    return;
  }

  if (spawn.interactedUserIds.includes(interaction.user.id)) {
    await interaction.update({
      content: '이미 이 NPC와 상호작용했습니다!',
      components: [],
    });
    return;
  }

  const character = await prisma.character.findUnique({
    where: { userId: interaction.user.id },
  });

  if (!character) {
    await interaction.update({
      content: '캐릭터를 찾을 수 없습니다.',
      components: [],
    });
    return;
  }

  const npc = RANDOM_NPCS.mysterious_elder;
  const blessing = npc.blessings[blessingIndex];

  if (!blessing) {
    await interaction.update({
      content: '축복을 찾을 수 없습니다.',
      components: [],
    });
    return;
  }

  const updates = {};

  if (blessing.type === 'instant') {
    if (blessing.goldReward) {
      updates.gold = { increment: blessing.goldReward };
    }
    if (blessing.xpReward) {
      updates.xp = { increment: blessing.xpReward };
    }
  }

  // TODO: 버프 타입은 버프 시스템 연동 필요

  await prisma.character.update({
    where: { id: character.id },
    data: updates,
  });

  // 상호작용 기록
  await prisma.randomNpcSpawn.update({
    where: { id: spawnId },
    data: {
      interactedUserIds: {
        push: interaction.user.id,
      },
    },
  });

  const rewardText = [];
  if (blessing.goldReward) {
    rewardText.push(`💰 골드 +${blessing.goldReward.toLocaleString()}G`);
  }
  if (blessing.xpReward) {
    rewardText.push(`✨ 경험치 +${blessing.xpReward.toLocaleString()}`);
  }
  if (blessing.type === 'buff') {
    rewardText.push(`🎁 ${blessing.description}`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`${blessing.emoji} ${blessing.name}`)
    .setDescription(npc.dialogue.blessing + '\n\n' + blessing.description)
    .setColor(0x8b5cf6)
    .addFields({
      name: '받은 축복',
      value: rewardText.join('\n'),
    });

  await interaction.update({
    embeds: [embed],
    components: [],
  });
}

/**
 * 도박꾼 배팅
 */
async function handleGamblerBet(interaction, prisma, spawnId, betAmount) {
  const spawn = await prisma.randomNpcSpawn.findUnique({
    where: { id: spawnId },
  });

  if (!spawn || !spawn.isActive || spawn.expiresAt < new Date()) {
    await interaction.update({
      content: 'NPC가 이미 떠났습니다...',
      components: [],
    });
    return;
  }

  if (spawn.interactedUserIds.includes(interaction.user.id)) {
    await interaction.update({
      content: '이미 이 NPC와 상호작용했습니다!',
      components: [],
    });
    return;
  }

  const character = await prisma.character.findUnique({
    where: { userId: interaction.user.id },
  });

  if (!character) {
    await interaction.update({
      content: '캐릭터를 찾을 수 없습니다.',
      components: [],
    });
    return;
  }

  if (character.gold < betAmount) {
    await interaction.update({
      content: `골드가 부족합니다! (필요: ${betAmount}G, 보유: ${character.gold}G)`,
      components: [],
    });
    return;
  }

  const npc = RANDOM_NPCS.gambler;
  const isWin = Math.random() < npc.winChance;

  const goldChange = isWin ? betAmount : -betAmount;

  await prisma.character.update({
    where: { id: character.id },
    data: {
      gold: { increment: goldChange },
    },
  });

  // 상호작용 기록
  await prisma.randomNpcSpawn.update({
    where: { id: spawnId },
    data: {
      interactedUserIds: {
        push: interaction.user.id,
      },
    },
  });

  const resultEmoji = isWin ? '🎉' : '💀';
  const resultTitle = isWin ? '승리!' : '패배...';
  const dialogue = isWin ? npc.dialogue.win : npc.dialogue.lose;

  const embed = new EmbedBuilder()
    .setTitle(`${resultEmoji} ${resultTitle}`)
    .setDescription(dialogue)
    .setColor(isWin ? 0x10b981 : 0xef4444)
    .addFields(
      {
        name: '배팅 금액',
        value: `💰 ${betAmount.toLocaleString()}G`,
        inline: true,
      },
      {
        name: isWin ? '획득' : '손실',
        value: `${isWin ? '+' : ''}${goldChange.toLocaleString()}G`,
        inline: true,
      },
      {
        name: '현재 골드',
        value: `💰 ${(character.gold + goldChange).toLocaleString()}G`,
        inline: true,
      }
    );

  await interaction.update({
    embeds: [embed],
    components: [],
  });
}

module.exports = {
  handleMerchantPurchase,
  handleElderBlessing,
  handleGamblerBet,
};
