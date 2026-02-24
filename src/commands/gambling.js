const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const prisma = require('../database/client');
const { EMBED_COLORS } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');

// ═══════════════════════════════════════════════════════════════
// 슬롯머신 설정
// ═══════════════════════════════════════════════════════════════
const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
const SLOT_WEIGHTS = [30, 25, 20, 15, 7, 3]; // 확률 가중치

const MIN_BET = 100;
const MAX_BET = 10000;

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

function spinSlot() {
  return [
    [weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS), weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS), weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS)],
    [weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS), weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS), weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS)],
    [weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS), weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS), weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS)],
  ];
}

function checkWin(grid) {
  const middleRow = grid[1];
  
  // 777 메가 잭팟
  if (middleRow.every(s => s === '7️⃣')) {
    return { multiplier: 50, type: '🎰 MEGA JACKPOT! 777!' };
  }
  
  // 3개 일치
  if (middleRow[0] === middleRow[1] && middleRow[1] === middleRow[2]) {
    const symbol = middleRow[0];
    if (symbol === '💎') return { multiplier: 20, type: '💎💎💎 다이아몬드!' };
    return { multiplier: 10, type: `${symbol}${symbol}${symbol} 잭팟!` };
  }
  
  // 2개 일치
  if (middleRow[0] === middleRow[1] || middleRow[1] === middleRow[2]) {
    return { multiplier: 2, type: '2개 일치!' };
  }
  
  return { multiplier: 0, type: '꽝!' };
}

// ═══════════════════════════════════════════════════════════════
// /slot (슬롯) 커맨드
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
    const character = await requireCharacter(interaction);
    if (!character) return;

    const bet = interaction.options.getInteger('bet');

    if (character.gold < bet) {
      return interaction.reply({
        content: `❌ 골드가 부족합니다! (보유: ${character.gold.toLocaleString()}G)`,
        ephemeral: true
      });
    }

    // 배팅 차감
    await prisma.character.update({
      where: { id: character.id },
      data: { gold: { decrement: bet } }
    });

    // 슬롯 돌리기
    const grid = spinSlot();
    const result = checkWin(grid);
    const winnings = bet * result.multiplier;

    // 당첨금 지급
    if (winnings > 0) {
      await prisma.character.update({
        where: { id: character.id },
        data: { gold: { increment: winnings } }
      });
    }

    const netGain = winnings - bet;
    const newGold = character.gold - bet + winnings;

    // 슬롯 시각화
    const slotDisplay = grid.map(row => `║ ${row.join(' │ ')} ║`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🎰 슬롯머신')
      .setDescription(
        '```\n' +
        '╔═══════════════╗\n' +
        slotDisplay + '\n' +
        '╚═══════════════╝\n' +
        '```\n' +
        `➤ 중앙 라인 체크!`
      )
      .addFields(
        { name: '결과', value: result.type, inline: true },
        { name: '배팅', value: `${bet.toLocaleString()}G`, inline: true },
        { name: netGain >= 0 ? '🎉 획득' : '💸 손실', value: `${netGain >= 0 ? '+' : ''}${netGain.toLocaleString()}G`, inline: true },
        { name: '💰 보유 골드', value: `${newGold.toLocaleString()}G`, inline: false }
      )
      .setColor(winnings > 0 ? EMBED_COLORS.victory : EMBED_COLORS.defeat)
      .setFooter({ text: '777 = 50배 | 💎💎💎 = 20배 | 3일치 = 10배 | 2일치 = 2배' });

    return interaction.reply({ embeds: [embed] });
  }
};

// ═══════════════════════════════════════════════════════════════
// /coin (코인) 커맨드
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
    const character = await requireCharacter(interaction);
    if (!character) return;

    const bet = interaction.options.getInteger('bet');
    const choice = interaction.options.getString('choice');

    if (character.gold < bet) {
      return interaction.reply({
        content: `❌ 골드가 부족합니다! (보유: ${character.gold.toLocaleString()}G)`,
        ephemeral: true
      });
    }

    // 배팅 차감
    await prisma.character.update({
      where: { id: character.id },
      data: { gold: { decrement: bet } }
    });

    // 동전 던지기
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = choice === result;
    const winnings = won ? bet * 2 : 0;

    // 당첨금 지급
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
        `동전이 공중으로...\n\n` +
        `# ${resultEmoji} ${resultText}!\n\n` +
        `당신의 선택: **${choiceText}**`
      )
      .addFields(
        { name: '결과', value: won ? '🎉 승리!' : '💀 패배...', inline: true },
        { name: '배팅', value: `${bet.toLocaleString()}G`, inline: true },
        { name: won ? '🎉 획득' : '💸 손실', value: `${won ? '+' : ''}${netGain.toLocaleString()}G`, inline: true },
        { name: '💰 보유 골드', value: `${newGold.toLocaleString()}G`, inline: false }
      )
      .setColor(won ? EMBED_COLORS.victory : EMBED_COLORS.defeat);

    return interaction.reply({ embeds: [embed] });
  }
};

// ═══════════════════════════════════════════════════════════════
// /dice (주사위) 커맨드
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
    const character = await requireCharacter(interaction);
    if (!character) return;

    const bet = interaction.options.getInteger('bet');

    if (character.gold < bet) {
      return interaction.reply({
        content: `❌ 골드가 부족합니다! (보유: ${character.gold.toLocaleString()}G)`,
        ephemeral: true
      });
    }

    // 배팅 차감
    await prisma.character.update({
      where: { id: character.id },
      data: { gold: { decrement: bet } }
    });

    // 주사위 굴리기
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
      resultText = '🎉 승리!';
      won = true;
      winnings = bet * 2;
    } else if (playerTotal < dealerTotal) {
      resultText = '💀 패배...';
      won = false;
      winnings = 0;
    } else {
      resultText = '🤝 무승부! (환불)';
      won = null;
      winnings = bet; // 무승부시 환불
    }

    // 당첨금/환불 지급
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

    return interaction.reply({ embeds: [embed] });
  }
};

// 배열로 export (command-loader가 배열 지원)
module.exports = [slotCommand, coinCommand, diceCommand];
