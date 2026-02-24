/**
 * Guild City (NPC System)
 * 길드 전용 NPC 상인 임대 시스템
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { getCityItem, getAllCityItems, getMaterialInfo } = require('./guild-city-items');
const { GuildSystem } = require('./guild-system');

const prisma = new PrismaClient();

const CITY_BUTTON_PREFIX = 'city_';
const NPC_WEEKLY_FEE = 10000; // 주간 임대비

// ===== NPC 임대 =====

async function hireNPC(guildId, userId) {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: { npcs: true },
  });

  if (!guild) {
    return { success: false, error: '길드를 찾을 수 없습니다.' };
  }

  if (guild.masterId !== userId) {
    return { success: false, error: '길드장만 NPC를 임대할 수 있습니다.' };
  }

  if (guild.npcs.length > 0) {
    return { success: false, error: '이미 NPC를 임대했습니다.' };
  }

  if (guild.gold < NPC_WEEKLY_FEE) {
    return { success: false, error: `길드 자금이 부족합니다. (${NPC_WEEKLY_FEE.toLocaleString()}G 필요)` };
  }

  // NPC 생성
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7일 후

  const npc = await prisma.guildNPC.create({
    data: {
      guildId,
      npcType: 'merchant',
      npcName: `${guild.name}의 상인`,
      expiresAt,
      weeklyFee: NPC_WEEKLY_FEE,
    },
  });

  // 길드 자금 차감
  await prisma.guild.update({
    where: { id: guildId },
    data: { gold: guild.gold - NPC_WEEKLY_FEE },
  });

  // 초기 상품 등록
  const items = getAllCityItems();
  for (const item of items) {
    await prisma.nPCShopItem.create({
      data: {
        npcId: npc.id,
        itemType: item.type,
        itemKey: item.key,
        stock: 0,
      },
    });
  }

  return {
    success: true,
    npc,
    message: `✅ NPC 상인을 임대했습니다! (${NPC_WEEKLY_FEE.toLocaleString()}G 차감)\n💡 만료일: ${expiresAt.toLocaleDateString('ko-KR')}`,
  };
}

async function fireNPC(guildId, userId) {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: { npcs: true },
  });

  if (!guild) {
    return { success: false, error: '길드를 찾을 수 없습니다.' };
  }

  if (guild.masterId !== userId) {
    return { success: false, error: '길드장만 NPC를 해고할 수 있습니다.' };
  }

  if (guild.npcs.length === 0) {
    return { success: false, error: '임대한 NPC가 없습니다.' };
  }

  // NPC 삭제 (cascade로 상품/납품 기록도 함께 삭제됨)
  await prisma.guildNPC.deleteMany({
    where: { guildId },
  });

  return {
    success: true,
    message: '✅ NPC를 해고했습니다.',
  };
}

// ===== 도시 정보 =====

async function getCityInfo(guildId) {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: {
      npcs: {
        include: {
          shopItems: true,
        },
      },
    },
  });

  if (!guild || guild.npcs.length === 0) {
    return null;
  }

  const npc = guild.npcs[0];
  const daysLeft = Math.ceil((new Date(npc.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));

  return {
    guild,
    npc,
    daysLeft,
    totalStock: npc.shopItems.reduce((sum, item) => sum + item.stock, 0),
  };
}

// ===== 재료 납품 =====

async function contribute(npcId, characterId, itemKey) {
  const item = getCityItem(itemKey);
  if (!item) {
    return { success: false, error: '존재하지 않는 상품입니다.' };
  }

  // 캐릭터의 자원 확인
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { resources: true },
  });

  if (!character) {
    return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
  }

  // 재료 체크
  const resourceMap = new Map(character.resources.map(r => [r.type, r.quantity]));
  const lacking = [];

  for (const material of item.materials) {
    const have = resourceMap.get(material.type) || 0;
    if (have < material.qty) {
      lacking.push(`${material.name} ${material.qty - have}개`);
    }
  }

  if (lacking.length > 0) {
    return {
      success: false,
      error: `재료가 부족합니다:\n${lacking.join(', ')}`,
    };
  }

  // 재료 소모 + 상품 추가 (트랜잭션)
  await prisma.$transaction(async (tx) => {
    // 재료 차감
    for (const material of item.materials) {
      await tx.resource.update({
        where: {
          characterId_type: {
            characterId,
            type: material.type,
          },
        },
        data: {
          quantity: {
            decrement: material.qty,
          },
        },
      });
    }

    // 상품 재고 증가
    await tx.nPCShopItem.update({
      where: {
        npcId_itemType_itemKey: {
          npcId,
          itemType: item.type,
          itemKey: item.key,
        },
      },
      data: {
        stock: {
          increment: item.outputQty,
        },
      },
    });

    // 납품 기록
    await tx.nPCContribution.create({
      data: {
        npcId,
        characterId,
        itemKey: item.key,
        materialsUsed: JSON.stringify(item.materials),
        quantity: item.outputQty,
      },
    });
  });

  return {
    success: true,
    message: `✅ 납품 완료!\n${item.emoji} ${item.name} x${item.outputQty} 생성됨`,
  };
}

// ===== 상품 구매 =====

async function buyItem(npcId, characterId, itemKey, isGuildMember) {
  const item = getCityItem(itemKey);
  if (!item) {
    return { success: false, error: '존재하지 않는 상품입니다.' };
  }

  // 재고 확인
  const shopItem = await prisma.nPCShopItem.findUnique({
    where: {
      npcId_itemType_itemKey: {
        npcId,
        itemType: item.type,
        itemKey: item.key,
      },
    },
  });

  if (!shopItem || shopItem.stock <= 0) {
    return { success: false, error: '재고가 없습니다.' };
  }

  // 가격 결정
  const price = isGuildMember ? item.memberPrice : item.guestPrice;

  // 캐릭터 확인
  const character = await prisma.character.findUnique({
    where: { id: characterId },
  });

  if (!character) {
    return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
  }

  if (character.gold < price) {
    return { success: false, error: `골드가 부족합니다. (${price.toLocaleString()}G 필요)` };
  }

  // 구매 처리 (트랜잭션)
  await prisma.$transaction(async (tx) => {
    // 골드 차감
    await tx.character.update({
      where: { id: characterId },
      data: {
        gold: {
          decrement: price,
        },
      },
    });

    // 재고 차감
    await tx.nPCShopItem.update({
      where: {
        npcId_itemType_itemKey: {
          npcId,
          itemType: item.type,
          itemKey: item.key,
        },
      },
      data: {
        stock: {
          decrement: 1,
        },
      },
    });

    // 길드 금고에 수익 추가
    const npc = await tx.guildNPC.findUnique({
      where: { id: npcId },
    });

    if (npc) {
      await tx.guild.update({
        where: { id: npc.guildId },
        data: {
          gold: {
            increment: price,
          },
        },
      });
    }

    // 아이템 지급
    if (item.type === 'potion' || item.type === 'consumable') {
      // 소비 아이템
      const existing = await tx.consumable.findUnique({
        where: {
          characterId_type_effect: {
            characterId,
            type: item.key,
            effect: item.effect,
          },
        },
      });

      if (existing) {
        await tx.consumable.update({
          where: { id: existing.id },
          data: {
            quantity: {
              increment: 1,
            },
          },
        });
      } else {
        await tx.consumable.create({
          data: {
            characterId,
            type: item.key,
            name: item.name,
            effect: item.effect,
            power: item.power,
            quantity: 1,
          },
        });
      }
    }
  });

  return {
    success: true,
    message: `✅ 구매 완료!\n${item.emoji} ${item.name} x1 획득 (${price.toLocaleString()}G)`,
  };
}

// ===== UI 생성 함수 =====

function createCityMainEmbed(cityInfo) {
  const { guild, npc, daysLeft, totalStock } = cityInfo;

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`🏙️ ${guild.name}의 도시`)
    .setDescription(
      [
        createDivider(),
        `🏛️ NPC: ${npc.npcName}`,
        `⏰ 남은 기간: ${daysLeft}일`,
        `📦 총 재고: ${totalStock}개`,
        `💰 길드 자금: ${guild.gold.toLocaleString()}G`,
        '',
        createDivider(),
      ].join('\n')
    )
    .setFooter({ text: `💡 재료를 납품하여 상품을 생성하세요` });
}

function createCityMainButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('city_shop')
        .setLabel('상점')
        .setEmoji('🏪')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('city_contribute')
        .setLabel('재료 납품')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('city_stats')
        .setLabel('통계')
        .setEmoji('📊')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('guild_info')
        .setLabel('길드로')
        .setEmoji('🏰')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

module.exports = {
  CITY_BUTTON_PREFIX,
  NPC_WEEKLY_FEE,
  hireNPC,
  fireNPC,
  getCityInfo,
  contribute,
  buyItem,
  createCityMainEmbed,
  createCityMainButtons,
};
