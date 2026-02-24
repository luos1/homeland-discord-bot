/**
 * 필드 보스 랜덤 등장 이벤트
 * 
 * - 30분~1시간마다 랜덤 등장
 * - 전체 채널 공지
 * - 선착순 참여 (5분 제한)
 * - 특별 보상
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { MONSTERS } = require('./monsters');
const { EMBED_COLORS } = require('../utils/ui');

// 활성 필드 보스 이벤트
const activeEvents = new Map();

// 필드 보스 목록 (특별한 강력한 보스)
const FIELD_BOSSES = {
  ancient_dragon: {
    ...MONSTERS.ancientDragon,
    name: '고대의 드래곤',
    emoji: '🐉',
    description: '전설 속에서만 존재한다던 고대 드래곤이 나타났습니다!',
    minLevel: 15,
    rewardMultiplier: 3.0,
    dropRate: 0.8, // 80% 전설 장비
  },
  demon_king: {
    ...MONSTERS.demonLord,
    name: '마왕',
    emoji: '👹',
    description: '어둠의 군주 마왕이 강림했습니다!',
    minLevel: 20,
    rewardMultiplier: 4.0,
    dropRate: 0.9,
  },
  world_eater: {
    name: '세계 포식자',
    emoji: '🌌',
    hp: 50000,
    attack: 200,
    defense: 80,
    xpReward: 10000,
    goldMin: 5000,
    goldMax: 10000,
    level: 30,
    description: '차원을 넘어온 세계 포식자가 나타났습니다!',
    minLevel: 25,
    rewardMultiplier: 5.0,
    dropRate: 1.0, // 100% 전설 장비
  }
};

/**
 * 랜덤 필드 보스 선택
 */
function selectRandomBoss() {
  const bosses = Object.keys(FIELD_BOSSES);
  const randomKey = bosses[Math.floor(Math.random() * bosses.length)];
  return { key: randomKey, ...FIELD_BOSSES[randomKey] };
}

/**
 * 필드 보스 이벤트 시작
 */
async function spawnFieldBoss(client, channelId) {
  const boss = selectRandomBoss();
  const eventId = `${channelId}_${Date.now()}`;
  
  const event = {
    id: eventId,
    boss,
    channelId,
    participants: [],
    maxParticipants: 10,
    startTime: Date.now(),
    duration: 5 * 60 * 1000, // 5분
    expiresAt: Date.now() + 5 * 60 * 1000
  };
  
  activeEvents.set(eventId, event);
  
  // 타임아웃 설정
  setTimeout(() => {
    if (activeEvents.has(eventId)) {
      activeEvents.delete(eventId);
    }
  }, event.duration);
  
  // 공지 메시지
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.defeat)
    .setTitle(`${boss.emoji} 긴급! 필드 보스 출현!`)
    .setDescription([
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `${boss.description}`,
      '',
      `**${boss.name}** 출현!`,
      '',
      `💀 레벨: ${boss.level}`,
      `❤️ HP: ${boss.hp.toLocaleString()}`,
      `⚔️ 공격력: ${boss.attack}`,
      `🛡️ 방어력: ${boss.defense}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `🎁 **특별 보상** 🎁`,
      `💰 골드 x${boss.rewardMultiplier}`,
      `⭐ 경험치 x${boss.rewardMultiplier}`,
      `💎 전설 장비 드롭 확률 ${Math.floor(boss.dropRate * 100)}%`,
      '',
      `⏰ 제한 시간: **5분**`,
      `👥 최대 인원: **10명**`,
      `📊 참여 조건: 레벨 ${boss.minLevel}+`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '⚠️ 지금 바로 도전하세요! ⚠️'
    ].join('\n'))
    .setTimestamp();
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`field_boss_join_${eventId}`)
        .setLabel('도전하기!')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Danger)
    );
  
  try {
    const channel = await client.channels.fetch(channelId);
    await channel.send({ embeds: [embed], components: [row] });
    return { success: true, eventId };
  } catch (error) {
    console.error('Field boss spawn error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 플레이어 참여
 */
async function joinFieldBoss(eventId, userId, character) {
  const event = activeEvents.get(eventId);
  
  if (!event) {
    return { success: false, error: '이벤트가 종료되었습니다.' };
  }
  
  // 시간 초과
  if (Date.now() > event.expiresAt) {
    activeEvents.delete(eventId);
    return { success: false, error: '이벤트가 종료되었습니다.' };
  }
  
  // 레벨 체크
  if (character.level < event.boss.minLevel) {
    return { success: false, error: `레벨 ${event.boss.minLevel} 이상만 참여 가능합니다.` };
  }
  
  // 이미 참여 중
  if (event.participants.some(p => p.userId === userId)) {
    return { success: false, error: '이미 참여 중입니다.' };
  }
  
  // 인원 초과
  if (event.participants.length >= event.maxParticipants) {
    return { success: false, error: '참여 인원이 가득 찼습니다.' };
  }
  
  // 참여 추가
  event.participants.push({
    userId,
    characterId: character.id,
    joinedAt: Date.now()
  });
  
  return { 
    success: true, 
    event,
    participantCount: event.participants.length
  };
}

/**
 * 이벤트 조회
 */
function getEvent(eventId) {
  return activeEvents.get(eventId);
}

/**
 * 활성 이벤트 목록
 */
function getActiveEvents() {
  return Array.from(activeEvents.values());
}

module.exports = {
  FIELD_BOSSES,
  spawnFieldBoss,
  joinFieldBoss,
  getEvent,
  getActiveEvents,
  selectRandomBoss
};
