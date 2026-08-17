-- Drop the feedback feature table (提交反馈功能已移除).
-- The table was originally created via `prisma db push` (never committed as a migration);
-- DROP IF EXISTS keeps this safe on both fresh and existing databases.
DROP TABLE IF EXISTS "feedbacks";
