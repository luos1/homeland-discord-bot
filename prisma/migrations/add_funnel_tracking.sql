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
