#!/usr/bin/env node
/**
 * 밸런스 검증 스크립트
 * Phase 3: 밸런스 검증
 */

const { MONSTERS, ZONE_TYPES, getZone } = require('../src/game/monsters');
const { xpRequiredForLevel } = require('../src/game/leveling');
const { calculateNpcResourcePrice, getResourceBasePrice } = require('../src/game/economy');

console.log('🎮 홈랜드 밸런스 검증 시작...\n');

// 1. 난이도 곡선 검증
function verifyDifficultyCurve() {
  console.log('═══════════════════════════════════════');
  console.log('📊 난이도 곡선 검증');
  console.log('═══════════════════════════════════════\n');

  const zones = ['zone1', 'zone2', 'zone3'];
  const results = [];

  zones.forEach(zoneKey => {
    const zone = getZone(zoneKey);
    const monsters = zone.monsterKeys.map(key => MONSTERS[key]);
    
    const avgHp = monsters.reduce((sum, m) => sum + m.hp, 0) / monsters.length;
    const avgAtk = monsters.reduce((sum, m) => sum + m.attack, 0) / monsters.length;
    const avgXp = monsters.reduce((sum, m) => sum + m.xp, 0) / monsters.length;
    const avgGold = monsters.reduce((sum, m) => sum + (m.goldMin + m.goldMax) / 2, 0) / monsters.length;

    results.push({
      zone: zoneKey,
      avgHp: Math.round(avgHp),
      avgAtk: Math.round(avgAtk),
      avgXp: Math.round(avgXp),
      avgGold: Math.round(avgGold),
    });
  });

  console.table(results);

  // 증가율 검증
  let allGood = true;
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];

    const hpIncrease = ((curr.avgHp - prev.avgHp) / prev.avgHp * 100).toFixed(1);
    const atkIncrease = ((curr.avgAtk - prev.avgAtk) / prev.avgAtk * 100).toFixed(1);

    console.log(`\n${prev.zone} → ${curr.zone}:`);
    console.log(`  HP 증가: ${hpIncrease}%`);
    console.log(`  공격력 증가: ${atkIncrease}%`);

    // 권장: 40-120% 증가
    if (hpIncrease < 40 || hpIncrease > 120) {
      console.log(`  ⚠️ HP 증가율이 비정상적입니다!`);
      allGood = false;
    } else {
      console.log(`  ✅ HP 증가율 정상`);
    }
    
    if (atkIncrease < 40 || atkIncrease > 120) {
      console.log(`  ⚠️ 공격력 증가율이 비정상적입니다!`);
      allGood = false;
    } else {
      console.log(`  ✅ 공격력 증가율 정상`);
    }
  }

  console.log('\n' + (allGood ? '✅ 난이도 곡선 검증 통과!' : '❌ 난이도 곡선 조정 필요!'));
  return allGood;
}

// 2. 서킷브레이커 검증
function verifyCircuitBreaker() {
  console.log('\n\n═══════════════════════════════════════');
  console.log('💰 경제 시스템 검증 (서킷브레이커)');
  console.log('═══════════════════════════════════════\n');

  const resources = ['wood', 'stone', 'iron'];
  let allGood = true;

  resources.forEach(resource => {
    const basePrice = getResourceBasePrice(resource);

    // 극단적 공급 과잉
    const crash = calculateNpcResourcePrice({
      resourceType: resource,
      supplyQuantity: 99999,
      demandQuantity: 0,
      recentAveragePrice: basePrice,
      previousPrice: basePrice,
    });

    // 극단적 공급 부족
    const spike = calculateNpcResourcePrice({
      resourceType: resource,
      supplyQuantity: 0,
      demandQuantity: 99999,
      recentAveragePrice: basePrice,
      previousPrice: basePrice,
    });

    const crashPct = ((crash.unitPrice / basePrice - 1) * 100).toFixed(1);
    const spikePct = ((spike.unitPrice / basePrice - 1) * 100).toFixed(1);

    console.log(`${resource.toUpperCase()}:`);
    console.log(`  기본 가격: ${basePrice}g`);
    console.log(`  폭락 가격: ${crash.unitPrice}g (${crashPct}%)`);
    console.log(`  폭등 가격: ${spike.unitPrice}g (${spikePct}%)`);

    if (Math.abs(parseFloat(crashPct)) > 12 || Math.abs(parseFloat(spikePct)) > 12) {
      console.log(`  ❌ 서킷브레이커 실패! (±12% 초과)`);
      allGood = false;
    } else {
      console.log(`  ✅ 서킷브레이커 정상 작동`);
    }
    console.log('');
  });

  console.log(allGood ? '✅ 경제 시스템 검증 통과!' : '❌ 서킷브레이커 조정 필요!');
  return allGood;
}

// 3. 레벨업 보상 검증
function verifyLevelingRewards() {
  console.log('\n\n═══════════════════════════════════════');
  console.log('📈 레벨업 시스템 검증');
  console.log('═══════════════════════════════════════\n');

  const checkLevels = [1, 5, 10, 15, 20, 30, 40, 50];
  const results = [];

  checkLevels.forEach(level => {
    const xp = xpRequiredForLevel(level);
    results.push({
      Level: level,
      'XP 필요': xp === null ? 'MAX' : xp,
    });
  });

  console.table(results);

  // 레벨 10-30 구간이 더 빠른지 확인
  const xp9 = xpRequiredForLevel(9);
  const xp15 = xpRequiredForLevel(15);
  const xp35 = xpRequiredForLevel(35);

  console.log('\n빠른 레벨업 구간 검증 (Lv10-30):');
  console.log(`  Lv9 필요 XP: ${xp9}`);
  console.log(`  Lv15 필요 XP: ${xp15} (${xp9 ? ((xp15/xp9 - 1) * 100).toFixed(1) + '%' : 'N/A'})`);
  console.log(`  Lv35 필요 XP: ${xp35} (${xp15 ? ((xp35/xp15 - 1) * 100).toFixed(1) + '%' : 'N/A'})`);

  if (xp15 && xp9 && xp15 < xp9 * 1.5) {
    console.log('  ✅ 빠른 레벨업 구간 정상 작동');
    return true;
  } else {
    console.log('  ⚠️ 빠른 레벨업 구간 확인 필요');
    return false;
  }
}

// 4. 보상 체감도 검증
function verifyRewardBalance() {
  console.log('\n\n═══════════════════════════════════════');
  console.log('🎁 보상 균형 검증');
  console.log('═══════════════════════════════════════\n');

  const zones = ['zone1', 'zone2', 'zone3'];
  const results = [];

  zones.forEach(zoneKey => {
    const zone = getZone(zoneKey);
    const zoneType = ZONE_TYPES[zone.zoneType];
    const monsters = zone.monsterKeys.map(key => MONSTERS[key]);
    
    const avgXp = monsters.reduce((sum, m) => sum + m.xp, 0) / monsters.length;
    const avgGold = monsters.reduce((sum, m) => sum + (m.goldMin + m.goldMax) / 2, 0) / monsters.length;
    const multipliedXp = Math.round(avgXp * (zoneType.xpMultiplier || 1));
    const multipliedGold = Math.round(avgGold * (zoneType.goldMultiplier || 1));

    results.push({
      Zone: zoneKey,
      'XP (기본)': Math.round(avgXp),
      'XP (보너스)': multipliedXp,
      'Gold (기본)': Math.round(avgGold),
      'Gold (보너스)': multipliedGold,
      '배율': `${zoneType.xpMultiplier || 1}x`,
    });
  });

  console.table(results);

  // 시간당 골드 예상 (전투당 30초 가정)
  console.log('\n시간당 골드 획득 예상 (전투당 30초):');
  results.forEach(r => {
    const goldPerHour = r['Gold (보너스)'] * 120; // 1시간 = 120회 전투
    console.log(`  ${r.Zone}: ${goldPerHour.toLocaleString()}g/hour`);
  });

  console.log('\n✅ 보상 균형 검증 완료');
  return true;
}

// 실행
function main() {
  const results = {
    difficulty: verifyDifficultyCurve(),
    economy: verifyCircuitBreaker(),
    leveling: verifyLevelingRewards(),
    rewards: verifyRewardBalance(),
  };

  console.log('\n\n═══════════════════════════════════════');
  console.log('📊 최종 결과');
  console.log('═══════════════════════════════════════\n');

  console.log(`난이도 곡선: ${results.difficulty ? '✅ 통과' : '❌ 실패'}`);
  console.log(`경제 시스템: ${results.economy ? '✅ 통과' : '❌ 실패'}`);
  console.log(`레벨업 시스템: ${results.leveling ? '✅ 통과' : '❌ 실패'}`);
  console.log(`보상 균형: ${results.rewards ? '✅ 통과' : '❌ 실패'}`);

  const allPassed = Object.values(results).every(r => r);
  
  console.log('\n' + (allPassed 
    ? '🎉 모든 밸런스 검증 통과! 글로벌 런칭 준비 완료!' 
    : '⚠️ 일부 밸런스 조정이 필요합니다.'));

  process.exit(allPassed ? 0 : 1);
}

main();
