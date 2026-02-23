const { applyProductionExperience } = require('../../src/game/production-leveling');
const { createCharacter } = require('../helpers/factories');

describe('production leveling mastery', () => {
  test('채집 계열 생산 성공 시 gathererMastery가 1 증가한다', () => {
    const character = createCharacter({
      productionClass: 'miner',
      productionLevel: 1,
      productionXp: 0,
      gathererMastery: 4,
    });

    const result = applyProductionExperience(character, 20);

    expect(result.masteryUpdates).toEqual({ gathererMastery: 5 });
    expect(result.productionXp).toBe(20);
    expect(result.levelsGained).toBe(0);
  });

  test('blacksmith 생산 성공 시 blacksmithMastery가 1 증가한다', () => {
    const character = createCharacter({
      productionClass: 'blacksmith',
      blacksmithMastery: 9,
    });

    const result = applyProductionExperience(character, 10);

    expect(result.masteryUpdates).toEqual({ blacksmithMastery: 10 });
  });

  test('alchemist 생산 성공 시 alchemistMastery가 1 증가한다', () => {
    const character = createCharacter({
      productionClass: 'alchemist',
      alchemistMastery: 2,
    });

    const result = applyProductionExperience(character, 10);

    expect(result.masteryUpdates).toEqual({ alchemistMastery: 3 });
  });
});
