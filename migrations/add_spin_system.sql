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

