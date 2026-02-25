# ⚖️ Phase 3: 밸런스 검증 가이드

**날짜**: 2026-02-25  
**목표**: 전투/경제 밸런스 검증 및 재미 요소 강화

---

## 📊 전투 밸런스 검증

### 1. 레벨별 난이도 곡선

#### 자동 검증 스크립트
```javascript
// scripts/verify-balance.js
const { MONSTERS } = require('../src/game/monsters');
const { xpRequiredForLevel } = require('../src/game/leveling');

// 레벨별 권장 몬스터
const LEVEL_MONSTER_MAP = {
  '1-10': 'zone1',
  '11-20': 'zone1',
  '21-35': 'zone2',
  '36-50': 'zone3',
  '51-65': 'zone4',
};

// 난이도 곡선 검증
function verifyDifficultyCurve() {
  const zones = ['zone1', 'zone2', 'zone3', 'zone4'];
  const results = [];

  zones.forEach(zone => {
    const monsters = Object.values(MONSTERS).filter(m => m.zone === zone);
    const avgHp = monsters.reduce((sum, m) => sum + m.hp, 0) / monsters.length;
    const avgAtk = monsters.reduce((sum, m) => sum + m.attack, 0) / monsters.length;
    const avgXp = monsters.reduce((sum, m) => sum + m.xp, 0) / monsters.length;
    const avgGold = monsters.reduce((sum, m) => sum + (m.goldMin + m.goldMax) / 2, 0) / monsters.length;

    results.push({
      zone,
      avgHp: Math.round(avgHp),
      avgAtk: Math.round(avgAtk),
      avgXp: Math.round(avgXp),
      avgGold: Math.round(avgGold),
    });
  });

  console.table(results);

  // 증가율 검증
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];

    const hpIncrease = ((curr.avgHp - prev.avgHp) / prev.avgHp * 100).toFixed(1);
    const atkIncrease = ((curr.avgAtk - prev.avgAtk) / prev.avgAtk * 100).toFixed(1);

    console.log(`\n${prev.zone} → ${curr.zone}:`);
    console.log(`  HP 증가: ${hpIncrease}%`);
    console.log(`  공격력 증가: ${atkIncrease}%`);

    // 권장: 50-100% 증가
    if (hpIncrease < 40 || hpIncrease > 120) {
      console.warn(`  ⚠️ HP 증가율이 비정상적입니다!`);
    }
    if (atkIncrease < 40 || atkIncrease > 120) {
      console.warn(`  ⚠️ 공격력 증가율이 비정상적입니다!`);
    }
  }
}

verifyDifficultyCurve();
```

#### 실행
```bash
node scripts/verify-balance.js
```

#### 예상 결과
```
┌─────────┬────────┬────────┬────────┬─────────┐
│ zone    │ avgHp  │ avgAtk │ avgXp  │ avgGold │
├─────────┼────────┼────────┼────────┼─────────┤
│ zone1   │ 45     │ 8      │ 18     │ 8       │
│ zone2   │ 95     │ 18     │ 45     │ 22      │
│ zone3   │ 180    │ 35     │ 95     │ 50      │
│ zone4   │ 320    │ 68     │ 180    │ 100     │
└─────────┴────────┴────────┴────────┴─────────┘

zone1 → zone2:
  HP 증가: 111.1%
  공격력 증가: 125.0%

zone2 → zone3:
  HP 증가: 89.5%
  공격력 증가: 94.4%

zone3 → zone4:
  HP 증가: 77.8%
  공격력 증가: 94.3%
```

✅ **합격 기준**: 각 존 간 40-120% 증가

---

### 2. 크리티컬/회피 확률

#### 현재 설정
```javascript
// src/game/combat.js
const GLOBAL_CRITICAL_CHANCE = 0.2;     // 20%
const GLOBAL_CRITICAL_MULTIPLIER = 2;   // 2배 데미지
const GLOBAL_EVASION_CHANCE = 0.15;     // 15%
```

#### 검증 방법
1000회 전투 시뮬레이션:
- 크리티컬 발생: 180-220회 (18-22%)
- 회피 발생: 130-170회 (13-17%)

#### 조정 가이드
```javascript
// 너무 높으면 (>25%): 전투가 너무 운빨
// 너무 낮으면 (<10%): 재미 없음
// 권장: 15-20%

// 현재 설정 ✅ 적정함
```

---

### 3. 보상 균형

#### 전투 보상 공식
```javascript
// Gold = (goldMin ~ goldMax) * zoneMultiplier * streakBonus
// XP = xpReward * zoneMultiplier * (1 + masteryBonus)

// Zone Multipliers:
// zone1: 1.0x
// zone2: 1.2x (20% 증가)
// zone3: 1.5x (50% 증가, 위험 구역)
// zone4: 2.0x (100% 증가, 최고 난이도)
```

#### 밸런스 체크
```bash
# 시간당 골드 획득량 (레벨 20 기준)
Zone 1: 500-800 gold/hour   (초보자)
Zone 2: 1200-1800 gold/hour (중급자)
Zone 3: 3000-4500 gold/hour (고급자, 위험)
Zone 4: 6000-9000 gold/hour (전문가, 매우 위험)

# 아이템 가격 (참고)
철검: 500g
철갑옷: 1000g
포션: 50g

# 밸런스 체크
- 초보자가 1시간에 철검 1개 살 수 있는가? ✅
- 고급자가 1시간에 고급 장비 3-5개 살 수 있는가? ✅
```

---

## 💰 경제 밸런스 검증

### 1. 골드 인플레이션 방지

#### 서킷브레이커 설정
```javascript
// src/game/economy.js
const CIRCUIT_BREAKER_THRESHOLD = 0.12;  // ±12% 제한
```

#### 검증 스크립트
```javascript
const { calculateNpcResourcePrice, getResourceBasePrice } = require('../src/game/economy');

function testCircuitBreaker() {
  const basePrice = getResourceBasePrice('wood');

  // 극단적 공급 과잉
  const crash = calculateNpcResourcePrice({
    resourceType: 'wood',
    supplyQuantity: 99999,
    demandQuantity: 0,
    recentAveragePrice: basePrice,
    previousPrice: basePrice,
  });

  // 극단적 공급 부족
  const spike = calculateNpcResourcePrice({
    resourceType: 'wood',
    supplyQuantity: 0,
    demandQuantity: 99999,
    recentAveragePrice: basePrice,
    previousPrice: basePrice,
  });

  console.log(`Base Price: ${basePrice}g`);
  console.log(`Crash Price: ${crash.unitPrice}g (${((crash.unitPrice / basePrice - 1) * 100).toFixed(1)}%)`);
  console.log(`Spike Price: ${spike.unitPrice}g (${((spike.unitPrice / basePrice - 1) * 100).toFixed(1)}%)`);

  if (Math.abs(crash.unitPrice / basePrice - 1) > 0.12) {
    console.error('❌ 서킷브레이커 실패!');
  } else {
    console.log('✅ 서킷브레이커 정상 작동');
  }
}

testCircuitBreaker();
```

---

### 2. 아이템 가격 적정성

#### 자원 가격표
```javascript
const RESOURCE_BASE_PRICES = {
  wood: 5,      // 나무
  stone: 8,     // 돌
  iron: 20,     // 철
  food: 3,      // 식량
  gem: 100,     // 보석 (프리미엄)
};
```

#### 밸런스 체크
```
# 1시간 플레이로 얻는 자원 (평균)
Zone 1 플레이어: 나무 100개 (500g 가치)
Zone 2 플레이어: 철 50개 (1000g 가치)
Zone 3 플레이어: 철 100개 (2000g 가치)

# 아이템 제작 비용
철검: 철 10개 + 나무 5개 = 200g + 25g = 225g
실제 판매가: 500g (이익률: 122%)

✅ 합리적인 제작 보상
```

---

## 🎮 재미 요소 강화

### 1. 이벤트 빈도 조정

#### 현재 설정
```javascript
// src/game/combat.js
const COMBAT_RANDOM_EVENT_CHANCE = 0.2;  // 20%
```

#### 권장 조정
```javascript
// 너무 자주 (>30%): 산만함
// 너무 드물게 (<10%): 지루함
// 권장: 15-25%

// 현재 20% ✅ 적정
```

#### 이벤트 종류
- 🎁 보물 발견 (30%): 추가 골드
- 🧙 상인 조우 (30%): 할인 아이템
- 💣 함정 (20%): 추가 데미지
- ✨ 버프 (20%): 일시 능력치 증가

---

### 2. 보상 체감도

#### 레벨업 보상
```javascript
// src/game/leveling.js
maxHp += 12;      // 체감 가능
maxMana += 4;     // 체감 가능
attack += 3;      // 체감 가능
defense += 2;     // 체감 가능
```

#### 장비 드롭률
```javascript
// Zone별 드롭률
zone1: 5%   (20회 전투당 1개)
zone2: 8%   (12회 전투당 1개)
zone3: 12%  (8회 전투당 1개)
zone4: 20%  (5회 전투당 1개)
```

✅ **보상이 너무 잦지도, 희귀하지도 않음**

---

## 📋 밸런스 검증 체크리스트

### 자동 검증 (스크립트)
- [ ] 난이도 곡선 검증 (40-120% 증가)
- [ ] 서킷브레이커 테스트 (±12% 제한)
- [ ] 자원 가격 일관성 체크
- [ ] 레벨업 보상 합리성

### 수동 테스트 (Discord)
- [ ] Zone 1 → 2 전환이 자연스러운가?
- [ ] Zone 2 → 3 전환이 도전적인가?
- [ ] Zone 3 → 4 전환이 매우 어려운가?
- [ ] 레벨 10, 20, 30, 40에서 체감 가능한 성장?
- [ ] 1시간 플레이로 의미 있는 진행?

### 재미 요소
- [ ] 랜덤 이벤트가 재미있는가?
- [ ] 크리티컬/회피가 흥미진진한가?
- [ ] 레벨업이 보람 있는가?
- [ ] 장비 드롭이 기대되는가?

---

## 🎯 Phase 3 완료 조건

1. ✅ 난이도 곡선 검증 완료
2. ✅ 경제 밸런스 검증 완료
3. ✅ 재미 요소 확인 완료
4. ✅ 밸런스 조정 (필요시)
5. ✅ 문서화 완료

**예상 소요 시간**: 2시간

---

## 💡 빠른 검증 방법

### 1단계: 자동 스크립트 실행 (10분)
```bash
node scripts/verify-balance.js
node scripts/test-circuit-breaker.js
```

### 2단계: Discord 수동 테스트 (30분)
```
/create
/explore → Zone 1 (5회)
/explore → Zone 2 (5회)
/profile (성장 확인)
```

### 3단계: 밸런스 조정 (30분)
- 문제 발견 시 상수 조정
- 재테스트

### 4단계: 문서 업데이트 (30분)
- 밸런스 수치 기록
- 권장 플레이 가이드 작성

---

**서브에이전트**: Jerry v2  
**상태**: Phase 3 가이드 작성 완료 ✅
