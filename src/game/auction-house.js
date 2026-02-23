const AUCTION_ITEM_TYPE = 'equipment';
const AUCTION_FEE_RATE = 0.05;
const AUCTION_EXTENSION_TRIGGER_MINUTES = 5;
const AUCTION_EXTENSION_MINUTES = 5;
const AUCTION_MIN_START_PRICE = 100;
const AUCTION_MAX_START_PRICE = 1_000_000_000;
const AUCTION_MIN_INCREMENT = 100;
const AUCTION_INCREMENT_RATE = 0.02;

const AUCTION_ALLOWED_DURATIONS_HOURS = Object.freeze([1, 6, 24]);

const AUCTION_STATUSES = Object.freeze({
  active: 'active',
  completed: 'completed',
  cancelled: 'cancelled',
});

const AUCTIONABLE_RARITIES = new Set(['rare', 'epic', 'legendary']);

function toSafeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function toPositiveInt(value, fallback = 0) {
  return Math.max(0, toSafeInt(value, fallback));
}

function isAllowedDurationHours(hours) {
  return AUCTION_ALLOWED_DURATIONS_HOURS.includes(hours);
}

function isAuctionableRarity(rarity) {
  return AUCTIONABLE_RARITIES.has(rarity);
}

function createAuctionEquipmentSnapshot(equipment) {
  return {
    name: equipment.name,
    type: equipment.type,
    rarity: equipment.rarity,
    attack: toPositiveInt(equipment.attack, 0),
    defense: toPositiveInt(equipment.defense, 0),
    hp: toPositiveInt(equipment.hp, 0),
    mana: toPositiveInt(equipment.mana, 0),
    effect: equipment.effect || null,
    upgradeLevel: toPositiveInt(equipment.upgradeLevel, 0),
  };
}

function buildEquipmentFromSnapshot(snapshot, characterId, fallbackName = '알 수 없는 장비') {
  return {
    characterId,
    name: snapshot?.name || fallbackName,
    type: snapshot?.type || 'weapon',
    rarity: snapshot?.rarity || 'common',
    attack: toPositiveInt(snapshot?.attack, 0),
    defense: toPositiveInt(snapshot?.defense, 0),
    hp: toPositiveInt(snapshot?.hp, 0),
    mana: toPositiveInt(snapshot?.mana, 0),
    effect: snapshot?.effect || null,
    equipped: false,
    upgradeLevel: toPositiveInt(snapshot?.upgradeLevel, 0),
  };
}

function resolveMinimumIncrement(currentPrice) {
  const safeCurrentPrice = Math.max(0, toSafeInt(currentPrice, 0));
  const byRate = Math.ceil((safeCurrentPrice * AUCTION_INCREMENT_RATE) / 100) * 100;
  return Math.max(AUCTION_MIN_INCREMENT, byRate);
}

function resolveMinimumBidAmount(auction) {
  if (!auction) {
    return AUCTION_MIN_START_PRICE;
  }

  const currentPrice = Math.max(
    toPositiveInt(auction.startPrice, 0),
    toPositiveInt(auction.currentPrice, 0),
  );
  return currentPrice + resolveMinimumIncrement(currentPrice);
}

function calculateAuctionFee(price) {
  return Math.floor(Math.max(0, toPositiveInt(price, 0)) * AUCTION_FEE_RATE);
}

function isAuctionExpired(auction, now = new Date()) {
  if (!auction?.expiresAt) {
    return true;
  }

  const expiresAt = new Date(auction.expiresAt);
  return expiresAt.getTime() <= now.getTime();
}

function getAuctionRemainingMs(auction, now = new Date()) {
  if (!auction?.expiresAt) {
    return 0;
  }

  const expiresAt = new Date(auction.expiresAt);
  return Math.max(0, expiresAt.getTime() - now.getTime());
}

async function createAuction({
  prisma,
  sellerUserId,
  equipmentId,
  startPrice,
  durationHours,
  reservePrice = null,
  now = new Date(),
}) {
  const safeEquipmentId = toSafeInt(equipmentId, 0);
  const safeStartPrice = toSafeInt(startPrice, 0);
  const safeDurationHours = toSafeInt(durationHours, 0);
  const safeReservePrice = reservePrice === null ? null : toSafeInt(reservePrice, 0);

  if (!Number.isInteger(safeEquipmentId) || safeEquipmentId <= 0) {
    throw new Error('INVALID_EQUIPMENT');
  }

  if (!Number.isInteger(safeStartPrice) || safeStartPrice < AUCTION_MIN_START_PRICE) {
    throw new Error('INVALID_START_PRICE');
  }

  if (safeStartPrice > AUCTION_MAX_START_PRICE) {
    throw new Error('START_PRICE_TOO_HIGH');
  }

  if (!isAllowedDurationHours(safeDurationHours)) {
    throw new Error('INVALID_DURATION');
  }

  if (safeReservePrice !== null && safeReservePrice > 0 && safeReservePrice < safeStartPrice) {
    throw new Error('INVALID_RESERVE_PRICE');
  }

  return prisma.$transaction(async (tx) => {
    const seller = await tx.character.findUnique({
      where: {
        userId: sellerUserId,
      },
      select: {
        id: true,
      },
    });

    if (!seller) {
      throw new Error('CHARACTER_NOT_FOUND');
    }

    const equipment = await tx.equipment.findUnique({
      where: {
        id: safeEquipmentId,
      },
    });

    if (!equipment || equipment.characterId !== seller.id) {
      throw new Error('EQUIPMENT_NOT_FOUND');
    }

    if (equipment.equipped) {
      throw new Error('EQUIPMENT_EQUIPPED');
    }

    if (!isAuctionableRarity(equipment.rarity)) {
      throw new Error('RARITY_NOT_ALLOWED');
    }

    const duplicated = await tx.auction.findFirst({
      where: {
        status: AUCTION_STATUSES.active,
        itemType: AUCTION_ITEM_TYPE,
        itemKey: `${safeEquipmentId}`,
      },
      select: {
        id: true,
      },
    });

    if (duplicated) {
      throw new Error('EQUIPMENT_ALREADY_LISTED');
    }

    const durationSeconds = safeDurationHours * 60 * 60;
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000);
    const snapshot = createAuctionEquipmentSnapshot(equipment);

    const auction = await tx.auction.create({
      data: {
        sellerId: seller.id,
        itemType: AUCTION_ITEM_TYPE,
        itemKey: `${safeEquipmentId}`,
        itemName: equipment.name,
        itemData: snapshot,
        startPrice: safeStartPrice,
        currentPrice: safeStartPrice,
        reservePrice: safeReservePrice && safeReservePrice > 0 ? safeReservePrice : null,
        duration: durationSeconds,
        status: AUCTION_STATUSES.active,
        highestBidderId: null,
        bidCount: 0,
        createdAt: now,
        expiresAt,
      },
    });

    await tx.equipment.delete({
      where: {
        id: safeEquipmentId,
      },
    });

    return auction;
  });
}

async function placeAuctionBid({
  prisma,
  bidderUserId,
  auctionId,
  bidAmount,
  now = new Date(),
}) {
  const safeAuctionId = toSafeInt(auctionId, 0);
  const safeBidAmount = toSafeInt(bidAmount, 0);

  if (!Number.isInteger(safeAuctionId) || safeAuctionId <= 0) {
    throw new Error('INVALID_AUCTION');
  }

  if (!Number.isInteger(safeBidAmount) || safeBidAmount <= 0) {
    throw new Error('INVALID_BID_AMOUNT');
  }

  return prisma.$transaction(async (tx) => {
    const bidder = await tx.character.findUnique({
      where: {
        userId: bidderUserId,
      },
      select: {
        id: true,
        gold: true,
      },
    });

    if (!bidder) {
      throw new Error('CHARACTER_NOT_FOUND');
    }

    const auction = await tx.auction.findUnique({
      where: {
        id: safeAuctionId,
      },
    });

    if (!auction) {
      throw new Error('AUCTION_NOT_FOUND');
    }

    if (auction.status !== AUCTION_STATUSES.active) {
      throw new Error('AUCTION_NOT_ACTIVE');
    }

    if (isAuctionExpired(auction, now)) {
      throw new Error('AUCTION_EXPIRED');
    }

    if (auction.sellerId === bidder.id) {
      throw new Error('SELF_BID_NOT_ALLOWED');
    }

    const minimumBidAmount = resolveMinimumBidAmount(auction);
    if (safeBidAmount < minimumBidAmount) {
      throw new Error('BID_TOO_LOW');
    }

    const debit = await tx.character.updateMany({
      where: {
        id: bidder.id,
        gold: {
          gte: safeBidAmount,
        },
      },
      data: {
        gold: {
          decrement: safeBidAmount,
        },
      },
    });

    if (debit.count === 0) {
      throw new Error('INSUFFICIENT_GOLD');
    }

    const hadWinningBid = auction.highestBidderId && auction.bidCount > 0;
    const previousHighestBidderId = auction.highestBidderId;
    const previousBidAmount = toPositiveInt(auction.currentPrice, 0);

    if (hadWinningBid) {
      await tx.character.update({
        where: {
          id: auction.highestBidderId,
        },
        data: {
          gold: {
            increment: previousBidAmount,
          },
        },
      });

      await tx.auctionBid.updateMany({
        where: {
          auctionId: auction.id,
          isWinning: true,
        },
        data: {
          isWinning: false,
        },
      });
    }

    let nextExpiresAt = new Date(auction.expiresAt);
    let wasExtended = false;
    const remainingMs = getAuctionRemainingMs(auction, now);
    const extensionTriggerMs = AUCTION_EXTENSION_TRIGGER_MINUTES * 60 * 1000;

    if (remainingMs <= extensionTriggerMs) {
      nextExpiresAt = new Date(nextExpiresAt.getTime() + AUCTION_EXTENSION_MINUTES * 60 * 1000);
      wasExtended = true;
    }

    const auctionUpdateResult = await tx.auction.updateMany({
      where: {
        id: auction.id,
        status: AUCTION_STATUSES.active,
        currentPrice: auction.currentPrice,
        bidCount: auction.bidCount,
      },
      data: {
        currentPrice: safeBidAmount,
        highestBidderId: bidder.id,
        bidCount: {
          increment: 1,
        },
        expiresAt: nextExpiresAt,
      },
    });

    if (auctionUpdateResult.count === 0) {
      throw new Error('AUCTION_CONFLICT');
    }

    const bid = await tx.auctionBid.create({
      data: {
        auctionId: auction.id,
        bidderId: bidder.id,
        bidAmount: safeBidAmount,
        bidAt: now,
        isWinning: true,
      },
    });

    const updatedAuction = await tx.auction.findUnique({
      where: {
        id: auction.id,
      },
    });

    return {
      auction: updatedAuction,
      bid,
      minimumBidAmount,
      wasExtended,
      extensionMinutes: wasExtended ? AUCTION_EXTENSION_MINUTES : 0,
      previousHighestBidderId,
      previousBidAmount,
    };
  });
}

async function finalizeAuction({
  prisma,
  auctionId,
  now = new Date(),
  force = false,
}) {
  const safeAuctionId = toSafeInt(auctionId, 0);

  if (!Number.isInteger(safeAuctionId) || safeAuctionId <= 0) {
    throw new Error('INVALID_AUCTION');
  }

  return prisma.$transaction(async (tx) => {
    const auction = await tx.auction.findUnique({
      where: {
        id: safeAuctionId,
      },
    });

    if (!auction) {
      return {
        status: 'not_found',
      };
    }

    if (auction.status !== AUCTION_STATUSES.active) {
      return {
        status: 'already_settled',
        auction,
      };
    }

    if (!force && !isAuctionExpired(auction, now)) {
      return {
        status: 'not_expired',
        auction,
      };
    }

    const itemSnapshot =
      auction.itemData && typeof auction.itemData === 'object' ? auction.itemData : {};

    const restoreItemToSeller = async () =>
      tx.equipment.create({
        data: buildEquipmentFromSnapshot(itemSnapshot, auction.sellerId, auction.itemName),
      });

    if (auction.highestBidderId && auction.bidCount > 0) {
      const reserveMet = !auction.reservePrice || auction.currentPrice >= auction.reservePrice;

      if (!reserveMet) {
        await tx.character.update({
          where: {
            id: auction.highestBidderId,
          },
          data: {
            gold: {
              increment: auction.currentPrice,
            },
          },
        });

        await tx.auctionBid.updateMany({
          where: {
            auctionId: auction.id,
            isWinning: true,
          },
          data: {
            isWinning: false,
          },
        });

        await restoreItemToSeller();

        const cancelledAuction = await tx.auction.update({
          where: {
            id: auction.id,
          },
          data: {
            status: AUCTION_STATUSES.cancelled,
            highestBidderId: null,
            completedAt: now,
          },
        });

        return {
          status: 'reserve_not_met',
          auction: cancelledAuction,
        };
      }

      const fee = calculateAuctionFee(auction.currentPrice);
      const sellerNet = auction.currentPrice - fee;

      await tx.character.update({
        where: {
          id: auction.sellerId,
        },
        data: {
          gold: {
            increment: sellerNet,
          },
          tradeVolume: {
            increment: auction.currentPrice,
          },
        },
      });

      await tx.character.update({
        where: {
          id: auction.highestBidderId,
        },
        data: {
          tradeVolume: {
            increment: auction.currentPrice,
          },
        },
      });

      await tx.equipment.create({
        data: buildEquipmentFromSnapshot(
          itemSnapshot,
          auction.highestBidderId,
          auction.itemName,
        ),
      });

      await tx.tradeHistory.create({
        data: {
          sellerId: auction.sellerId,
          buyerId: auction.highestBidderId,
          itemType: AUCTION_ITEM_TYPE,
          itemKey: `auction:${auction.id}`,
          itemName: auction.itemName,
          quantity: 1,
          price: auction.currentPrice,
          fee,
        },
      });

      await tx.rankingEvent.createMany({
        data: [
          {
            characterId: auction.sellerId,
            category: 'trade_volume',
            value: auction.currentPrice,
          },
          {
            characterId: auction.highestBidderId,
            category: 'trade_volume',
            value: auction.currentPrice,
          },
        ],
      });

      const completedAuction = await tx.auction.update({
        where: {
          id: auction.id,
        },
        data: {
          status: AUCTION_STATUSES.completed,
          completedAt: now,
        },
      });

      return {
        status: 'completed',
        auction: completedAuction,
        fee,
        sellerNet,
      };
    }

    await restoreItemToSeller();

    const cancelledAuction = await tx.auction.update({
      where: {
        id: auction.id,
      },
      data: {
        status: AUCTION_STATUSES.cancelled,
        completedAt: now,
      },
    });

    return {
      status: 'no_bids',
      auction: cancelledAuction,
    };
  });
}

async function settleExpiredAuctions(prisma, { now = new Date(), limit = 20 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, toSafeInt(limit, 20)));
  const expiredAuctions = await prisma.auction.findMany({
    where: {
      status: AUCTION_STATUSES.active,
      expiresAt: {
        lte: now,
      },
    },
    orderBy: {
      expiresAt: 'asc',
    },
    select: {
      id: true,
    },
    take: safeLimit,
  });

  const summary = {
    checked: expiredAuctions.length,
    completed: 0,
    cancelled: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };

  for (const entry of expiredAuctions) {
    try {
      const result = await finalizeAuction({
        prisma,
        auctionId: entry.id,
        now,
        force: true,
      });
      summary.results.push(result);

      if (result.status === 'completed') {
        summary.completed += 1;
      } else if (result.status === 'no_bids' || result.status === 'reserve_not_met') {
        summary.cancelled += 1;
      } else if (result.status === 'already_settled') {
        summary.skipped += 1;
      } else {
        summary.failed += 1;
      }
    } catch (error) {
      summary.failed += 1;
      summary.results.push({
        status: 'failed',
        auctionId: entry.id,
        error,
      });
    }
  }

  return summary;
}

async function listActiveAuctions(prisma, { take = 10 } = {}) {
  const safeTake = Math.min(25, Math.max(1, toSafeInt(take, 10)));
  return prisma.auction.findMany({
    where: {
      status: AUCTION_STATUSES.active,
    },
    orderBy: [
      { expiresAt: 'asc' },
      { createdAt: 'desc' },
    ],
    include: {
      seller: {
        select: {
          id: true,
          name: true,
        },
      },
      highestBidder: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: safeTake,
  });
}

async function listCharacterAuctions(
  prisma,
  characterId,
  { status = null, take = 20 } = {},
) {
  const safeCharacterId = toSafeInt(characterId, 0);
  const safeTake = Math.min(50, Math.max(1, toSafeInt(take, 20)));
  return prisma.auction.findMany({
    where: {
      sellerId: safeCharacterId,
      ...(status ? { status } : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: safeTake,
  });
}

async function getAuctionDetail(prisma, auctionId) {
  const safeAuctionId = toSafeInt(auctionId, 0);
  if (!Number.isInteger(safeAuctionId) || safeAuctionId <= 0) {
    return null;
  }

  return prisma.auction.findUnique({
    where: {
      id: safeAuctionId,
    },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
        },
      },
      highestBidder: {
        select: {
          id: true,
          name: true,
        },
      },
      bids: {
        orderBy: {
          bidAt: 'desc',
        },
        take: 10,
        include: {
          bidder: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

module.exports = {
  AUCTION_ITEM_TYPE,
  AUCTION_FEE_RATE,
  AUCTION_EXTENSION_TRIGGER_MINUTES,
  AUCTION_EXTENSION_MINUTES,
  AUCTION_MIN_START_PRICE,
  AUCTION_MAX_START_PRICE,
  AUCTION_MIN_INCREMENT,
  AUCTION_INCREMENT_RATE,
  AUCTION_ALLOWED_DURATIONS_HOURS,
  AUCTION_STATUSES,
  AUCTIONABLE_RARITIES,
  isAllowedDurationHours,
  isAuctionableRarity,
  createAuctionEquipmentSnapshot,
  buildEquipmentFromSnapshot,
  resolveMinimumIncrement,
  resolveMinimumBidAmount,
  calculateAuctionFee,
  isAuctionExpired,
  getAuctionRemainingMs,
  createAuction,
  placeAuctionBid,
  finalizeAuction,
  settleExpiredAuctions,
  listActiveAuctions,
  listCharacterAuctions,
  getAuctionDetail,
};
