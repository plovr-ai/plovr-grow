/**
 * Menu API Service
 * 提供 Menu API 相关的服务方法（使用 mock 数据）
 */

import { getMockMenuResponse } from "@/data/mock/menu-api";
import type { MenuApiResponse } from "./menu-api.types";

export class MenuApiService {
  /**
   * Get menu with normalized data structure
   * @param tenantId 租户 ID
   * @param merchantId 商家 ID
   * @returns MenuApiResponse - normalized menu data
   */
  async getMenu(tenantId: string, merchantId: string): Promise<MenuApiResponse> {
    // TODO: 后续替换为数据库实现
    return getMockMenuResponse(tenantId, merchantId);
  }
}

export const menuApiService = new MenuApiService();
