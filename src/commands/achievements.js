const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { ACHIEVEMENTS, CATEGORY_NAMES, getCharacterAchievements } = require('../game/achievement-system');
const { EMBED_COLORS } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievements')
		.setNameLocalizations({ "en-US": "achievements" })
    .setDescription('업적 목록과 진행도를 확인합니다')
		.setDescriptionLocalizations({ "en-US": "View 업적 목록과 진행도" })
    .setDescriptionLocalizations({ ko: '업적 목록과 진행도를 확인합니다' })
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('특정 카테고리만 보기')
        .setDescriptionLocalizations({ ko: '특정 카테고리만 보기' })
        .setRequired(false)
        .addChoices(
          { name: '⚔️ 전투', value: 'combat' },
          { name: '🐉 보스', value: 'boss' },
          { name: '📈 성장', value: 'level' },
          { name: '💰 재화', value: 'wealth' },
          { name: '📅 출석', value: 'attendance' },
          { name: '🎰 도박', value: 'gambling' },
          { name: '🛠️ 생산', value: 'production' },
          { name: '👥 소셜', value: 'social' },
          { name: '✨ 강화', value: 'enhancement' }
        )
    ),

  async execute(interaction, { prisma }) {
    const character = await requireCharacter(prisma, interaction);
    if (!character) return;

    const categoryFilter = interaction.options.getString('category');
    const achievements = await getCharacterAchievements(prisma, character.id);

    // 카테고리별 그룹화
    const grouped = {};
    for (const achievement of achievements) {
      if (achievement.hidden && !achievement.unlocked) continue;
      if (categoryFilter && achievement.category !== categoryFilter) continue;
      
      if (!grouped[achievement.category]) {
        grouped[achievement.category] = [];
      }
      grouped[achievement.category].push(achievement);
    }

    // 통계 계산
    const totalAchievements = Object.values(ACHIEVEMENTS).filter(a => !a.hidden).length;
    const unlockedCount = achievements.filter(a => a.unlocked && !ACHIEVEMENTS[a.id]?.hidden).length;
    const hiddenUnlocked = achievements.filter(a => a.unlocked && ACHIEVEMENTS[a.id]?.hidden).length;

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.amber)
      .setTitle('🏆 업적')
      .setDescription([
        `**${character.name}**의 업적 현황`,
        '',
        `📊 달성: **${unlockedCount}** / ${totalAchievements}`,
        hiddenUnlocked > 0 ? `🔮 숨겨진 업적: **${hiddenUnlocked}**개 달성` : '',
        '',
        categoryFilter ? `📁 카테고리: ${CATEGORY_NAMES[categoryFilter]}` : '📁 전체 카테고리',
      ].filter(Boolean).join('\n'));

    // 카테고리별 필드 추가
    const categoryOrder = ['combat', 'boss', 'level', 'wealth', 'attendance', 'gambling', 'hidden'];
    
    for (const category of categoryOrder) {
      const categoryAchievements = grouped[category];
      if (!categoryAchievements || categoryAchievements.length === 0) continue;

      const lines = categoryAchievements.map(a => {
        const status = a.unlocked ? '✅' : '⬜';
        const name = a.hidden && !a.unlocked ? '???' : a.name;
        const desc = a.hidden && !a.unlocked ? '숨겨진 업적' : a.description;
        return `${status} ${a.emoji} **${name}**\n　└ ${desc}`;
      });

      // 필드 크기 제한으로 나눠서 추가
      const fieldValue = lines.join('\n');
      if (fieldValue.length > 1024) {
        // 너무 길면 요약
        const unlocked = categoryAchievements.filter(a => a.unlocked).length;
        embed.addFields({
          name: CATEGORY_NAMES[category],
          value: `${unlocked}/${categoryAchievements.length} 달성`,
          inline: true,
        });
      } else {
        embed.addFields({
          name: CATEGORY_NAMES[category],
          value: fieldValue || '없음',
          inline: false,
        });
      }
    }

    // 카테고리 선택 메뉴
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('achievement_category')
      .setPlaceholder('카테고리 선택...')
      .addOptions([
        { label: '전체 보기', value: 'all', emoji: '📋' },
        { label: '전투', value: 'combat', emoji: '⚔️' },
        { label: '보스', value: 'boss', emoji: '🐉' },
        { label: '성장', value: 'level', emoji: '📈' },
        { label: '재화', value: 'wealth', emoji: '💰' },
        { label: '출석', value: 'attendance', emoji: '📅' },
        { label: '도박', value: 'gambling', emoji: '🎰' },
        { label: '생산', value: 'production', emoji: '🛠️' },
        { label: '소셜', value: 'social', emoji: '👥' },
        { label: '강화', value: 'enhancement', emoji: '✨' },
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row] });
  },

  // Select Menu 핸들러
  async handleSelectMenu(interaction, { prisma }) {
    if (interaction.customId !== 'achievement_category') return false;

    const category = interaction.values[0];
    const character = await prisma.character.findFirst({
      where: { userId: interaction.user.id },
    });

    if (!character) {
      return interaction.update({ content: '❌ 캐릭터가 없습니다.', embeds: [], components: [] });
    }

    const categoryFilter = category === 'all' ? null : category;
    const achievements = await getCharacterAchievements(prisma, character.id);

    const grouped = {};
    for (const achievement of achievements) {
      if (achievement.hidden && !achievement.unlocked) continue;
      if (categoryFilter && achievement.category !== categoryFilter) continue;
      
      if (!grouped[achievement.category]) {
        grouped[achievement.category] = [];
      }
      grouped[achievement.category].push(achievement);
    }

    const totalAchievements = Object.values(ACHIEVEMENTS).filter(a => !a.hidden).length;
    const unlockedCount = achievements.filter(a => a.unlocked && !ACHIEVEMENTS[a.id]?.hidden).length;

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.amber)
      .setTitle('🏆 업적')
      .setDescription([
        `**${character.name}**의 업적 현황`,
        '',
        `📊 달성: **${unlockedCount}** / ${totalAchievements}`,
        '',
        categoryFilter ? `📁 카테고리: ${CATEGORY_NAMES[categoryFilter]}` : '📁 전체 카테고리',
      ].join('\n'));

    const categoryOrder = ['combat', 'boss', 'level', 'wealth', 'attendance', 'gambling', 'hidden'];
    
    for (const cat of categoryOrder) {
      const categoryAchievements = grouped[cat];
      if (!categoryAchievements || categoryAchievements.length === 0) continue;

      const lines = categoryAchievements.map(a => {
        const status = a.unlocked ? '✅' : '⬜';
        const name = a.hidden && !a.unlocked ? '???' : a.name;
        const desc = a.hidden && !a.unlocked ? '숨겨진 업적' : a.description;
        return `${status} ${a.emoji} **${name}**\n　└ ${desc}`;
      });

      const fieldValue = lines.join('\n');
      if (fieldValue.length > 1024) {
        const unlocked = categoryAchievements.filter(a => a.unlocked).length;
        embed.addFields({
          name: CATEGORY_NAMES[cat],
          value: `${unlocked}/${categoryAchievements.length} 달성`,
          inline: true,
        });
      } else {
        embed.addFields({
          name: CATEGORY_NAMES[cat],
          value: fieldValue || '없음',
          inline: false,
        });
      }
    }

    await interaction.update({ embeds: [embed] });
    return true;
  }
};
