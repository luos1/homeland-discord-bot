const {
  applyExperience,
  xpRequiredForLevel,
  LEVEL_CAP,
} = require('../../src/game/leveling');
const { createCharacter } = require('../helpers/factories');

describe('leveling mastery', () => {
  test('Phase 1 밸런스: 레벨 캡이 100이다', () => {
    expect(LEVEL_CAP).toBe(100);
    expect(xpRequiredForLevel(LEVEL_CAP)).toBeNull();
  });

  test('Phase 1 밸런스: Lv10-30 구간은 필요 경험치가 77%로 완화된다', () => {
    expect(xpRequiredForLevel(9)).toBe(250);
    expect(xpRequiredForLevel(10)).toBe(Math.floor(275 / 1.3));
    expect(xpRequiredForLevel(30)).toBe(Math.floor(775 / 1.3));
    expect(xpRequiredForLevel(31)).toBe(800);
  });

  test('전투 승리 시 warrior 클래스는 warriorMastery가 1 증가한다', () => {
    const character = createCharacter({
      class: 'warrior',
      warriorMastery: 3,
      rangerMastery: 1,
      mageMastery: 2,
    });

    const result = applyExperience(
      character,
      10,
      character.hp,
      character.mana,
      { combatVictory: true },
    );

    expect(result.characterUpdate.warriorMastery).toBe(4);
  });

  test('전투 승리 시 sorcerer 클래스는 mageMastery가 1 증가한다', () => {
    const character = createCharacter({
      class: 'sorcerer',
      warriorMastery: 0,
      rangerMastery: 0,
      mageMastery: 7,
    });

    const result = applyExperience(
      character,
      5,
      character.hp,
      character.mana,
      { combatVictory: true },
    );

    expect(result.characterUpdate.mageMastery).toBe(8);
  });

  test('전투 승리가 아니면 숙련도가 증가하지 않는다', () => {
    const character = createCharacter({
      class: '전사',
      warriorMastery: 9,
    });

    const result = applyExperience(character, 15, character.hp, character.mana);

    expect(result.characterUpdate.warriorMastery).toBeUndefined();
  });
});
