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
