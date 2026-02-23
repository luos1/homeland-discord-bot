// 자동 역할 부여 시스템

/**
 * 레벨에 따른 역할 매핑
 */
const LEVEL_ROLES = {
  50: '🟠 레전더리',
  30: '🟣 에픽',
  20: '🔵 레어',
  10: '🟢 언커먼',
  1: '⚪ 뉴비',
};

/**
 * 직업별 역할 매핑
 */
const CLASS_ROLES = {
  Warrior: '⚔️ Warrior',
  Ranger: '🏹 Ranger',
  Mage: '🔮 Mage',
};

const PRODUCTION_CLASS_ROLES = {
  Gatherer: '🌾 Gatherer',
  Blacksmith: '⚒️ Blacksmith',
  Alchemist: '🧪 Alchemist',
};

/**
 * 특별 역할
 */
const SPECIAL_ROLES = {
  mythic: '🌟 Mythic 보유자',
  premium: '💎 후원자',
};

/**
 * 레벨에 따른 역할 업데이트
 * @param {Guild} guild - Discord 길드
 * @param {GuildMember} member - 길드 멤버
 * @param {number} level - 캐릭터 레벨
 */
async function updateLevelRole(guild, member, level) {
  try {
    // 현재 레벨에 맞는 역할 찾기
    let targetRoleName = null;
    for (const [minLevel, roleName] of Object.entries(LEVEL_ROLES).sort((a, b) => b[0] - a[0])) {
      if (level >= parseInt(minLevel)) {
        targetRoleName = roleName;
        break;
      }
    }

    if (!targetRoleName) return;

    // 역할 객체 찾기
    const targetRole = guild.roles.cache.find((role) => role.name === targetRoleName);
    if (!targetRole) {
      console.warn(`역할 "${targetRoleName}"을(를) 찾을 수 없습니다`);
      return;
    }

    // 이미 해당 역할을 가지고 있으면 스킵
    if (member.roles.cache.has(targetRole.id)) {
      return;
    }

    // 기존 레벨 역할 제거
    const levelRoleNames = Object.values(LEVEL_ROLES);
    const oldLevelRoles = member.roles.cache.filter((role) =>
      levelRoleNames.includes(role.name)
    );

    for (const oldRole of oldLevelRoles.values()) {
      await member.roles.remove(oldRole);
    }

    // 새 역할 부여
    await member.roles.add(targetRole);
    console.log(`✅ ${member.user.username}에게 "${targetRoleName}" 역할 부여 (레벨 ${level})`);
  } catch (error) {
    console.error('레벨 역할 업데이트 실패:', error);
  }
}

/**
 * 직업에 따른 역할 업데이트
 * @param {Guild} guild - Discord 길드
 * @param {GuildMember} member - 길드 멤버
 * @param {string} className - 직업 이름
 */
async function updateClassRole(guild, member, className) {
  try {
    const roleName = CLASS_ROLES[className] || PRODUCTION_CLASS_ROLES[className];
    if (!roleName) return;

    const targetRole = guild.roles.cache.find((role) => role.name === roleName);
    if (!targetRole) {
      console.warn(`역할 "${roleName}"을(를) 찾을 수 없습니다`);
      return;
    }

    // 이미 해당 역할을 가지고 있으면 스킵
    if (member.roles.cache.has(targetRole.id)) {
      return;
    }

    // 기존 직업 역할 제거
    const classRoleNames = [...Object.values(CLASS_ROLES), ...Object.values(PRODUCTION_CLASS_ROLES)];
    const oldClassRoles = member.roles.cache.filter((role) =>
      classRoleNames.includes(role.name)
    );

    for (const oldRole of oldClassRoles.values()) {
      await member.roles.remove(oldRole);
    }

    // 새 역할 부여
    await member.roles.add(targetRole);
    console.log(`✅ ${member.user.username}에게 "${roleName}" 역할 부여`);
  } catch (error) {
    console.error('직업 역할 업데이트 실패:', error);
  }
}

/**
 * Mythic 보유자 역할 부여
 * @param {Guild} guild - Discord 길드
 * @param {GuildMember} member - 길드 멤버
 */
async function addMythicRole(guild, member) {
  try {
    const roleName = SPECIAL_ROLES.mythic;
    const targetRole = guild.roles.cache.find((role) => role.name === roleName);

    if (!targetRole) {
      console.warn(`역할 "${roleName}"을(를) 찾을 수 없습니다`);
      return;
    }

    // 이미 역할이 있으면 스킵
    if (member.roles.cache.has(targetRole.id)) {
      return;
    }

    await member.roles.add(targetRole);
    console.log(`✅ ${member.user.username}에게 "${roleName}" 역할 부여`);
  } catch (error) {
    console.error('Mythic 역할 부여 실패:', error);
  }
}

/**
 * 프리미엄 역할 부여
 * @param {Guild} guild - Discord 길드
 * @param {GuildMember} member - 길드 멤버
 * @param {boolean} hasPremium - 프리미엄 구독 여부
 */
async function updatePremiumRole(guild, member, hasPremium) {
  try {
    const roleName = SPECIAL_ROLES.premium;
    const targetRole = guild.roles.cache.find((role) => role.name === roleName);

    if (!targetRole) {
      console.warn(`역할 "${roleName}"을(를) 찾을 수 없습니다`);
      return;
    }

    if (hasPremium) {
      // 프리미엄 역할 부여
      if (!member.roles.cache.has(targetRole.id)) {
        await member.roles.add(targetRole);
        console.log(`✅ ${member.user.username}에게 "${roleName}" 역할 부여`);
      }
    } else {
      // 프리미엄 역할 제거
      if (member.roles.cache.has(targetRole.id)) {
        await member.roles.remove(targetRole);
        console.log(`❌ ${member.user.username}의 "${roleName}" 역할 제거`);
      }
    }
  } catch (error) {
    console.error('프리미엄 역할 업데이트 실패:', error);
  }
}

module.exports = {
  LEVEL_ROLES,
  CLASS_ROLES,
  PRODUCTION_CLASS_ROLES,
  SPECIAL_ROLES,
  updateLevelRole,
  updateClassRole,
  addMythicRole,
  updatePremiumRole,
};
