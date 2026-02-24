const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');
const { createVillageNavigationRow, VILLAGE_MENU_KEYS } = require('../utils/village');
const { getStripePremiumReadiness } = require('../game/premium');
const {
  GEM_EXCHANGE_FEE_RATE,
  calculateExchangeQuote,
  getGemMarketSnapshot,
} = require('../game/gem-exchange');
const {
  FEE_CONFIG_KEYS,
  resolveFeeRate,
} = require('../game/fee-config');
const { requireCharacter } = require('../utils/response-helpers');

const CASH_PURCHASE_USD_PER_GEM = 0.05;

function formatUsd(amount) {
  return `$${amount.toFixed(2)}`;
}

async function getGemFeeRate(prisma, now = new Date()) {
  try {
    return await resolveFeeRate(prisma, FEE_CONFIG_KEYS.gem, { now });
  } catch (error) {
    console.error('젬 수수료 조회 실패, 기본값 사용:', error);
    return GEM_EXCHANGE_FEE_RATE;
  }
}

function createGemStatusEmbed({ character, marketSnapshot, feeRate }) {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('💠 젬 거래소')
    .setDescription(
      [
        createDivider(),
        `💎 보유 젬: ${formatNumber(character.gems || 0)}`,
        `💰 보유 골드: ${formatNumber(character.gold)}G`,
        '',
        `📈 현재 기준 환율: 1젬 = ${formatNumber(marketSnapshot.rate)}G`,
        `🛒 매수 수요(24h): ${formatNumber(marketSnapshot.demand)}젬`,
        `📦 매도 공급(24h): ${formatNumber(marketSnapshot.supply)}젬`,
        `🔄 거래량(24h): ${formatNumber(marketSnapshot.volume)}젬 (${marketSnapshot.recentCount}건)`,
        `💸 거래 수수료: ${Math.round(feeRate * 100)}%`,
        createDivider(),
        '',
        '명령어',
        '• `/gem purchase amount:<젬>` : 현금 결제 준비 모드 젬 구매',
        '• `/gem buy amount:<젬>` : 골드로 젬 매수',
        '• `/gem sell amount:<젬>` : 젬을 골드로 매도',
      ].join('\n'),
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gem')
    .setDescription('젬 구매/교환 거래소를 이용합니다')
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('젬 잔액과 시장 환율을 확인합니다'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('purchase')
        .setDescription('현금 결제 준비 모드로 젬을 구매합니다')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('구매할 젬 수량')
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(10000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('buy')
        .setDescription('골드로 젬을 매수합니다')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('매수할 젬 수량')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('sell')
        .setDescription('젬을 골드로 매도합니다')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('매도할 젬 수량')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10000),
        ),
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand();
    const now = new Date();

    const character = await requireCharacter(prisma, interaction);
    if (!character) return;

    const marketSnapshot = await getGemMarketSnapshot(prisma);
    const gemFeeRate = await getGemFeeRate(prisma, now);

    if (subcommand === 'status') {
      await interaction.reply({
        embeds: [createGemStatusEmbed({ character, marketSnapshot, feeRate: gemFeeRate })],
        components: [createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.premium })],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'purchase') {
      const amount = interaction.options.getInteger('amount', true);
      const usdPrice = amount * CASH_PURCHASE_USD_PER_GEM;
      const stripeState = getStripePremiumReadiness();

      await prisma.$transaction(async (tx) => {
        await tx.character.update({
          where: {
            id: character.id,
          },
          data: {
            gems: {
              increment: amount,
            },
          },
        });

        await tx.gemTransaction.create({
          data: {
            userId: character.userId,
            type: 'purchase',
            amount,
            rate: 0,
            note: `cash_mock_usd:${usdPrice.toFixed(2)}`,
          },
        });
      });

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.victory)
        .setTitle('💎 젬 구매 완료')
        .setDescription(
          [
            createDivider(),
            `구매 수량: ${formatNumber(amount)}젬`,
            `결제 금액(기준): ${formatUsd(usdPrice)}`,
            '',
            `현재 Stripe 준비: ${stripeState.ready ? '완료' : '설정 필요'}`,
            stripeState.ready
              ? '실결제 연동 준비 완료 상태입니다.'
              : `누락 키: ${stripeState.missingKeys.join(', ')}`,
            createDivider(),
          ].join('\n'),
        );

      await interaction.reply({
        embeds: [embed],
        components: [createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.premium })],
      });
      return;
    }

    if (subcommand === 'buy' || subcommand === 'sell') {
      const amount = interaction.options.getInteger('amount', true);
      const quote = calculateExchangeQuote({
        orderType: subcommand,
        amount,
        rate: marketSnapshot.rate,
        feeRate: gemFeeRate,
      });

      if (subcommand === 'buy' && character.gold < quote.totalGoldCost) {
        await interaction.reply({
          content: `골드가 부족합니다. 필요: ${formatNumber(quote.totalGoldCost)}G, 보유: ${formatNumber(character.gold)}G`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'sell' && (character.gems || 0) < amount) {
        await interaction.reply({
          content: `젬이 부족합니다. 필요: ${formatNumber(amount)}젬, 보유: ${formatNumber(character.gems || 0)}젬`,
          ephemeral: true,
        });
        return;
      }

      await prisma.$transaction(async (tx) => {
        if (subcommand === 'buy') {
          await tx.character.update({
            where: {
              id: character.id,
            },
            data: {
              gold: {
                decrement: quote.totalGoldCost,
              },
              gems: {
                increment: amount,
              },
            },
          });
        } else {
          await tx.character.update({
            where: {
              id: character.id,
            },
            data: {
              gems: {
                decrement: amount,
              },
              gold: {
                increment: quote.netGoldPayout,
              },
            },
          });
        }

        await tx.gemExchange.create({
          data: {
            userId: character.userId,
            orderType: subcommand,
            amount,
            rate: quote.rate,
            fee: quote.fee,
            goldAmount: subcommand === 'buy' ? quote.totalGoldCost : quote.netGoldPayout,
            status: 'filled',
          },
        });

        await tx.gemTransaction.create({
          data: {
            userId: character.userId,
            type: subcommand === 'buy' ? 'exchange_buy' : 'exchange_sell',
            amount: subcommand === 'buy' ? amount : -amount,
            rate: quote.rate,
            note:
              subcommand === 'buy'
                ? `gold_spent:${quote.totalGoldCost}`
                : `gold_received:${quote.netGoldPayout}`,
          },
        });
      });

      const isBuy = subcommand === 'buy';
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.profile)
        .setTitle(isBuy ? '📈 젬 매수 완료' : '📉 젬 매도 완료')
        .setDescription(
          [
            createDivider(),
            `수량: ${formatNumber(amount)}젬`,
            `환율: 1젬 = ${formatNumber(quote.rate)}G`,
            `수수료(${Math.round(gemFeeRate * 100)}%): ${formatNumber(quote.fee)}G`,
            isBuy
              ? `총 차감 골드: ${formatNumber(quote.totalGoldCost)}G`
              : `순수령 골드: ${formatNumber(quote.netGoldPayout)}G`,
            createDivider(),
          ].join('\n'),
        );

      await interaction.reply({
        embeds: [embed],
        components: [createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.premium })],
      });
    }
  },
};
