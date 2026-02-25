#!/usr/bin/env node
/**
 * 정적 분석: 데이터베이스 없이 코드 안정성 검증
 * 
 * 1. 모든 슬래시 명령어 파일 syntax 검증
 * 2. Export/Import 검증
 * 3. 필수 필드 존재 확인
 * 4. 코드 복잡도 경고
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const stats = {
  totalCommands: 0,
  validCommands: 0,
  syntaxErrors: [],
  structureErrors: [],
  warnings: []
};

async function testCommandFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n🔍 테스트 중: ${fileName}`);
  
  try {
    // 1. Syntax 검증
    await execPromise(`node --check "${filePath}"`);
    console.log(`  ✅ Syntax OK`);
    
    // 2. 파일 내용 읽기
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 3. 기본 구조 검증
    const hasData = content.includes('data:') || content.includes('module.exports');
    const hasExecute = content.includes('execute') || content.includes('async execute');
    
    if (!hasData) {
      stats.structureErrors.push({
        file: fileName,
        error: 'data 필드 없음 (SlashCommandBuilder)'
      });
      console.log(`  ⚠️  data 필드 없음`);
    } else {
      console.log(`  ✅ data 필드 존재`);
    }
    
    if (!hasExecute) {
      stats.structureErrors.push({
        file: fileName,
        error: 'execute 함수 없음'
      });
      console.log(`  ⚠️  execute 함수 없음`);
    } else {
      console.log(`  ✅ execute 함수 존재`);
    }
    
    // 4. 잠재적 문제 검사
    if (content.includes('TODO') || content.includes('FIXME')) {
      stats.warnings.push({
        file: fileName,
        warning: 'TODO/FIXME 주석 존재'
      });
      console.log(`  ⚠️  TODO/FIXME 있음`);
    }
    
    if (content.match(/console\.log/g)?.length > 5) {
      stats.warnings.push({
        file: fileName,
        warning: '디버그 로그 과다 (5개 이상)'
      });
      console.log(`  ⚠️  console.log 많음`);
    }
    
    // 5. 긴 함수 경고 (500줄 이상)
    const lines = content.split('\n').length;
    if (lines > 500) {
      stats.warnings.push({
        file: fileName,
        warning: `파일이 너무 큼 (${lines}줄)`
      });
      console.log(`  ⚠️  파일 크기: ${lines}줄`);
    }
    
    stats.validCommands++;
    
  } catch (error) {
    stats.syntaxErrors.push({
      file: fileName,
      error: error.message
    });
    console.log(`  ❌ Syntax Error: ${error.message}`);
  }
}

async function runStaticAnalysis() {
  console.log('🔍 홈랜드 디스코드 봇 정적 분석');
  console.log('═'.repeat(60));
  
  // 모든 명령어 파일 찾기
  const commandsDir = path.join(__dirname, 'src', 'commands');
  const files = fs.readdirSync(commandsDir)
    .filter(f => f.endsWith('.js'))
    .map(f => path.join(commandsDir, f));
  
  stats.totalCommands = files.length;
  console.log(`\n📂 총 ${stats.totalCommands}개 명령어 발견\n`);
  
  // 각 파일 테스트
  for (const file of files) {
    await testCommandFile(file);
  }
  
  // 결과 리포트
  console.log('\n' + '═'.repeat(60));
  console.log('📊 정적 분석 결과');
  console.log('═'.repeat(60));
  console.log(`✅ 유효한 명령어: ${stats.validCommands}/${stats.totalCommands}`);
  console.log(`❌ Syntax 에러: ${stats.syntaxErrors.length}개`);
  console.log(`⚠️  구조 문제: ${stats.structureErrors.length}개`);
  console.log(`💡 경고: ${stats.warnings.length}개`);
  
  if (stats.syntaxErrors.length > 0) {
    console.log('\n🐛 Syntax 에러:');
    stats.syntaxErrors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err.file}: ${err.error}`);
    });
  }
  
  if (stats.structureErrors.length > 0) {
    console.log('\n⚠️  구조 문제:');
    stats.structureErrors.slice(0, 10).forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err.file}: ${err.error}`);
    });
    if (stats.structureErrors.length > 10) {
      console.log(`  ... 외 ${stats.structureErrors.length - 10}개`);
    }
  }
  
  if (stats.warnings.length > 0) {
    console.log('\n💡 경고 (참고용):');
    stats.warnings.slice(0, 5).forEach((warn, idx) => {
      console.log(`  ${idx + 1}. ${warn.file}: ${warn.warning}`);
    });
    if (stats.warnings.length > 5) {
      console.log(`  ... 외 ${stats.warnings.length - 5}개`);
    }
  }
  
  // 판정
  console.log('\n' + '═'.repeat(60));
  const successRate = (stats.validCommands / stats.totalCommands) * 100;
  
  if (stats.syntaxErrors.length === 0) {
    console.log('🎉 완벽! Syntax 에러 없음');
  } else {
    console.log(`❌ Syntax 에러 ${stats.syntaxErrors.length}개 발견 - 수정 필요`);
  }
  
  if (successRate === 100) {
    console.log('✅ 모든 명령어 파일 유효');
  } else if (successRate >= 95) {
    console.log(`✅ ${successRate.toFixed(1)}% 유효 - 양호`);
  } else {
    console.log(`⚠️  ${successRate.toFixed(1)}% 유효 - 개선 필요`);
  }
  
  console.log('═'.repeat(60));
  
  // 다음 단계 안내
  console.log('\n📋 다음 단계:');
  console.log('1. ❌ Syntax 에러 수정');
  console.log('2. 🎮 로컬 Discord 봇 실행 (npm run dev)');
  console.log('3. 🧪 수동 테스트 (TEST_CHECKLIST.md 참고)');
  console.log('4. ✅ 형아 승인 받기');
  
  process.exit(stats.syntaxErrors.length > 0 ? 1 : 0);
}

runStaticAnalysis().catch(console.error);
