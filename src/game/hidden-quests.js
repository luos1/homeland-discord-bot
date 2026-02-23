// 숨겨진 퀘스트 시스템

/**
 * 숨겨진 퀘스트 정의
 */
const HIDDEN_QUESTS = {
  ancient_warrior: {
    key: 'ancient_warrior',
    name: '고대 전사의 유산',
    emoji: '⚔️',
    description: '오래된 전사의 영혼이 당신에게 말을 걸어옵니다...',
    
    // 발견 조건
    triggerCondition: {
      type: 'kills',
      monsterType: 'skeletonGrunt',
      required: 100,
    },
    
    // NPC 대화
    npcDialogue: {
      discovery: [
        '...당신, 흥미로운 사람이군요.',
        '스켈레톤을 100마리나 처치했다니...',
        '진정한 전사의 자질이 보입니다.',
        '',
        '내가 묻혀 있던 장소를 찾아주시겠습니까?',
        '고대의 무기가 기다리고 있을 것입니다.',
      ].join('\n'),
      
      accept: '좋습니다. Zone 2에서 고대 언데드 기사 50마리를 처치해주세요.',
      
      reject: '...그렇군요. 인연이 아니었나 봅니다.',
      
      complete: [
        '훌륭합니다! 진정한 전사로군요.',
        '약속한 보상을 드리겠습니다.',
        '',
        '⚔️ 고대 전사의 검',
        '💰 골드 5,000G',
      ].join('\n'),
    },
    
    // 퀘스트 목표
    objective: {
      type: 'kill',
      monsterType: 'undeadKnight',
      required: 50,
      zone: 'zone2',
    },
    
    // 보상
    rewards: {
      gold: 5000,
      equipment: {
        type: 'weapon',
        rarity: 'epic',
        minLevel: 20,
      },
    },
  },
  
  dark_secret: {
    key: 'dark_secret',
    name: '어둠의 비밀',
    emoji: '🌑',
    description: '그림자 속에서 속삭이는 목소리...',
    
    triggerCondition: {
      type: 'zone_visits',
      zone: 'zone2',
      required: 10,
    },
    
    npcDialogue: {
      discovery: [
        '...어둠을 두려워하지 않는군요.',
        '이 동굴에 자주 오시는 것 같은데...',
        '진실을 알고 싶지 않으신가요?',
        '',
        '동굴 깊은 곳에 숨겨진 비밀이 있습니다.',
      ].join('\n'),
      
      accept: '현명한 선택입니다. 고블린 주술사 30마리의 영혼을 가져오십시오.',
      
      reject: '...비겁하군요.',
      
      complete: [
        '잘했습니다. 이제 진실을 알려드리죠.',
        '이 동굴은 과거 금지된 의식이 열렸던 장소입니다...',
        '',
        '보상으로 어둠의 힘을 담은 장비를 드리겠습니다.',
      ].join('\n'),
    },
    
    objective: {
      type: 'kill',
      monsterType: 'goblinShaman',
      required: 30,
      zone: 'zone2',
    },
    
    rewards: {
      gold: 3000,
      equipment: {
        type: 'armor',
        rarity: 'rare',
        minLevel: 15,
      },
    },
  },
  
  faithful_adventurer: {
    key: 'faithful_adventurer',
    name: '성실한 모험가',
    emoji: '📅',
    description: '꾸준함은 언젠가 보상받는다...',
    
    triggerCondition: {
      type: 'attendance_streak',
      required: 7,
    },
    
    npcDialogue: {
      discovery: [
        '오! 당신을 매일 같이 보고 있습니다.',
        '7일 연속으로 모험을 떠나다니...',
        '이런 성실함은 보기 드뭅니다.',
        '',
        '특별한 보상을 준비했습니다.',
      ].join('\n'),
      
      accept: '감사합니다! 총 몬스터 200마리만 더 처치해주세요.',
      
      reject: '...아쉽군요.',
      
      complete: [
        '대단합니다!',
        '성실한 모험가에게 어울리는 보상입니다.',
        '',
        '💎 보석 500개',
        '💰 골드 10,000G',
      ].join('\n'),
    },
    
    objective: {
      type: 'total_kills',
      required: 200,
    },
    
    rewards: {
      gold: 10000,
      gems: 500,
    },
  },
};

/**
 * 퀘스트 발견 조건 체크
 */
function checkQuestDiscoveryCondition(character, triggerStats, attendanceData, questKey) {
  const quest = HIDDEN_QUESTS[questKey];
  if (!quest) return false;
  
  const condition = quest.triggerCondition;
  
  switch (condition.type) {
    case 'kills':
      const kills = triggerStats[`${condition.monsterType}Kills`] || 0;
      return kills >= condition.required;
      
    case 'zone_visits':
      const visits = triggerStats[`${condition.zone}Visits`] || 0;
      return visits >= condition.required;
      
    case 'attendance_streak':
      if (!attendanceData) return false;
      return attendanceData.streak >= condition.required;
      
    case 'total_kills':
      return triggerStats.totalMonsterKills >= condition.required;
      
    default:
      return false;
  }
}

function checkQuestObjectiveComplete(progress, questKey) {
  const quest = HIDDEN_QUESTS[questKey];
  if (!quest) return false;
  
  return progress.progress >= quest.objective.required;
}

function incrementQuestProgress(quest, progress, monsterKey, zone) {
  const objective = quest.objective;
  
  if (progress.completed) return 0;
  if (!progress.accepted) return 0;
  
  let increment = 0;
  
  switch (objective.type) {
    case 'kill':
      if (objective.monsterType && monsterKey !== objective.monsterType) {
        return 0;
      }
      if (objective.zone && zone !== objective.zone) {
        return 0;
      }
      increment = 1;
      break;
      
    case 'total_kills':
      increment = 1;
      break;
      
    default:
      return 0;
  }
  
  return increment;
}

module.exports = {
  HIDDEN_QUESTS,
  checkQuestDiscoveryCondition,
  checkQuestObjectiveComplete,
  incrementQuestProgress,
};
