// 랜덤 NPC 핸들러

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { RANDOM_NPCS, selectRandomNpc, calculateExpiryTime } = require('./random-npcs');

/**
 * NPC 스폰
 */
async function spawnRandomNpc(prisma, client) {
  // 이미 활성 NPC가 있는지 체크
  const activeNpc = await prisma.randomNpcSpawn.findFirst({
    where: {
      isActive: true,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (activeNpc) {
    console.log('Already active NPC, skipping spawn');
    return null;
  }

  // 랜덤 NPC 선택
  const npcType = selectRandomNpc();
  const npc = RANDOM_NPCS[npcType];
  const expiresAt = calculateExpiryTime(npcType);

  // DB에 기록
  const spawn = await prisma.randomNpcSpawn.create({
    data: {
      npcType,
      expiresAt,
      isActive: true,
    },
  });

  // 전체 공지
  await broadcastNpcSpawn(client, spawn, npc);

  // 자동 소멸 스케줄
  scheduleNpcDespawn(prisma, client, spawn.id, expiresAt);

  return spawn;
}

/**
 * NPC 스폰 전체 공지
 */
async function broadcastNpcSpawn(client, spawn, npc) {
  const embed = new EmbedBuilder()
    .setTitle(`${npc.emoji} ${npc.name} 등장!`)
    .setDescription(npc.description + '\n\n' + npc.dialogue.greeting)
    .setColor(0xf59e0b)
    .setTimestamp();

  const actionButton = new ButtonBuilder()
    .setCustomId(`random_npc:interact:${spawn.id}`)
    .setLabel(`${npc.name}과 대화하기`)
    .setEmoji(npc.emoji)
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(actionButton);

  // 모든 길드의 일반 채널에 공지
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      // #general 또는 #game 채널 찾기
      const channel = guild.channels.cache.find(
        (ch) =>
          ch.isTextBased() &&
          (ch.name === 'general' ||
            ch.name === 'game' ||
            ch.name === 'announcements')
      );

      if (channel) {
        await channel.send({
          embeds: [embed],
          components: [row],
        });
      }
    } catch (error) {
      console.error(`Failed to broadcast NPC spawn to guild ${guildId}:`, error);
    }
  }
}

/**
 * NPC 소멸 스케줄
 */
function scheduleNpcDespawn(prisma, client, spawnId, expiresAt) {
  const timeUntilExpiry = expiresAt.getTime() - Date.now();

  setTimeout(async () => {
    await despawnNpc(prisma, client, spawnId);
  }, timeUntilExpiry);
}

/**
 * NPC 소멸
 */
async function despawnNpc(prisma, client, spawnId) {
  const spawn = await prisma.randomNpcSpawn.findUnique({
    where: { id: spawnId },
  });

  if (!spawn || !spawn.isActive) return;

  // 비활성화
  await prisma.randomNpcSpawn.update({
    where: { id: spawnId },
    data: { isActive: false },
  });

  const npc = RANDOM_NPCS[spawn.npcType];
  if (!npc) return;

  // 소멸 공지
  const embed = new EmbedBuilder()
    .setTitle(`${npc.emoji} ${npc.name} 퇴장`)
    .setDescription(npc.dialogue.farewell)
    .setColor(0x6b7280)
    .setTimestamp();

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const channel = guild.channels.cache.find(
        (ch) =>
          ch.isTextBased() &&
          (ch.name === 'general' ||
            ch.name === 'game' ||
            ch.name === 'announcements')
      );

      if (channel) {
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error(`Failed to broadcast NPC despawn to guild ${guildId}:`, error);
    }
  }
}

/**
 * NPC 상호작용 처리
 */
async function handleNpcInteraction(interaction, prisma, spawnId) {
  const spawn = await prisma.randomNpcSpawn.findUnique({
    where: { id: spawnId },
  });

  if (!spawn || !spawn.isActive || spawn.expiresAt < new Date()) {
    await interaction.reply({
      content: 'NPC가 이미 떠났습니다...',
      ephemeral: true,
    });
    return;
  }

  // 이미 상호작용한 플레이어인지 체크
  if (spawn.interactedUserIds.includes(interaction.user.id)) {
    await interaction.reply({
      content: '이미 이 NPC와 상호작용했습니다!',
      ephemeral: true,
    });
    return;
  }

  const npc = RANDOM_NPCS[spawn.npcType];
  if (!npc) return;

  // NPC 타입별 UI 표시
  switch (npc.key) {
    case 'wandering_merchant':
      await showMerchantUI(interaction, prisma, spawn, npc);
      break;

    case 'mysterious_elder':
      await showElderUI(interaction, prisma, spawn, npc);
      break;

    case 'gambler':
      await showGamblerUI(interaction, prisma, spawn, npc);
      break;

    default:
      await interaction.reply({
        content: '알 수 없는 NPC입니다.',
        ephemeral: true,
      });
  }
}

/**
 * 떠돌이 상인 UI
 */
async function showMerchantUI(interaction, prisma, spawn, npc) {
  const embed = new EmbedBuilder()
    .setTitle(`${npc.emoji} ${npc.name}`)
    .setDescription(npc.dialogue.greeting)
    .setColor(0x10b981);

  const itemFields = npc.items.map((item) => ({
    name: `${item.emoji} ${item.name}`,
    value: [
      item.description,
      `~~${item.normalPrice}G~~ → **${item.discountPrice}G** (${Math.round((1 - item.discountPrice / item.normalPrice) * 100)}% 할인!)`,
    ].join('\n'),
    inline: false,
  }));

  embed.addFields(itemFields);

  // 구매 버튼
  const buttons = npc.items.map((item, index) =>
    new ButtonBuilder()
      .setCustomId(`npc_merchant:buy:${spawn.id}:${index}`)
      .setLabel(`${item.name} 구매 (${item.discountPrice}G)`)
      .setStyle(ButtonStyle.Success)
  );

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
    rows.push(row);
  }

  await interaction.reply({
    embeds: [embed],
    components: rows,
    ephemeral: true,
  });
}

/**
 * 신비한 노인 UI
 */
async function showElderUI(interaction, prisma, spawn, npc) {
  const embed = new EmbedBuilder()
    .setTitle(`${npc.emoji} ${npc.name}`)
    .setDescription(npc.dialogue.greeting)
    .setColor(0x8b5cf6);

  const blessingFields = npc.blessings.map((blessing) => ({
    name: `${blessing.emoji} ${blessing.name}`,
    value: blessing.description,
    inline: true,
  }));

  embed.addFields(blessingFields);

  // 축복 선택 버튼
  const buttons = npc.blessings.map((blessing, index) =>
    new ButtonBuilder()
      .setCustomId(`npc_elder:bless:${spawn.id}:${index}`)
      .setLabel(blessing.name)
      .setEmoji(blessing.emoji)
      .setStyle(ButtonStyle.Primary)
  );

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
    rows.push(row);
  }

  await interaction.reply({
    embeds: [embed],
    components: rows,
    ephemeral: true,
  });
}

/**
 * 도박꾼 UI
 */
async function showGamblerUI(interaction, prisma, spawn, npc) {
  const character = await prisma.character.findUnique({
    where: { userId: interaction.user.id },
  });

  if (!character) {
    await interaction.reply({
      content: '먼저 `/create` 명령어로 캐릭터를 생성해주세요!',
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${npc.emoji} ${npc.name}`)
    .setDescription(
      npc.dialogue.greeting +
      `\n\n💰 현재 보유 골드: ${character.gold.toLocaleString()}G`
    )
    .setColor(0xef4444)
    .addFields({
      name: '규칙',
      value: [
        '• 배팅 금액을 선택하세요',
        '• 50% 확률로 2배를 받거나 전부 잃습니다',
        '• 한 번만 도박할 수 있습니다!',
      ].join('\n'),
    });

  // 배팅 버튼
  const buttons = npc.gambleOptions
    .filter((opt) => character.gold >= opt.amount)
    .map((opt) =>
      new ButtonBuilder()
        .setCustomId(`npc_gambler:bet:${spawn.id}:${opt.amount}`)
        .setLabel(opt.label)
        .setStyle(ButtonStyle.Danger)
    );

  if (buttons.length === 0) {
    await interaction.reply({
      content: '골드가 부족합니다! 최소 1,000G가 필요합니다.',
      ephemeral: true,
    });
    return;
  }

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
    rows.push(row);
  }

  await interaction.reply({
    embeds: [embed],
    components: rows,
    ephemeral: true,
  });
}

module.exports = {
  spawnRandomNpc,
  despawnNpc,
  handleNpcInteraction,
};
