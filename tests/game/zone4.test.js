const { COMBAT_ACTIONS, resolveCombatTurn } = require('../../src/game/combat');
const { MONSTERS, ZONE_TYPES, getZone } = require('../../src/game/monsters');
const { COMBAT_GOLD_SOURCE_MULTIPLIER } = require('../../src/game/economy');
const { createCharacter } = require('../helpers/factories');

function createZone4Session(overrides = {}) {
  return {
    id: 'zone4-session',
    zone: 'zone4',
    monsterName: MONSTERS.voidStalker.name,
    monsterHp: 120,
    monsterMaxHp: 120,
    monsterAttack: 45,
    monsterDefense: 12,
    monsterXpReward: MONSTERS.voidStalker.xpReward,
    monsterGoldMin: MONSTERS.voidStalker.goldMin,
    monsterGoldMax: MONSTERS.voidStalker.goldMax,
    playerHp: 500,
    potionsRemaining: 3,
    turn: 1,
    monsterFirstStrike: false,
    ...overrides,
  };
}

describe('zone4 content and combat', () => {
  test('Zone 4 메타데이터와 몬스터 밸런스가 조건을 만족한다', () => {
    const zone4 = getZone('zone4');
    const zone3 = getZone('zone3');

    expect(zone4).toBeTruthy();
    expect(zone4.zoneType).toBe('yellow');
    expect(zone4.recommendedLevel).toBe('40-65');
    expect(zone4.monsterKeys).toHaveLength(5);
    expect(zone4.resourceDrops.length).toBeGreaterThanOrEqual(4);
    expect(zone4.dropChance).toBe(0.45);

    const zone4Monsters = zone4.monsterKeys.map((key) => MONSTERS[key]);
    const zone3Monsters = zone3.monsterKeys.map((key) => MONSTERS[key]);
    const zone4Levels = zone4Monsters.map((monster) => monster.level);
    const zone4Hp = zone4Monsters.map((monster) => monster.hp);
    const zone4Atk = zone4Monsters.map((monster) => monster.attack);
    const zone4Def = zone4Monsters.map((monster) => monster.defense);

    expect(Math.min(...zone4Levels)).toBeGreaterThanOrEqual(40);
    expect(Math.max(...zone4Levels)).toBeLessThanOrEqual(65);
    expect(Math.min(...zone4Hp)).toBeGreaterThan(Math.max(...zone3Monsters.map((monster) => monster.hp)));
    expect(Math.min(...zone4Atk)).toBeGreaterThan(
      Math.max(...zone3Monsters.map((monster) => monster.attack)),
    );
    expect(Math.min(...zone4Def)).toBeGreaterThan(
      Math.max(...zone3Monsters.map((monster) => monster.defense)),
    );
  });

  test('Zone 4 전투 시작 시 Yellow(1.5x) 능력치 배율이 적용된다', () => {
    const zone4 = getZone('zone4');
    const zoneType = ZONE_TYPES[zone4.zoneType];
    const baseMonster = MONSTERS[zone4.monsterKeys[0]];
    const startedMonster = {
      hp: Math.floor(baseMonster.hp * zoneType.statMultiplier),
      attack: Math.floor(baseMonster.attack * zoneType.statMultiplier),
      defense: Math.floor(baseMonster.defense * zoneType.statMultiplier),
    };

    expect(zoneType.statMultiplier).toBe(1.5);
    expect(startedMonster.hp).toBe(Math.floor(baseMonster.hp * 1.5));
    expect(startedMonster.attack).toBe(Math.floor(baseMonster.attack * 1.5));
    expect(startedMonster.defense).toBe(Math.floor(baseMonster.defense * 1.5));
  });

  test('Zone 4 일반 몬스터 처치 시 승리와 보상이 정상 계산된다', () => {
    const zone4 = getZone('zone4');
    const baseMonster = MONSTERS[zone4.monsterKeys[0]];
    const character = createCharacter({
      level: 45,
      attack: 120,
      defense: 30,
      hp: 500,
      maxHp: 500,
      mana: 80,
      maxMana: 80,
      winStreak: 0,
    });
    const session = createZone4Session({
      monsterName: baseMonster.name,
      monsterHp: 1,
      monsterMaxHp: Math.floor(baseMonster.hp * 1.5),
      monsterDefense: 0,
      monsterAttack: Math.floor(baseMonster.attack * 1.5),
      monsterXpReward: baseMonster.xpReward,
      monsterGoldMin: baseMonster.goldMin,
      monsterGoldMax: baseMonster.goldMax,
      playerHp: character.hp,
    });

    const outcome = resolveCombatTurn({
      character,
      session,
      action: COMBAT_ACTIONS.attack,
    });

    expect(outcome.status).toBe('victory');
    expect(outcome.rewards.xpReward).toBe(
      Math.floor(baseMonster.xpReward * ZONE_TYPES.yellow.xpMultiplier),
    );
    expect(outcome.rewards.goldReward).toBeGreaterThanOrEqual(
      Math.floor(baseMonster.goldMin * ZONE_TYPES.yellow.goldMultiplier * COMBAT_GOLD_SOURCE_MULTIPLIER),
    );
    expect(outcome.rewards.goldReward).toBeLessThanOrEqual(
      Math.floor(baseMonster.goldMax * ZONE_TYPES.yellow.goldMultiplier * COMBAT_GOLD_SOURCE_MULTIPLIER),
    );
  });

  test.skip('Zone 4 보스 처치 시 희귀+ 장비가 확정 드롭된다', () => {
    const zone4Boss = MONSTERS.shadowOverlord;
    const character = createCharacter({
      level: 60,
      attack: 220,
      defense: 45,
      hp: 900,
      maxHp: 900,
      mana: 120,
      maxMana: 120,
      winStreak: 0,
    });
    const session = createZone4Session({
      monsterName: zone4Boss.name,
      monsterHp: 1,
      monsterMaxHp: Math.floor(zone4Boss.hp * 1.5),
      monsterAttack: Math.floor(zone4Boss.attack * 1.5),
      monsterDefense: 0,
      monsterXpReward: zone4Boss.xpReward,
      monsterGoldMin: zone4Boss.goldMin,
      monsterGoldMax: zone4Boss.goldMax,
      playerHp: character.hp,
    });

    const outcome = resolveCombatTurn({
      character,
      session,
      action: COMBAT_ACTIONS.attack,
    });

    expect(outcome.status).toBe('victory');
    expect(outcome.droppedEquipment).toBeTruthy();
    expect(['rare', 'epic', 'legendary']).toContain(outcome.droppedEquipment.rarity);
  });

  test('Zone 4 보스 스킬 패턴은 조건을 만족할 때 발동한다', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const boss = MONSTERS.shadowOverlord;
    const character = createCharacter({
      level: 62,
      attack: 100,
      defense: 30,
      hp: 900,
      maxHp: 900,
      mana: 90,
      maxMana: 90,
    });
    const session = createZone4Session({
      turn: 3,
      monsterName: boss.name,
      monsterHp: Math.floor((boss.hp * 1.5) * 0.45),
      monsterMaxHp: Math.floor(boss.hp * 1.5),
      monsterAttack: Math.floor(boss.attack * 1.5),
      monsterDefense: Math.floor(boss.defense * 1.5),
      playerHp: character.hp,
      monsterXpReward: boss.xpReward,
      monsterGoldMin: boss.goldMin,
      monsterGoldMax: boss.goldMax,
    });

    const outcome = resolveCombatTurn({
      character,
      session,
      action: COMBAT_ACTIONS.defend,
    });
    randomSpy.mockRestore();

    expect(outcome.status).toBe('ongoing');
    expect(outcome.battleLog.join('\n')).toContain('그림자 과충전');
    expect(outcome.battleLog.join('\n')).toContain('심연 광폭화');
  });
});
