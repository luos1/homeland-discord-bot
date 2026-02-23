const { enhanceEquipment, getEnhancementInfo, ENHANCEMENT_SUCCESS_RATES } = require('../../src/game/enhancement');

describe('Enhancement System', () => {
  describe('getEnhancementInfo', () => {
    it('should return correct info for +0 equipment', () => {
      const equipment = {
        name: 'Test Sword',
        attack: 10,
        enhancementLevel: 0
      };

      const info = getEnhancementInfo(equipment);

      expect(info.currentLevel).toBe(0);
      expect(info.nextLevel).toBe(1);
      expect(info.cost).toBe(100);
      expect(info.successRate).toBe(100);
      expect(info.failPenalty).toBe('레벨 유지');
    });

    it('should return correct info for +5 equipment', () => {
      const equipment = {
        name: 'Test Sword',
        attack: 10,
        enhancementLevel: 5
      };

      const info = getEnhancementInfo(equipment);

      expect(info.currentLevel).toBe(5);
      expect(info.nextLevel).toBe(6);
      expect(info.cost).toBe(3200);
      expect(info.successRate).toBe(60);
      expect(info.failPenalty).toBe('레벨 -1');
    });
  });

  describe('enhanceEquipment', () => {
    it('should reject enhancement beyond +15', () => {
      const equipment = {
        name: 'Test Sword',
        attack: 100,
        enhancementLevel: 15
      };

      const character = { gold: 1000000 };

      const result = enhanceEquipment(equipment, character);

      expect(result.success).toBe(false);
      expect(result.error).toContain('최대');
    });

    it('should reject enhancement with insufficient gold', () => {
      const equipment = {
        name: 'Test Sword',
        attack: 10,
        enhancementLevel: 0
      };

      const character = { gold: 50 };

      const result = enhanceEquipment(equipment, character);

      expect(result.success).toBe(false);
      expect(result.error).toContain('골드가 부족');
    });

    it('should increase stats on successful enhancement', () => {
      // Mock Math.random to always succeed
      const originalRandom = Math.random;
      Math.random = () => 0;

      const equipment = {
        name: 'Test Sword',
        attack: 10,
        defense: 5,
        hp: 50,
        mana: 20,
        enhancementLevel: 0
      };

      const character = { gold: 1000 };

      const result = enhanceEquipment(equipment, character);

      Math.random = originalRandom;

      expect(result.success).toBe(true);
      expect(result.isEnhancementSuccess).toBe(true);
      expect(result.newLevel).toBe(1);
      expect(result.newStats.attack).toBeGreaterThan(equipment.attack);
      expect(result.message).toContain('강화 성공');
    });

    it('should maintain level on failure (< +5)', () => {
      // Mock Math.random to always fail
      const originalRandom = Math.random;
      Math.random = () => 0.99;

      const equipment = {
        name: 'Test Sword',
        attack: 10,
        enhancementLevel: 3
      };

      const character = { gold: 10000 };

      const result = enhanceEquipment(equipment, character);

      Math.random = originalRandom;

      expect(result.success).toBe(true);
      expect(result.isEnhancementSuccess).toBe(false);
      expect(result.newLevel).toBe(3);
      expect(result.message).toContain('유지');
    });

    it('should decrease level on failure (>= +5)', () => {
      // Mock Math.random to always fail
      const originalRandom = Math.random;
      Math.random = () => 0.99;

      const equipment = {
        name: 'Test Sword',
        attack: 100,
        enhancementLevel: 7
      };

      const character = { gold: 100000 };

      const result = enhanceEquipment(equipment, character);

      Math.random = originalRandom;

      expect(result.success).toBe(true);
      expect(result.isEnhancementSuccess).toBe(false);
      expect(result.newLevel).toBe(6);
      expect(result.message).toContain('하락');
    });

    it('should calculate stats correctly for each level', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const baseAttack = 100;
      const equipment = {
        name: 'Test Sword',
        attack: baseAttack,
        enhancementLevel: 0
      };

      const character = { gold: 1000000 };

      // +0 → +1
      const result1 = enhanceEquipment(equipment, character);
      expect(result1.newStats.attack).toBe(Math.floor(baseAttack * 1.1));

      // +1 → +2
      equipment.enhancementLevel = 1;
      const result2 = enhanceEquipment(equipment, character);
      expect(result2.newStats.attack).toBe(Math.floor(baseAttack * 1.2));

      // +4 → +5
      equipment.enhancementLevel = 4;
      const result5 = enhanceEquipment(equipment, character);
      expect(result5.newStats.attack).toBe(Math.floor(baseAttack * 1.5));

      Math.random = originalRandom;
    });
  });

  describe('Success Rates', () => {
    it('should have correct success rates', () => {
      expect(ENHANCEMENT_SUCCESS_RATES[0]).toBe(1.0);
      expect(ENHANCEMENT_SUCCESS_RATES[5]).toBe(0.6);
      expect(ENHANCEMENT_SUCCESS_RATES[10]).toBe(0.1);
    });

    it('should decrease success rate as level increases', () => {
      for (let i = 0; i < 10; i++) {
        expect(ENHANCEMENT_SUCCESS_RATES[i]).toBeGreaterThanOrEqual(ENHANCEMENT_SUCCESS_RATES[i + 1]);
      }
    });
  });
});
