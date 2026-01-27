// Services
export { loyaltyService, LoyaltyService } from "./loyalty.service";
export { loyaltyConfigService, LoyaltyConfigService } from "./loyalty-config.service";
export { loyaltyMemberService, LoyaltyMemberService } from "./loyalty-member.service";
export { pointsService, PointsService } from "./points.service";

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
