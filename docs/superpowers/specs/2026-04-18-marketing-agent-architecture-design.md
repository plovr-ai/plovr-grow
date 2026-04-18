# Marketing Agent — Strategy & Execution Architecture Design

**Date**: 2026-04-18
**Status**: Draft
**Companion Doc**: [Marketing Agent — Input Data Sources Design](./2026-04-18-marketing-agent-inputs-design.md)
**Context**: 在输入层 spec 基础上，设计 Agent 的**策略层与执行层架构**。餐厅营销是长周期持续运营，不是一次性方案产出；本文档定义 Agent 如何在多个时间粒度上持续规划、执行、归因、学习。

---

## 1. Core Design Principles

1. **分层时间粒度** — 不存在"一个 Agent 产出一个大方案"。必须按季/周/实时三档分层规划，各司其职。
2. **闭环可学习** — 每个 campaign 必须有 hypothesis + measurement plan + 归因结果，结果反哺下一次决策。
3. **人机分工清晰** — Agent 处理 80% 常规动作，人只审 20% 高风险决策。
4. **Guardrails 比智能重要** — 频次、预算、品牌红线必须硬编码，不交给 LLM 自由发挥。
5. **可解释性是一等公民** — 每个 action 都能回答"为什么是这个客户 / 这个内容 / 这个时间"。

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│  Observer (持续观测层)                                │
│  订单 / Review / 天气 / 节日 / 会员行为 / 社媒互动     │
│  → 输出 Signal Events                                 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Planner (三档规划器)                                 │
│  ┌─────────────────────────────────────────────┐     │
│  │ Strategic Planner  (月/季 cron)              │     │
│  │  → 季度主题、预算分配、渠道权重              │     │
│  ├─────────────────────────────────────────────┤     │
│  │ Tactical Planner   (周 cron)                 │     │
│  │  → 本周 campaigns、分群、内容日历             │     │
│  ├─────────────────────────────────────────────┤     │
│  │ Reactive Planner   (事件触发)                 │     │
│  │  → 差评回复、下雨推外卖、生日祝福、库存消化   │     │
│  └─────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Executor (执行层)                                    │
│  SMS / Email / 社媒发帖 / GMB 回复 / Ads 投放         │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Measurer (归因与度量)                                │
│  UTM + 短链 + 专属优惠券码 → 每个 campaign 可追踪     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Memory (记忆与学习，反哺 Planner)                     │
│  campaign history / 什么策略有效 / 什么时间点转化高   │
└─────────────────────────────────────────────────────┘
```

---

## 3. Module 1: Observer

**职责**：持续监听所有数据源的变化，产出结构化 signal events，投递到消息队列供 Planner 消费。

### Signal Event 类型

| 类型 | 触发源 | 示例 payload |
|------|--------|-------------|
| `order.created` | POS / online ordering webhook | `{ customerId, items, total, channel }` |
| `review.received` | GMB/Yelp 轮询 | `{ rating, text, keywords, sentiment }` |
| `member.birthday.upcoming` | 定时扫表 | `{ memberId, daysUntil }` |
| `member.sleeping.detected` | 定时 RFM 重算 | `{ memberId, daysSinceLastVisit }` |
| `weather.alert` | OpenWeather cron | `{ condition: 'rain', probability: 0.8, date }` |
| `holiday.upcoming` | 节日日历 cron | `{ holiday: 'chinese_new_year', daysUntil: 30 }` |
| `inventory.surplus` | POS 库存同步 | `{ itemId, surplusQty }` |
| `social.mention` | 社媒 webhook | `{ platform, content, sentiment }` |

### 实现要点

- Observer 本身是无状态的采集器集合（webhook handler + cron poller）
- 所有 events 落到 `agent_signal_events` 表 + 发到 event bus（BullMQ / SQS / 自建队列）
- 每个 event 有 TTL，超时未消费自动归档

---

## 4. Module 2: Planner (Three Tiers)

### 4.1 Strategic Planner（季度级）

**触发频率**：每月 1 号 cron，每季度末做复盘。

**输入**：
- 季度目标（10% 增长拆解）
- 上季度 KPI 结果（从 Memory 读取）
- 年度预算与剩余可用额度
- 节日日历（下季度）
- 菜单毛利结构
- 品牌定位与红线（Onboarding Wizard 配置）

**输出**：一份季度营销战略文档（结构化 JSON）：

```typescript
interface QuarterlyStrategy {
  quarter: string;                    // "2027-Q1"
  goals: {
    revenueGrowthPercent: number;
    newCustomerCount: number;
    repeatRateTarget: number;
  };
  themes: Array<{                     // 季度主题活动
    name: string;                     // "春节年夜饭"
    window: { start: Date; end: Date };
    budget: number;
    expectedROI: number;
  }>;
  channelWeights: {                   // 渠道预算分配
    sms: number; email: number; meta: number; googleAds: number; social: number;
  };
  rationale: string;                  // LLM 生成的决策依据
}
```

**实现模式**：
- Prompt 结构化输入上下文 + Memory 中上季度复盘
- LLM 生成草稿 → 强制人工审批 → 入库
- 审批通过后自动拆分给 Tactical Planner 作为周规划输入

**为什么需要人审**：季度战略决策面大、撤销成本高、涉及预算分配，必须保留人工判断。

### 4.2 Tactical Planner（周级）

**触发频率**：每周日晚 22:00 cron，周一早上人审批，周二开始执行。

**输入**：
- 当季 QuarterlyStrategy
- 本周 signal events 摘要
- 会员分群最新状态（定时 RFM 产出）
- 上周 campaign 效果（Measurer 归因结果）
- Memory 中同类 campaign 的历史表现

**输出**：本周 Campaign 清单：

```typescript
interface Campaign {
  id: string;
  name: string;                       // "沉睡 VIP 会员召回 - 春季限定"
  theme?: string;                     // 关联的季度主题
  hypothesis: string;                 // "给 60+ 天未到店的 VIP 发 15% off SMS，预期召回 8%"
  audience: AudienceFilter;           // 分群规则（RFM + 标签）
  estimatedAudienceSize: number;
  channels: Channel[];                // ['sms', 'email']
  content: ContentPayload;            // 文案、图片、CTA
  schedule: { sendAt: Date; timezone: string };
  budget: number;
  kpiTarget: { metric: string; target: number };
  measurementPlan: {
    attributionWindowDays: number;    // 7
    successCode: string;              // 专属 coupon code
    utmCampaign: string;
  };
  riskLevel: 'auto' | 'review' | 'strict_review';
  status: CampaignStatus;             // 见 §5
}
```

### 4.3 Reactive Planner（事件触发级）

**触发频率**：事件驱动，订阅 event bus。

**输入**：单个 signal event + 相关客户/门店上下文。

**输出**：一个即时 action 或延迟入队的 campaign（小规模）。

**响应表**：

| 事件 | 响应 | 风险级别 |
|------|------|---------|
| 1–2 星 review | 生成回复草稿 → 人审 → 发布 + 给客户补偿券 | review |
| 4–5 星 review | 自动标准回复 + 提取素材入社媒池 | auto |
| 5 星含菜品关键词 | 入素材池，供 Tactical Planner 做种草选材 | auto |
| 会员生日 T-3 天 | 发生日券 SMS + Email | auto |
| 会员沉睡 60/90/120 天节点 | 分级召回 SMS | auto |
| 次日降雨 >70% | 今晚推外卖主题内容 + Ads 加投 | review |
| 招牌菜库存超标 | 当日限时特价推送 | review |
| 商圈有大型活动 | 活动期间加投 Ads | review |

---

## 5. Module 3: Executor

**职责**：把 approved 状态的 campaign/action 发送到实际渠道。

### Campaign Lifecycle State Machine

```
draft → pending_review → approved → scheduled → running → measuring → archived
                ↓
              rejected
```

### 渠道 Adapter 抽象

```typescript
interface ChannelAdapter {
  channel: Channel;
  send(payload: RenderedContent, audience: Contact[]): Promise<DispatchResult>;
  attachTracking(payload: RenderedContent, tracking: TrackingMeta): RenderedContent;
  healthCheck(): Promise<boolean>;
}
```

每个渠道（Twilio、SendGrid、Meta Graph、GMB、Meta Ads API）实现同一接口。Executor 不关心渠道细节。

### 执行前强制检查

- **频次 cap**：同一客户 30 天 ≤ 3 条 SMS / ≤ 6 封 email
- **预算 cap**：日/月花费不超过 Wizard 配置
- **静默时段**：22:00–09:00 不发 SMS
- **TCPA / CAN-SPAM 校验**：opt-in 证据 + unsubscribe link
- **品牌校验**：文案过 brand voice classifier

任一校验失败 → campaign 标记 `blocked` + 告警人工。

---

## 6. Module 4: Measurer

**职责**：归因、度量、产出每个 campaign 的结果报告。

### 三重追踪

每个 campaign 自动附加：
1. **UTM 参数** — website 端归因
2. **短链接** — 点击率 + 设备/地理
3. **专属 coupon code** — 线下/online ordering 归因

### 归因窗口

- SMS / Email：7 天
- 社媒 organic：14 天
- Ads：按平台归因窗口（Meta 默认 7d click / 1d view）

### 结算产出

```typescript
interface CampaignResult {
  campaignId: string;
  metrics: {
    sent: number; delivered: number; clicked: number;
    ordered: number; gmv: number; roi: number;
    newCustomers: number; reactivatedCustomers: number;
  };
  comparedToHypothesis: {
    hypothesized: number;
    actual: number;
    deltaPercent: number;
  };
  learnings: string[];                // LLM 生成的 3 条学习要点
}
```

结果写入 Memory，供未来 Planner 查询。

---

## 7. Module 5: Memory

**职责**：Agent 的长期记忆，让下次决策优于上次。

### 存储分层

| 层 | 内容 | 存储 |
|----|------|------|
| **事件流** | 所有 signal events | MySQL `agent_signal_events` |
| **Campaign 档案** | 所有 campaign 全生命周期数据 | MySQL `agent_campaigns` |
| **客户互动历史** | 每个客户收到过什么、响应了什么 | MySQL `agent_customer_interactions` |
| **学习知识库** | "周三晚 7 点 SMS 转化最高"等规律 | MySQL `agent_learnings` + 向量检索 |
| **决策轨迹** | 每个决策的 prompt + output + 人审记录 | MySQL `agent_decision_trace` |

### Planner 如何用 Memory

- **Tactical Planner 规划前**：
  - 查过去 90 天同类 campaign 的 ROI → 加权采纳高 ROI 模式
  - 查目标受众近期是否已被其他 campaign 触达 → 避免叠加骚扰
- **Strategic Planner 季度规划前**：
  - 读取上季度所有 campaign 归因结果
  - 读取 `agent_learnings` 的季度总结
- **Reactive Planner**：
  - 查本客户过去 30 天触达历史，做频次熔断

---

## 8. Human-in-the-Loop 设计

| 风险级别 | 典型动作 | 审批策略 |
|---------|---------|---------|
| **auto** | review 自动回复（4–5 星）、生日 SMS、社媒配图选择 | 自动执行，事后可撤回 |
| **review** | 全量会员群发、周度社媒发帖、差评回复、小额 Ads | 发前 24h 送审，超时默认通过 |
| **strict_review** | 广告投放 >$100、折扣 >20%、品牌主题活动、季度战略 | 强制人工审批，无默认通过 |

审批界面要求：
- 列出 campaign 全部关键字段（受众、内容、预算、KPI、风险点）
- 支持 inline 修改文案
- 每次审批动作写入 `agent_decision_trace`

---

## 9. Guardrails（硬编码非可选）

```typescript
interface GuardrailConfig {
  frequencyCaps: {
    smsPerCustomerPer30Days: number;      // 3
    emailPerCustomerPer30Days: number;    // 6
    pushPerCustomerPer7Days: number;      // 2
  };
  discountCaps: {
    maxSingleCampaignPercent: number;     // 20
    maxYearlyPerCustomer: number;         // 500 USD
  };
  budgetCaps: {
    dailyAdSpendUSD: number;
    monthlyTotalUSD: number;
  };
  quietHours: { start: '22:00'; end: '09:00' };
  contentModeration: {
    brandVoiceMinScore: number;           // 0–1
    forbiddenPhrases: string[];
    requiredDisclosures: string[];        // 如 "Msg&Data rates may apply"
  };
  complianceChecks: {
    tcpaOptInRequired: boolean;
    canSpamUnsubscribeRequired: boolean;
  };
}
```

违反 guardrail → campaign 直接拒绝，不进入审批流。

---

## 10. End-to-End Example: 春节主题活动

展示三档 Planner 如何协同：

```
【2026-12-01】 Strategic Planner 月度 cron
  - 读取节日日历：2027 春节在 2027-02-17
  - 读取 Memory：去年春节活动 ROI 4.2，Email 预告 W-3 最佳
  - 生成草稿：主题"年夜饭外卖套餐 + VIP 尊享预订"
  - 预算 $5k，分配 SMS $1k / Email $500 / Meta Ads $3k / 社媒 $500
  - 提交人审 → 老板微调后批准

【2027-01-24】 Tactical Planner 周度 cron
  - 读取季度战略，识别"春节"主题 window 进入 W-3
  - 拆出 5 个 campaigns:
      1. 全会员 Email 预告（发送日 01-27）
      2. VIP 会员独家预订 SMS（发送日 02-03）
      3. 社媒倒计时内容 × 7 帖（02-10 到 02-17）
      4. Meta Ads 地理定向 3 英里（02-03 到 02-17）
      5. 活动后 Review 请求自动化（02-18 起）
  - 每个 campaign 带 hypothesis + KPI + 专属 coupon code
  - SMS 和 Ads 标记 review；社媒发帖标记 auto
  - 周一早上人审

【活动期间每天】 Reactive Planner 订阅 event bus
  - 新 5 星 review → 自动回复 + 入素材池
  - 02-15 检测到次日降雨 80% → 加推"年前外卖提前订"内容
  - 生日 T-3 触发 → 生日券 + 春节套餐 CTA
  - 库存告警：红烧肉超标 30kg → 02-16 限时特价

【2027-02-24】 Measurer 归因结算
  - 套餐销量 / ROI 4.7 / 新客占比 18% / 会员召回率 12%
  - 写入 Memory，生成 3 条 learnings:
      "Email 预告 W-3 转化最高"
      "VIP 独家 SMS 打开率 62%"
      "降雨加投当日 GMV +23%"

【2028 年春节】 Strategic Planner
  - 从 Memory 自动引用去年 learnings
  - 在去年模式基础上做增量优化，不从零开始
```

---

## 11. 分阶段落地

**不要一次开三档 Planner**。按置信度递增：

| Phase | 时间窗 | 开启模块 | 目标 |
|-------|--------|---------|------|
| **Phase 1** | Month 1 | Observer + Reactive Planner + Executor + Measurer | 跑通"差评自动回复 + 生日 SMS + 沉睡会员召回"，验证端到端链路 |
| **Phase 2** | Month 2–3 | 加 Tactical Planner | 加入周度会员 campaign + 社媒内容节奏 |
| **Phase 3** | Month 4+ | 加 Strategic Planner | Agent 接管季度战略 |

Phase 1 的三个场景是**低风险高确定性**的经典套路，最容易跑出正反馈，验证 guardrails 和归因链路。

---

## 12. 可解释性要求

每个发出的 action，dashboard 都必须附"Why this?"展开面板：

- **为什么是这个客户？** — 展示分群规则 ID + 命中字段
- **为什么是这个内容？** — 关联的 campaign + hypothesis
- **为什么是这个时间？** — 引用 Memory 中的最佳窗口学习
- **为什么是这个金额/折扣？** — 预算 / 历史同类活动对比
- **这次决策经过谁审批？** — 决策轨迹

---

## 13. 数据模型草图（待下一份 spec 细化）

核心表清单：

```
agent_signal_events        -- Observer 产出的所有事件
agent_strategies            -- Strategic Planner 产出的季度战略
agent_campaigns             -- Tactical/Reactive Planner 产出的 campaigns
agent_campaign_executions   -- 每次实际发送记录
agent_customer_interactions -- 客户收到/响应的每条动作
agent_attributions          -- Measurer 归因结果
agent_learnings             -- 学习知识库（结构化 + 向量）
agent_decision_trace        -- LLM prompt + output + 审批轨迹
agent_guardrail_config      -- 租户级 guardrail 设置
agent_audience_segments     -- 分群规则（RFM + 标签）
```

---

## 14. 开放问题

1. **LLM 选型与成本** — Strategic/Tactical 规划用什么模型？需要估算每月 token 成本。
2. **Prompt Engineering** — 每档 Planner 的 system prompt 需要单独设计（是否走 structured output / JSON mode）。
3. **A/B 测试框架** — 是否在 Tactical Planner 内置 A/B 能力（同一 campaign 分 variant）？
4. **多租户隔离** — Memory/Learnings 是否跨租户共享（可能带来冷启动优势，但有数据隐私顾虑）。
5. **失败恢复** — Executor 发送失败时的重试策略、归因窗口内的 session 恢复。
6. **Dashboard 权限** — 多角色（老板、经理、运营）看到的信息粒度差异。
7. **MVP 成本** — Phase 1 最少需要实现哪几张表 + 哪几个服务，估算开发工时。

---

## 15. 下一步

本 spec 确定了 Agent 的策略层架构轮廓。后续需要细化的方向：

- **数据模型 spec** — §13 列出的核心表展开成 Prisma schema + ER 图
- **Tactical Planner 详细设计** — 周度规划器的 prompt、输入 context 组装、output 结构、人审 UI
- **Guardrail 引擎 spec** — 前置校验的实现架构与性能考虑
- **MVP 实施计划** — Phase 1 的工时估算、里程碑、验证指标
- **LLM 选型与 prompt library** — 模型选择、prompt 模板管理、成本预算
