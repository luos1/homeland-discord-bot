'use strict';

function formatGold(value) {
  return `${Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR')}G`;
}

function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePositiveInteger(rawValue) {
  const trimmed = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!trimmed) return NaN;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return NaN;
  return n;
}

function truncateLabel(text, maxLength = 100) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function calculateSessionRemainingTime(session) {
  const now = new Date();
  const completesAt = new Date(session.completesAt);
  const remainingMs = Math.max(0, completesAt - now);
  const remainingMin = Math.ceil(remainingMs / 1000 / 60);

  return {
    remainingMs,
    remainingMin,
    isComplete: remainingMs <= 0,
  };
}

module.exports = {
  formatGold,
  toSafeNumber,
  parsePositiveInteger,
  truncateLabel,
  calculateSessionRemainingTime,
};
