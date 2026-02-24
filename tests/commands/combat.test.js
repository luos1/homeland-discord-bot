const {
  COMBAT_ACTIONS,
  createCombatActionRows,
  resolveCombatTurn,
} = require('../../src/game/combat');
const { createCharacter, createConsumable } = require('../helpers/factories');

function createSession(overrides = {}) {
  return {
    id: 'session-1',
    zone: 'zone1',
    monsterName: '고블린',
    monsterHp: 50,
    monsterMaxHp: 50,
    monsterAttack: 8,
    monsterDefense: 2,
    monsterXpReward: 20,
    monsterGoldMin: 5,
    monsterGoldMax: 10,
    playerHp: 100,
    potionsRemaining: 3,
    turn: 1,
    monsterFirstStrike: false,
    ...overrides,
  };
}

describe('combat flow', () => {
  test('전투 시작: 기본 액션 버튼이 생성된다', () => {
    const rows = createCombatActionRows('session-1', {
      character: createCharacter(),
    });

    const rowData = rows[0].toJSON();
    const customIds = rowData.components.map((component) => component.custom_id);

    expect(customIds).toContain('combat:attack:session-1');
    expect(customIds).toContain('combat:defend:session-1');
    expect(customIds).toContain('combat:potion:session-1');
    expect(customIds).toContain('combat:flee:session-1');
  });

  test('포션 선택 UI: 기본 포션과 Consumable 포션 버튼이 생성된다', () => {
    const rows = createCombatActionRows('session-1', {
      character: createCharacter(),
      showPotionOptions: true,
      sessionPotionsRemaining: 2,
      consumablePotions: [
        createConsumable({
          id: 55,
          name: '고급 체력 포션',
          quantity: 3,
          type: 'potion',
          effect: 'heal_hp',
        }),
      ],
    });

    const customIds = rows
      .flatMap((row) => row.toJSON().components)
      .map((component) => component.custom_id);

    expect(customIds).toContain('combat:potion_base:session-1');
    expect(customIds).toContain('combat:potion_db:session-1:55');
    expect(customIds).toContain('combat:potion_cancel:session-1');
  });

  test('턴 진행: 방어 선택 시 전투가 진행되고 턴이 증가한다', () => {
    const character = createCharacter({
      hp: 100,
      maxHp: 100,
      mana: 30,
      maxMana: 30,
    });
    const session = createSession({
      monsterHp: 90,
      monsterDefense: 40,
      monsterAttack: 6,
      playerHp: 100,
    });

    const outcome = resolveCombatTurn({
      character,
      session,
      action: COMBAT_ACTIONS.defend,
    });

    expect(outcome.status).toBe('ongoing');
    expect(outcome.sessionUpdate.turn).toBe(session.turn + 1);
    expect(outcome.characterUpdate.hp).toBeLessThanOrEqual(character.maxHp);
  });

  test('승리: 적 HP를 0으로 만들면 보상을 반환한다', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const character = createCharacter({
      attack: 30,
      defense: 5,
      gold: 100,
    });
    const session = createSession({
      monsterHp: 1,
      monsterMaxHp: 20,
      monsterDefense: 0,
      monsterAttack: 3,
    });

    const outcome = resolveCombatTurn({
      character,
      session,
      action: COMBAT_ACTIONS.attack,
    });

    expect(outcome.status).toBe('victory');
    expect(outcome.rewards.xpReward).toBeGreaterThan(0);
    expect(outcome.rewards.goldReward).toBeGreaterThan(0);

    randomSpy.mockRestore();
  });

  test('프리미엄 혜택: 활성 구독이면 전투 보상이 증가한다', () => {
    const session = createSession({
      monsterHp: 1,
      monsterMaxHp: 20,
      monsterDefense: 0,
      monsterAttack: 3,
      monsterXpReward: 20,
      monsterGoldMin: 10,
      monsterGoldMax: 10,
    });
    const baseCharacter = createCharacter({
      attack: 40,
      defense: 5,
      gold: 100,
      winStreak: 0,
    });
    const premiumCharacter = createCharacter({
      ...baseCharacter,
      premiumSubscription: {
        userId: baseCharacter.userId,
        planId: 'premium_monthly_999',
        startDate: new Date('2026-02-01T00:00:00.000Z'),
        endDate: new Date('2026-03-01T00:00:00.000Z'),
      },
    });

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const baseOutcome = resolveCombatTurn({
      character: baseCharacter,
      session,
      action: COMBAT_ACTIONS.attack,
    });
    const premiumOutcome = resolveCombatTurn({
      character: premiumCharacter,
      session,
      action: COMBAT_ACTIONS.attack,
    });

    expect(baseOutcome.status).toBe('victory');
    expect(premiumOutcome.status).toBe('victory');
    expect(premiumOutcome.rewards.xpReward).toBeGreaterThan(baseOutcome.rewards.xpReward);
    expect(premiumOutcome.rewards.goldReward).toBeGreaterThan(baseOutcome.rewards.goldReward);

    randomSpy.mockRestore();
  });

  test('패배: 플레이어 HP가 0 이하가 되면 즉시 전투 종료된다', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const character = createCharacter({
      attack: 1,
      defense: 0,
      hp: 1,
      maxHp: 100,
      mana: 0,
      maxMana: 0,
      winStreak: 2,
    });
    const session = createSession({
      monsterHp: 999,
      monsterMaxHp: 999,
      monsterDefense: 999,
      monsterAttack: 999,
      playerHp: 1,
    });

    const outcome = resolveCombatTurn({
      character,
      session,
      action: COMBAT_ACTIONS.attack,
    });

    expect(outcome.status).toBe('defeat');
    expect(outcome.characterUpdate.hp).toBe(character.maxHp);
    expect(outcome.sessionUpdate.turn).toBe(session.turn + 1);

    randomSpy.mockRestore();
  });

  test('일반 공격: 크리티컬 발생 시 로그에 표시된다', () => {
    const randomSpy = jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.9);

    const character = createCharacter({
      attack: 20,
      defense: 5,
      hp: 100,
      maxHp: 100,
    });
    const session = createSession({
      monsterHp: 80,
      monsterMaxHp: 80,
      monsterDefense: 2,
      monsterAttack: 3,
      playerHp: 100,
    });

    const outcome = resolveCombatTurn({
      character,
      session,
      action: COMBAT_ACTIONS.attack,
    });

    expect(outcome.status).toBe('ongoing');
    expect(outcome.battleLog.some((line) => line.includes('치명타'))).toBe(true);

    randomSpy.mockRestore();
  });

  test('일반 공격: 회피 발생 시 데미지가 무효화된다', () => {
    const randomSpy = jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.9);

    const character = createCharacter({
      attack: 20,
      defense: 5,
      hp: 100,
      maxHp: 100,
    });
    const session = createSession({
      monsterHp: 80,
      monsterMaxHp: 80,
      monsterDefense: 2,
      monsterAttack: 3,
      playerHp: 100,
    });

    const outcome = resolveCombatTurn({
      character,
      session,
      action: COMBAT_ACTIONS.attack,
    });

    expect(outcome.status).toBe('ongoing');
    expect(outcome.sessionUpdate.monsterHp).toBe(session.monsterHp);
    expect(outcome.battleLog.some((line) => line.includes('회피'))).toBe(true);

    randomSpy.mockRestore();
  });

  test('기본 스킬 강화: 스킬 레벨이 높을수록 데미지가 증가한다', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9);

    const baseCharacter = createCharacter({
      class: '전사',
      attack: 20,
      mana: 100,
      maxMana: 100,
      skills: [{ skillKey: 'power_strike', skillLevel: 1, equipped: true }],
    });
    const leveledCharacter = createCharacter({
      class: '전사',
      attack: 20,
      mana: 100,
      maxMana: 100,
      skills: [{ skillKey: 'power_strike', skillLevel: 3, equipped: true }],
    });

    const baseOutcome = resolveCombatTurn({
      character: baseCharacter,
      session: createSession({
        id: 'session-skill-1',
        monsterHp: 100,
        monsterMaxHp: 100,
        monsterDefense: 0,
        monsterAttack: 1,
      }),
      action: COMBAT_ACTIONS.skill,
      skillKey: 'power_strike',
    });

    const leveledOutcome = resolveCombatTurn({
      character: leveledCharacter,
      session: createSession({
        id: 'session-skill-2',
        monsterHp: 100,
        monsterMaxHp: 100,
        monsterDefense: 0,
        monsterAttack: 1,
      }),
      action: COMBAT_ACTIONS.skill,
      skillKey: 'power_strike',
    });

    const baseDamage = 100 - baseOutcome.sessionUpdate.monsterHp;
    const leveledDamage = 100 - leveledOutcome.sessionUpdate.monsterHp;

    expect(baseOutcome.status).toBe('ongoing');
    expect(leveledOutcome.status).toBe('ongoing');
    expect(leveledDamage).toBeGreaterThan(baseDamage);

    randomSpy.mockRestore();
  });

  test('기본 포션 사용: session.potionsRemaining이 감소한다', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const character = createCharacter({
      hp: 60,
      maxHp: 120,
      defense: 999,
      mana: 20,
      maxMana: 20,
    });
    const session = createSession({
      playerHp: 60,
      potionsRemaining: 3,
      monsterAttack: 1,
      monsterDefense: 999,
    });

    const outcome = resolveCombatTurn({
      character,
      session,
      action: COMBAT_ACTIONS.potionBase,
    });

    expect(outcome.sessionUpdate.potionsRemaining).toBe(2);
    expect(outcome.meta.consumedConsumableId).toBeNull();
    expect(outcome.characterUpdate.hp).toBeGreaterThan(session.playerHp);

    randomSpy.mockRestore();
  });

  test('DB 포션 사용: heal_hp 효과 적용 및 consumable 소비 메타를 반환한다', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const character = createCharacter({
      hp: 50,
      maxHp: 120,
      defense: 999,
      mana: 20,
      maxMana: 20,
    });
    const session = createSession({
      playerHp: 50,
      potionsRemaining: 3,
      monsterAttack: 1,
      monsterDefense: 999,
    });
    const selectedConsumable = createConsumable({
      id: 77,
      name: '전투용 체력 포션',
      type: 'potion',
      effect: 'heal_hp',
      power: 40,
      quantity: 5,
    });

    const outcome = resolveCombatTurn({
      character,
      session,
      action: COMBAT_ACTIONS.potionDb,
      selectedConsumable,
    });

    expect(outcome.meta.consumedConsumableId).toBe(77);
    expect(outcome.sessionUpdate.potionsRemaining).toBe(3);
    expect(outcome.characterUpdate.hp).toBeGreaterThan(session.playerHp);
    expect(outcome.battleLog.some((line) => line.includes('전투용 체력 포션'))).toBe(true);

    randomSpy.mockRestore();
  });
});
