-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
