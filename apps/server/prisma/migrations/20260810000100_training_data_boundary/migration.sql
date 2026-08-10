-- 陪练角色一律标记为模拟资料；这里不建立也不保存真实客户外键。
ALTER TABLE "ai_roles" ADD COLUMN "training_data_kind" TEXT NOT NULL DEFAULT 'SIMULATED';

-- 训练完成事件采用本地 outbox，供工作台按事件 ID 幂等拉取。
CREATE TABLE "platform_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_key" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "platform_events_event_key_key" ON "platform_events"("event_key");
