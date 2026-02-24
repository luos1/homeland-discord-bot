const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const prisma = require('../database/client');
const { EMBED_COLORS } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');
const { logger } = require('../utils/server-logger');

// ═══════════════════════════════════════════════════════════════
// 설정
// ═══════════════════════════════════════════════════════════════
const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
const SLOT_WEIGHTS = [30, 25, 20, 15, 7, 3];

const VIP_SLOT_SYMBOLS = ['💎', '👑', '🌟', '💰', '🔥', '7️⃣'];
const VIP_SLOT_WEIGHTS = [25, 22, 20, 18, 10, 5];

const MIN_BET = 100;
const MAX_BET = 10000;
const VIP_MIN_BET = 1000;
const VIP_MAX_BET = 100000;

// 연승 추적 (메모리)
const winStreaks = new Map();
const STREAK_BONUS = {
  3: 1.2,
  5: 1.5,
  7: 2.0,
  10: 3.0
};

// 일일 무료 스핀 추적
const freeSpinUsed = new Map();

// 버튼 prefix
const BTN_PREFIX = {
  SLOT_AGAIN: 'gamble_slot_again:',
  SLOT_DOUBLE: 'gamble_slot_double:',
  VIP_AGAIN: 'gamble_vip_again:',
  VIP_DOUBLE: 'gamble_vip_double:',
  COIN_AGAIN: 'gamble_coin_again:',
  COIN_DOUBLE: 'gamble_coin_double:',
  DICE_AGAIN: 'gamble_dice_again:',
  DICE_DOUBLE: 'gamble_dice_double:',
  STOP: 'gamble_stop'
};

// ═══════════════════════════════════════════════════════════════
// 유틸리티 함수
// ═══════════════════════════════════════════════════════════════
function weightedRandom(symbols, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < symbols.length; i++) {
    random -= weights[i];
    if (random <= 0) return symbols[i];
  }
  return symbols[0];
}

function spinSlot(symbols = SLOT_SYMBOLS, weights = SLOT_WEIGHTS) {
  return [
    [weightedRandom(symbols, weights), weightedRandom(symbols, weights), weightedRandom(symbols, weights)],
    [weightedRandom(symbols, weights), weightedRandom(symbols, weights), weightedRandom(symbols, weights)],
    [weightedRandom(symbols, weights), weightedRandom(symbols, weights), weightedRandom(symbols, weights)],
  ];
}

function checkWin(grid, isVip = false) {
  const middleRow = grid[1];
  
  if (middleRow.every(s => s === '7️⃣')) {
    return { multiplier: isVip ? 100 : 50, type: '🎰 MEGA JACKPOT! 777!', isJackpot: true };
  }
  
  if (middleRow[0] === middleRow[1] && middleRow[1] === middleRow[2]) {
    const symbol = middleRow[0];
    if (symbol === '💎') return { multiplier: isVip ? 30 : 20, type: '💎💎💎 다이아몬드!', isJackpot: true };
    if (symbol === '👑') return { multiplier: 40, type: '👑👑👑 로얄!', isJackpot: true };
    return { multiplier: isVip ? 15 : 10, type: `${symbol}${symbol}${symbol} 잭팟!`, isJackpot: false };
  }
  
  if (middleRow[0] === middleRow[1] || middleRow[1] === middleRow[2]) {
    return { multiplier: isVip ? 3 : 2, type: '2개 일치!', isJackpot: false };
  }
  
  return { multiplier: 0, type: '꽝!', isJackpot: false };
}

function getStreakBonus(streak) {
  let bonus = 1.0;
  for (const [threshold, mult] of Object.entries(STREAK_BONUS)) {
    if (streak >= parseInt(threshold)) bonus = mult;
  }
  return bonus;
}

function updateStreak(userId, won) {
  const current = winStreaks.get(userId) || 0;
  if (won) {
    winStreaks.set(userId, current + 1);
    return current + 1;
  } else {
    winStreaks.set(userId, 0);
    return 0;
  }
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function canFreeSpin(userId) {
  const key = `${userId}-${getTodayKey()}`;
  return !freeSpinUsed.has(key);
}

function useFreeSpin(userId) {
  const key = `${userId}-${getTodayKey()}`;
  freeSpinUsed.set(key, true);
}

async function announceJackpot(character, game, bet, winnings) {
  try {
    await logger.log('jackpot', `🎰 **[JACKPOT]** ${character.name}님이 ${game}에서 **${winnings.toLocaleString()}G** 대박! (배팅: ${bet.toLocaleString()}G)`);
  } catch (e) {
    console.error('Jackpot announce failed:', e);
  }
}

// 버튼 생성 함수들
function createSlotButtons(bet, isVip = false) {
  const prefix = isVip ? BTN_PREFIX.VIP_AGAIN : BTN_PREFIX.SLOT_AGAIN;
  const doublePrefix = isVip ? BTN_PREFIX.VIP_DOUBLE : BTN_PREFIX.SLOT_DOUBLE;
  const maxBet = isVip ? VIP_MAX_BET : MAX_BET;
  const doubleBet = Math.min(bet * 2, maxBet);
  
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}${bet}`)
      .setLabel(`🔄 다시 (${bet.toLocaleString()}G)`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${doublePrefix}${doubleBet}`)
      .setLabel(`⬆️ 2배 (${doubleBet.toLocaleString()}G)`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(bet >= maxBet),
    new ButtonBuilder()
      .setCustomId(BTN_PREFIX.STOP)
      .setLabel('🛑 그만하기')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createCoinButtons(bet, choice) {
  const doubleBet = Math.min(bet * 2, MAX_BET);
  
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BTN_PREFIX.COIN_AGAIN}${bet}:${choice}`)
      .setLabel(`🔄 다시 (${bet.toLocaleString()}G)`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${BTN_PREFIX.COIN_DOUBLE}${doubleBet}:${choice}`)
      .setLabel(`⬆️ 2배 (${doubleBet.toLocaleString()}G)`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(bet >= MAX_BET),
    new ButtonBuilder()
      .setCustomId(BTN_PREFIX.STOP)
      .setLabel('🛑 그만하기')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createDiceButtons(bet) {
  const doubleBet = Math.min(bet * 2, MAX_BET);
  
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BTN_PREFIX.DICE_AGAIN}${bet}`)
      .setLabel(`🔄 다시 (${bet.toLocaleString()}G)`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${BTN_PREFIX.DICE_DOUBLE}${doubleBet}`)
      .setLabel(`⬆️ 2배 (${doubleBet.toLocaleString()}G)`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(bet >= MAX_BET),
    new ButtonBuilder()
      .setCustomId(BTN_PREFIX.STOP)
      .setLabel('🛑 그만하기')
      .setStyle(ButtonStyle.Secondary)
  );
}

// ═══════════════════════════════════════════════════════════════
// 슬롯 로직 (공통)
// ═══════════════════════════════════════════════════════════════
async function playSlot(interaction, bet, isVip = false, isButton = false) {
  const userId = interaction.user.id;
  
  const character = await prisma.character.findFirst({
    where: { userId },
    include: { premiumSubscription: true }
  });
  
  if (!character) {
    const content = '❌ 캐릭터가 없습니다! `/create`로 생성해주세요.';
    return isButton ? interaction.update({ content, embeds: [], components: [] }) : interaction.reply({ content, ephemeral: true });
  }
  
  if (isVip && !character.isPremium) {
    const content = '👑 VIP 슬롯은 **프리미엄 회원** 전용입니다!';
    return isButton ? interaction.update({ content, embeds: [], components: [] }) : interaction.reply({ content, ephemeral: true });
  }

  if (character.gold < bet) {
    const content = `❌ 골드가 부족합니다! (보유: ${character.gold.toLocaleString()}G)`;
    return isButton ? interaction.update({ content, embeds: [], components: [] }) : interaction.reply({ content, ephemeral: true });
  }

  await prisma.character.update({
    where: { id: character.id },
    data: { gold: { decrement: bet } }
  });

  const symbols = isVip ? VIP_SLOT_SYMBOLS : SLOT_SYMBOLS;
  const weights = isVip ? VIP_SLOT_WEIGHTS : SLOT_WEIGHTS;
  const grid = spinSlot(symbols, weights);
  const result = checkWin(grid, isVip);
  
  const won = result.multiplier > 0;
  const streak = updateStreak(userId, won);
  const streakBonus = won ? getStreakBonus(streak) : 1.0;
  
  let winnings = Math.floor(bet * result.multiplier * streakBonus);

  if (winnings > 0) {
    await prisma.character.update({
      where: { id: character.id },
      data: { gold: { increment: winnings } }
    });
    
    if (result.isJackpot && winnings >= (isVip ? 50000 : 10000)) {
      announceJackpot(character, isVip ? 'VIP슬롯' : '슬롯', bet, winnings);
    }
  }

  const netGain = winnings - bet;
  const newGold = character.gold - bet + winnings;
  const slotDisplay = grid.map(row => `║ ${row.join(' │ ')} ║`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(isVip ? '👑 VIP 슬롯머신' : '🎰 슬롯머신')
    .setDescription(
      '```\n╔═══════════════╗\n' + slotDisplay + '\n╚═══════════════╝\n```\n➤ 중앙 라인 체크!'
    )
    .addFields(
      { name: '결과', value: result.type, inline: true },
      { name: '배팅', value: `${bet.toLocaleString()}G`, inline: true },
      { name: netGain >= 0 ? '🎉 획득' : '💸 손실', value: `${netGain >= 0 ? '+' : ''}${netGain.toLocaleString()}G`, inline: true }
    );
  
  if (streak >= 3 && won) {
    embed.addFields({ name: '🔥 연승 보너스', value: `${streak}연승! (x${streakBonus})`, inline: true });
  }
  
  embed.addFields({ name: '💰 보유 골드', value: `${newGold.toLocaleString()}G`, inline: false })
    .setColor(winnings > 0 ? (isVip ? 0xFFD700 : EMBED_COLORS.victory) : EMBED_COLORS.defeat)
    .setFooter({ text: isVip ? '👑 VIP: 777=100배 | 👑👑👑=40배 | 💎💎💎=30배' : '777=50배 | 💎💎💎=20배 | 3일치=10배 | 2일치=2배' });

  const buttons = createSlotButtons(bet, isVip);
  
  if (isButton) {
    return interaction.update({ embeds: [embed], components: [buttons] });
  }
  return interaction.reply({ embeds: [embed], components: [buttons] });
}

// ═══════════════════════════════════════════════════════════════
// 코인 로직 (공통)
// ═══════════════════════════════════════════════════════════════
async function playCoin(interaction, bet, choice, isButton = false) {
  const userId = interaction.user.id;
  
  const character = await prisma.character.findFirst({
    where: { userId }
  });
  
  if (!character) {
    const content = '❌ 캐릭터가 없습니다!';
    return isButton ? interaction.update({ content, embeds: [], components: [] }) : interaction.reply({ content, ephemeral: true });
  }

  if (character.gold < bet) {
    const content = `❌ 골드가 부족합니다! (보유: ${character.gold.toLocaleString()}G)`;
    return isButton ? interaction.update({ content, embeds: [], components: [] }) : interaction.reply({ content, ephemeral: true });
  }

  await prisma.character.update({
    where: { id: character.id },
    data: { gold: { decrement: bet } }
  });

  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = choice === result;
  
  const streak = updateStreak(userId, won);
  const streakBonus = won ? getStreakBonus(streak) : 1.0;
  
  let winnings = won ? Math.floor(bet * 2 * streakBonus) : 0;

  if (winnings > 0) {
    await prisma.character.update({
      where: { id: character.id },
      data: { gold: { increment: winnings } }
    });
  }

  const netGain = winnings - bet;
  const newGold = character.gold - bet + winnings;

  const resultEmoji = result === 'heads' ? '🪙' : '🔴';
  const resultText = result === 'heads' ? '앞면' : '뒷면';
  const choiceText = choice === 'heads' ? '앞면' : '뒷면';

  const embed = new EmbedBuilder()
    .setTitle('🪙 동전 던지기')
    .setDescription(
      `동전이 공중으로...\n\n# ${resultEmoji} ${resultText}!\n\n당신의 선택: **${choiceText}**`
    )
    .addFields(
      { name: '결과', value: won ? '🎉 승리!' : '💀 패배...', inline: true },
      { name: '배팅', value: `${bet.toLocaleString()}G`, inline: true },
      { name: won ? '🎉 획득' : '💸 손실', value: `${won ? '+' : ''}${netGain.toLocaleString()}G`, inline: true }
    );
    
  if (streak >= 3 && won) {
    embed.addFields({ name: '🔥 연승 보너스', value: `${streak}연승! (x${streakBonus})`, inline: true });
  }
  
  embed.addFields({ name: '💰 보유 골드', value: `${newGold.toLocaleString()}G`, inline: false })
    .setColor(won ? EMBED_COLORS.victory : EMBED_COLORS.defeat);

  const buttons = createCoinButtons(bet, choice);
  
  if (isButton) {
    return interaction.update({ embeds: [embed], components: [buttons] });
  }
  return interaction.reply({ embeds: [embed], components: [buttons] });
}

// ═══════════════════════════════════════════════════════════════
// 주사위 로직 (공통)
// ═══════════════════════════════════════════════════════════════
async function playDice(interaction, bet, isButton = false) {
  const userId = interaction.user.id;
  
  const character = await prisma.character.findFirst({
    where: { userId }
  });
  
  if (!character) {
    const content = '❌ 캐릭터가 없습니다!';
    return isButton ? interaction.update({ content, embeds: [], components: [] }) : interaction.reply({ content, ephemeral: true });
  }

  if (character.gold < bet) {
    const content = `❌ 골드가 부족합니다! (보유: ${character.gold.toLocaleString()}G)`;
    return isButton ? interaction.update({ content, embeds: [], components: [] }) : interaction.reply({ content, ephemeral: true });
  }

  await prisma.character.update({
    where: { id: character.id },
    data: { gold: { decrement: bet } }
  });

  const playerDice1 = Math.floor(Math.random() * 6) + 1;
  const playerDice2 = Math.floor(Math.random() * 6) + 1;
  const dealerDice1 = Math.floor(Math.random() * 6) + 1;
  const dealerDice2 = Math.floor(Math.random() * 6) + 1;

  const playerTotal = playerDice1 + playerDice2;
  const dealerTotal = dealerDice1 + dealerDice2;

  const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const playerEmoji1 = diceEmojis[playerDice1 - 1];
  const playerEmoji2 = diceEmojis[playerDice2 - 1];
  const dealerEmoji1 = diceEmojis[dealerDice1 - 1];
  const dealerEmoji2 = diceEmojis[dealerDice2 - 1];

  let resultText, won, winnings;

  if (playerTotal > dealerTotal) {
    won = true;
    const streak = updateStreak(userId, true);
    const streakBonus = getStreakBonus(streak);
    winnings = Math.floor(bet * 2 * streakBonus);
    resultText = streak >= 3 ? `🎉 승리! (${streak}연승 x${streakBonus})` : '🎉 승리!';
  } else if (playerTotal < dealerTotal) {
    updateStreak(userId, false);
    resultText = '💀 패배...';
    won = false;
    winnings = 0;
  } else {
    resultText = '🤝 무승부! (환불)';
    won = null;
    winnings = bet;
  }

  if (winnings > 0) {
    await prisma.character.update({
      where: { id: character.id },
      data: { gold: { increment: winnings } }
    });
  }

  const netGain = winnings - bet;
  const newGold = character.gold - bet + winnings;

  const embed = new EmbedBuilder()
    .setTitle('🎲 주사위 대결')
    .setDescription(
      `**당신:** ${playerEmoji1} ${playerEmoji2} = **${playerTotal}**\n` +
      `**딜러:** ${dealerEmoji1} ${dealerEmoji2} = **${dealerTotal}**`
    )
    .addFields(
      { name: '결과', value: resultText, inline: true },
      { name: '배팅', value: `${bet.toLocaleString()}G`, inline: true },
      { name: won === true ? '🎉 획득' : won === false ? '💸 손실' : '🔄 환불', value: `${netGain >= 0 ? '+' : ''}${netGain.toLocaleString()}G`, inline: true },
      { name: '💰 보유 골드', value: `${newGold.toLocaleString()}G`, inline: false }
    )
    .setColor(won === true ? EMBED_COLORS.victory : won === false ? EMBED_COLORS.defeat : EMBED_COLORS.neutral);

  const buttons = createDiceButtons(bet);
  
  if (isButton) {
    return interaction.update({ embeds: [embed], components: [buttons] });
  }
  return interaction.reply({ embeds: [embed], components: [buttons] });
}

// ═══════════════════════════════════════════════════════════════
// /slot 커맨드
// ═══════════════════════════════════════════════════════════════
const slotCommand = {
  data: new SlashCommandBuilder()
    .setName('slot')
    .setNameLocalizations({ ko: '슬롯' })
    .setDescription('슬롯머신을 돌려 골드를 걸어보세요!')
    .setDescriptionLocalizations({ ko: '슬롯머신을 돌려 골드를 걸어보세요!' })
    .addIntegerOption(opt =>
      opt.setName('bet')
        .setNameLocalizations({ ko: '배팅' })
        .setDescription('배팅할 골드 (100~10000)')
        .setDescriptionLocalizations({ ko: '배팅할 골드 (100~10000)' })
        .setRequired(true)
        .setMinValue(MIN_BET)
        .setMaxValue(MAX_BET)
    ),

  async execute(interaction) {
    const bet = interaction.options.getInteger('bet');
    return playSlot(interaction, bet, false, false);
  },
  
  // 버튼 핸들러
  async handleButton(interaction, customId) {
    if (customId.startsWith(BTN_PREFIX.SLOT_AGAIN)) {
      const bet = parseInt(customId.replace(BTN_PREFIX.SLOT_AGAIN, ''));
      return playSlot(interaction, bet, false, true);
    }
    if (customId.startsWith(BTN_PREFIX.SLOT_DOUBLE)) {
      const bet = parseInt(customId.replace(BTN_PREFIX.SLOT_DOUBLE, ''));
      return playSlot(interaction, bet, false, true);
    }
    if (customId === BTN_PREFIX.STOP) {
      return interaction.update({ 
        content: '🛑 게임을 종료했습니다. 다음에 또 만나요!', 
        embeds: [], 
        components: [] 
      });
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// /freespin 커맨드
// ═══════════════════════════════════════════════════════════════
const freespinCommand = {
  data: new SlashCommandBuilder()
    .setName('freespin')
    .setNameLocalizations({ ko: '무료스핀' })
    .setDescription('하루 1회 무료 슬롯! (당첨금 500G 고정)')
    .setDescriptionLocalizations({ ko: '하루 1회 무료 슬롯! (당첨금 500G 고정)' }),

  async execute(interaction) {
    const character = await requireCharacter(interaction);
    if (!character) return;

    const userId = interaction.user.id;

    if (!canFreeSpin(userId)) {
      return interaction.reply({
        content: `⏰ 오늘의 무료 스핀을 이미 사용했습니다!\n내일 다시 시도해주세요.`,
        ephemeral: true
      });
    }

    useFreeSpin(userId);

    const grid = spinSlot();
    const result = checkWin(grid);
    const FREE_PRIZE = 500;
    
    let winnings = result.multiplier > 0 ? FREE_PRIZE * Math.min(result.multiplier, 10) : 0;

    if (winnings > 0) {
      await prisma.character.update({
        where: { id: character.id },
        data: { gold: { increment: winnings } }
      });
    }

    const newGold = character.gold + winnings;
    const slotDisplay = grid.map(row => `║ ${row.join(' │ ')} ║`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🎁 무료 스핀!')
      .setDescription(
        '```\n╔═══════════════╗\n' + slotDisplay + '\n╚═══════════════╝\n```\n➤ 중앙 라인 체크!'
      )
      .addFields(
        { name: '결과', value: result.type, inline: true },
        { name: '🎁 무료!', value: '배팅 0G', inline: true },
        { name: winnings > 0 ? '🎉 획득' : '💨 꽝', value: winnings > 0 ? `+${winnings.toLocaleString()}G` : '0G', inline: true },
        { name: '💰 보유 골드', value: `${newGold.toLocaleString()}G`, inline: false }
      )
      .setColor(winnings > 0 ? EMBED_COLORS.victory : EMBED_COLORS.neutral)
      .setFooter({ text: '무료 스핀은 하루 1회! 내일 또 만나요 🎰' });

    return interaction.reply({ embeds: [embed] });
  }
};

// ═══════════════════════════════════════════════════════════════
// /vipslot 커맨드
// ═══════════════════════════════════════════════════════════════
const vipslotCommand = {
  data: new SlashCommandBuilder()
    .setName('vipslot')
    .setNameLocalizations({ ko: 'VIP슬롯' })
    .setDescription('💎 VIP 전용 고배율 슬롯! (프리미엄 전용)')
    .setDescriptionLocalizations({ ko: '💎 VIP 전용 고배율 슬롯! (프리미엄 전용)' })
    .addIntegerOption(opt =>
      opt.setName('bet')
        .setNameLocalizations({ ko: '배팅' })
        .setDescription('배팅할 골드 (1000~100000)')
        .setDescriptionLocalizations({ ko: '배팅할 골드 (1000~100000)' })
        .setRequired(true)
        .setMinValue(VIP_MIN_BET)
        .setMaxValue(VIP_MAX_BET)
    ),

  async execute(interaction) {
    const bet = interaction.options.getInteger('bet');
    return playSlot(interaction, bet, true, false);
  },
  
  async handleButton(interaction, customId) {
    if (customId.startsWith(BTN_PREFIX.VIP_AGAIN)) {
      const bet = parseInt(customId.replace(BTN_PREFIX.VIP_AGAIN, ''));
      return playSlot(interaction, bet, true, true);
    }
    if (customId.startsWith(BTN_PREFIX.VIP_DOUBLE)) {
      const bet = parseInt(customId.replace(BTN_PREFIX.VIP_DOUBLE, ''));
      return playSlot(interaction, bet, true, true);
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// /coin 커맨드
// ═══════════════════════════════════════════════════════════════
const coinCommand = {
  data: new SlashCommandBuilder()
    .setName('coin')
    .setNameLocalizations({ ko: '코인' })
    .setDescription('동전 던지기! 맞추면 2배!')
    .setDescriptionLocalizations({ ko: '동전 던지기! 맞추면 2배!' })
    .addIntegerOption(opt =>
      opt.setName('bet')
        .setNameLocalizations({ ko: '배팅' })
        .setDescription('배팅할 골드 (100~10000)')
        .setDescriptionLocalizations({ ko: '배팅할 골드 (100~10000)' })
        .setRequired(true)
        .setMinValue(MIN_BET)
        .setMaxValue(MAX_BET)
    )
    .addStringOption(opt =>
      opt.setName('choice')
        .setNameLocalizations({ ko: '선택' })
        .setDescription('앞면 또는 뒷면')
        .setDescriptionLocalizations({ ko: '앞면 또는 뒷면' })
        .setRequired(true)
        .addChoices(
          { name: '🪙 앞면 (Heads)', value: 'heads' },
          { name: '🔴 뒷면 (Tails)', value: 'tails' }
        )
    ),

  async execute(interaction) {
    const bet = interaction.options.getInteger('bet');
    const choice = interaction.options.getString('choice');
    return playCoin(interaction, bet, choice, false);
  },
  
  async handleButton(interaction, customId) {
    if (customId.startsWith(BTN_PREFIX.COIN_AGAIN)) {
      const [bet, choice] = customId.replace(BTN_PREFIX.COIN_AGAIN, '').split(':');
      return playCoin(interaction, parseInt(bet), choice, true);
    }
    if (customId.startsWith(BTN_PREFIX.COIN_DOUBLE)) {
      const [bet, choice] = customId.replace(BTN_PREFIX.COIN_DOUBLE, '').split(':');
      return playCoin(interaction, parseInt(bet), choice, true);
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// /dice 커맨드
// ═══════════════════════════════════════════════════════════════
const diceCommand = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setNameLocalizations({ ko: '주사위' })
    .setDescription('딜러와 주사위 대결! 이기면 2배!')
    .setDescriptionLocalizations({ ko: '딜러와 주사위 대결! 이기면 2배!' })
    .addIntegerOption(opt =>
      opt.setName('bet')
        .setNameLocalizations({ ko: '배팅' })
        .setDescription('배팅할 골드 (100~10000)')
        .setDescriptionLocalizations({ ko: '배팅할 골드 (100~10000)' })
        .setRequired(true)
        .setMinValue(MIN_BET)
        .setMaxValue(MAX_BET)
    ),

  async execute(interaction) {
    const bet = interaction.options.getInteger('bet');
    return playDice(interaction, bet, false);
  },
  
  async handleButton(interaction, customId) {
    if (customId.startsWith(BTN_PREFIX.DICE_AGAIN)) {
      const bet = parseInt(customId.replace(BTN_PREFIX.DICE_AGAIN, ''));
      return playDice(interaction, bet, true);
    }
    if (customId.startsWith(BTN_PREFIX.DICE_DOUBLE)) {
      const bet = parseInt(customId.replace(BTN_PREFIX.DICE_DOUBLE, ''));
      return playDice(interaction, bet, true);
    }
  }
};

module.exports = [slotCommand, freespinCommand, vipslotCommand, coinCommand, diceCommand];
