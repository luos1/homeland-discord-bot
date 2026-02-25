#!/usr/bin/env node
/**
 * 에러 로그 분석기
 * 
 * bot.log에서 에러 패턴을 추출하고 분석합니다
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'bot.log');

const errorPatterns = {
  syntax: /SyntaxError|Unexpected token/gi,
  reference: /ReferenceError|is not defined/gi,
  type: /TypeError|Cannot read property/gi,
  prisma: /PrismaClient|Database error/gi,
  discord: /DiscordAPIError/gi,
  network: /ECONNREFUSED|ETIMEDOUT|fetch failed/gi,
  critical: /FATAL|CRITICAL|Unhandled/gi
};

const stats = {
  totalLines: 0,
  errorLines: 0,
  errorsByType: {},
  uniqueErrors: new Set(),
  recentErrors: []
};

function analyzeLog() {
  console.log('🔍 에러 로그 분석 중...\n');
  
  if (!fs.existsSync(LOG_FILE)) {
    console.log('⚠️  bot.log 파일이 없습니다');
    console.log('   봇을 실행한 적이 없거나 로그가 삭제되었습니다\n');
    console.log('✅ 이것은 좋은 신호입니다 (에러 로그가 없음)');
    return;
  }
  
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = content.split('\n');
  stats.totalLines = lines.length;
  
  console.log(`📄 총 ${stats.totalLines.toLocaleString()}줄 로그 발견\n`);
  
  // 각 패턴별 에러 찾기
  Object.keys(errorPatterns).forEach(type => {
    stats.errorsByType[type] = 0;
  });
  
  lines.forEach((line, idx) => {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('error') || lowerLine.includes('exception') || lowerLine.includes('fail')) {
      stats.errorLines++;
      
      // 패턴 매칭
      Object.keys(errorPatterns).forEach(type => {
        if (errorPatterns[type].test(line)) {
          stats.errorsByType[type]++;
        }
      });
      
      // 최근 에러 저장 (마지막 50개)
      if (stats.recentErrors.length < 50) {
        stats.recentErrors.push({
          line: idx + 1,
          content: line.trim()
        });
      }
    }
  });
  
  // 결과 출력
  console.log('═'.repeat(60));
  console.log('📊 에러 분석 결과');
  console.log('═'.repeat(60));
  console.log(`총 로그: ${stats.totalLines.toLocaleString()}줄`);
  console.log(`에러 관련 줄: ${stats.errorLines}줄 (${(stats.errorLines/stats.totalLines*100).toFixed(2)}%)`);
  
  console.log('\n🔍 에러 유형별 통계:');
  Object.keys(stats.errorsByType).forEach(type => {
    const count = stats.errorsByType[type];
    if (count > 0) {
      console.log(`  ❌ ${type}: ${count}개`);
    }
  });
  
  if (stats.errorLines === 0) {
    console.log('\n🎉 에러 없음! 로그가 깨끗합니다');
  } else if (stats.errorLines < 10) {
    console.log('\n✅ 에러가 매우 적습니다 (10개 미만)');
  } else if (stats.errorLines < 50) {
    console.log('\n⚠️  일부 에러 있음 (10-50개) - 검토 권장');
  } else {
    console.log('\n❌ 에러 다수 발견 (50개 이상) - 수정 필요');
  }
  
  // 최근 에러 샘플
  if (stats.recentErrors.length > 0) {
    console.log('\n📝 최근 에러 샘플 (최대 5개):');
    stats.recentErrors.slice(-5).forEach((err, idx) => {
      const preview = err.content.substring(0, 100);
      console.log(`  ${idx + 1}. [줄 ${err.line}] ${preview}${err.content.length > 100 ? '...' : ''}`);
    });
  }
  
  console.log('\n═'.repeat(60));
  console.log('💡 권장사항:');
  
  if (stats.errorsByType.critical > 0) {
    console.log('  🚨 CRITICAL 에러 발견 - 즉시 수정 필요');
  }
  if (stats.errorsByType.prisma > 0) {
    console.log('  🗄️  데이터베이스 관련 에러 - DB 연결 확인 필요');
  }
  if (stats.errorsByType.network > 0) {
    console.log('  🌐 네트워크 에러 - Discord API 연결 확인');
  }
  if (stats.errorLines === 0) {
    console.log('  ✅ 에러 로그 없음 - 안정적!');
  } else if (stats.errorLines < 10) {
    console.log('  ✅ 에러가 적음 - 양호한 상태');
  }
  
  console.log('═'.repeat(60));
}

analyzeLog();
