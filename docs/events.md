# 陪练系统事件定义

## coaching.session.completed.v1

### 触发时机

会话完成并成功生成评分报告后发布。事件仅提供工作台所需的汇总指标，不包含原始录音、完整对话文本、附件路径、模型提示词或任何密钥。

### 载荷

```json
{
  "event": "coaching.session.completed.v1",
  "trace_id": "9da5d5a8-3e1f-4a40-bc7d-0447bf1c8a6b",
  "session_id": "session_uuid",
  "user_id": "user_uuid",
  "team_id": null,
  "score": 86,
  "completed_at": "2026-08-05T07:30:00.000Z"
}
```

### 投递方式

当前版本将事件写入结构化审计日志。配置 `WORKBENCH_EVENT_WEBHOOK_URL` 后，服务端会将同一载荷以 JSON `POST` 到工作台事件接收端；失败仅记录审计结果，不影响会话完成和评分落库。

### 幂等性

消费者应使用 `event + session_id` 作为幂等键；重复投递不应生成重复的工作台记录。
