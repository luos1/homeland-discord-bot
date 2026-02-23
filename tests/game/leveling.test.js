const { applyExperience } = require('../../src/game/leveling');
const { createCharacter } = require('../helpers/factories');

describe('leveling mastery', () => {
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
