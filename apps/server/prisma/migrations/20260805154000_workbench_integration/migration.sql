-- Add OIDC organization claims used by server-side data-scope enforcement.
ALTER TABLE "users" ADD COLUMN "department" TEXT;
ALTER TABLE "users" ADD COLUMN "team_id" TEXT;

CREATE INDEX "users_team_id_idx" ON "users"("team_id");
CREATE INDEX "training_sessions_user_id_started_at_idx" ON "training_sessions"("user_id", "started_at");
CREATE INDEX "reports_user_id_created_at_idx" ON "reports"("user_id", "created_at");
