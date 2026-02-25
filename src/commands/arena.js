const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ArenaSystem, ARENA_ENTRY_FEE } = require('../game/arena-system');
const { handleCombatButton, createCombatEmbed, createCombatActionRows } = require('../game/combat');
const { EMBED_COLORS } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');


// 매칭 대기 중인 유저들
const matchmakingQueue = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('arena')
		.setNameLocalizations({ "en-US": "arena" })
    .setDescription('PvP Arena')
		.setDescriptionLocalizations({ "en-US": "PvP Arena" })
    .setDescriptionLocalizations({ ko: 'PvP 투기장' })
    .addSubcommand(sub =>
      sub.setName('queue')
        .setDescription('매칭 대기열 참가')
        .setDescriptionLocalizations({ ko: '매칭 대기열 참가' })
    )
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('내 Arena 전적')
        .setDescriptionLocalizations({ ko: '내 Arena 전적' })
    )
    .addSubcommand(sub =>
      sub.setName('ranking')
        .setDescription('Arena 랭킹')
        .setDescriptionLocalizations({ ko: 'Arena 랭킹' })
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'queue':
        return await handleQueue(interaction);
      case 'stats':
        return await handleStats(interaction);
      case 'ranking':
        return await handleRanking(interaction);
      default:
        return interaction.reply({ content: '알 수 없는 명령어입니다.', ephemeral: true });
    }
  }
};

async function handleQueue(interaction) {
  const userId = interaction.user.id;

  // 골드 확인
  const character = await requireCharacter(prisma, interaction);
  if (!character) return;

  if (character.gold < ARENA_ENTRY_FEE) {
    return interaction.reply({
      content: `❌ 골드가 부족합니다! (필요: ${ARENA_ENTRY_FEE.toLocaleString()} 골드)`,
      ephemeral: true
    });
  }

  // 이미 대기 중인지 확인
  if (matchmakingQueue.has(userId)) {
    return interaction.reply({ content: '❌ 이미 매칭 대기 중입니다!', ephemeral: true });
  }

  // 상대방 찾기
  const opponent = await ArenaSystem.findMatch(userId);

  if (!opponent) {
    // 대기열에 추가
    matchmakingQueue.set(userId, {
      interaction,
      timestamp: Date.now()
    });

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.arena)
      .setTitle('⚔️ Arena 매칭 대기 중...')
      .setDescription('상대를 찾고 있습니다!')
      .addFields(
        { name: '입장료', value: `${ARENA_ENTRY_FEE.toLocaleString()} 골드`, inline: true },
        { name: '보상', value: `${(ARENA_ENTRY_FEE * 2).toLocaleString()} 골드 (승리 시)`, inline: true }
      )
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('arena_cancel_queue')
          .setLabel('취소')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

    await interaction.reply({ embeds: [embed], components: [row] });

    // 1분 후 자동 취소
    setTimeout(() => {
      if (matchmakingQueue.has(userId)) {
        matchmakingQueue.delete(userId);
        interaction.editReply({ content: '⏰ 매칭 시간 초과! 다시 시도하세요.', embeds: [], components: [] }).catch(() => {});
      }
    }, 60000);

    return;
  }

  // 매칭 성공!
  const opponentData = matchmakingQueue.get(opponent.userId);
  
  if (opponentData) {
    matchmakingQueue.delete(opponent.userId);
  }

  matchmakingQueue.delete(userId);

  // 전투 시작
  const result = await ArenaSystem.startBattle(userId, opponent.userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  // 전투 시작 알림
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.defeat)
    .setTitle('⚔️ Arena 전투 시작!')
    .setDescription(`<@${userId}> vs <@${opponent.userId}>`)
    .addFields(
      { name: '입장료', value: `${ARENA_ENTRY_FEE.toLocaleString()} 골드씩`, inline: true },
      { name: '보상', value: `${result.battle.reward.toLocaleString()} 골드 (승자)`, inline: true },
      { name: '내 ELO', value: `${result.elo1.elo}`, inline: true },
      { name: '상대 ELO', value: `${result.elo2.elo}`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  // 상대방에게도 알림
  if (opponentData && opponentData.interaction) {
    opponentData.interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
  }

  // PvP 전투 진행 (기존 combat 시스템 재사용)
  await startArenaCombat(interaction, userId, opponent.userId, result.battle.id);
}

async function handleStats(interaction) {
  const userId = interaction.user.id;
  const elo = await ArenaSystem.getOrCreateElo(userId);
  const battles = await ArenaSystem.getUserBattles(userId, 5);

  const winRate = elo.wins + elo.losses > 0
    ? ((elo.wins / (elo.wins + elo.losses)) * 100).toFixed(1)
    : 0;

  const battleHistory = battles.map((battle, i) => {
    const isWinner = battle.winnerId === userId;
    const emoji = isWinner ? '✅' : '❌';
    return `${i + 1}. ${emoji} ${isWinner ? '승리' : '패배'}`;
  }).join('\n') || '_전투 기록 없음_';

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.arena)
    .setTitle(`⚔️ ${interaction.user.username}님의 Arena 전적`)
    .addFields(
      { name: 'ELO', value: `${elo.elo}`, inline: true },
      { name: '승/패', value: `${elo.wins}승 ${elo.losses}패`, inline: true },
      { name: '승률', value: `${winRate}%`, inline: true },
      { name: '최근 전투', value: battleHistory, inline: false }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleRanking(interaction) {
  const topPlayers = await ArenaSystem.getWeeklyTopPlayers(10);

  if (topPlayers.length === 0) {
    return interaction.reply({ content: '❌ 아직 랭킹이 없습니다.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.arena)
    .setTitle('🏆 Arena 랭킹 TOP 10')
    .setDescription('주간 Arena ELO 순위')
    .setTimestamp();

  const medals = ['🥇', '🥈', '🥉'];

  for (let i = 0; i < topPlayers.length; i++) {
    const player = topPlayers[i];
    const medal = i < 3 ? medals[i] : `${i + 1}.`;
    const winRate = player.wins + player.losses > 0
      ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
      : 0;

    embed.addFields({
      name: `${medal} <@${player.userId}>`,
      value: `ELO: ${player.elo} | ${player.wins}승 ${player.losses}패 (${winRate}%)`,
      inline: false
    });
  }

  await interaction.reply({ embeds: [embed] });
}

async function startArenaCombat(interaction, player1Id, player2Id, battleId) {
  // PvP 전투는 기존 combat 시스템을 재사용하되,
  // 상대가 플레이어이므로 AI 대신 플레이어 캐릭터를 사용
  
  const char1 = await prisma.character.findUnique({ where: { userId: player1Id }, include: { equipment: { where: { isEquipped: true } } } });
  const char2 = await prisma.character.findUnique({ where: { userId: player2Id }, include: { equipment: { where: { isEquipped: true } } } });

  // 간단히 스탯 비교로 승자 결정 (나중에 턴제 전투로 개선 가능)
  const char1Power = char1.attack + char1.defense + char1.level * 10;
  const char2Power = char2.attack + char2.defense + char2.level * 10;

  const winnerId = char1Power > char2Power ? player1Id : player2Id;

  // 전투 완료
  await ArenaSystem.completeBattle(battleId, winnerId, {
    player1Power: char1Power,
    player2Power: char2Power
  });

  // 결과 알림
  const resultEmbed = new EmbedBuilder()
    .setColor(winnerId === player1Id ? EMBED_COLORS.victory : EMBED_COLORS.defeat)
    .setTitle('⚔️ Arena 전투 종료!')
    .setDescription(`승자: <@${winnerId}>`)
    .addFields(
      { name: '<@' + player1Id + '>', value: `파워: ${char1Power}`, inline: true },
      { name: '<@' + player2Id + '>', value: `파워: ${char2Power}`, inline: true },
      { name: '보상', value: `${(ARENA_ENTRY_FEE * 2).toLocaleString()} 골드 + 50 XP`, inline: false }
    )
    .setTimestamp();

  await interaction.followUp({ embeds: [resultEmbed] });
}
