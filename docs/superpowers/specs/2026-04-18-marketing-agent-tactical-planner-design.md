# Marketing Agent — Tactical Planner I/O Contract & Pipeline Design

**Date**: 2026-04-18
**Status**: Draft
**Related Docs**:
- [Input Data Sources Design](./2026-04-18-marketing-agent-inputs-design.md)
- [Strategy & Execution Architecture Design](./2026-04-18-marketing-agent-architecture-design.md)

**Context**: Tactical Planner 是 Agent 策略层中唯一每周"动脑"的规划器，是整个 Agent 智能的核心体现。本文档定义其 I/O 契约、Pipeline、冲突仲裁、冷启动、反馈回流等关键机制。**设计与餐厅类型无关**；餐厅特性通过 Input Contract 中的 `brand` / `channels` / `guardrails` 等 profile 字段传入。

---

## 1. Scope

本 spec 只覆盖 Tactical Planner 自身。Strategic / Reactive Planner、Memory 子系统、Executor、Measurer 均另起文档。

**设计目标**：
- 每周日晚自动产出本周 campaign 清单
- Output 必须是可直接执行 + 可度量 + 可解释的结构化数据
- 长周期可学习：上周结果与人审修改自动反哺下周决策
- 失败不中断：LLM 异常时降级到规则引擎兜底

---

## 2. Core Design Decisions

| # | 决策点 | 选择 | 理由 |
|---|--------|------|------|
| 1 | Prompt 结构 | **多步 chain**（Diagnose → Opportunity → Select → Detailize） | 周度规划对延迟不敏感，质量优先。每步 context 精简、中间产物可存档。 |
| 2 | 冷启动 | **Bootstrap best-practices + 首周仅 Reactive** | 第一周无历史数据，Tactical 第 2 周启动；启动 Memory 内置行业最佳实践。 |
| 3 | 冲突仲裁 | **LLM 初判 + deterministic ConflictResolver 二次仲裁** | 关键频次/合规规则不交给 LLM；LLM hint 作为仲裁输入。 |
| 4 | Structured Output | **Anthropic tool use** | Schema 尊重度最高，retry 成本低；Zod 在后端二次校验。 |
| 5 | 人审回流 | **强制存 diff，3 次同类修改自动提取为 learning** | 老板的修改是最好训练信号，避免 Agent 重复犯同样错。 |

---

## 3. Planning Pipeline (Multi-Step Chain)

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Diagnose                                         │
│  Input:  Weekly Layer + goal progress                   │
│  Output: 600-token 业务诊断摘要                           │
│          • 本周业务健康度                                  │
│          • 关键偏离点                                      │
│          • 紧急/重要事项                                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Opportunity Identification                       │
│  Input:  Step 1 output + Audience + Calendar + MemoryTopK│
│  Output: 10–15 个机会点，每个带:                           │
│          • opportunity: string                           │
│          • targetSegment: segmentId                     │
│          • estimatedImpact: { gmv, effort, confidence }  │
│          • supportingEvidence: string[]                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: Select & Prioritize                              │
│  Input:  Step 2 机会列表 + budget/channel weights + 上周 │
│         触达历史 + guardrails 摘要                         │
│  Output: 选中 N 个（3-10）+ 理由 + conflictsWith 标注     │
│          每个带 riskLevel 初判                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Step 4: Detailize (for each selected opportunity)        │
│  Input:  选中 opportunity + brand voice + channel specs  │
│  Output: Full Campaign payload (via tool use)            │
│          • hypothesis, audience filter, content, schedule│
│          • KPI target, measurement plan                  │
│          • rationale.dataEvidence + memoryEvidence       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Step 5: ConflictResolver (deterministic, non-LLM)        │
│  Input:  Detailized campaigns + customer touch history   │
│  Output: Final campaigns after conflict/frequency rules  │
│          被移除 / 降级的 campaign 进 deferredOpportunities │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Step 6: Assemble Output + Executive Summary              │
│  LLM 生成 TL;DR 给人审看                                  │
└─────────────────────────────────────────────────────────┘
```

**中间产物存档**：Step 1–4 的 LLM input/output 全部写入 `agent_decision_trace`，便于后续 replay 和 prompt 优化。

---

## 4. Input Contract

### 4.1 分层组装

Input 按更新频率分 4 层，每层有独立缓存策略：

| Layer | 更新频率 | Token 预算 | 缓存策略 |
|-------|---------|-----------|---------|
| Invariant | 配置变更时 | ~2k | 长期缓存（Anthropic prompt caching） |
| Quarterly | 月初/战略审批后 | ~1k | 季度缓存 |
| Weekly | 每周规划时重算 | ~5k | 不缓存 |
| Historical (top-k) | 按需向量检索 | ~3k | 不缓存（每次动态） |

**总 input ≈ 11–12k tokens**，在 Sonnet 4.6 context window 内轻松容纳，成本可控（≈ $0.2/周/商户）。

### 4.2 Schema

```typescript
interface TacticalPlannerInput {
  meta: {
    tenantId: string;
    merchantId: string;
    planningWeek: { start: Date; end: Date };
    timezone: string;
    locale: string;
  };

  // ───── Invariant Layer ─────
  brand: {
    name: string;
    positioning: "fine_dining" | "casual" | "fast";
    cuisine: string;
    toneOfVoice: string;
    avgTicketUSD: number;
    forbiddenTactics: string[];
  };
  guardrails: GuardrailConfig;  // architecture spec §9
  channels: {
    enabled: Channel[];
    capabilities: Record<Channel, ChannelCapability>;
  };

  // ───── Quarterly Layer ─────
  quarterlyStrategy: {
    quarterId: string;
    themes: Array<{
      name: string;
      window: { start: Date; end: Date };
      status: "upcoming" | "active" | "winding_down";
      budgetUSD: number;
    }>;
    channelWeights: Record<Channel, number>;
    remainingBudgetUSD: number;
    budgetBurnStatus: "on_track" | "ahead" | "behind";
  };

  // ───── Weekly Layer ─────
  audienceSnapshot: {
    segments: Array<{
      id: string;
      name: string;
      size: number;
      rfmProfile: { avgRecencyDays; avgFrequency; avgMonetaryUSD };
      recentlyTouchedCount30d: number;
    }>;
    birthdaysUpcoming14d: number;
    sleepingMembers: {
      "60d": number;
      "90d": number;
      "120d": number;
    };
  };

  recentSignals: {
    reviews: {
      newCount: number;
      avgRating: number;
      topPositiveKeywords: string[];
      topNegativeKeywords: string[];
    };
    orders: {
      weeklyGMV: number;
      weeklyOrderCount: number;
      trendDeltaPercent: number;      // vs 上周
      channelMix: Record<Channel, number>;
    };
    social: {
      mentionCount: number;
      sentimentDelta: number;
    };
    inventory: {
      surplusItems: Array<{ name: string; qty: number; daysOfSupply: number }>;
    };
  };

  calendar: {
    upcoming4Weeks: Array<{
      date: Date;
      type: "holiday" | "weather" | "local_event";
      name: string;
      relevanceScore: number;           // 0–1
      notes?: string;
    }>;
  };

  lastWeekResults: {
    campaigns: Array<{
      id: string;
      name: string;
      hypothesis: string;
      result: {
        gmv: number;
        roi: number;
        hitKpiTarget: boolean;
        metrics: Record<string, number>;
      };
      learnings: string[];
      humanEdits?: {                    // 人审修改记录
        editCount: number;
        notableDiffs: string[];
      };
    }>;
    goalProgress: {
      weeklyTargetUSD: number;
      actualUSD: number;
      cumulativeDeltaPercent: number;
    };
  };

  // ───── Historical Layer (retrieved) ─────
  memoryTopK: Array<{
    campaignId: string;
    summary: string;
    result: { gmv; roi; hitKpiTarget };
    learnings: string[];
    similarityScore: number;
  }>;
}
```

### 4.3 各层数据来源

| 字段 | 来源 |
|------|------|
| brand / guardrails / channels | Onboarding Wizard config |
| quarterlyStrategy | Strategic Planner 产出 |
| audienceSnapshot | 每周 cron 跑 RFM + segments 重算 |
| recentSignals | Observer 聚合 7 天 signal events |
| calendar | holiday JSON + OpenWeather API + Eventbrite |
| lastWeekResults | Measurer 的归因结算 |
| memoryTopK | 向量检索 `agent_learnings` + `agent_campaigns` |

---

## 5. Output Contract

### 5.1 Top-level Structure

```typescript
interface TacticalPlannerOutput {
  planningSessionId: string;
  generatedAt: Date;
  planningWeek: { start: Date; end: Date };

  executiveSummary: {
    plannedCampaignsCount: number;
    totalBudgetUSD: number;
    expectedIncrementalGMV: number;
    goalProgressImpact: string;
    keyThemes: string[];
    majorRisks: string[];
    reviewRequiredCount: number;        // 需人审的数量
  };

  campaigns: Campaign[];

  deferredOpportunities: Array<{
    opportunity: string;
    reason:
      | "audience_over_touched"
      | "budget_exhausted"
      | "conflicts_with_higher_priority"
      | "confidence_too_low"
      | "outside_brand_guardrails";
    suggestedWeek?: string;
  }>;

  skippedRoutines: Array<{
    routine: string;                    // e.g. "weekly_birthday_sms"
    reason: string;
  }>;

  dataGaps: Array<{
    missing: string;
    impact: string;
    blockingCampaigns?: string[];
  }>;

  rationaleTrace: {
    contextSources: string[];
    memoryReferences: string[];
    guardrailsApplied: string[];
    conflictResolutions: Array<{
      removedCampaignId: string;
      reason: string;
    }>;
  };
}
```

### 5.2 Campaign Schema (enhanced)

```typescript
interface Campaign {
  id: string;
  name: string;
  themeId?: string;

  hypothesis: {
    statement: string;                  // "X 会带来 Y"
    falsifiable: boolean;               // 必须可证伪
    baselineReference: string;          // 对比基线来源
  };

  audience: {
    filter: AudienceFilter;             // RFM + tags + 自然语言可选
    estimatedSize: number;
    segmentIds: string[];
  };

  channels: Channel[];
  content: ContentPayload;              // 文案、图片、CTA

  schedule: {
    sendAt: Date;
    timezone: string;
    recurrence?: RecurrenceRule;
  };

  budget: {
    totalUSD: number;
    breakdown: Record<Channel, number>;
  };

  kpiTarget: {
    primary: { metric: string; target: number; confidenceLevel: number };
    secondary?: Array<{ metric: string; target: number }>;
  };

  measurementPlan: {
    attributionWindowDays: number;
    successCode: string;                // 专属 coupon code
    utmCampaign: string;
    controlGroupPercent?: number;       // 可选留对照组
  };

  rationale: {
    dataEvidence: string[];             // 引用 input 中哪些字段
    memoryEvidence: string[];           // 引用 memoryTopK 哪些条目
    expectedOutcome: {
      gmv: number;
      roi: number;
      newCustomers: number;
    };
  };

  riskLevel: "auto" | "review" | "strict_review";
  conflictsWith: string[];              // 同输出中其他 campaign ID
  status: CampaignStatus;               // 初始为 draft
}
```

### 5.3 Validation

- 所有 Output 必须通过 Zod schema 校验
- 校验失败时 retry 最多 2 次，每次把 validation error 作为 feedback 附在下轮 prompt
- 2 次仍失败 → 降级到 Fallback Pipeline（§8）

---

## 6. Conflict Resolver (Deterministic)

独立模块，不走 LLM。在 Step 5 对 Step 4 输出做二次仲裁。

### 6.1 规则优先级（从高到低）

1. **合规硬拒** — 违反 TCPA / CAN-SPAM / 静默时段 → 直接拒绝
2. **频次 cap** — 违反 `guardrails.frequencyCaps` → 拒绝或推迟
3. **预算 cap** — 累计超出 `quarterlyStrategy.remainingBudgetUSD` → 按 ROI 排序裁剪
4. **客户级触达冲突** — 同客户本周收到 >2 条 campaign → 保留 ROI 最高的
5. **主题冲突** — 同一 theme 下 >3 个 campaign → 合并或裁剪
6. **LLM hint 参考** — 读取 `conflictsWith` 字段作为辅助

### 6.2 输出

```typescript
interface ConflictResolution {
  keptCampaigns: Campaign[];
  removedCampaigns: Array<{
    campaign: Campaign;
    reason: string;
    rule: string;                       // 命中的具体规则
  }>;
  modifiedCampaigns: Array<{
    campaign: Campaign;
    modifications: string[];            // e.g. "audience size reduced from 2000 to 800"
  }>;
}
```

所有 removed/modified 写回 `rationaleTrace.conflictResolutions`，人审时展示。

---

## 7. Cold Start Strategy

### 7.1 首周（Week 0–1）

- Tactical Planner **不启动**
- 只开 Reactive Planner（事件触发类：差评回复、生日 SMS）
- 积累 1 周 signal events + 1 轮 segment 快照

### 7.2 第 2 周启动时

因无 `lastWeekResults` + 空 `memoryTopK`，启用 Bootstrap Memory：

```typescript
// 预置的餐厅营销 best-practice 条目
interface BootstrapMemoryEntry {
  scenario: string;                     // "first_week_sleeping_recovery"
  hypothesis: string;
  recommendedChannels: Channel[];
  typicalKpi: { metric; range };
  sourceAuthority: string;              // "industry_benchmark" | "internal_ops"
}
```

这批数据手工整理（约 20–30 条覆盖常见场景：沉睡召回、生日、节日套餐、差评补救、招牌菜推广、新客激活等），在 Agent 部署时种入数据库。

### 7.3 退出冷启动

当 `lastWeekResults.campaigns.length >= 3` 且 `memoryTopK` 至少有 5 条真实 campaign → 切换到正常模式，Bootstrap Memory 权重降为 0.2（仍可查询但不优先）。

---

## 8. Fallback Pipeline (Non-LLM)

任一 Step 失败（超时、schema 校验 2 次失败、API 错误）→ 降级到纯规则版：

```typescript
interface FallbackPlanner {
  generate(input: TacticalPlannerInput): TacticalPlannerOutput;
}
```

保守输出固定 3 个 campaign：

1. **沉睡 90 天会员召回 SMS**（阈值达到才执行）
2. **本周生日会员批量券**（有生日用户才执行）
3. **Review 请求（针对上周下单未评价客户）**

所有 fallback campaigns 标记 `riskLevel: 'review'`，强制人审；output 顶层加 `degraded: true` 字段让 dashboard 高亮显示。

目标：**Agent 永不让一周完全空跑**，即使 LLM 全挂也有基本动作。

---

## 9. Human Review & Memory Write-back

### 9.1 审批界面要素

每个 campaign 卡片必须展示：
- 基本信息（name, audience size, channels, budget, schedule）
- `rationale.dataEvidence` + `rationale.memoryEvidence`（"Why this?"）
- `conflictsWith`（如有）
- Inline 修改：文案、发送时间、受众筛选、budget
- Approve / Reject / Modify 按钮

### 9.2 修改回流

```typescript
interface HumanEditRecord {
  campaignId: string;
  editorUserId: string;
  editedAt: Date;
  field: string;                        // "content.body" | "schedule.sendAt" | ...
  before: unknown;
  after: unknown;
  reason?: string;                      // 可选，鼓励填写
}
```

- 每次修改写 `agent_decision_trace`
- 定期扫描：**同一 field 连续 3 次被同向修改** → 自动提取 learning

### 9.3 Learning 自动提取示例

```typescript
// 连续 3 周老板把 VIP campaign 折扣从 15% 改到 10%
{
  scope: "vip_campaigns",
  rule: "discount_ceiling",
  value: 10,
  evidence: ["edit#123", "edit#145", "edit#167"],
  confidence: 0.9,
  appliedInPromptFrom: "2026-05-10",
}
```

自动写入 `agent_learnings`，下次 Tactical Planner 的 prompt 中作为 hard constraint 传入。

---

## 10. Token & Cost Budget

### 10.1 单次规划成本估算（Claude Sonnet 4.6）

| Step | Input tokens | Output tokens | Cost (USD) |
|------|:---:|:---:|:---:|
| Diagnose | 5k | 600 | $0.02 |
| Opportunity | 8k | 1.5k | $0.04 |
| Select | 6k | 800 | $0.03 |
| Detailize (×N=5 avg) | 4k each | 1.5k each | $0.10 |
| Summary | 3k | 500 | $0.01 |
| **Total** | | | **≈ $0.20** |

每周 1 次 × 52 周 / 商户 = **~$10/年/商户**。100 商户规模年成本 ~$1000。

### 10.2 缓存优化

Invariant Layer（brand + guardrails + channels）用 Anthropic **prompt caching**，缓存命中时 input 成本降 90%。实际 per-week 成本可压到 **~$0.10**。

### 10.3 模型选型初判

- Diagnose + Summary 两步可用 Haiku 4.5（简单摘要），成本降 70%
- Opportunity + Select + Detailize 必须 Sonnet 4.6（决策质量敏感）

最终优化后预计 **~$0.08/周/商户，$4/年/商户**。

---

## 11. Operational Cadence

```
每周日 22:00 (商户本地时区)  → Tactical Planner 开始规划
每周日 23:00 左右            → 审批通知发给老板/运营（SMS + Email + Dashboard）
每周一 09:00 之前            → 期望人审完成
每周一 09:00 之后            → 已批准 campaign 按 schedule 入执行队列
每周一 10:00                → 未审批的自动按规则处理:
                               • riskLevel=auto  → 自动通过
                               • riskLevel=review → 超时默认通过
                               • riskLevel=strict_review → 继续等待（不默认通过）
```

---

## 12. Observability 要求

- 每次规划 session 的 Step 1–6 LLM input/output 完整入库 `agent_decision_trace`
- Metrics: planning duration, token usage, fallback triggered count, human edit count
- Alerts: fallback 连续 2 周触发、规划 duration >5 分钟、human edit >5 次/周

---

## 13. Open Questions

1. **向量检索实现** — 用 pgvector / MySQL 自建 embedding 列 / 外部向量服务？取决于底层 DB 选型。
2. **Prompt 版本管理** — prompt 升级时如何 A/B 验证（同一周跑两套 prompt 对比）？
3. **多语言输出** — 商家运营团队与最终客户的语言可能不同（如运营侧看本地语言、campaign 发给其他语言客户）。Planner output 的语言策略？
4. **Audience filter DSL** — 用声明式 JSON 还是允许 LLM 产出 SQL-like 表达式？安全性与灵活性平衡。
5. **Seasonal 学习衰减** — 季节性/节日性 learnings 在非匹配时段是否仍适用？是否需要按季节/月份做 Memory 分桶。
6. **跨租户学习** — 多租户能否共享通用 learnings（如"雨天外卖加推有效"）？隐私与冷启动收益权衡。

---

## 14. 下一步

本 spec 确定 Tactical Planner 的 I/O 契约和 Pipeline 骨架。后续待展开：

- **Prompt 模板库** — Step 1–4 的 system/user prompt 详细模板与 few-shot 示例
- **Audience Filter DSL** — 声明式分群语言的语法与执行器
- **Memory 子系统 spec** — 向量检索、learnings 自动提取、跨周/跨租户策略
- **ConflictResolver 规则引擎** — 独立子系统详细设计
- **Fallback Pipeline** — 兜底规则的具体实现
- **人审 Dashboard UI** — 审批界面的信息密度与交互流程
- **端到端 MVP 实施计划** — Phase 1 工时估算、里程碑、验证指标
