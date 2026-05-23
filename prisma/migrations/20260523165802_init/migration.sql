-- CreateTable
CREATE TABLE "MigrationSmoke" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MigrationSmoke_pkey" PRIMARY KEY ("id")
);
