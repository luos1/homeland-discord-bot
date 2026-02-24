const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { createVillageHomeButton } = require('../utils/village');
const { getAllBosses, getBossById } = require('../game/bosses');
const { requireCharacter } = require('../utils/response-helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boss')
    .setDescription('필드 보스에 도전합니다')
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('사용 가능한 보스 목록을 확인합니다'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('challenge')
        .setDescription('보스에 도전합니다')
        .addStringOption((option) =>
          option
            .setName('boss')
            .setDescription('도전할 보스')
            .setRequired(true)
            .addChoices(
              { name: '🐺 알파 울프 (Zone 1)', value: 'alpha_wolf' },
              { name: '⚔️ 타락한 기사 (Zone 2)', value: 'fallen_knight' },
              { name: '🐉 어린 드래곤 (Zone 3)', value: 'young_dragon' },
            ),
        ),
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      await handleBossList(interaction, { prisma });
    } else if (subcommand === 'challenge') {
      await handleBossChallenge(interaction, { prisma });
    }
  },

  async handleBossConfirm(interaction, { prisma, bossId }) {
    const boss = getBossById(bossId);

    if (!boss) {
      await interaction.update({
        content: '존재하지 않는 보스입니다.',
        components: [],
      });
      return;
    }

    const character = await requireCharacter(prisma, interaction, {
      include: {
        combatSession: true,
        equipment: true,
        skills: true,
      },
    });
    if (!character) return;

    if (character.combatSession) {
      await interaction.update({
        content: '이미 전투 중입니다.',
        components: [],
      });
      return;
    }

    await startBossFight(interaction, { prisma, character, boss });
  },
};

async function handleBossList(interaction, { prisma }) {
  const bosses = getAllBosses();

  // 모든 보스의 리스폰 상태 조회
  const encounters = await prisma.bossEncounter.findMany({
    where: {
      bossId: { in: bosses.map((b) => b.id) },
    },
  });

  const encounterMap = {};
  encounters.forEach((enc) => {
    encounterMap[enc.bossId] = enc;
  });

  const now = new Date();

  const bossLines = bosses.map((boss) => {
    const encounter = encounterMap[boss.id];
    let statusLine = '✅ **도전 가능**';

    if (encounter && encounter.respawnAt && encounter.respawnAt > now) {
      const remainingMs = encounter.respawnAt - now;
      const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;

      statusLine = `⏰ 리스폰: ${hours > 0 ? `${hours}시간 ` : ''}${minutes}분 후`;

      if (encounter.defeatedBy) {
        statusLine += `\n   마지막 처치: ${encounter.defeatedBy}`;
      }
    }

    return [
      `${boss.emoji} **${boss.name}** (Zone ${boss.zone})`,
      `   레벨: ${boss.level} | HP: ${boss.hp} | 공격: ${boss.attack} | 방어: ${boss.defense}`,
      `   ${statusLine}`,
      `   💰 골드: ${boss.goldReward.min}-${boss.goldReward.max} | 💎 경험치: ${boss.xpReward}`,
      `   📦 드롭: 희귀+ 장비 확정, 스킬북 ${Math.round(boss.dropTable.skillBook.chance * 100)}%`,
    ].join('\n');
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.boss || EMBED_COLORS.combat)
    .setTitle('⚔️ 필드 보스 목록')
    .setDescription(
      [
        createDivider(),
        '🐉 강력한 필드 보스에 도전하세요!',
        '',
        ...bossLines,
        '',
        createDivider(),
        '',
        '💡 아래 버튼으로 보스에 도전할 수 있습니다',
        '⏰ 보스는 처치 후 일정 시간 후 리스폰됩니다',
      ].join('\n'),
    )
    .setFooter({
      text: '필드 보스 시스템',
    });

  // 도전 가능한 보스 버튼 생성
  const challengeButtons = bosses
    .filter((boss) => {
      const encounter = encounterMap[boss.id];
      return !encounter || !encounter.respawnAt || encounter.respawnAt <= now;
    })
    .map((boss) =>
      new ButtonBuilder()
        .setCustomId(`boss_quick_challenge:${boss.id}`)
        .setLabel(`${boss.emoji} ${boss.name}`)
        .setStyle(ButtonStyle.Danger),
    );

  const rows = [];

  if (challengeButtons.length > 0) {
    // 최대 5개씩 나눠서 행 추가
    for (let i = 0; i < challengeButtons.length; i += 5) {
      const rowButtons = challengeButtons.slice(i, i + 5);
      rows.push(new ActionRowBuilder().addComponents(rowButtons));
    }
  }

  // 프로필로 돌아가기 버튼
  const backButton = new ButtonBuilder()
    .setCustomId('back_to_profile')
    .setLabel('프로필로')
    .setEmoji('👤')
    .setStyle(ButtonStyle.Secondary);
  const villageButton = createVillageHomeButton();

  rows.push(new ActionRowBuilder().addComponents(backButton, villageButton));

  await interaction.reply({
    embeds: [embed],
    components: rows,
  });
}

async function handleBossChallenge(interaction, { prisma }) {
  const bossId = interaction.options.getString('boss');
  const boss = getBossById(bossId);

  if (!boss) {
    await interaction.reply({
      content: '존재하지 않는 보스입니다.',
      ephemeral: true,
    });
    return;
  }

  // 캐릭터 조회
  const character = await requireCharacter(prisma, interaction, {
    include: {
      combatSession: true,
      equipment: true,
      skills: true,
    },
  });
  if (!character) return;

  // 이미 전투 중인지 확인
  if (character.combatSession) {
    await interaction.reply({
      content: '이미 전투 중입니다. 먼저 현재 전투를 완료해주세요.',
      ephemeral: true,
    });
    return;
  }

  // 보스 리스폰 확인
  const encounter = await prisma.bossEncounter.findUnique({
    where: { bossId: boss.id },
  });

  const now = new Date();

  if (encounter && encounter.respawnAt && encounter.respawnAt > now) {
    const remainingMs = encounter.respawnAt - now;
    const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;

    await interaction.reply({
      content: [
        `⏰ ${boss.emoji} **${boss.name}**은(는) 아직 리스폰되지 않았습니다.`,
        '',
        `남은 시간: ${hours > 0 ? `${hours}시간 ` : ''}${minutes}분`,
        encounter.defeatedBy ? `마지막 처치: ${encounter.defeatedBy}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      ephemeral: true,
    });
    return;
  }

  // HP 확인 (보스 도전은 풀 HP 권장)
  const hpPercent = (character.hp / character.maxHp) * 100;
  if (hpPercent < 50) {
    const confirmButton = new ButtonBuilder()
      .setCustomId(`boss_challenge_confirm:${bossId}`)
      .setLabel('그래도 도전')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('boss_challenge_cancel')
      .setLabel('취소')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    await interaction.reply({
      content: [
        `⚠️ 체력이 ${Math.round(hpPercent)}%만 남아있습니다!`,
        '',
        `${boss.emoji} **${boss.name}**은(는) 매우 강력한 적입니다.`,
        '체력을 회복하고 도전하는 것을 권장합니다.',
        '',
        '정말 도전하시겠습니까?',
      ].join('\n'),
      components: [row],
      ephemeral: true,
    });
    return;
  }

  // 보스 전투 시작
  await startBossFight(interaction, { prisma, character, boss });
}

async function startBossFight(interaction, { prisma, character, boss }) {
  // 보스 전투 세션 생성
  const session = await prisma.combatSession.create({
    data: {
      characterId: character.id,
      zone: String(boss.zone),
      monsterName: boss.name,
      monsterHp: boss.hp,
      monsterMaxHp: boss.hp,
      monsterAttack: boss.attack,
      monsterDefense: boss.defense,
      monsterXpReward: boss.xpReward,
      monsterGoldMin: boss.goldReward.min,
      monsterGoldMax: boss.goldReward.max,
      playerHp: character.hp,
      playerDefending: false,
      potionsRemaining: 3,
      turn: 1,
      isBossFight: true,
      bossId: boss.id,
      monsterFirstStrike: boss.zone === 3, // Zone 3 bosses attack first
    },
  });

  const { createBossCombatEmbed, createBossCombatActionRow } = require('../game/boss-combat');

  const embed = await createBossCombatEmbed({
    session,
    character,
    boss,
    prisma,
  });

  const actionRow = createBossCombatActionRow(session);

  await interaction.reply({
    embeds: [embed],
    components: [actionRow],
  });
}
