const { selectDailyQuests, DAILY_QUESTS } = require('../../src/game/daily-quest-system');

describe('Daily Quest System', () => {
  describe('selectDailyQuests', () => {
    it('should return exactly 3 quests', () => {
      const quests = selectDailyQuests();
      expect(quests.length).toBe(3);
    });

    it('should return same quests for same date', () => {
      const date = new Date('2026-02-24');
      const quests1 = selectDailyQuests(date);
      const quests2 = selectDailyQuests(date);

      expect(quests1).toEqual(quests2);
    });

    it('should return different quests for different dates', () => {
      const date1 = new Date('2026-02-24');
      const date2 = new Date('2026-02-25');

      const quests1 = selectDailyQuests(date1);
      const quests2 = selectDailyQuests(date2);

      const ids1 = quests1.map(q => q.id).sort();
      const ids2 = quests2.map(q => q.id).sort();

      expect(ids1).not.toEqual(ids2);
    });

    it('should only return quests from the defined list', () => {
      const quests = selectDailyQuests();
      const validIds = DAILY_QUESTS.map(q => q.id);

      quests.forEach(quest => {
        expect(validIds).toContain(quest.id);
      });
    });

    it('should not return duplicate quests', () => {
      const quests = selectDailyQuests();
      const ids = quests.map(q => q.id);
      const uniqueIds = [...new Set(ids)];

      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('Quest Data', () => {
    it('should have valid quest types', () => {
      const validTypes = ['kill', 'levelup', 'enhance', 'trade', 'streak'];

      DAILY_QUESTS.forEach(quest => {
        expect(validTypes).toContain(quest.type);
      });
    });

    it('should have rewards', () => {
      DAILY_QUESTS.forEach(quest => {
        expect(quest.rewards).toBeDefined();
        expect(quest.rewards.gold).toBeGreaterThan(0);
        expect(quest.rewards.xp).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have target values', () => {
      DAILY_QUESTS.forEach(quest => {
        expect(quest.target).toBeGreaterThan(0);
      });
    });

    it('should have descriptions', () => {
      DAILY_QUESTS.forEach(quest => {
        expect(quest.name).toBeTruthy();
        expect(quest.description).toBeTruthy();
      });
    });
  });
});
