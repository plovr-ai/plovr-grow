import type { MenuCategory, MenuItem } from "@prisma/client";

export interface MenuCategoryWithItems extends MenuCategory {
  menuItems: MenuItem[];
}

export interface GetMenuResponse {
  categories: MenuCategoryWithItems[];
  merchantId: string;
  merchantName: string;
  merchantLogo: string | null;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  status?: "active" | "inactive";
}

export interface CreateMenuItemInput {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  sortOrder?: number;
  options?: MenuItemOptionInput[];
  tags?: string[];
  taxConfigId?: string;
}

export interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  sortOrder?: number;
  status?: "active" | "inactive" | "out_of_stock";
  options?: MenuItemOptionInput[];
  tags?: string[];
  taxConfigId?: string | null;
}

export interface MenuItemOptionInput {
  id: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  choices: {
    id: string;
    name: string;
    price: number;
  }[];
}
