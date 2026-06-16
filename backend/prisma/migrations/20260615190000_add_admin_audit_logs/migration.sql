-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" SERIAL NOT NULL,
    "actor" VARCHAR(100) NOT NULL DEFAULT 'admin',
    "action" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "admin_audit_logs_status_idx" ON "admin_audit_logs"("status");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");
