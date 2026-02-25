/**
 * 향상된 로깅 시스템
 * Phase 2: 버그 수정 - 에러 로깅 개선
 */

const fs = require('fs');
const path = require('path');

// 로그 레벨 정의
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

// 현재 로그 레벨 (환경 변수로 설정 가능)
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

// 로그 디렉토리 생성
const LOG_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 로그 파일 경로
const LOG_FILE = path.join(LOG_DIR, `bot-${new Date().toISOString().split('T')[0]}.log`);
const ERROR_FILE = path.join(LOG_DIR, `error-${new Date().toISOString().split('T')[0]}.log`);

/**
 * 로그 메시지 포맷팅
 */
function formatMessage(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const contextStr = Object.keys(context).length > 0 
    ? `\n  Context: ${JSON.stringify(context, null, 2)}` 
    : '';
  
  return `[${timestamp}] [${level}] ${message}${contextStr}`;
}

/**
 * 파일에 로그 저장
 */
function writeToFile(filePath, message) {
  try {
    fs.appendFileSync(filePath, message + '\n', 'utf8');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

/**
 * 로그 함수들
 */
const logger = {
  debug(message, context = {}) {
    if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
      const formatted = formatMessage('DEBUG', message, context);
      console.debug(formatted);
      writeToFile(LOG_FILE, formatted);
    }
  },

  info(message, context = {}) {
    if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
      const formatted = formatMessage('INFO', message, context);
      console.log(formatted);
      writeToFile(LOG_FILE, formatted);
    }
  },

  warn(message, context = {}) {
    if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
      const formatted = formatMessage('WARN', message, context);
      console.warn(formatted);
      writeToFile(LOG_FILE, formatted);
    }
  },

  error(message, error = null, context = {}) {
    if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
      const errorContext = error ? {
        ...context,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      } : context;

      const formatted = formatMessage('ERROR', message, errorContext);
      console.error(formatted);
      writeToFile(LOG_FILE, formatted);
      writeToFile(ERROR_FILE, formatted);
    }
  },

  fatal(message, error = null, context = {}) {
    const errorContext = error ? {
      ...context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    } : context;

    const formatted = formatMessage('FATAL', message, errorContext);
    console.error(formatted);
    writeToFile(LOG_FILE, formatted);
    writeToFile(ERROR_FILE, formatted);
  },

  /**
   * 전투 관련 로그 (특화된 로깅)
   */
  combat(action, sessionId, result, context = {}) {
    this.info(`Combat action: ${action}`, {
      sessionId,
      result,
      ...context,
    });
  },

  /**
   * 경제 관련 로그 (특화된 로깅)
   */
  economy(action, userId, amount, context = {}) {
    this.info(`Economy action: ${action}`, {
      userId,
      amount,
      ...context,
    });
  },

  /**
   * Discord 상호작용 에러 로그
   */
  interactionError(interaction, error, context = {}) {
    this.error('Interaction failed', error, {
      user: interaction.user?.tag,
      userId: interaction.user?.id,
      commandName: interaction.commandName,
      customId: interaction.customId,
      ...context,
    });
  },
};

module.exports = logger;
