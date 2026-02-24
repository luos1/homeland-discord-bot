const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { generateEquipment, RARITIES } = require('../game/equipment');
const {
  ATTENDANCE_TIMEZONE,
  calculateNextAttendanceStreak,
  getAttendanceReward,
  getDateKeyInKST,
  getMonthMetaFromDateKey,
  renderAttendanceCalendar,
} = require('../game/attendance');
const {
  EMBED_COLORS,
  createDivider,
  formatNumber,
} = require('../utils/ui');
const { createVillageNavigationRow, VILLAGE_MENU_KEYS } = require('../utils/village');
const { resolvePremiumBenefits } = require('../game/premium');
const { requireCharacter } = require('../utils/response-helpers');

function createRewardLines({ rewardPlan, grantedEquipment, premiumDailyGems = 0 }) {
  const lines = [`💰 골드 +${formatNumber(rewardPlan.gold)}G`];

  if (premiumDailyGems > 0) {
    lines.push(`💠 프리미엄 일일 젬 +${formatNumber(premiumDailyGems)}`);
  }

  rewardPlan.consumables.forEach((item) => {
    lines.push(item.displayName);
  });

  if (grantedEquipment) {
    const rarity = RARITIES[grantedEquipment.rarity];
    const rarityLabel = rarity ? `${rarity.emoji} ${rarity.name}` : grantedEquipment.rarity;
    lines.push(`${rarityLabel} 장비: **${grantedEquipment.name}**`);
  }

  return lines;
}

function createAttendanceEmbed({
  character,
  monthMeta,
  currentStreak,
  maxStreak,
  todayAlreadyClaimed,
  streakReset,
  rewardLines,
  calendarText,
}) {
  const statusLine = todayAlreadyClaimed
    ? '✅ 오늘 출석은 이미 완료되었습니다.'
    : '🎉 오늘 출석 체크가 완료되었습니다!';

  const descriptionLines = [
    createDivider(),
    `🧑 캐릭터: ${character.name}`,
    `🔥 연속 출석: ${currentStreak}일`,
    `🏆 최장 연속: ${maxStreak}일`,
    `🗓️ ${monthMeta.year}년 ${monthMeta.month}월`,
    createDivider(),
    statusLine,
  ];

  if (streakReset && !todayAlreadyClaimed) {
    descriptionLines.push('⚠️ 하루 이상 비워 스트릭이 1일부터 다시 시작되었습니다.');
  }

  if (!todayAlreadyClaimed && rewardLines.length > 0) {
    descriptionLines.push('', '🎁 오늘 보상', ...rewardLines);
  }

  descriptionLines.push(
    '',
    createDivider(),
    '```',
    calendarText,
    '```',
    '범례: O=출석완료, *=오늘, -=미출석, .=미래',
  );

  return new EmbedBuilder()
    .setColor(todayAlreadyClaimed ? EMBED_COLORS.neutral : EMBED_COLORS.create)
    .setTitle(todayAlreadyClaimed ? '📅 출석 캘린더' : '📅 출석 체크 완료')
    .setDescription(descriptionLines.join('\n'))
    .setFooter({
      text: `매일 자정(00:00, ${ATTENDANCE_TIMEZONE}) 기준으로 출석이 초기화됩니다.`,
    });
}

async function getAttendanceDashboard(prisma, characterId, todayDateKey) {
  const monthMeta = getMonthMetaFromDateKey(todayDateKey);

  const [monthlyRecords, todayRecord, maxStreakAggregate] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        characterId,
        date: {
          startsWith: monthMeta.monthKey,
        },
      },
      orderBy: {
        date: 'asc',
      },
    }),
    prisma.attendanceRecord.findUnique({
      where: {
        characterId_date: {
          characterId,
          date: todayDateKey,
        },
      },
    }),
    prisma.attendanceRecord.aggregate({
      where: {
        characterId,
      },
      _max: {
        streak: true,
      },
    }),
  ]);

  return {
    monthMeta,
    monthlyRecords,
    todayRecord,
    maxStreak: maxStreakAggregate._max.streak ?? 0,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('attendance')
    .setDescription('하루 1회 출석 체크를 진행하고 보상을 받습니다'),

  async execute(interaction, { prisma }) {
    const character = await requireCharacter(prisma, interaction);
    if (!character) return;

    const todayDateKey = getDateKeyInKST();
    const premiumSubscription = await prisma.premiumSubscription.findUnique({
      where: {
        userId: interaction.user.id,
      },
    });
    const premiumBenefits = resolvePremiumBenefits(premiumSubscription);

    const latestRecord = await prisma.attendanceRecord.findFirst({
      where: {
        characterId: character.id,
      },
      orderBy: {
        date: 'desc',
      },
    });

    const streakStatus = calculateNextAttendanceStreak(latestRecord, todayDateKey);
    let todayAlreadyClaimed = streakStatus.alreadyClaimedToday;
    let rewardLines = [];

    if (!todayAlreadyClaimed) {
      const rewardPlan = getAttendanceReward(streakStatus.streak);

      try {
        const claimResult = await prisma.$transaction(async (tx) => {
          await tx.attendanceRecord.create({
            data: {
              characterId: character.id,
              date: todayDateKey,
              streak: streakStatus.streak,
              claimed: true,
            },
          });

          await tx.character.update({
            where: {
              id: character.id,
            },
            data: {
              gold: {
                increment: rewardPlan.gold,
              },
              ...(premiumBenefits.dailyGemBonus > 0
                ? {
                    gems: {
                      increment: premiumBenefits.dailyGemBonus,
                    },
                  }
                : {}),
            },
          });

          for (const consumable of rewardPlan.consumables) {
            await tx.consumable.upsert({
              where: {
                characterId_type_effect: {
                  characterId: character.id,
                  type: consumable.type,
                  effect: consumable.effect,
                },
              },
              update: {
                quantity: {
                  increment: consumable.quantity,
                },
              },
              create: {
                characterId: character.id,
                name: consumable.name,
                type: consumable.type,
                effect: consumable.effect,
                power: consumable.power,
                duration: consumable.duration,
                quantity: consumable.quantity,
              },
            });
          }

          let grantedEquipment = null;

          if (rewardPlan.equipmentRarity) {
            const rolledEquipment = generateEquipment(character.level, {
              rarity: rewardPlan.equipmentRarity,
            });

            grantedEquipment = await tx.equipment.create({
              data: {
                characterId: character.id,
                name: rolledEquipment.name,
                type: rolledEquipment.type,
                rarity: rolledEquipment.rarity,
                attack: rolledEquipment.attack,
                defense: rolledEquipment.defense,
                hp: rolledEquipment.hp,
                mana: rolledEquipment.mana,
                effect: rolledEquipment.effect,
                equipped: false,
              },
            });
          }

          return {
            grantedEquipment,
          };
        });

        rewardLines = createRewardLines({
          rewardPlan,
          grantedEquipment: claimResult.grantedEquipment,
          premiumDailyGems: premiumBenefits.dailyGemBonus,
        });
      } catch (error) {
        if (error.code === 'P2002') {
          todayAlreadyClaimed = true;
        } else {
          throw error;
        }
      }
    }

    const dashboard = await getAttendanceDashboard(prisma, character.id, todayDateKey);
    const currentStreak = dashboard.todayRecord?.streak ?? 0;
    const calendarText = renderAttendanceCalendar({
      monthMeta: dashboard.monthMeta,
      monthlyRecords: dashboard.monthlyRecords,
      todayDateKey,
    });

    const embed = createAttendanceEmbed({
      character,
      monthMeta: dashboard.monthMeta,
      currentStreak,
      maxStreak: Math.max(dashboard.maxStreak, currentStreak),
      todayAlreadyClaimed,
      streakReset: streakStatus.reset,
      rewardLines,
      calendarText,
    });

    await interaction.reply({
      embeds: [embed],
      components: [createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.daily })],
    });
  },

  createAttendanceEmbed,
  createRewardLines,
};
