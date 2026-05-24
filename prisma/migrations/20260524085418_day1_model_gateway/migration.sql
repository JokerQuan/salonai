-- CreateEnum
CREATE TYPE "ModelProviderKind" AS ENUM ('MOCK', 'OPENAI_COMPATIBLE');

-- CreateEnum
CREATE TYPE "ModelCallStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "ModelConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerKind" "ModelProviderKind" NOT NULL,
    "model" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKeyEnvName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "inputTokenPriceUsdPer1K" DECIMAL(12,8) NOT NULL DEFAULT 0,
    "outputTokenPriceUsdPer1K" DECIMAL(12,8) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelCall" (
    "id" TEXT NOT NULL,
    "modelConfigId" TEXT,
    "tenantId" TEXT,
    "userId" TEXT,
    "providerKind" "ModelProviderKind" NOT NULL,
    "model" TEXT NOT NULL,
    "status" "ModelCallStatus" NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(12,8) NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "langfuseTraceId" TEXT,
    "langfuseGenerationId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelConfig_name_key" ON "ModelConfig"("name");

-- CreateIndex
CREATE INDEX "ModelConfig_enabled_priority_idx" ON "ModelConfig"("enabled", "priority");

-- CreateIndex
CREATE INDEX "ModelConfig_providerKind_idx" ON "ModelConfig"("providerKind");

-- CreateIndex
CREATE INDEX "ModelCall_createdAt_idx" ON "ModelCall"("createdAt");

-- CreateIndex
CREATE INDEX "ModelCall_tenantId_createdAt_idx" ON "ModelCall"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ModelCall_modelConfigId_createdAt_idx" ON "ModelCall"("modelConfigId", "createdAt");

-- CreateIndex
CREATE INDEX "ModelCall_status_createdAt_idx" ON "ModelCall"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ModelCall" ADD CONSTRAINT "ModelCall_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
