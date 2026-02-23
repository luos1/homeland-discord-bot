const { MARKET_BUTTON_PREFIX } = require('../commands/market');
const { NPC_SHOP_BUTTON_PREFIX } = require('../commands/npc_shop');
const { SELL_RESOURCES_BUTTON_PREFIX } = require('../commands/sell_resources');
const { AUCTION_BUTTON_PREFIX } = require('../commands/auction');

async function handleModal(interaction, { prisma, client }) {
  // 거래소 모달
  if (interaction.customId.startsWith(MARKET_BUTTON_PREFIX)) {
    const marketCommand = client.commands.get('market');
    if (marketCommand) {
      const handled = await marketCommand.handleMarketModal(interaction, { prisma });
      if (handled) return;
    }
  }

  // NPC 상점 모달
  if (interaction.customId.startsWith(NPC_SHOP_BUTTON_PREFIX)) {
    const npcShopCommand = client.commands.get('npc_shop');
    if (npcShopCommand) {
      const handled = await npcShopCommand.handleNpcShopModal(interaction, { prisma });
      if (handled) return;
    }
  }

  // 자원 판매소 모달
  if (interaction.customId.startsWith(SELL_RESOURCES_BUTTON_PREFIX)) {
    const sellResourcesCommand = client.commands.get('sell_resources');
    if (sellResourcesCommand && typeof sellResourcesCommand.handleSellResourcesModal === 'function') {
      const handled = await sellResourcesCommand.handleSellResourcesModal(interaction, { prisma });
      if (handled) return;
    }
  }

  // 경매 모달
  if (interaction.customId.startsWith(AUCTION_BUTTON_PREFIX)) {
    const auctionCommand = client.commands.get('auction');
    if (auctionCommand) {
      const handled = await auctionCommand.handleAuctionModal(interaction, { prisma });
      if (handled) return;
    }
  }

  // 미처리 모달 fallback
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: '처리할 수 없는 요청입니다.', ephemeral: true });
  }
}

module.exports = {
  handleModal,
};
