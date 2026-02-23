const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { prisma } = require('../database/prisma');

// 쿨다운 (6시간)
const STEAL_COOLDOWN = 6 * 60 * 60 * 1000;
const STEAL_PENALTY = 500; // 실패 시 벌금

// 쿨다운 관리 (메모리)
const lastSteal = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('steal')
    .setNameLocalizations({ ko: '훔치기' })
    .setDescription('다른 플레이어의 골드 훔치기')
    .setDescriptionLocalizations({ ko: '다른 플레이어의 골드 훔치기' })
    .addUserOption(opt =>
      opt.setName('target')
        .setNameLocalizations({ ko: '대상' })
        .setDescription('훔칠 대상')
        .setDescriptionLocalizations({ ko: '훔칠 대상' })
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('target');
    const targetId = targetUser.id;

    // 자기 자신 훔치기 금지
    if (userId === targetId) {
      return interaction.reply({ content: '❌ 자기 자신은 훔칠 수 없습니다!', ephemeral: true });
    }

    // 쿨다운 확인
    const lastAttempt = lastSteal.get(userId);
    if (lastAttempt && Date.now() - lastAttempt < STEAL_COOLDOWN) {
      const remainingMs = STEAL_COOLDOWN - (Date.now() - lastAttempt);
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      return interaction.reply({
        content: `❌ 쿨다운 중입니다! ${remainingHours}시간 후에 다시 시도하세요.`,
        ephemeral: true
      });
    }

    // 캐릭터 조회
    const thief = await prisma.character.findUnique({ where: { userId } });
    const target = await prisma.character.findUnique({ where: { userId: targetId } });

    if (!thief || !target) {
      return interaction.reply({ content: '❌ 캐릭터를 찾을 수 없습니다.', ephemeral: true });
    }

    // 벌금 확인
    if (thief.gold < STEAL_PENALTY) {
      return interaction.reply({
        content: `❌ 골드가 부족합니다! (최소: ${STEAL_PENALTY.toLocaleString()} 골드)`,
        ephemeral: true
      });
    }

    // 성공률 계산: (내 레벨 / 상대 레벨) × 50%
    const baseChance = Math.min((thief.level / target.level) * 50, 90); // 최대 90%
    const successChance = baseChance;

    const roll = Math.random() * 100;
    const success = roll < successChance;

    // 쿨다운 설정
    lastSteal.set(userId, Date.now());

    if (success) {
      // 성공: 상대 골드 10% 훔치기
      const stolenAmount = Math.floor(target.gold * 0.1);

      if (stolenAmount === 0) {
        return interaction.reply({
          content: '❌ 대상에게 훔칠 골드가 없습니다!',
          ephemeral: true
        });
      }

      try {
        await prisma.$transaction(async (tx) => {
          // 도둑에게 추가
          await tx.character.update({
            where: { userId },
            data: { gold: { increment: stolenAmount } }
          });

          // 타겟에서 차감
          await tx.character.update({
            where: { userId: targetId },
            data: { gold: { decrement: stolenAmount } }
          });

          // 기록
          await tx.theftAttempt.create({
            data: {
              thiefId: userId,
              targetId,
              success: true,
              amount: stolenAmount
            }
          });
        });

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ 훔치기 성공!')
          .setDescription(`<@${targetId}>님으로부터 **${stolenAmount.toLocaleString()} 골드**를 훔쳤습니다!`)
          .addFields(
            { name: '성공률', value: `${successChance.toFixed(1)}%`, inline: true },
            { name: '쿨다운', value: '6시간', inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // 타겟에게 알림 (DM 또는 채널)
        try {
          const targetUserObj = await interaction.client.users.fetch(targetId);
          await targetUserObj.send(`⚠️ <@${userId}>님이 당신으로부터 ${stolenAmount.toLocaleString()} 골드를 훔쳤습니다!`);
        } catch (error) {
          // DM 실패 시 무시
        }
      } catch (error) {
        console.error('Steal success error:', error);
        return interaction.reply({ content: '❌ 오류가 발생했습니다.', ephemeral: true });
      }
    } else {
      // 실패: 벌금
      try {
        await prisma.$transaction(async (tx) => {
          await tx.character.update({
            where: { userId },
            data: { gold: { decrement: STEAL_PENALTY } }
          });

          await tx.theftAttempt.create({
            data: {
              thiefId: userId,
              targetId,
              success: false,
              amount: STEAL_PENALTY
            }
          });
        });

        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ 훔치기 실패!')
          .setDescription(`발각되어 **${STEAL_PENALTY.toLocaleString()} 골드** 벌금을 냈습니다!`)
          .addFields(
            { name: '성공률', value: `${successChance.toFixed(1)}%`, inline: true },
            { name: '쿨다운', value: '6시간', inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error('Steal fail error:', error);
        return interaction.reply({ content: '❌ 오류가 발생했습니다.', ephemeral: true });
      }
    }
  }
};
