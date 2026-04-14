// Services
export { loyaltyService } from "./loyalty.service";
export { loyaltyConfigService } from "./loyalty-config.service";
export { loyaltyMemberService } from "./loyalty-member.service";
export { pointsService } from "./points.service";

// Event handlers
export {
  registerLoyaltyEventHandlers,
  unregisterLoyaltyEventHandlers,
} from "./loyalty-event-handler";

// Types
export type {
  LoyaltyConfigData,
  UpsertLoyaltyConfigInput,
  LoyaltyMemberData,
  CreateMemberInput,
  LoyaltyStatus,
  AwardPointsInput,
  AwardCustomPointsInput,
  PointsEarnResult,
  PointTransactionData,
  PaginatedTransactions,
  PaginatedMembers,
} from "./loyalty.types";

export type {
  OrderCompletionData,
  CustomerLoyaltyDashboard,
} from "./loyalty.service";
