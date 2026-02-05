import type {
  IntentCategory,
  IntentResult,
  ConversationContext,
} from "../dashboard-agent.types";

/**
 * Pattern-based intent keywords for each category
 */
const INTENT_PATTERNS: Record<IntentCategory, string[]> = {
  subscription: [
    "subscribe",
    "subscription",
    "plan",
    "pricing",
    "trial",
    "free trial",
    "upgrade",
    "billing",
    "payment plan",
    "start trial",
    "begin trial",
    "订阅",
    "付费",
    "试用",
    "免费试用",
    "套餐",
    "定价",
    "升级",
  ],
  onboarding: [
    "import",
    "导入",
    "setup",
    "设置",
    "get started",
    "开始",
    "website",
    "网站",
    "doordash",
    "ubereats",
    "uber eats",
    "add menu",
    "添加菜单",
    "scrape",
    "extract",
    "提取",
    "google business",
  ],
  menu_management: [
    "menu",
    "菜单",
    "item",
    "菜品",
    "category",
    "分类",
    "price",
    "价格",
    "add item",
    "添加菜品",
    "edit item",
    "编辑",
    "delete item",
    "删除",
    "update price",
    "更新价格",
    "modifier",
    "选项",
  ],
  order_management: [
    "order",
    "订单",
    "orders",
    "pending",
    "待处理",
    "completed",
    "已完成",
    "cancelled",
    "取消",
    "refund",
    "退款",
    "today's orders",
    "今日订单",
    "recent orders",
    "最近订单",
  ],
  reports: [
    "report",
    "报表",
    "sales",
    "销售",
    "revenue",
    "收入",
    "analytics",
    "分析",
    "statistics",
    "统计",
    "performance",
    "表现",
    "how much",
    "多少",
    "total",
    "总计",
  ],
  settings: [
    "settings",
    "设置",
    "configure",
    "配置",
    "hours",
    "营业时间",
    "tax",
    "税",
    "tip",
    "小费",
    "payment",
    "支付",
  ],
  general_help: [
    "help",
    "帮助",
    "how to",
    "如何",
    "what can you",
    "你能做什么",
    "support",
    "支持",
    "guide",
    "指南",
  ],
  unknown: [],
};

/**
 * Intent Classifier
 *
 * Classifies user messages into intent categories using rule-based matching
 * with optional AI fallback for ambiguous cases.
 */
class IntentClassifier {
  /**
   * Classify user message intent
   * @param message - User message to classify
   * @param context - Optional conversation context for boosting
   * @returns Intent classification result
   */
  async classify(
    message: string,
    context?: Partial<ConversationContext>
  ): Promise<IntentResult> {
    const lowerMessage = message.toLowerCase();

    // Rule-based classification (fast path)
    let result = this.classifyWithRules(lowerMessage);

    // Context-aware boosting
    if (context?.activeIntent && result.confidence < 0.9) {
      result = this.boostWithContext(result, lowerMessage, context);
    }

    // Boost confidence if URLs are detected and we're in onboarding
    if (this.containsUrls(message)) {
      if (
        context?.onboardingState?.status === "collecting_urls" ||
        result.category === "onboarding"
      ) {
        result = {
          ...result,
          category: "onboarding",
          action: "provide_urls",
          confidence: Math.min(result.confidence + 0.3, 1),
          entities: {
            ...result.entities,
            urls: this.extractUrls(message),
          },
        };
      }
    }

    return result;
  }

  /**
   * Rule-based classification using keyword matching
   */
  private classifyWithRules(message: string): IntentResult {
    let bestMatch: IntentResult = {
      category: "unknown",
      action: "unknown",
      confidence: 0,
      entities: {},
    };

    for (const [category, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (category === "unknown") continue;

      for (const pattern of patterns) {
        if (message.includes(pattern.toLowerCase())) {
          const confidence = this.calculateConfidence(message, pattern, patterns);
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              category: category as IntentCategory,
              action: this.extractAction(message, category as IntentCategory),
              confidence,
              entities: this.extractEntities(message, category as IntentCategory),
            };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate confidence score based on pattern matches
   */
  private calculateConfidence(
    message: string,
    matchedPattern: string,
    allPatterns: string[]
  ): number {
    // Base confidence from pattern match
    let confidence = 0.6;

    // Boost for exact word match (not substring)
    const wordBoundary = new RegExp(`\\b${this.escapeRegex(matchedPattern)}\\b`, "i");
    if (wordBoundary.test(message)) {
      confidence += 0.2;
    }

    // Boost for multiple pattern matches
    const matchCount = allPatterns.filter((p) =>
      message.includes(p.toLowerCase())
    ).length;
    confidence += Math.min(matchCount * 0.05, 0.15);

    return Math.min(confidence, 1);
  }

  /**
   * Extract specific action from message based on category
   */
  private extractAction(message: string, category: IntentCategory): string {
    switch (category) {
      case "subscription":
        if (message.includes("start") || message.includes("begin") || message.includes("开始"))
          return "start_trial";
        if (message.includes("upgrade") || message.includes("升级")) return "upgrade";
        if (message.includes("billing") || message.includes("账单")) return "manage_billing";
        return "start_trial";

      case "onboarding":
        return "import_menu";

      case "menu_management":
        if (message.includes("add") || message.includes("添加")) return "add_item";
        if (message.includes("edit") || message.includes("编辑") || message.includes("update") || message.includes("更新"))
          return "edit_item";
        if (message.includes("delete") || message.includes("删除") || message.includes("remove"))
          return "delete_item";
        return "view_menu";

      case "order_management":
        if (message.includes("pending") || message.includes("待处理")) return "view_pending";
        if (message.includes("cancel") || message.includes("取消")) return "cancel_order";
        return "view_orders";

      case "reports":
        if (message.includes("sales") || message.includes("销售")) return "view_sales";
        if (message.includes("revenue") || message.includes("收入")) return "view_revenue";
        return "view_report";

      case "settings":
        return "view_settings";

      case "general_help":
        return "show_help";

      default:
        return "general";
    }
  }

  /**
   * Extract entities from message based on category
   */
  private extractEntities(
    message: string,
    _category: IntentCategory
  ): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    // Extract URLs
    const urls = this.extractUrls(message);
    if (urls.length > 0) {
      entities.urls = urls;
    }

    // Extract numbers (for order numbers, prices, etc.)
    const numberRegex = /\b(\d+(?:\.\d{2})?)\b/g;
    const numbers = message.match(numberRegex);
    if (numbers) {
      entities.numbers = numbers;
    }

    // Extract dates (basic pattern)
    const dateRegex = /\b(today|yesterday|this week|last week|今天|昨天|本周|上周)\b/gi;
    const dates = message.match(dateRegex);
    if (dates) {
      entities.dateRef = dates[0];
    }

    return entities;
  }

  /**
   * Boost confidence based on conversation context
   */
  private boostWithContext(
    result: IntentResult,
    message: string,
    context: Partial<ConversationContext>
  ): IntentResult {
    // If we're collecting URLs in onboarding and message contains URLs
    if (
      context.onboardingState?.status === "collecting_urls" &&
      this.containsUrls(message)
    ) {
      return {
        ...result,
        category: "onboarding",
        action: "provide_urls",
        confidence: Math.min(result.confidence + 0.3, 1),
      };
    }

    // If same category as active intent, boost confidence
    if (context.activeIntent?.category === result.category) {
      return {
        ...result,
        confidence: Math.min(result.confidence + 0.1, 1),
      };
    }

    return result;
  }

  /**
   * Check if message contains URLs
   */
  private containsUrls(message: string): boolean {
    const urlRegex = /https?:\/\/[^\s]+/i;
    return urlRegex.test(message);
  }

  /**
   * Extract URLs from message
   */
  private extractUrls(message: string): string[] {
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
    return message.match(urlRegex) || [];
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

// Singleton instance
export const intentClassifier = new IntentClassifier();
