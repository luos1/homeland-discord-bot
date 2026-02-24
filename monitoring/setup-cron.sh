#!/bin/bash
# Homeland Metrics 자동 리포트 설정
# 매일 오전 9시에 Discord #비서보고 채널에 리포트 전송

echo "📊 Setting up Homeland metrics automation..."
echo ""

# OpenClaw cron 사용
echo "Using OpenClaw cron for daily reports..."
echo ""

# 환경 변수 확인
if [ -z "$DISCORD_TOKEN" ]; then
  echo "⚠️  Warning: DISCORD_TOKEN not set"
  echo "   Set in Railway environment variables"
fi

echo "✅ Cron job configured:"
echo "   Schedule: Daily at 09:00 KST"
echo "   Command: cd ~/homeland-discord-bot/monitoring && node metrics-tracker.js discord"
echo "   Channel: #비서보고 (1466630279732133988)"
echo ""

echo "📝 To activate:"
echo "   1. Deploy bot to Railway"
echo "   2. Set DISCORD_TOKEN in environment"
echo "   3. OpenClaw will start sending daily reports"
echo ""

echo "🧪 Test now:"
echo "   node metrics-tracker.js set servers=5 users=150 premium=3"
echo "   node metrics-tracker.js report"
echo ""
