/**
 * 오토 배틀 시스템
 * 
 * 버튼 클릭 없이 자동으로 전투 진행
 * - 빠른 전투
 * - 즉각 피드백
 * - 반복 사냥 편의성
 */

const { handleCombatAction } = require('./combat');

/**
 * 오토 배틀 실행
 * 
 * AI가 자동으로 최적 행동 선택
 */
async function executeAutoBattle({ interaction, session, character, prisma }) {
  const actions = [];
  let currentSession = session;
  let turnCount = 0;
  const maxTurns = 50; // 무한루프 방지
  
  // 전투 종료까지 자동 진행
  while (turnCount < maxTurns) {
    turnCount++;
    
    // AI 행동 선택
    const action = selectBestAction(currentSession, character);
    
    // 행동 실행
    const result = await handleCombatAction({
      interaction,
      prisma,
      action: action.type,
      skillKey: action.skillKey
    });
    
    actions.push({
      turn: turnCount,
      action: action.type,
      result: result.status
    });
    
    // 전투 종료 체크
    if (result.status === 'victory' || result.status === 'defeat') {
      return {
        status: result.status,
        actions,
        totalTurns: turnCount,
        finalResult: result
      };
    }
    
    // 세션 갱신
    currentSession = await prisma.combatSession.findUnique({
      where: { id: session.id },
      include: { character: true }
    });
    
    if (!currentSession) {
      // 전투 세션 사라짐
      break;
    }
  }
  
  return {
    status: 'timeout',
    actions,
    totalTurns: turnCount
  };
}

/**
 * AI 행동 선택 로직
 */
function selectBestAction(session, character) {
  const playerHp = session.playerHp;
  const playerHpPercent = playerHp / character.maxHp;
  const monsterHp = session.monsterHp;
  const monsterHpPercent = monsterHp / session.monsterMaxHp;
  
  // 위험: 체력 30% 이하 → 포션
  if (playerHpPercent < 0.3 && session.potionsRemaining > 0) {
    return { type: 'potion' };
  }
  
  // 스킬 우선 (마나 있으면)
  const hasSkill = character.skills && character.skills.length > 0;
  const hasMana = character.mana > 0;
  
  if (hasSkill && hasMana) {
    // 랜덤 스킬 선택 (콤보를 위해)
    const skills = character.skills.filter(s => s.manaCost <= character.mana);
    if (skills.length > 0) {
      const randomSkill = skills[Math.floor(Math.random() * skills.length)];
      return { 
        type: 'skill',
        skillKey: randomSkill.skillKey
      };
    }
  }
  
  // 적 체력 낮을 때: 공격
  if (monsterHpPercent < 0.5) {
    return { type: 'attack' };
  }
  
  // 기본: 공격
  return { type: 'attack' };
}

/**
 * 빠른 오토 배틀 (결과만 반환)
 */
async function quickAutoBattle({ session, character, prisma }) {
  // 간소화된 전투 시뮬레이션
  let playerHp = session.playerHp;
  let monsterHp = session.monsterHp;
  let turn = 0;
  const maxTurns = 50;
  
  while (turn < maxTurns && playerHp > 0 && monsterHp > 0) {
    turn++;
    
    // 플레이어 공격
    const playerDamage = Math.max(1, character.attack - session.monsterDefense);
    monsterHp -= playerDamage;
    
    if (monsterHp <= 0) {
      return { status: 'victory', turns: turn };
    }
    
    // 몬스터 반격
    const monsterDamage = Math.max(1, session.monsterAttack - character.defense);
    playerHp -= monsterDamage;
    
    if (playerHp <= 0) {
      return { status: 'defeat', turns: turn };
    }
  }
  
  return { status: 'timeout', turns: maxTurns };
}

module.exports = {
  executeAutoBattle,
  quickAutoBattle,
  selectBestAction
};
