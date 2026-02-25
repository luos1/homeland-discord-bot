-- Migration: Add Spin System and Enhanced Features
-- Phase 1: Fun Enhancement Features

-- ==========================================
-- 🎰 Daily Spin System (Lucky Roulette)
-- ==========================================

CREATE TABLE IF NOT EXISTS "DailySpin" (
  "id" SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "characterId" INTEGER NOT NULL,
  "date" TEXT NOT NULL,  -- YYYY-MM-DD (KST)
  "spinCount" INTEGER DEFAULT 0 NOT NULL,
  "lastSpinAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT "DailySpin_userId_date_key" UNIQUE ("userId", "date")
);

CREATE INDEX "DailySpin_userId_idx" ON "DailySpin"("userId");
CREATE INDEX "DailySpin_date_idx" ON "DailySpin"("date");

CREATE TABLE IF NOT EXISTS "SpinHistory" (
  "id" SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "characterId" INTEGER NOT NULL,
  "rewardType" TEXT NOT NULL,  -- gold, gems, rare_box, epic_box, legendary_box
  "rewardAmount" INTEGER NOT NULL,
  "spunAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX "SpinHistory_userId_spunAt_idx" ON "SpinHistory"("userId", "spunAt");
CREATE INDEX "SpinHistory_spunAt_idx" ON "SpinHistory"("spunAt");

-- ==========================================
-- 📊 Character Stats 확장 (업적용)
-- ==========================================

-- Add new stats columns if not exists (for achievements)
ALTER TABLE "CharacterStats" 
ADD COLUMN IF NOT EXISTS "tradesTotal" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "resourcesGathered" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "itemsCrafted" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "guildJoined" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "guildContribution" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "arenaWins" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "enhancementsSuccess" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "maxEnhancement" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "spinLegendary" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "totalAttendance" INTEGER DEFAULT 0;

-- ==========================================
-- 📝 Notes
-- ==========================================

-- Migration완료 후:
-- 1. Prisma Client 재생성: npx prisma generate
-- 2. 서버 재시작
-- 3. /spin 명령어 테스트
-- 4. /attendance 명령어 테스트 (강화된 보상)
-- 5. /achievements 명령어 테스트 (새로운 업적)

-- Phase 1: Combat Enhancements Migration
-- Adds pattern system, counter-attack, and combat events

-- Add new columns to CombatSession
ALTER TABLE "CombatSession" ADD COLUMN IF NOT EXISTS "monsterPatternPhase" INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE "CombatSession" ADD COLUMN IF NOT EXISTS "playerCounterChance" BOOLEAN DEFAULT false NOT NULL;

-- Create CombatEvent table for logging random events
CREATE TABLE IF NOT EXISTS "CombatEvent" (
  "id" SERIAL PRIMARY KEY,
  "characterId" INTEGER NOT NULL,
  "sessionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for CombatEvent
CREATE INDEX IF NOT EXISTS "CombatEvent_characterId_createdAt_idx" ON "CombatEvent"("characterId", "createdAt");
CREATE INDEX IF NOT EXISTS "CombatEvent_sessionId_idx" ON "CombatEvent"("sessionId");
-- Conversion Funnel Tracking
-- Track user journey from join to premium subscription

CREATE TABLE IF NOT EXISTS "FunnelEvent" (
    "id" SERIAL PRIMARY KEY,
    "userId" BIGINT NOT NULL,
    "stage" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Index for fast queries
    INDEX "FunnelEvent_userId_idx" ("userId"),
    INDEX "FunnelEvent_stage_idx" ("stage"),
    INDEX "FunnelEvent_timestamp_idx" ("timestamp")
);

-- Add lastActive tracking to Character table
ALTER TABLE "Character" 
ADD COLUMN IF NOT EXISTS "lastActive" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create index for retention queries
CREATE INDEX IF NOT EXISTS "Character_lastActive_idx" ON "Character"("lastActive");

-- Conversion analytics view
CREATE OR REPLACE VIEW "ConversionFunnel" AS
SELECT 
    stage,
    COUNT(DISTINCT "userId") as users,
    COUNT(*) as events,
    MIN("timestamp") as first_seen,
    MAX("timestamp") as last_seen
FROM "FunnelEvent"
GROUP BY stage
ORDER BY users DESC;

-- Daily conversion rate view
CREATE OR REPLACE VIEW "DailyConversion" AS
SELECT 
    DATE("timestamp") as date,
    COUNT(DISTINCT CASE WHEN stage = 'joined' THEN "userId" END) as joined,
    COUNT(DISTINCT CASE WHEN stage = 'created_character' THEN "userId" END) as created,
    COUNT(DISTINCT CASE WHEN stage = 'premium_subscribed' THEN "userId" END) as subscribed,
    ROUND(
        100.0 * COUNT(DISTINCT CASE WHEN stage = 'premium_subscribed' THEN "userId" END) / 
        NULLIF(COUNT(DISTINCT CASE WHEN stage = 'joined' THEN "userId" END), 0),
        2
    ) as conversion_rate
FROM "FunnelEvent"
GROUP BY DATE("timestamp")
ORDER BY date DESC;
