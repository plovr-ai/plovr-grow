# 业务监控 + 告警设计 (Issue #260)

## 概述

在 order / payment / webhook service 添加 Sentry Metrics 打点，用 `Sentry.withMonitor()` 包裹 cron job，为后续告警规则提供数据基础。

## 技术决策

- **SDK**: `@sentry/nextjs` ^10.48.0（已在 #257 中接入）
- **Metrics API**: `Sentry.metrics.count()` / `Sentry.metrics.distribution()`（v10 中 `increment` 已更名为 `count`）
- **Cron 监控**: `Sentry.withMonitor(slug, callback, monitorConfig)`

## Metrics 打点

| Service | 位置 | Metric | Tags |
|---------|------|--------|------|
| `order.service.ts` | `createMerchantOrderAtomic` 成功返回后 | `order.created` | `tenant_id`, `merchant_id` |
| `payment.service.ts` | `handlePaymentSucceeded` 成功更新后 | `payment.result` | `status: succeeded`, `provider` |
| `payment.service.ts` | `handlePaymentFailed` 成功更新后 | `payment.result` | `status: failed`, `provider` |
| `webhook-dispatcher.service.ts` | dispatch 处理完毕时 | `webhook.processed` | `status: processed / failed / deduplicated`, `provider` |

## Cron 监控

| Cron Route | Monitor Slug | Schedule |
|-----------|-------------|----------|
| `square-webhook-retry` | `square-webhook-retry` | 每 5 分钟 |
| `square-order-push-retry` | `square-order-push-retry` | 每 5 分钟 |

## 手动配置（不在代码范围内）

- Sentry Dashboard Alert Rules: 错误激增、支付失败率、Cron 未执行、API 响应慢
- Sentry Slack 集成
