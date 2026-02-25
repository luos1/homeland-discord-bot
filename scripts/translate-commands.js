#!/usr/bin/env node
/**
 * 홈랜드 명령어 자동 영문 번역 스크립트
 * 
 * Discord.js v14 Native i18n 사용
 */

const fs = require('fs');
const path = require('path');

// 핵심 10개 명령어 영문 번역
const COMMAND_TRANSLATIONS = {
  create: {
    name: 'create',
    desc: 'Create a new character',
    options: {
      class: {
        name: 'class',
        desc: 'Character class to create',
        choices: {
          warrior: 'Warrior',
          mage: 'Mage',
          archer: 'Archer',
          assassin: 'Assassin'
        }
      }
    }
  },
  profile: {
    name: 'profile',
    desc: 'View character profile and stats'
  },
  explore: {
    name: 'explore',
    desc: 'Start exploring to find monsters and resources',
    options: {
      zone: {
        name: 'zone',
        desc: 'Exploration zone',
        choices: {
          forest: 'Forest',
          cave: 'Cave',
          mountain: 'Mountain'
        }
      }
    }
  },
  attack: {
    name: 'attack',
    desc: 'Attack the current enemy'
  },
  defend: {
    name: 'defend',
    desc: 'Defend to reduce incoming damage'
  },
  escape: {
    name: 'escape',
    desc: 'Attempt to escape from combat'
  },
  market: {
    name: 'market',
    desc: 'Open the market to buy and sell items'
  },
  inventory: {
    name: 'inventory',
    desc: 'View your inventory and equipped items'
  },
  use: {
    name: 'use',
    desc: 'Use an item from your inventory',
    options: {
      item: {
        name: 'item',
        desc: 'Item to use'
      }
    }
  },
  daily: {
    name: 'daily',
    desc: 'Claim daily rewards'
  }
};

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

// 명령어 파일 분석
function analyzeCommandFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // .setName() 찾기
  const nameMatch = content.match(/\.setName\(['"]([^'"]+)['"]\)/);
  if (!nameMatch) return null;
  
  const commandName = nameMatch[1];
  const translation = COMMAND_TRANSLATIONS[commandName];
  
  if (!translation) return null;
  
  return {
    filePath,
    commandName,
    translation,
    hasNameLocalizations: content.includes('.setNameLocalizations('),
    hasDescriptionLocalizations: content.includes('.setDescriptionLocalizations(')
  };
}

// 명령어 파일 수정
function updateCommandFile(info) {
  let content = fs.readFileSync(info.filePath, 'utf8');
  
  // .setName() 뒤에 .setNameLocalizations() 추가
  if (!info.hasNameLocalizations) {
    content = content.replace(
      /\.setName\(['"]([^'"]+)['"]\)/,
      `.setName('${info.commandName}')\n\t\t.setNameLocalizations({ en: '${info.translation.name}' })`
    );
  }
  
  // .setDescription() 뒤에 .setDescriptionLocalizations() 추가
  if (!info.hasDescriptionLocalizations) {
    content = content.replace(
      /\.setDescription\(['"]([^'"]+)['"]\)/,
      (match, desc) => `${match}\n\t\t.setDescriptionLocalizations({ en: '${info.translation.desc}' })`
    );
  }
  
  fs.writeFileSync(info.filePath, content, 'utf8');
}

// 메인
async function main() {
  console.log('🌍 홈랜드 영문 번역 시작...\n');
  
  const commandsDir = path.join(__dirname, '../src/commands');
  const files = findCommandFiles(commandsDir);
  
  console.log(`📁 총 ${files.length}개 명령어 파일 발견\n`);
  
  let translated = 0;
  let skipped = 0;
  
  for (const file of files) {
    const info = analyzeCommandFile(file);
    
    if (!info) {
      skipped++;
      continue;
    }
    
    if (info.hasNameLocalizations && info.hasDescriptionLocalizations) {
      console.log(`⏭️  ${info.commandName}: 이미 번역됨`);
      skipped++;
      continue;
    }
    
    console.log(`🔧 ${info.commandName}: 번역 추가 중...`);
    updateCommandFile(info);
    translated++;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ 번역 완료: ${translated}개`);
  console.log(`⏭️  스킵: ${skipped}개`);
  console.log('='.repeat(60));
  
  console.log('\n💡 다음 단계:');
  console.log('1. Railway에 배포: git push origin main');
  console.log('2. Discord 명령어 재등록: node deploy-commands.js');
  console.log('3. Discord 언어 설정 변경 후 테스트');
}

main().catch(console.error);
