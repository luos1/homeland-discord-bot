#!/usr/bin/env node
/**
 * 홈랜드 전체 명령어 자동 영문 번역
 * 
 * 모든 명령어를 자동으로 영어로 번역합니다.
 */

const fs = require('fs');
const path = require('path');

// 한글 → 영어 자동 매핑
function translateKoreanToEnglish(korean) {
  const translations = {
    // 기본 명령어
    '생성': 'create',
    '프로필': 'profile',
    '탐험': 'explore',
    '공격': 'attack',
    '방어': 'defend',
    '도망': 'escape',
    '시장': 'market',
    '가방': 'inventory',
    '사용': 'use',
    '출석': 'daily',
    
    // 추가 명령어
    '강화': 'upgrade',
    '제작': 'craft',
    '퀘스트': 'quest',
    '길드': 'guild',
    '거래': 'trade',
    '채팅': 'chat',
    '랭킹': 'ranking',
    '도움말': 'help',
    '설정': 'settings',
    '상점': 'shop',
    '던전': 'dungeon',
    '보스': 'boss',
    '파티': 'party',
    '친구': 'friend',
    '우편': 'mail',
    '업적': 'achievement',
    '칭호': 'title',
    '펫': 'pet',
    '탈것': 'mount',
    '스킬': 'skill',
    '스탯': 'stats',
    '장비': 'equipment',
    '재료': 'materials',
    '전투': 'battle',
    '휴식': 'rest',
    '회복': 'heal',
    '부활': 'resurrect',
    '저장': 'save',
    '불러오기': 'load',
    '초기화': 'reset',
    '삭제': 'delete',
    '정보': 'info',
    '상태': 'status',
    '효과': 'effects',
    '버프': 'buffs',
    '디버프': 'debuffs',
    '쿨다운': 'cooldown',
    '경험치': 'exp',
    '레벨업': 'levelup',
    '전직': 'job-change',
    '환생': 'rebirth'
  };
  
  return translations[korean] || korean.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

// 명령어 설명 자동 번역 (간단한 매핑)
function translateDescription(korean) {
  const translations = {
    '캐릭터를 생성합니다': 'Create a new character',
    '프로필을 확인합니다': 'View your character profile',
    '탐험을 시작합니다': 'Start exploring',
    '적을 공격합니다': 'Attack the enemy',
    '방어 자세를 취합니다': 'Defend to reduce damage',
    '전투에서 도망칩니다': 'Escape from battle',
    '시장을 엽니다': 'Open the market',
    '가방을 확인합니다': 'View your inventory',
    '아이템을 사용합니다': 'Use an item',
    '출석 보상을 받습니다': 'Claim daily rewards',
    '장비를 강화합니다': 'Upgrade equipment',
    '아이템을 제작합니다': 'Craft an item',
    '퀘스트를 확인합니다': 'View quests',
    '길드를 관리합니다': 'Manage guild',
    '아이템을 거래합니다': 'Trade items',
    '랭킹을 확인합니다': 'View rankings',
    '도움말을 표시합니다': 'Show help',
    '설정을 변경합니다': 'Change settings',
    '상점에서 구매합니다': 'Buy from shop',
    '던전에 입장합니다': 'Enter dungeon',
    '보스를 도전합니다': 'Challenge boss',
    '파티를 생성합니다': 'Create party',
    '친구를 추가합니다': 'Add friend',
    '우편을 확인합니다': 'Check mail',
    '업적을 확인합니다': 'View achievements',
    '칭호를 관리합니다': 'Manage titles',
    '펫을 관리합니다': 'Manage pets',
    '탈것을 관리합니다': 'Manage mounts',
    '스킬을 사용합니다': 'Use skill',
    '스탯을 확인합니다': 'View stats',
    '장비를 관리합니다': 'Manage equipment',
    '재료를 확인합니다': 'View materials',
    '전투를 시작합니다': 'Start battle',
    '휴식을 취합니다': 'Take a rest',
    '체력을 회복합니다': 'Heal HP',
    '부활합니다': 'Resurrect',
    '진행상황을 저장합니다': 'Save progress',
    '진행상황을 불러옵니다': 'Load progress',
    '캐릭터를 초기화합니다': 'Reset character',
    '캐릭터를 삭제합니다': 'Delete character',
    '정보를 표시합니다': 'Show info',
    '상태를 확인합니다': 'Check status',
    '효과를 확인합니다': 'View effects',
    '버프를 확인합니다': 'View buffs',
    '디버프를 확인합니다': 'View debuffs',
    '쿨다운을 확인합니다': 'Check cooldown',
    '경험치를 확인합니다': 'View experience',
    '레벨업을 합니다': 'Level up',
    '전직을 합니다': 'Change job',
    '환생을 합니다': 'Rebirth'
  };
  
  // 간단한 자동 번역 (fallback)
  if (translations[korean]) {
    return translations[korean];
  }
  
  // 기본 패턴 매칭
  if (korean.includes('확인')) return `View ${korean.replace('를 확인합니다', '').replace('을 확인합니다', '')}`;
  if (korean.includes('생성')) return `Create ${korean.replace('를 생성합니다', '').replace('을 생성합니다', '')}`;
  if (korean.includes('관리')) return `Manage ${korean.replace('를 관리합니다', '').replace('을 관리합니다', '')}`;
  
  return korean; // fallback
}

// 명령어 파일 찾기
function findCommandFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(findCommandFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// 명령어 파일 분석 및 번역
function processCommandFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // .setName() 찾기
  const nameMatch = content.match(/\.setName\(['"]([^'"]+)['"]\)/);
  if (!nameMatch) return { success: false };
  
  const koreanName = nameMatch[1];
  const englishName = translateKoreanToEnglish(koreanName);
  
  // 이미 번역되어 있는지 확인
  if (content.includes('.setNameLocalizations(')) {
    return { success: false, reason: 'already translated' };
  }
  
  // .setDescription() 찾기
  const descMatch = content.match(/\.setDescription\(['"]([^'"]+)['"]\)/);
  const koreanDesc = descMatch ? descMatch[1] : '';
  const englishDesc = translateDescription(koreanDesc);
  
  // .setName() 뒤에 .setNameLocalizations() 추가
  content = content.replace(
    /\.setName\(['"]([^'"]+)['"]\)/,
    `.setName('${koreanName}')\n\t\t.setNameLocalizations({ "en-US": "${englishName}" })`
  );
  
  // .setDescription() 뒤에 .setDescriptionLocalizations() 추가
  if (descMatch) {
    content = content.replace(
      /\.setDescription\(['"]([^'"]+)['"]\)/,
      `.setDescription('${koreanDesc}')\n\t\t.setDescriptionLocalizations({ "en-US": "${englishDesc}" })`
    );
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  
  return {
    success: true,
    koreanName,
    englishName,
    koreanDesc,
    englishDesc
  };
}

// 메인
async function main() {
  console.log('🌍 홈랜드 전체 명령어 자동 번역 시작...\n');
  
  const commandsDir = path.join(__dirname, '../src/commands');
  const files = findCommandFiles(commandsDir);
  
  console.log(`📁 총 ${files.length}개 명령어 파일 발견\n`);
  
  let translated = 0;
  let skipped = 0;
  const results = [];
  
  for (const file of files) {
    const result = processCommandFile(file);
    
    if (!result.success) {
      if (result.reason === 'already translated') {
        console.log(`⏭️  ${path.basename(file)}: 이미 번역됨`);
      }
      skipped++;
      continue;
    }
    
    console.log(`✅ ${result.koreanName} → ${result.englishName}`);
    translated++;
    results.push(result);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ 번역 완료: ${translated}개`);
  console.log(`⏭️  스킵: ${skipped}개`);
  console.log('='.repeat(60));
  
  if (translated > 0) {
    console.log('\n📝 번역 결과:');
    results.forEach(r => {
      console.log(`  ${r.koreanName} (${r.englishName})`);
      if (r.koreanDesc) {
        console.log(`    ${r.koreanDesc} → ${r.englishDesc}`);
      }
    });
  }
  
  console.log('\n💡 다음 단계:');
  console.log('1. 테스트: npm test');
  console.log('2. Git 커밋: git add . && git commit -m "feat: Add English translations"');
  console.log('3. Railway 배포: git push origin main');
}

main().catch(console.error);
