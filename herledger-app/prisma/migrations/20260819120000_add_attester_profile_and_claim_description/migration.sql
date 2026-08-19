-- AlterTable
ALTER TABLE "attestations" ADD COLUMN "claimDescription" TEXT;

-- CreateTable
CREATE TABLE "attester_profiles" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attester_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attester_profiles_walletAddress_key" ON "attester_profiles"("walletAddress");

-- CreateIndex
CREATE INDEX "attester_profiles_walletAddress_idx" ON "attester_profiles"("walletAddress");
