-- Add gift sending tracking to OnboardingProgress
ALTER TABLE "OnboardingProgress" ADD COLUMN IF NOT EXISTS "giftSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnboardingProgress" ADD COLUMN IF NOT EXISTS "giftSentAt" TIMESTAMP(3);

-- Add server invite rewards tracking
CREATE TABLE IF NOT EXISTS "ServerInviteReward" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "rewardClaimed" BOOLEAN NOT NULL DEFAULT true,
    "rewardGold" INTEGER NOT NULL DEFAULT 0,
    "rewardGems" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerInviteReward_pkey" PRIMARY KEY ("id")
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS "ServerInviteReward_userId_idx" ON "ServerInviteReward"("userId");
CREATE INDEX IF NOT EXISTS "ServerInviteReward_guildId_idx" ON "ServerInviteReward"("guildId");
CREATE UNIQUE INDEX IF NOT EXISTS "ServerInviteReward_userId_guildId_key" ON "ServerInviteReward"("userId", "guildId");

-- Add Pet collection table for daily login reward
CREATE TABLE IF NOT EXISTS "Pet" (
    "id" SERIAL NOT NULL,
    "characterId" INTEGER NOT NULL,
    "petKey" TEXT NOT NULL,
    "petName" TEXT NOT NULL,
    "petType" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "obtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- Add foreign key and indexes for Pet
CREATE UNIQUE INDEX IF NOT EXISTS "Pet_characterId_petKey_key" ON "Pet"("characterId", "petKey");
CREATE INDEX IF NOT EXISTS "Pet_characterId_idx" ON "Pet"("characterId");

-- Add foreign key constraint if Character table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Character') THEN
        ALTER TABLE "Pet" ADD CONSTRAINT "Pet_characterId_fkey" 
            FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
