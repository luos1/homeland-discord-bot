/**
 * 버튼 핸들러 표준화 유틸리티
 * 
 * 목적:
 * 1. Discord 3초 timeout 자동 방지 (deferUpdate)
 * 2. 에러 핸들링 자동화
 * 3. 성능 모니터링 (느린 핸들러 경고)
 */

/**
 * 안전한 버튼 핸들러 래퍼
 * 
 * @param {Interaction} interaction - Discord interaction
 * @param {Function} handler - 실제 핸들러 함수 (async (interaction, deps) => {})
 * @param {Object} deps - 의존성 (prisma, client 등)
 * @returns {Promise<void>}
 * 
 * @example
 * async function handleMonsterSelectButton(interaction, { prisma, client }) {
 *   await safeButtonHandler(interaction, async (int, deps) => {
 *     const monster = await deps.prisma.monster.findFirst();
 *     await int.editReply({ content: monster.name });
 *   }, { prisma, client });
 * }
 */
async function safeButtonHandler(interaction, handler, deps = {}) {
  const startTime = Date.now();
  const customId = interaction.customId || 'unknown';
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // Step 1: Discord 3초 timeout 방지
    // ═══════════════════════════════════════════════════════════════
    if (!interaction.deferred && !interaction.replied) {
      console.log(`[Button] Deferring: ${customId}`);
      await interaction.deferUpdate();
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Step 2: 실제 핸들러 실행
    // ═══════════════════════════════════════════════════════════════
    await handler(interaction, deps);
    
    // ═══════════════════════════════════════════════════════════════
    // Step 3: 성능 모니터링
    // ═══════════════════════════════════════════════════════════════
    const elapsed = Date.now() - startTime;
    
    if (elapsed > 2500) {
      console.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.warn(`[PERF WARNING] Slow button handler`);
      console.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.warn(`CustomId: ${customId}`);
      console.warn(`Elapsed: ${elapsed}ms (threshold: 2500ms)`);
      console.warn(`User: ${interaction.user.username} (${interaction.user.id})`);
      console.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    } else {
      console.log(`[Button] ✅ Success: ${customId} (${elapsed}ms)`);
    }
    
  } catch (error) {
    // ═══════════════════════════════════════════════════════════════
    // Step 4: 에러 핸들링
    // ═══════════════════════════════════════════════════════════════
    const elapsed = Date.now() - startTime;
    
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`[ERROR] Button handler failed`);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`CustomId: ${customId}`);
    console.error(`User: ${interaction.user.username} (${interaction.user.id})`);
    console.error(`Elapsed: ${elapsed}ms`);
    console.error(`Error: ${error.message}`);
    console.error(`Stack:`, error.stack);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // 사용자에게 에러 표시
    const errorMsg = `❌ 처리 중 오류가 발생했습니다.\n\n**오류:** ${error.message}\n\n문제가 반복되면 관리자에게 문의해주세요.`;
    
    try {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          content: errorMsg,
          embeds: [],
          components: [],
        });
      } else if (!interaction.replied) {
        await interaction.followUp({
          content: errorMsg,
          ephemeral: true,
        });
      }
    } catch (replyError) {
      console.error(`[ERROR] Failed to send error message:`, replyError);
    }
    
    // 에러 재throw (상위에서 추가 처리 가능)
    throw error;
  }
}

/**
 * 빠른 defer 유틸 (단순 defer만 필요할 때)
 * 
 * @param {Interaction} interaction
 * @returns {Promise<void>}
 */
async function quickDefer(interaction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
  }
}

/**
 * 에러 응답 헬퍼
 * 
 * @param {Interaction} interaction
 * @param {string} message - 에러 메시지
 * @returns {Promise<void>}
 */
async function sendError(interaction, message) {
  const content = `❌ ${message}`;
  
  try {
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content, embeds: [], components: [] });
    } else if (interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch (error) {
    console.error('[ERROR] sendError failed:', error);
  }
}

module.exports = {
  safeButtonHandler,
  quickDefer,
  sendError,
};
