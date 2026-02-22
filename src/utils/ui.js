const EMBED_COLORS = {
  create: 0x16a34a,
  profile: 0x2563eb,
  combat: 0xff6600,
  boss: 0x9b59b6,
  victory: 0x00ff00,
  defeat: 0xff0000,
  warning: 0xf59e0b,
  levelUp: 0xffd700,
  neutral: 0x64748b,
};

const DIVIDERS = {
  long: '━━━━━━━━━━━━━━━━━━',
  short: '──────────────────',
  boxTop: '╔══════════════════╗',
  boxBottom: '╚══════════════════╝',
};

const CLASS_NAME_MAP = {
  warrior: '전사',
  ranger: '궁수',
  sorcerer: '마법사',
  Warrior: '전사',
  Ranger: '궁수',
  Sorcerer: '마법사',
  전사: '전사',
  궁수: '궁수',
  마법사: '마법사',
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createHPBar(current, max, length = 10) {
  const safeLength = Math.max(1, length);
  const safeMax = Math.max(max, 1);
  const ratio = clamp(current / safeMax, 0, 1);
  const filled = Math.floor(ratio * safeLength);
  const empty = safeLength - filled;

  return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
}

function createXPBar(current, required, length = 10) {
  const safeLength = Math.max(1, length);

  if (!required || required <= 0) {
    return '▓'.repeat(safeLength);
  }

  const ratio = clamp(current / required, 0, 1);
  const filled = Math.floor(ratio * safeLength);
  const empty = safeLength - filled;

  return `${'▓'.repeat(filled)}${'░'.repeat(empty)}`;
}

function createDivider(type = 'long') {
  return DIVIDERS[type] ?? DIVIDERS.long;
}

function formatNumber(value) {
  return Number(value).toLocaleString('ko-KR');
}

function localizeClassName(className) {
  return CLASS_NAME_MAP[className] ?? className;
}

module.exports = {
  EMBED_COLORS,
  createHPBar,
  createXPBar,
  createDivider,
  formatNumber,
  localizeClassName,
};
