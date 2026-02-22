const {
  COMBAT_ACTIONS,
  createCombatActionRows,
  resolveCombatTurn,
} = require('../../src/game/combat');
const { createCharacter } = require('../helpers/factories');

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

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

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
  });
});
