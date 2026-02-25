-- Phase 1 마이그레이션 통합

-- Combat Enhancements
ALTER TABLE "CombatSession" ADD COLUMN IF NOT EXISTS "monsterPatternPhase" INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE "CombatSession" ADD COLUMN IF NOT EXISTS "playerCounterChance" BOOLEAN DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "CombatEvent" (
  "id" SERIAL PRIMARY KEY,
  "characterId" INTEGER NOT NULL,
  "sessionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CombatEvent_characterId_createdAt_idx" ON "CombatEvent"("characterId", "createdAt");
CREATE INDEX IF NOT EXISTS "CombatEvent_sessionId_idx" ON "CombatEvent"("sessionId");

-- Spin System
CREATE TABLE IF NOT EXISTS "DailySpin" (
  "id" SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "characterId" INTEGER NOT NULL,
  "date" TEXT NOT NULL,
  "spinCount" INTEGER DEFAULT 0 NOT NULL,
  "lastSpinAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "DailySpin_userId_date_key" UNIQUE ("userId", "date")
);

CREATE INDEX IF NOT EXISTS "DailySpin_userId_idx" ON "DailySpin"("userId");
CREATE INDEX IF NOT EXISTS "DailySpin_date_idx" ON "DailySpin"("date");

CREATE TABLE IF NOT EXISTS "SpinHistory" (
  "id" SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "characterId" INTEGER NOT NULL,
  "rewardType" TEXT NOT NULL,
  "rewardAmount" INTEGER NOT NULL,
  "spunAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "SpinHistory_userId_spunAt_idx" ON "SpinHistory"("userId", "spunAt");
CREATE INDEX IF NOT EXISTS "SpinHistory_spunAt_idx" ON "SpinHistory"("spunAt");

-- Character Stats 확장
ALTER TABLE "CharacterStats" ADD COLUMN IF NOT EXISTS "tradesTotal" INTEGER DEFAULT 0;
ALTER TABLE "CharacterStats" ADD COLUMN IF NOT EXISTS "resourcesGathered" INTEGER DEFAULT 0;
ALTER TABLE "CharacterStats" ADD COLUMN IF NOT EXISTS "itemsCrafted" INTEGER DEFAULT 0;
ALTER TABLE "CharacterStats" ADD COLUMN IF NOT EXISTS "guildJoined" INTEGER DEFAULT 0;
ALTER TABLE "CharacterStats" ADD COLUMN IF NOT EXISTS "guildContribution" INTEGER DEFAULT 0;
ALTER TABLE "CharacterStats" ADD COLUMN IF NOT EXISTS "arenaWins" INTEGER DEFAULT 0;
ALTER TABLE "CharacterStats" ADD COLUMN IF NOT EXISTS "enhancementsSuccess" INTEGER DEFAULT 0;
ALTER TABLE "CharacterStats" ADD COLUMN IF NOT EXISTS "maxEnhancement" INTEGER DEFAULT 0;
ALTER TABLE "CharacterStats" ADD COLUMN IF NOT EXISTS "spinLegendary" INTEGER DEFAULT 0;
ALTER TABLE "CharacterStats" ADD COLUMN IF NOT EXISTS "totalAttendance" INTEGER DEFAULT 0;

-- Funnel Tracking
CREATE TABLE IF NOT EXISTS "FunnelEvent" (
    "id" SERIAL PRIMARY KEY,
    "userId" BIGINT NOT NULL,
    "stage" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "FunnelEvent_userId_idx" ON "FunnelEvent"("userId");
CREATE INDEX IF NOT EXISTS "FunnelEvent_stage_idx" ON "FunnelEvent"("stage");
CREATE INDEX IF NOT EXISTS "FunnelEvent_timestamp_idx" ON "FunnelEvent"("timestamp");

ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "lastActive" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Character_lastActive_idx" ON "Character"("lastActive");
