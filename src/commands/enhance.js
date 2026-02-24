const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { enhanceEquipment, getEnhancementInfo } = require('../game/enhancement');
const { EMBED_COLORS } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enhance')
    .setNameLocalizations({ ko: '강화' })
    .setDescription('장비 강화')
    .setDescriptionLocalizations({ ko: '장비 강화' }),

  async execute(interaction, { prisma }) {
    const character = await requireCharacter(prisma, interaction, {
      include: { equipment: { where: { equipped: true } } },
    });
    if (!character) return;

    const equippedItems = character.equipment;

    if (equippedItems.length === 0) {
      return interaction.reply({ content: '강화할 장비가 없습니다. 먼저 장비를 장착하세요.', ephemeral: true });
    }

    // 강화 가능한 장비 목록
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.boss)
      .setTitle('⚒️ 장비 강화')
      .setDescription([
        '강화할 장비를 선택하세요.',
        '',
        '**강화 시스템:**',
        '• +0 → +15까지 강화 가능',
        '• 강화 성공 시 스탯 +10%',
        '• +5 이상 실패 시 레벨 -1',
        '• +4 이하 실패 시 레벨 유지',
        ''
      ].join('\n'));

    equippedItems.forEach(item => {
      const info = getEnhancementInfo(item);
      embed.addFields({
        name: `${item.name} +${info.currentLevel}`,
        value: [
          `⚔️ 공격: ${item.attack || 0} | 🛡️ 방어: ${item.defense || 0}`,
          `💰 비용: ${info.cost.toLocaleString()}G`,
          `📊 성공률: ${info.successRate}%`,
          `⚠️ 실패 시: ${info.failPenalty}`
        ].join('\n'),
        inline: false
      });
    });

    const buttons = equippedItems.map(item => 
      new ButtonBuilder()
        .setCustomId(`enhance_${item.id}`)
        .setLabel(`${item.name} +${item.enhancementLevel || 0}`)
        .setStyle(ButtonStyle.Primary)
    );

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }

    await interaction.reply({ embeds: [embed], components: rows });
  },

  async handleEnhanceButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith('enhance_')) return false;

    const equipmentId = parseInt(interaction.customId.replace('enhance_', ''));
    
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: { character: true }
    });

    if (!equipment || equipment.character.userId !== interaction.user.id) {
      await interaction.reply({ content: '❌ 잘못된 요청입니다.', ephemeral: true });
      return true;
    }

    const result = enhanceEquipment(equipment, equipment.character);

    if (!result.success) {
      await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
      return true;
    }

    // 트랜잭션: 골드 차감 + 장비 업데이트
    await prisma.$transaction([
      prisma.character.update({
        where: { id: equipment.character.id },
        data: { gold: { decrement: result.cost } }
      }),
      prisma.equipment.update({
        where: { id: equipmentId },
        data: {
          enhancementLevel: result.newLevel,
          attack: result.newStats.attack,
          defense: result.newStats.defense,
          hp: result.newStats.hp,
          mana: result.newStats.mana
        }
      })
    ]);

    await interaction.reply({ content: result.message });
    return true;
  }
};
