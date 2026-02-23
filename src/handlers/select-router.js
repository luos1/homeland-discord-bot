const { MARKET_BUTTON_PREFIX } = require('../commands/market');
const { NPC_SHOP_BUTTON_PREFIX } = require('../commands/npc_shop');
const { SELL_RESOURCES_BUTTON_PREFIX } = require('../commands/sell_resources');
const { AUCTION_BUTTON_PREFIX } = require('../commands/auction');
const { RANKING_COMPONENT_PREFIX } = require('../commands/ranking');

async function handleSelectMenu(interaction, { prisma, client }) {
  // 랭킹 셀렉트
  if (interaction.customId.startsWith(RANKING_COMPONENT_PREFIX)) {
    const rankingCommand = client.commands.get('ranking');
    if (rankingCommand) {
      const handled = await rankingCommand.handleRankingSelect(interaction, { prisma });
      if (handled) return;
    }
  }

  // 거래소 셀렉트
  if (interaction.customId.startsWith(MARKET_BUTTON_PREFIX)) {
    const marketCommand = client.commands.get('market');
    if (marketCommand) {
      const handled = await marketCommand.handleMarketSelect(interaction, { prisma });
      if (handled) return;
    }
  }

  // NPC 상점 셀렉트
  if (interaction.customId.startsWith(NPC_SHOP_BUTTON_PREFIX)) {
    const npcShopCommand = client.commands.get('npc_shop');
    if (npcShopCommand) {
      const handled = await npcShopCommand.handleNpcShopSelect(interaction, { prisma });
      if (handled) return;
    }
  }

  // 자원 판매소 셀렉트
  if (interaction.customId.startsWith(SELL_RESOURCES_BUTTON_PREFIX)) {
    const sellResourcesCommand = client.commands.get('sell_resources');
    if (sellResourcesCommand && typeof sellResourcesCommand.handleSellResourcesSelect === 'function') {
      const handled = await sellResourcesCommand.handleSellResourcesSelect(interaction, { prisma });
      if (handled) return;
    }
  }

  // 경매장 셀렉트
  if (interaction.customId.startsWith(AUCTION_BUTTON_PREFIX)) {
    const auctionCommand = client.commands.get('auction');
    if (auctionCommand) {
      const handled = await auctionCommand.handleAuctionSelect(interaction, { prisma });
      if (handled) return;
    }
  }

  // 미처리 셀렉트 메뉴 fallback
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: '알 수 없는 선택입니다.', ephemeral: true });
  }
}

module.exports = {
  handleSelectMenu,
};
