const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const VILLAGE_BUTTON_PREFIX = 'village';

const VILLAGE_MENU_KEYS = Object.freeze({
  main: 'main',
  combat: 'combat',
  shop: 'shop',
  market: 'market',
  production: 'production',
  premium: 'premium',
  daily: 'daily',
  ranking: 'ranking',
});

function buildVillageCustomId(...parts) {
  return [VILLAGE_BUTTON_PREFIX, ...parts].join(':');
}

function buildVillageHomeCustomId() {
  return buildVillageCustomId('home');
}

function buildVillageMenuCustomId(menuKey) {
  return buildVillageCustomId('menu', menuKey);
}

function buildVillageBackCustomId(menuKey) {
  return buildVillageCustomId('back', menuKey);
}

function buildVillageOpenCustomId(action, param = null) {
  if (!param) {
    return buildVillageCustomId('open', action);
  }

  return buildVillageCustomId('open', action, param);
}

function isVillageButton(customId) {
  return typeof customId === 'string' && customId.startsWith(`${VILLAGE_BUTTON_PREFIX}:`);
}

function parseVillageCustomId(customId) {
  if (!isVillageButton(customId)) {
    return null;
  }

  const parts = customId.split(':');
  const action = parts[1];

  if (action === 'home') {
    return { action: 'home' };
  }

  if (action === 'menu' || action === 'back') {
    return {
      action,
      menuKey: parts[2] || VILLAGE_MENU_KEYS.main,
    };
  }

  if (action === 'open') {
    return {
      action,
      target: parts[2] || null,
      param: parts[3] || null,
    };
  }

  return null;
}

function createVillageNavigationRow({ backTo = VILLAGE_MENU_KEYS.main } = {}) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buildVillageHomeCustomId())
      .setLabel('마을로')
      .setEmoji('🏘️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(buildVillageBackCustomId(backTo))
      .setLabel('뒤로')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary),
  );
}

function getRowComponents(row) {
  if (!row) {
    return [];
  }

  if (Array.isArray(row.components)) {
    return row.components;
  }

  if (Array.isArray(row.data?.components)) {
    return row.data.components;
  }

  return [];
}

function getComponentCustomId(component) {
  if (!component) {
    return null;
  }

  if (typeof component.customId === 'string') {
    return component.customId;
  }

  if (typeof component.data?.custom_id === 'string') {
    return component.data.custom_id;
  }

  if (typeof component.data?.customId === 'string') {
    return component.data.customId;
  }

  return null;
}

function hasVillageNavigation(components = []) {
  return components.some((row) =>
    getRowComponents(row).some((component) => {
      const customId = getComponentCustomId(component);
      return customId === buildVillageHomeCustomId()
        || customId === buildVillageBackCustomId(VILLAGE_MENU_KEYS.main)
        || (typeof customId === 'string'
          && customId.startsWith(`${VILLAGE_BUTTON_PREFIX}:back:`));
    }));
}

function withVillageNavigation(payload = {}, { backTo = VILLAGE_MENU_KEYS.main } = {}) {
  const nextPayload = { ...(payload || {}) };
  const currentComponents = Array.isArray(nextPayload.components)
    ? [...nextPayload.components]
    : [];

  if (!hasVillageNavigation(currentComponents)) {
    currentComponents.push(createVillageNavigationRow({ backTo }));
  }

  if (currentComponents.length > 5) {
    nextPayload.components = currentComponents.slice(0, 5);
  } else {
    nextPayload.components = currentComponents;
  }

  return nextPayload;
}

module.exports = {
  VILLAGE_BUTTON_PREFIX,
  VILLAGE_MENU_KEYS,
  buildVillageHomeCustomId,
  buildVillageMenuCustomId,
  buildVillageBackCustomId,
  buildVillageOpenCustomId,
  isVillageButton,
  parseVillageCustomId,
  createVillageNavigationRow,
  withVillageNavigation,
};
