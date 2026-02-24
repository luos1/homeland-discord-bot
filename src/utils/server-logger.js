// ═══════════════════════════════════════════════════════════════
// Server Logger - Discord 실시간 로그 시스템
// ═══════════════════════════════════════════════════════════════

const LOG_CHANNEL_ID = '1475837860878880811';
const RATE_LIMIT = 10; // 분당 최대 메시지
const RATE_WINDOW = 60000; // 1분

class ServerLogger {
  constructor() {
    this.client = null;
    this.messageCount = 0;
    this.windowStart = Date.now();
    this.queue = [];
    this.processing = false;
  }

  init(client) {
    this.client = client;
    console.log('📊 Server Logger initialized');
  }

  async _checkRateLimit() {
    const now = Date.now();
    if (now - this.windowStart > RATE_WINDOW) {
      this.messageCount = 0;
      this.windowStart = now;
    }
    
    if (this.messageCount >= RATE_LIMIT) {
      return false;
    }
    
    this.messageCount++;
    return true;
  }

  async _sendToChannel(embed) {
    if (!this.client) return;
    
    try {
      const channel = await this.client.channels.fetch(LOG_CHANNEL_ID);
      if (channel) {
        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error('[Logger] Failed to send to Discord:', err.message);
    }
  }

  async logError(error, context = '') {
    if (!(await this._checkRateLimit())) {
      console.warn('[Logger] Rate limited, skipping Discord log');
      return;
    }

    const stack = error?.stack?.slice(0, 1800) || 'No stack trace';
    
    const embed = {
      title: '🚨 에러 발생',
      color: 0xff0000,
      fields: [
        {
          name: '에러',
          value: `\`\`\`${error?.message || error}\`\`\``,
          inline: false
        },
        {
          name: '컨텍스트',
          value: context || 'N/A',
          inline: true
        },
        {
          name: '시간',
          value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: true
        }
      ],
      description: `\`\`\`js\n${stack}\n\`\`\``,
      timestamp: new Date().toISOString()
    };

    await this._sendToChannel(embed);
  }

  async logEvent(type, data = {}) {
    if (!(await this._checkRateLimit())) return;

    const icons = {
      startup: '🚀',
      shutdown: '🛑',
      user_join: '👋',
      command: '⚡',
      payment: '💰',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const colors = {
      startup: 0x00ff00,
      shutdown: 0xff6600,
      user_join: 0x00ccff,
      command: 0x9966ff,
      payment: 0xffcc00,
      warning: 0xffaa00,
      info: 0x0099ff
    };

    const embed = {
      title: `${icons[type] || '📝'} ${type.toUpperCase()}`,
      color: colors[type] || 0x808080,
      fields: Object.entries(data).map(([key, value]) => ({
        name: key,
        value: String(value).slice(0, 1000),
        inline: true
      })),
      timestamp: new Date().toISOString()
    };

    await this._sendToChannel(embed);
  }

  async logMetric(name, value, unit = '') {
    if (!(await this._checkRateLimit())) return;

    const embed = {
      title: '📈 메트릭',
      color: 0x00cc99,
      fields: [
        { name: '이름', value: name, inline: true },
        { name: '값', value: `${value}${unit}`, inline: true }
      ],
      timestamp: new Date().toISOString()
    };

    await this._sendToChannel(embed);
  }

  async logCritical(message, details = {}) {
    // Critical은 rate limit 무시
    const embed = {
      title: '🔥 CRITICAL',
      color: 0xff0000,
      description: `**${message}**`,
      fields: Object.entries(details).map(([key, value]) => ({
        name: key,
        value: String(value).slice(0, 1000),
        inline: false
      })),
      timestamp: new Date().toISOString()
    };

    await this._sendToChannel(embed);
  }
}

// 싱글톤 인스턴스
const logger = new ServerLogger();

module.exports = { logger, ServerLogger };
