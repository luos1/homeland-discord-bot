const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { getShopSkills, getAdvancedSkillByKey } = require('../game/advanced-skills');
const { getAvailableSkills } = require('./skills');

const SKILL_UPGRADE_MAX_LEVEL = 5;

function buildUpgradeableSkills(character, learnedSkills = []) {
  const resolvedLearnedSkills = learnedSkills.length > 0
    ? learnedSkills
    : (character.skills || []);
  const merged = new Map();

  // 기본 전투 스킬: 직업 레벨로 해금된 스킬은 모두 강화 가능
  getAvailableSkills({
    ...character,
    skills: resolvedLearnedSkills,
  }).forEach((skill) => {
    if (merged.has(skill.key)) {
      return;
    }

    merged.set(skill.key, {
      skillKey: skill.key,
      name: skill.name,
      emoji: skill.emoji,
      skillLevel: Math.max(1, Number.parseInt(skill.skillLevel, 10) || 1),
      category: 'basic',
    });
  });

  // 전직 스킬: 배운 스킬만 강화 가능
  if (character.advancedClass) {
    resolvedLearnedSkills.forEach((skill) => {
      const skillData = getAdvancedSkillByKey(character.advancedClass, skill.skillKey);
      if (!skillData || merged.has(skill.skillKey)) {
        return;
      }

      merged.set(skill.skillKey, {
        skillKey: skill.skillKey,
        name: skillData.name,
        emoji: skillData.emoji,
        skillLevel: Math.max(1, Number.parseInt(skill.skillLevel, 10) || 1),
        category: 'advanced',
      });
    });
  }

  return Array.from(merged.values());
}

function createSkillShopEmbed(character, learnedSkills = []) {
  if (!character.advancedClass) {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.profile)
      .setTitle('📚 스킬 상점')
      .setDescription('전직 후에 이용할 수 있습니다.')
      .setFooter({ text: '/jobchange 명령어로 전직하세요' });
  }

  const shopSkills = getShopSkills(character.advancedClass);
  const learnedKeys = new Set(learnedSkills.map((skill) => skill.skillKey));

  const skillLines = shopSkills.map((skill, index) => {
    const learned = learnedKeys.has(skill.key);
    const isBossDrop = skill.type === 'boss_drop';
    const status = learned
      ? '✅ 구매 완료'
      : isBossDrop
        ? '💀 보스 드랍 전용'
        : `${skill.shopPrice}G`;
    return `${index + 1}. ${skill.emoji} **${skill.name}** - ${status}\n   ${skill.description}\n   마나: ${skill.manaCost}`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`📚 스킬 상점 - ${character.advancedClass}`)
    .setDescription(
      [
        createDivider(),
        `💰 보유 골드: ${character.gold}G`,
        '',
        '🔮 스킬 목록',
        '',
        ...skillLines,
        '',
        '💡 보스 드랍 스킬은 보스 클리어 시 낮은 확률로 획득',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '구매할 스킬을 선택하세요',
    });
}

function createSkillShopActionRow(character, learnedSkills = []) {
  const shopSkills = getShopSkills(character.advancedClass);
  const learnedKeys = new Set(learnedSkills.map((skill) => skill.skillKey));
  const upgradableSkills = buildUpgradeableSkills(character, learnedSkills);

  const buttons = shopSkills.slice(0, 3).map((skill, index) => {
    const learned = learnedKeys.has(skill.key);
    const isBossDrop = skill.type === 'boss_drop';
    const canAfford = !isBossDrop && character.gold >= (skill.shopPrice || 0);

    return new ButtonBuilder()
      .setCustomId(`shop:buy_skill:${skill.key}`)
      .setLabel(`${index + 1}. ${learned ? '✅' : isBossDrop ? '💀' : `${skill.shopPrice}G`}`)
      .setEmoji(skill.emoji)
      .setStyle(learned ? ButtonStyle.Success : isBossDrop ? ButtonStyle.Danger : ButtonStyle.Primary)
      .setDisabled(learned || isBossDrop || !canAfford);
  });

  buttons.push(
    new ButtonBuilder()
      .setCustomId('shop:upgrade_skill_menu')
      .setLabel('스킬 강화')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(upgradableSkills.length === 0),
    new ButtonBuilder()
      .setCustomId('shop:main')
      .setLabel('뒤로')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary),
  );

  return new ActionRowBuilder().addComponents(buttons);
}

function createSkillUpgradeShopEmbed(character, learnedSkills = []) {
  const upgradableSkills = buildUpgradeableSkills(character, learnedSkills);

  const skillLines = upgradableSkills.slice(0, 5).map((skill, index) => {
    const upgradeCost = calculateSkillUpgradeCost(skill.skillLevel);
    const canUpgrade = skill.skillLevel < SKILL_UPGRADE_MAX_LEVEL;
    const categoryLabel = skill.category === 'advanced' ? '전직 스킬' : '기본 스킬';

    return `${index + 1}. ${skill.emoji} **${skill.name}** +${skill.skillLevel}\n   분류: ${categoryLabel} | 강화 비용: ${canUpgrade ? `${upgradeCost}G` : '최대 레벨'}`;
  });

  const title = character.advancedClass
    ? `✨ 스킬 강화 - ${character.advancedClass}`
    : '✨ 스킬 강화';

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(title)
    .setDescription(
      [
        createDivider(),
        `💰 보유 골드: ${character.gold}G`,
        '',
        '🔮 강화 가능한 스킬',
        '',
        skillLines.length > 0 ? skillLines.join('\n\n') : '강화 가능한 스킬이 없습니다',
        '',
        '💡 강화 시 스킬 데미지/효과가 증가합니다',
        `✨ 최대 +${SKILL_UPGRADE_MAX_LEVEL}까지 강화 가능`,
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '강화할 스킬을 선택하세요',
    });
}

function createSkillUpgradeActionRow(character, learnedSkills = []) {
  const upgradableSkills = buildUpgradeableSkills(character, learnedSkills);

  const buttons = upgradableSkills.slice(0, 4).map((skill, index) => {
    const upgradeCost = calculateSkillUpgradeCost(skill.skillLevel);
    const canUpgrade = skill.skillLevel < SKILL_UPGRADE_MAX_LEVEL;
    const canAfford = character.gold >= upgradeCost;

    return new ButtonBuilder()
      .setCustomId(`shop:upgrade_skill:${skill.skillKey}`)
      .setLabel(`${index + 1}번 강화`)
      .setEmoji(skill.emoji)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canUpgrade || !canAfford);
  });

  buttons.push(
    new ButtonBuilder()
      .setCustomId('shop:main')
      .setLabel('뒤로')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary),
  );

  return new ActionRowBuilder().addComponents(buttons);
}

function calculateSkillUpgradeCost(currentLevel) {
  const baseUpgrade = 300;
  return baseUpgrade * (currentLevel + 1);
}

module.exports = {
  buildUpgradeableSkills,
  createSkillShopEmbed,
  createSkillShopActionRow,
  createSkillUpgradeShopEmbed,
  createSkillUpgradeActionRow,
  calculateSkillUpgradeCost,
};
