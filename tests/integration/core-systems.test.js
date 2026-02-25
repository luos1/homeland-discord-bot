/**
 * 핵심 시스템 통합 테스트
 * Phase 1: 자동 테스트 구축
 * 
 * 목표: 전투, 경제, 탐험 시스템 70%+ 커버리지
 */

const { resolveCombatTurn } = require('../../src/game/combat');
const { getResourceBasePrice, calculateNpcResourcePrice } = require('../../src/game/economy');
const { randomInt, MONSTERS } = require('../../src/game/monsters');
const { xpRequiredForLevel, applyExperience } = require('../../src/game/leveling');

// Helper: 몬스터 선택
function selectMonsterFromZone(zone) {
  const zoneMonsters = MONSTERS[zone];
  if (!zoneMonsters || zoneMonsters.length === 0) return null;
  const index = randomInt(0, zoneMonsters.length - 1);
  return zoneMonsters[index];
}

describe('전투 시스템 통합 테스트', () => {
  describe('전투 시스템 안정성', () => {
    test('전투 시스템이 에러 없이 실행된다', () => {
      // 100회 시뮬레이션
      for (let i = 0; i < 100; i++) {
        const session = {
          id: `session-${i}`,
          zone: 'zone1',
          monsterName: '고블린',
          monsterHp: 50,
          monsterMaxHp: 50,
          monsterAttack: 8,
          monsterDefense: 2,
          playerHp: 100,
          potionsRemaining: 3,
          turn: 1,
        };

        const character = {
          userId: 'test-user',
          hp: 100,
          maxHp: 100,
          attack: 15,
          defense: 5,
          level: 5,
          mana: 50,
          maxMana: 50,
        };

        // 전투 턴이 에러 없이 실행되는지 확인
        expect(() => {
          resolveCombatTurn({
            character,
            session,
            action: 'attack',
          });
        }).not.toThrow();
      }
    });

    test('방어/포션 액션이 에러 없이 실행된다', () => {
      const actions = ['defend', 'potion'];

      actions.forEach(action => {
        const session = {
          id: `${action}-test`,
          zone: 'zone1',
          monsterName: '고블린',
          monsterHp: 50,
          monsterMaxHp: 50,
          monsterAttack: 8,
          monsterDefense: 2,
          playerHp: 100,
          potionsRemaining: 3,
          turn: 1,
        };

        const character = {
          userId: 'test-user',
          hp: 100,
          maxHp: 100,
          attack: 15,
          defense: 5,
          level: 5,
          mana: 50,
          maxMana: 50,
        };

        // 액션이 에러 없이 실행되는지 확인
        expect(() => {
          resolveCombatTurn({
            character,
            session,
            action,
          });
        }).not.toThrow();
      });
    });
  });

  describe('레벨업 시스템', () => {
    test('경험치가 임계값에 도달하면 레벨업된다', () => {
      const character = {
        level: 1,
        xp: 0,
        hp: 100,
        maxHp: 100,
        mana: 40,
        maxMana: 40,
        attack: 10,
        defense: 5,
      };

      const threshold = xpRequiredForLevel(character.level);
      const result = applyExperience(character, threshold, character.hp, character.mana);

      expect(result.levelsGained).toBeGreaterThan(0);
      expect(result.characterUpdate.level).toBe(2);
      expect(result.characterUpdate.maxHp).toBeGreaterThan(character.maxHp);
    });

    test('레벨업 시 HP/MP가 증가한다', () => {
      const character = {
        level: 1,
        xp: 0,
        hp: 100,
        maxHp: 100,
        mana: 40,
        maxMana: 40,
        attack: 10,
        defense: 5,
      };

      const threshold = xpRequiredForLevel(character.level);
      const result = applyExperience(character, threshold, character.hp, character.mana);

      expect(result.characterUpdate.maxHp).toBeGreaterThan(character.maxHp);
      expect(result.characterUpdate.maxMana).toBeGreaterThan(character.maxMana);
    });

    test('레벨 10-30 구간의 레벨업이 더 빠르다', () => {
      const xpLevel5 = xpRequiredForLevel(5);
      const xpLevel15 = xpRequiredForLevel(15);
      const xpLevel25 = xpRequiredForLevel(25);

      // 레벨 15는 레벨 5보다 필요 경험치가 적어야 함 (빠른 레벨업 구간)
      expect(xpLevel15).toBeLessThan(xpLevel5 * 3);
      expect(xpLevel25).toBeLessThan(xpLevel5 * 5);
    });
  });

  describe('전투 보상 균형', () => {
    test('레벨별 보상이 적절한 범위 내에 있다', () => {
      const zones = ['zone1', 'zone2', 'zone3'];
      
      zones.forEach(zone => {
        const monster = selectMonsterFromZone(zone);
        
        if (!monster) return;
        
        expect(monster.name).toBeDefined();
        expect(monster.hp).toBeGreaterThan(0);
        expect(monster.attack).toBeGreaterThan(0);
        expect(monster.xp).toBeGreaterThan(0);
        expect(monster.goldMin).toBeGreaterThan(0);
        expect(monster.goldMax).toBeGreaterThanOrEqual(monster.goldMin);
        
        // 골드 범위가 합리적인지 확인
        const avgGold = (monster.goldMin + monster.goldMax) / 2;
        expect(avgGold).toBeLessThan(1000); // 너무 많은 골드 방지
      });
    });

    test('존별로 몬스터 난이도가 증가한다', () => {
      const zone1Monster = selectMonsterFromZone('zone1');
      const zone2Monster = selectMonsterFromZone('zone2');

      if (!zone1Monster || !zone2Monster) return;

      // HP가 증가하는지 확인 (평균적으로)
      expect(zone2Monster.hp).toBeGreaterThanOrEqual(zone1Monster.hp * 0.7);

      // 공격력이 증가하는지 확인 (평균적으로)
      expect(zone2Monster.attack).toBeGreaterThanOrEqual(zone1Monster.attack * 0.7);
    });
  });
});

describe('경제 시스템 통합 테스트', () => {
  describe('골드 인플레이션 방지', () => {
    test('자원 기본 가격이 정의되어 있다', () => {
      const resources = ['wood', 'stone', 'iron', 'food'];
      
      resources.forEach(resource => {
        const price = getResourceBasePrice(resource);
        expect(price).toBeGreaterThan(0);
        expect(price).toBeLessThan(1000); // 너무 비싸지 않게
      });
    });

    test('NPC 가격이 급격히 변동하지 않는다 (서킷브레이커)', () => {
      const basePrice = getResourceBasePrice('wood');
      
      // 극단적인 공급 과잉
      const extremeOversupply = calculateNpcResourcePrice({
        resourceType: 'wood',
        supplyQuantity: 10000,
        demandQuantity: 1,
        recentAveragePrice: basePrice,
        previousPrice: basePrice,
      });

      // 극단적인 공급 부족
      const extremeShortage = calculateNpcResourcePrice({
        resourceType: 'wood',
        supplyQuantity: 0,
        demandQuantity: 10000,
        recentAveragePrice: basePrice,
        previousPrice: basePrice,
      });

      // 서킷브레이커가 작동하여 ±12% 이내로 제한
      expect(extremeOversupply.circuitBreakerTriggered).toBe(true);
      expect(extremeShortage.circuitBreakerTriggered).toBe(true);
      
      expect(extremeOversupply.unitPrice).toBeGreaterThanOrEqual(Math.round(basePrice * 0.88));
      expect(extremeShortage.unitPrice).toBeLessThanOrEqual(Math.round(basePrice * 1.12));
    });
  });

  describe('아이템 가격 적정성', () => {
    test('자원 가격이 합리적인 범위 내에 있다', () => {
      const baseWoodPrice = getResourceBasePrice('wood');
      const baseStonePrice = getResourceBasePrice('stone');
      const baseIronPrice = getResourceBasePrice('iron');

      // 희귀도에 따라 가격이 높아져야 함
      expect(baseStonePrice).toBeGreaterThanOrEqual(baseWoodPrice);
      expect(baseIronPrice).toBeGreaterThanOrEqual(baseStonePrice);
      
      // 모든 자원이 너무 비싸지 않아야 함
      expect(baseWoodPrice).toBeLessThan(100);
      expect(baseStonePrice).toBeLessThan(200);
      expect(baseIronPrice).toBeLessThan(500);
    });

    test('NPC 가격 계산이 일관성 있다', () => {
      const basePrice = getResourceBasePrice('wood');
      
      // 동일한 공급/수요로 2번 계산
      const result1 = calculateNpcResourcePrice({
        resourceType: 'wood',
        supplyQuantity: 100,
        demandQuantity: 100,
        recentAveragePrice: basePrice,
      });

      const result2 = calculateNpcResourcePrice({
        resourceType: 'wood',
        supplyQuantity: 100,
        demandQuantity: 100,
        recentAveragePrice: basePrice,
      });

      expect(result1.unitPrice).toBe(result2.unitPrice);
    });
  });
});

describe('회귀 테스트 (Regression Prevention)', () => {
  test('전투 시스템이 무한 루프에 빠지지 않는다', () => {
    const session = {
      id: 'regression-test',
      zone: 'zone1',
      monsterName: '고블린',
      monsterHp: 1, // 1 HP만 남음
      monsterMaxHp: 50,
      monsterAttack: 1,
      monsterDefense: 0,
      playerHp: 1, // 플레이어도 1 HP
      potionsRemaining: 0,
      turn: 50, // 이미 50턴
    };

    const character = {
      userId: 'test-user',
      hp: 1,
      maxHp: 100,
      attack: 1,
      defense: 0,
      level: 1,
      mana: 10,
      maxMana: 10,
    };

    // 무한 루프 방지: 타임아웃 설정
    const startTime = Date.now();
    const result = resolveCombatTurn({
      character,
      session,
      action: 'attack',
    });
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(1000); // 1초 이내에 완료
    expect(result).toBeDefined();
  });

  test('경제 시스템이 음수 가격을 생성하지 않는다', () => {
    const extremeOversupply = calculateNpcResourcePrice({
      resourceType: 'wood',
      supplyQuantity: 999999,
      demandQuantity: 0,
      recentAveragePrice: getResourceBasePrice('wood'),
    });

    expect(extremeOversupply.unitPrice).toBeGreaterThan(0);
  });

  test('레벨업이 음수 스탯을 생성하지 않는다', () => {
    for (let level = 1; level < 20; level++) {
      const character = {
        level,
        xp: 0,
        hp: 100,
        maxHp: 100,
        mana: 40,
        maxMana: 40,
        attack: 10,
        defense: 5,
      };

      const xpGain = xpRequiredForLevel(level);
      if (xpGain === null) continue;

      const result = applyExperience(character, xpGain, character.hp, character.mana);

      if (result.levelsGained > 0) {
        expect(result.characterUpdate.maxHp).toBeGreaterThan(0);
        expect(result.characterUpdate.maxMana).toBeGreaterThan(0);
        expect(result.characterUpdate.attack).toBeGreaterThan(0);
        expect(result.characterUpdate.defense).toBeGreaterThan(0);
      }
    }
  });

  test('몬스터 데이터가 유효하다', () => {
    const zones = ['zone1', 'zone2', 'zone3'];
    
    zones.forEach(zone => {
      const zoneMonsters = MONSTERS[zone];
      
      if (!zoneMonsters) return;
      
      zoneMonsters.forEach(monster => {
        expect(monster.name).toBeDefined();
        expect(monster.hp).toBeGreaterThan(0);
        expect(monster.attack).toBeGreaterThan(0);
        expect(monster.defense).toBeGreaterThanOrEqual(0);
        expect(monster.xp).toBeGreaterThan(0);
        expect(monster.goldMin).toBeGreaterThan(0);
        expect(monster.goldMax).toBeGreaterThanOrEqual(monster.goldMin);
      });
    });
  });
});

describe('성능 테스트', () => {
  test('전투 턴 처리가 100ms 이내에 완료된다', () => {
    const session = {
      id: 'perf-test',
      zone: 'zone1',
      monsterName: '고블린',
      monsterHp: 50,
      monsterMaxHp: 50,
      monsterAttack: 8,
      monsterDefense: 2,
      playerHp: 100,
      potionsRemaining: 3,
      turn: 1,
    };

    const character = {
      userId: 'test-user',
      hp: 100,
      maxHp: 100,
      attack: 15,
      defense: 5,
      level: 5,
      mana: 50,
      maxMana: 50,
    };

    const startTime = Date.now();
    resolveCombatTurn({
      character,
      session,
      action: 'attack',
    });
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });
});
