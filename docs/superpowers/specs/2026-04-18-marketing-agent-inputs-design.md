# Marketing Agent — Input Data Sources Design

**Date**: 2026-04-18
**Status**: Draft (input layer only — strategy & execution layers TBD)
**Context**: 为餐厅客户构建通用个性化营销 Agent。Agent 的行为由餐厅 profile 驱动（菜系、定位、客单价、渠道覆盖等），**与餐厅类型无关**。本文档只覆盖 Agent 的**输入层**设计（Agent 需要哪些数据、如何最大化自动化采集），并以某一具体 profile 作为示例场景驱动采集需求推导。策略生成与执行层将另起文档。

---

## 1. Example Client Profile (用于校准本 spec 的数据采集推导)

> **说明**：本节仅作为一个具体 profile 样本，驱动后文的采集路径设计。Agent 本身与餐厅类型无关；下文提及的具体平台 / 工具 / API（如 Fantuan、Punchh、Square Loyalty 等）是针对本样本 profile 的示例，实际覆盖范围由 profile 字段决定。

| 维度 | 现状 |
|------|------|
| 业态 | 正餐中餐 |
| 线上外卖占比 | 10–20%，来自 DoorDash / Uber Eats / Fantuan |
| 自有 website | 有，但**无 online ordering** |
| Loyalty 会员 | 1.8 万，仅线下攒积分换折扣，未主动运营 |
| Social media | 未运营 |
| Google / Yelp review | 人工手动回复 |
| 目标 | 线上营销带来 **10% 增长** |

### 两个前置阻塞

Agent 启动前必须解决，否则输出再好也无法转化：

1. **Online ordering 缺位** — website 有流量但没有自营转化出口，所有营销流量只能回流到 DD/UE，白给平台抽佣。建议先接自营 ordering（平台内已具备）。
2. **Loyalty / POS 数据孤岛** — 1.8 万会员是核心资产。若数据散在 POS 后台或纸质记录中，Agent 的分群和个性化无从谈起。必须先打通 POS + Loyalty 的数据导出。

---

## 2. Agent 输入数据总览

按五大类划分。每项标注自动化档位：

- 🟢 **全自动** — 有官方 API，一次授权即可长期运行
- 🟡 **半自动** — 需要商家账号、CSV 导出或无头浏览器，可脚本化但有人工环节
- 🔴 **手工为主** — 无 API、TOS 限制或需要业务决策输入

---

## 3. Module 1: 商家本体数据

| 数据 | 来源 | 采集方式 | 档位 | 备注 |
|------|------|----------|------|------|
| 菜单、价格、菜品图片 | 自家 website、DD、UE、Fantuan | 抓商家页（多数平台返回 JSON） | 🟢 | 平台反爬需 UA + 限速 |
| 菜品销量 Top N、招牌菜 | DD / UE 商家后台 | Playwright 自动登录 + CSV 导出 | 🟡 | 需商家账号，2FA 需预处理 |
| 营业时间、地址、坐标 | Google Places API | `place_details` 一次拿全 | 🟢 | 免费额度充足 |
| 品牌调性、logo、主色 | 自家 website | 抓首页 HTML + `color-thief` 提取主色 + LLM 生成调性描述 | 🟢 | — |
| 客单价、堂食/外卖比例 | POS 系统 | Toast / Square / Clover 有 REST API；老派 POS 仅 CSV | 🟡 | **最大变数：先确认客户用什么 POS** |

---

## 4. Module 2: 客户数据（最关键也最难）

| 数据 | 来源 | 采集方式 | 档位 | 备注 |
|------|------|----------|------|------|
| 1.8 万 Loyalty 会员档案 | Loyalty 平台（Square Loyalty / Punchh / Fivestars / 自建） | 官方 API 或 CSV 导出 | 🟡 | **首要问题：客户用哪家 Loyalty** |
| 消费历史（RFM 所需字段） | POS + Loyalty 关联 | POS API 拉 transaction | 🟡 | 清洗工作量大（电话号码去重、跨账号合并） |
| 会员生日、偏好 | Loyalty 注册表单 | 同上 | 🟢 | 取决于注册表单是否收集 |
| 外卖平台订单 | DoorDash / Uber Eats / Fantuan | DD Marketplace API（需申请 partner）；UE 类似；Fantuan 仅商家后台导 CSV | 🔴 | Partner API 审批周期 4–8 周 |
| Google Review 原文 + 评分 | Google Places API / SerpAPI / Outscraper | Places API 返回最近 5 条；全量 SerpAPI（~$0.002/条） | 🟢 | **合规：Google TOS 禁止长期存储超过 30 天原文，只能存元数据 + AI 摘要** |
| Yelp Review | Yelp Fusion API + 爬虫 | Fusion API 仅返回 3 条；全量需爬 | 🟢 (摘要) / 🔴 (原文) | Yelp TOS 更严 |

---

## 5. Module 3: 渠道授权与能力

此类以**一次性 OAuth 授权**为主，授权后几乎全自动。

| 渠道 | 接入方式 | 档位 | 备注 |
|------|----------|------|------|
| Meta (Instagram + Facebook) | Graph API + Business Login | 🟢 | 发帖、评论、洞察全自动 |
| TikTok | TikTok Business API | 🟡 | 需申请，审批慢 |
| 小红书 | ❌ 无官方 API | 🔴 | 只能 AI 生成内容 + 人工发布 |
| 微信公众号 | 公众平台 API | 🟢 | 模板消息、群发可用 |
| Google Business Profile | GMB API | 🟢 | 发帖 + 自动回复 review |
| Yelp 商家回复 | ❌ 无公开商家 API | 🔴 | 只能无头浏览器半自动 |
| SMS | Twilio | 🟢 | **合规：需 TCPA opt-in 证据** |
| Email | SendGrid / Resend | 🟢 | 遵守 CAN-SPAM |
| Meta Ads / Google Ads | Marketing API | 🟢 | 投放、出价、素材全自动 |

---

## 6. Module 4: 业务目标与约束（Onboarding Wizard）

🔴 **必须人工输入**。通过 Setup Wizard 5–10 个问题收集，输出结构化 JSON config 持久化存储。

```typescript
interface MarketingAgentConfig {
  goal: {
    type: "revenue_growth" | "new_customer" | "repeat_rate";
    targetPercent: number;     // e.g. 10
    horizonMonths: number;     // e.g. 3
  };
  budget: {
    monthlyCapUSD: number;
    adSpendCapUSD?: number;
    discountCapPercent?: number;  // e.g. 20（最多允许打 8 折）
  };
  brandGuardrails: {
    positioning: "fine_dining" | "casual" | "fast";
    forbiddenTactics: string[];   // e.g. ["群发 push 轰炸", "低价引流"]
    toneOfVoice: string;          // 自由文本
  };
  channelPreferences: string[];    // 启用的渠道 ID 列表
}
```

---

## 7. Module 5: 外部信号

全自动获取，用于触发时机化营销（timing-based campaigns）。

| 信号 | 来源 | 档位 |
|------|------|------|
| 中美节假日 + 节气 | 本地 JSON 字典 | 🟢 |
| 天气（下雨/寒潮 → 外卖场景） | OpenWeather API（按门店坐标） | 🟢 |
| 本地活动 | Eventbrite API / Ticketmaster API | 🟢 |
| 竞对动态 | 抓竞对的 GMB + IG 公开数据 | 🟢 |

---

## 8. 分阶段落地

| Phase | 时间窗 | 接入内容 | 目标 |
|-------|--------|----------|------|
| Phase 1 | Day 1–7 | Google Places + POS/Loyalty CSV 一次性导入 + Onboarding Wizard | Agent 能跑起来 |
| Phase 2 | Week 2–4 | Meta / GMB OAuth、Twilio、SendGrid、POS 增量同步（webhook 或 cron） | 主力渠道打通 |
| Phase 3 | Month 2+ | DD/UE Partner API、Yelp/小红书半自动、竞对监控 | 覆盖长尾渠道 |

---

## 9. 合规与法律红线

Agent 必须内置合规检查，违反时硬拦截：

- **Google / Yelp review**：不长期存储原文超过 30 天；只保留元数据 + AI 摘要。
- **SMS 营销（TCPA）**：发送前必须有 opt-in 证据链，违规单条罚款 $500–1500。
- **Email 营销（CAN-SPAM）**：所有模板必须带 unsubscribe link 与实体地址。
- **会员 PII**：电话、邮箱必须加密存储；访问审计日志。

---

## 10. 开放问题（Open Questions）

进入下一阶段前需与客户确认：

1. **POS 系统是什么？** 决定了交易数据能否自动同步。
2. **Loyalty 系统是什么？** 决定了 1.8 万会员数据的导出方式。
3. **是否已接入自营 online ordering？** 如未接入，是否同意优先接入（作为营销转化出口）？
4. **DD/UE/Fantuan 商家后台账号是否可提供？** 决定了外卖数据能否自动化。
5. **社媒账号现状** —— 是否已注册（IG/FB/TikTok/小红书/微信公众号/GMB）？有无管理员权限？
6. **合规证据链** —— 1.8 万会员是否有 TCPA opt-in 记录？若无，需先走 re-opt-in 流程才能做 SMS。
7. **预算与折扣红线** —— 正餐定位下愿意承受的最大折扣幅度。

---

## 11. 下一步（待讨论）

本 spec 仅覆盖 Agent 的**输入层**。后续需要继续设计的模块：

- **数据 Schema** — 上述输入如何落到 plovr-grow 的数据库（ER 图 + Prisma schema）
- **Agent 策略层** — 诊断 → 机会识别 → 策略生成 → 执行 → 闭环的工作流
- **MVP 场景选择** — 推荐首发三个自动化场景：沉睡会员 SMS 召回、Review 自动回复、招牌菜社媒内容生成
- **Onboarding 客户清单** — 面向客户的需提供物清单（账号、数据文件、授权流程）
