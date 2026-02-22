const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const { getBossById } = require('./bosses');
const { applyExperience } = require('./leveling');
const { calculateEquipmentStats } = require('./equipment');
const { getAvailableSkills, canUseSkill } = require('./skills');
const { DAILY_QUEST_EVENTS, recordDailyQuestProgress } = require('./daily-quests');
const { EMBED_COLORS, createDivider, createHPBar } = require('../utils/ui');
const { RARITIES } = require('./equipment');

const BOSS_COMBAT_PREFIX = 'boss_combat';

const BOSS_COMBAT_ACTIONS = {
  attack: 'attack',
  defend: 'defend',
  potion: 'potion',
  skill: 'skill',
  flee: 'flee',
};

function buildBossCombatCustomId(action, sessionId, skillKey = null) {
  if (skillKey) {
    return `${BOSS_COMBAT_PREFIX}:${action}:${sessionId}:${skillKey}`;
  }
  return `${BOSS_COMBAT_PREFIX}:${action}:${sessionId}`;
}

function parseBossCombatCustomId(customId) {
  if (!customId || !customId.startsWith(`${BOSS_COMBAT_PREFIX}:`)) {
    return null;
  }

  const parts = customId.split(':');
  if (parts.length < 3) return null;

  const [, action, sessionId, skillKey] = parts;
  if (!BOSS_COMBAT_ACTIONS[action] || !sessionId) return null;

  return { action, sessionId, skillKey: skillKey || null };
}

function isBossCombatButton(customId) {
  return customId && customId.startsWith(`${BOSS_COMBAT_PREFIX}:`);
}

async function createBossCombatEmbed({ session, character, boss, prisma, combatLog = [] }) {
  const bossData = boss || getBossById(session.bossId);

  const equipment = await prisma.equipment.findMany({
    where: { characterId: character.id, equipped: true },
  });

  const equipStats = calculateEquipmentStats(equipment);

  const totalAttack = character.attack + equipStats.attack;
  const totalDefense = character.defense + equipStats.defense;
  const maxHp = character.maxHp + equipStats.hp;

  const bossHpPercent = (session.monsterHp / session.monsterMaxHp) * 100;
  const playerHpPercent = (session.playerHp / maxHp) * 100;

  // 보스 스킬 표시
  const activeSkills = getActiveBossSkills(bossData, session);
  const skillLines = activeSkills.map((skill) => `🔥 ${skill.name}`);

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.boss || '#FF0000')
    .setTitle(`${bossData.emoji} 보스 전투: ${bossData.name}`)
    .setDescription(
      [
        createDivider(),
        `📍 Zone ${bossData.zone} | 턴 ${session.turn}`,
        '',
        `${bossData.emoji} **${bossData.name}** (Lv.${bossData.level})`,
        createHPBar(session.monsterHp, session.monsterMaxHp, 10),
        `❤️ ${session.monsterHp}/${session.monsterMaxHp} (${Math.round(bossHpPercent)}%)`,
        skillLines.length > 0 ? skillLines.join(' | ') : '',
        '',
        `👤 **${character.name}** (Lv.${character.level})`,
        createHPBar(session.playerHp, maxHp, 10),
        `❤️ ${session.playerHp}/${maxHp} (${Math.round(playerHpPercent)}%)`,
        session.playerDefending ? '🛡️ 방어 중 (피해 -50%)' : '',
        '',
        createDivider(),
        ...combatLog,
        combatLog.length > 0 ? createDivider() : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({
      text: `💊 포션 ${session.potionsRemaining}개 남음 | ⚔️ 공격 ${totalAttack} | 🛡️ 방어 ${totalDefense}`,
    });
}

function createBossCombatActionRow(session, availableSkills = []) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId(buildBossCombatCustomId('attack', session.id))
      .setLabel('공격')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(buildBossCombatCustomId('defend', session.id))
      .setLabel('방어')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Primary),
  ];

  if (session.potionsRemaining > 0) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(buildBossCombatCustomId('potion', session.id))
        .setLabel(`포션 (${session.potionsRemaining})`)
        .setEmoji('💊')
        .setStyle(ButtonStyle.Success),
    );
  }

  // 스킬 버튼 (최대 2개)
  const skillButtons = availableSkills.slice(0, 2).map((skill) =>
    new ButtonBuilder()
      .setCustomId(buildBossCombatCustomId('skill', session.id, skill.key))
      .setLabel(skill.name)
      .setEmoji(skill.emoji || '✨')
      .setStyle(ButtonStyle.Success),
  );

  buttons.push(...skillButtons);

  return new ActionRowBuilder().addComponents(buttons);
}

function getActiveBossSkills(boss, session) {
  if (!boss || !boss.skills) return [];

  const active = [];
  const bossHpPercent = (session.monsterHp / session.monsterMaxHp) * 100;

  boss.skills.forEach((skill) => {
    let isActive = false;

    switch (skill.trigger) {
      case 'hp_below_50':
        isActive = bossHpPercent < 50;
        break;
      case 'hp_below_30':
        isActive = bossHpPercent < 30;
        break;
      case 'hp_above_70':
        isActive = bossHpPercent > 70;
        break;
      case 'hp_above_80':
        isActive = bossHpPercent > 80;
        break;
      case 'every_3_turns':
        isActive = session.turn % 3 === 0;
        break;
      case 'every_4_turns':
        isActive = session.turn % 4 === 0;
        break;
      case 'every_5_turns':
        isActive = session.turn % 5 === 0;
        break;
      default:
        isActive = false;
    }

    if (isActive) {
      active.push(skill);
    }
  });

  return active;
}

function applyBossSkillEffects(boss, session, baseDamage) {
  const activeSkills = getActiveBossSkills(boss, session);
  let finalDamage = baseDamage;
  let healAmount = 0;
  let dodged = false;
  const logs = [];

  activeSkills.forEach((skill) => {
    switch (skill.effect) {
      case 'attack_boost':
        finalDamage = Math.round(baseDamage * (1 + skill.value));
        logs.push(`🔥 ${skill.name}! (공격력 +${Math.round(skill.value * 100)}%)`);
        break;

      case 'extra_damage':
        finalDamage += skill.value;
        logs.push(`💥 ${skill.name}! (+${skill.value} 추가 피해)`);
        break;

      case 'power_strike':
        finalDamage = Math.round(baseDamage * skill.value);
        logs.push(`💢 ${skill.name}! (피해 x${skill.value})`);
        break;

      case 'breath_attack':
        finalDamage = Math.round(baseDamage * skill.value);
        logs.push(`🔥 ${skill.name}! (피해 x${skill.value})`);
        break;

      case 'heal':
        healAmount = skill.value;
        logs.push(`💚 ${skill.name}! (HP +${skill.value})`);
        break;

      case 'dodge':
        dodged = true;
        logs.push(`💨 ${skill.name}! (공격 회피)`);
        break;

      default:
        break;
    }
  });

  return { finalDamage, healAmount, dodged, logs };
}

function calculateBossDamageReduction(boss, session) {
  const activeSkills = getActiveBossSkills(boss, session);
  let reduction = 0;

  activeSkills.forEach((skill) => {
    if (skill.effect === 'damage_reduction') {
      reduction = Math.max(reduction, skill.value);
    }
  });

  return reduction;
}

async function handleBossVictory({ interaction, prisma, session, character, boss }) {
  const equipment = await prisma.equipment.findMany({
    where: { characterId: character.id, equipped: true },
  });

  const equipStats = calculateEquipmentStats(equipment);
  const maxHp = character.maxHp + equipStats.hp;

  // 골드 보상
  const goldReward = Math.floor(
    Math.random() * (boss.goldReward.max - boss.goldReward.min + 1) + boss.goldReward.min,
  );

  // 경험치 보상
  const xpReward = boss.xpReward;

  // 레벨업 체크 (올바른 시그니처: character object, xp, currentHp, currentMana)
  const leveling = applyExperience(character, xpReward, session.playerHp, character.mana ?? 0);

  // 장비 드롭 (확정)
  const droppedEquipment = await generateBossEquipment({
    prisma,
    characterId: character.id,
    characterLevel: leveling.characterUpdate.level,
    boss,
  });

  // 스킬북 드롭
  const droppedSkillBook = await rollBossSkillBook({
    prisma,
    character,
    boss,
  });

  // 보스 인카운터 업데이트 (리스폰 타이머 시작)
  const respawnAt = new Date(Date.now() + boss.respawnMinutes * 60 * 1000);

  // 트랜잭션으로 모든 업데이트를 원자적으로 처리
  await prisma.$transaction(async (tx) => {
    await tx.bossEncounter.upsert({
      where: { bossId: boss.id },
      update: {
        lastDefeatedAt: new Date(),
        defeatedBy: character.name,
        defeatedById: character.id,
        respawnAt,
      },
      create: {
        bossId: boss.id,
        lastDefeatedAt: new Date(),
        defeatedBy: character.name,
        defeatedById: character.id,
        respawnAt,
      },
    });

    // 캐릭터 업데이트 (레벨업 + 골드 + HP)
    await tx.character.update({
      where: { id: character.id },
      data: {
        ...leveling.characterUpdate,
        gold: character.gold + goldReward,
        battleWins: (character.battleWins || 0) + 1,
        bossKills: (character.bossKills || 0) + 1,
      },
    });

    await tx.rankingEvent.createMany({
      data: [
        {
          characterId: character.id,
          category: 'battle_wins',
          value: 1,
        },
        {
          characterId: character.id,
          category: 'boss_kills',
          value: 1,
        },
      ],
    });

    // 전투 세션 삭제
    await tx.combatSession.delete({
      where: { id: session.id },
    });
  });

  try {
    await Promise.all([
      recordDailyQuestProgress(prisma, character.id, DAILY_QUEST_EVENTS.KILL_BOSS, 1),
      recordDailyQuestProgress(prisma, character.id, DAILY_QUEST_EVENTS.KILL_MONSTER, 1),
    ]);
  } catch (error) {
    console.error('Daily quest progress update failed (boss victory):', error);
  }

  // 승리 메시지
  const victoryEmbed = new EmbedBuilder()
    .setColor(EMBED_COLORS.victory || '#FFD700')
    .setTitle(`🏆 보스 처치 성공!`)
    .setDescription(
      [
        createDivider(),
        `${boss.emoji} **${boss.name}**을(를) 처치했습니다!`,
        '',
        `💰 골드: +${goldReward}G`,
        `💎 경험치: +${xpReward}`,
        leveling.levelsGained > 0
          ? `🎉 **레벨 업!** ${character.level} → ${leveling.characterUpdate.level}`
          : '',
        '',
        '📦 **보상**',
        droppedEquipment
          ? `${RARITIES[droppedEquipment.rarity].emoji} ${droppedEquipment.name} 획득!`
          : '',
        droppedSkillBook ? `📕 **${droppedSkillBook.name}** 스킬북 획득!` : '',
        '',
        createDivider(),
        '',
        `❤️ HP: ${session.playerHp}/${maxHp}`,
        `⏰ 보스 리스폰: ${boss.respawnMinutes}분 후`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({
      text: '보스 전투 완료',
    });

  const retryButton = new ButtonBuilder()
    .setCustomId('back_to_profile')
    .setLabel('프로필로')
    .setEmoji('👤')
    .setStyle(ButtonStyle.Primary);

  const bossListButton = new ButtonBuilder()
    .setCustomId('boss_list')
    .setLabel('보스 목록')
    .setEmoji('📜')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(retryButton, bossListButton);

  await interaction.editReply({
    embeds: [victoryEmbed],
    components: [row],
  });
}

async function generateBossEquipment({ prisma, characterId, characterLevel, boss }) {
  const { generateEquipment } = require('./equipment');

  const dropConfig = boss.dropTable.equipment;

  // 희귀도 결정 (minRarity와 maxRarity 사이)
  const rarities = ['common', 'uncommon', 'rare', 'epic'];
  const minIndex = rarities.indexOf(dropConfig.minRarity);
  const maxIndex = rarities.indexOf(dropConfig.maxRarity);

  const possibleRarities = rarities.slice(minIndex, maxIndex + 1);
  const rarity = possibleRarities[Math.floor(Math.random() * possibleRarities.length)];

  // 장비 생성 (올바른 시그니처: characterLevel, options)
  const equipmentData = generateEquipment(characterLevel, { rarity });

  // DB에 장비 저장
  const equipment = await prisma.equipment.create({
    data: {
      characterId,
      name: equipmentData.name,
      type: equipmentData.type,
      rarity: equipmentData.rarity,
      attack: equipmentData.attack,
      defense: equipmentData.defense,
      hp: equipmentData.hp,
      mana: equipmentData.mana,
      effect: equipmentData.effect,
      equipped: false,
    },
  });

  return equipment;
}

async function rollBossSkillBook({ prisma, character, boss }) {
  const { getAdvancedClassSkills } = require('./advanced-skills');

  const chance = boss.dropTable.skillBook.chance;
  const roll = Math.random();

  if (roll >= chance) {
    return null; // 스킬북 드롭 실패
  }

  // 플레이어의 전직 클래스 확인
  if (!character.advancedClass) {
    return null; // 전직하지 않았으면 스킬북 드롭 불가
  }

  const advancedSkills = getAdvancedClassSkills(character.advancedClass);
  if (!advancedSkills || advancedSkills.length === 0) {
    return null;
  }

  // 마스터 스킬 (인덱스 5, 6)
  const masterSkills = advancedSkills.slice(5, 7);

  // 이미 보유한 스킬 제외
  const existingSkills = await prisma.skill.findMany({
    where: { characterId: character.id },
  });

  const existingKeys = new Set(existingSkills.map((s) => s.skillKey));
  const availableSkills = masterSkills.filter((s) => !existingKeys.has(s.key));

  if (availableSkills.length === 0) {
    return null; // 모든 마스터 스킬 보유 중
  }

  // 랜덤 스킬 선택
  const droppedSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];

  // 스킬 추가
  await prisma.skill.create({
    data: {
      characterId: character.id,
      skillKey: droppedSkill.key,
      skillLevel: 1,
      equipped: false,
    },
  });

  return droppedSkill;
}

module.exports = {
  BOSS_COMBAT_PREFIX,
  BOSS_COMBAT_ACTIONS,
  buildBossCombatCustomId,
  parseBossCombatCustomId,
  isBossCombatButton,
  createBossCombatEmbed,
  createBossCombatActionRow,
  getActiveBossSkills,
  applyBossSkillEffects,
  calculateBossDamageReduction,
  handleBossVictory,
};
