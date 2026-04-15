import { cartRepository } from "@/repositories/cart.repository";
import { menuRepository } from "@/repositories/menu.repository";
import { orderService } from "@/services/order";
import { AppError } from "@/lib/errors";
import { ErrorCodes } from "@/lib/errors/error-codes";
import type {
  CreateCartInput,
  AddCartItemInput,
  UpdateCartItemInput,
  CheckoutInput,
  CartWithItems,
  CartItemData,
  CartItemModifierData,
  CheckoutResult,
} from "./cart.types";
import type { OrderItemData, SelectedModifier, SalesChannel } from "@/types";

export class CartService {
  async createCart(tenantId: string, merchantId: string, input: CreateCartInput) {
    return cartRepository.create(tenantId, merchantId, {
      salesChannel: input.salesChannel,
      notes: input.notes,
    });
  }

  async getCart(tenantId: string, cartId: string): Promise<CartWithItems> {
    const cart = await cartRepository.findByIdWithItems(tenantId, cartId);
    if (!cart) {
      throw new AppError(ErrorCodes.CART_NOT_FOUND, undefined, 404);
    }

    return {
      id: cart.id,
      tenantId: cart.tenantId,
      merchantId: cart.merchantId,
      status: cart.status as CartWithItems["status"],
      salesChannel: cart.salesChannel,
      notes: cart.notes,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      items: cart.cartItems.map((item): CartItemData => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.name,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        totalPrice: Number(item.totalPrice),
        specialInstructions: item.specialInstructions,
        imageUrl: item.imageUrl,
        sortOrder: item.sortOrder,
        modifiers: item.modifiers.map((m): CartItemModifierData => ({
          id: m.id,
          modifierGroupId: m.modifierGroupId,
          modifierOptionId: m.modifierOptionId,
          groupName: m.groupName,
          name: m.name,
          price: Number(m.price),
          quantity: m.quantity,
        })),
      })),
    };
  }

  async cancelCart(tenantId: string, cartId: string): Promise<void> {
    const cart = await cartRepository.findById(tenantId, cartId);
    if (!cart) {
      throw new AppError(ErrorCodes.CART_NOT_FOUND, undefined, 404);
    }
    if (cart.status !== "active") {
      throw new AppError(ErrorCodes.CART_NOT_ACTIVE);
    }
    await cartRepository.updateStatus(tenantId, cartId, "cancelled");
  }

  async addItem(tenantId: string, cartId: string, input: AddCartItemInput) {
    const cart = await cartRepository.findById(tenantId, cartId);
    if (!cart) {
      throw new AppError(ErrorCodes.CART_NOT_FOUND, undefined, 404);
    }
    if (cart.status !== "active") {
      throw new AppError(ErrorCodes.CART_NOT_ACTIVE);
    }

    // Validate menu item exists and get price from DB
    const menuItems = await menuRepository.getItemsByIdsByCompany(
      tenantId,
      [input.menuItemId]
    );
    if (menuItems.length === 0) {
      throw new AppError(ErrorCodes.CART_MENU_ITEM_NOT_FOUND, undefined, 404);
    }

    const menuItem = menuItems[0];
    const unitPrice = Number(menuItem.price);

    // Calculate modifier total
    const modifiers = (input.selectedModifiers ?? []).map((m) => ({
      modifierGroupId: m.modifierGroupId,
      modifierOptionId: m.modifierOptionId,
      groupName: m.groupName,
      name: m.name,
      price: m.price,
      quantity: m.quantity ?? 1,
    }));

    const modifierTotal = modifiers.reduce(
      (sum, m) => sum + m.price * m.quantity,
      0
    );
    const totalPrice = (unitPrice + modifierTotal) * input.quantity;

    const sortOrder = await cartRepository.getNextSortOrder(cartId);

    const item = await cartRepository.addItem(cartId, {
      menuItemId: input.menuItemId,
      name: menuItem.name,
      unitPrice,
      quantity: input.quantity,
      totalPrice: Math.round(totalPrice * 100) / 100,
      specialInstructions: input.specialInstructions,
      imageUrl: menuItem.imageUrl ?? null,
      sortOrder,
      modifiers,
    });

    return this.mapCartItem(item);
  }

  async updateItem(
    tenantId: string,
    cartId: string,
    itemId: string,
    input: UpdateCartItemInput
  ) {
    const cart = await cartRepository.findById(tenantId, cartId);
    if (!cart) {
      throw new AppError(ErrorCodes.CART_NOT_FOUND, undefined, 404);
    }
    if (cart.status !== "active") {
      throw new AppError(ErrorCodes.CART_NOT_ACTIVE);
    }

    const existingItem = await cartRepository.findItemById(cartId, itemId);
    if (!existingItem) {
      throw new AppError(ErrorCodes.CART_ITEM_NOT_FOUND, undefined, 404);
    }

    const quantity = input.quantity ?? existingItem.quantity;
    const unitPrice = Number(existingItem.unitPrice);

    // If modifiers changed, replace them
    if (input.selectedModifiers !== undefined) {
      const newModifiers = input.selectedModifiers.map((m) => ({
        modifierGroupId: m.modifierGroupId,
        modifierOptionId: m.modifierOptionId,
        groupName: m.groupName,
        name: m.name,
        price: m.price,
        quantity: m.quantity ?? 1,
      }));

      await cartRepository.replaceItemModifiers(itemId, newModifiers);

      const modifierTotal = newModifiers.reduce(
        (sum, m) => sum + m.price * m.quantity,
        0
      );
      const totalPrice = Math.round((unitPrice + modifierTotal) * quantity * 100) / 100;

      const updated = await cartRepository.updateItem(itemId, {
        quantity,
        totalPrice,
        specialInstructions: input.specialInstructions,
      });

      return this.mapCartItem(updated);
    }

    // Only quantity/instructions changed
    const modifierTotal = existingItem.modifiers.reduce(
      (sum, m) => sum + Number(m.price) * m.quantity,
      0
    );
    const totalPrice = Math.round((unitPrice + modifierTotal) * quantity * 100) / 100;

    const updated = await cartRepository.updateItem(itemId, {
      quantity,
      totalPrice,
      specialInstructions: input.specialInstructions !== undefined
        ? input.specialInstructions
        : undefined,
    });

    return this.mapCartItem(updated);
  }

  async removeItem(tenantId: string, cartId: string, itemId: string): Promise<void> {
    const cart = await cartRepository.findById(tenantId, cartId);
    if (!cart) {
      throw new AppError(ErrorCodes.CART_NOT_FOUND, undefined, 404);
    }
    if (cart.status !== "active") {
      throw new AppError(ErrorCodes.CART_NOT_ACTIVE);
    }

    const existingItem = await cartRepository.findItemById(cartId, itemId);
    if (!existingItem) {
      throw new AppError(ErrorCodes.CART_ITEM_NOT_FOUND, undefined, 404);
    }

    await cartRepository.softDeleteItem(itemId);
  }

  async checkout(
    tenantId: string,
    cartId: string,
    input: CheckoutInput
  ): Promise<CheckoutResult> {
    const cart = await this.getCart(tenantId, cartId);

    if (cart.status !== "active") {
      throw new AppError(ErrorCodes.CART_NOT_ACTIVE);
    }
    if (cart.items.length === 0) {
      throw new AppError(ErrorCodes.CART_EMPTY);
    }

    // Convert cart items to OrderItemData[]
    const orderItems: OrderItemData[] = cart.items.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.unitPrice,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      specialInstructions: item.specialInstructions ?? undefined,
      imageUrl: item.imageUrl,
      selectedModifiers: item.modifiers.map((m): SelectedModifier => ({
        groupId: m.modifierGroupId,
        groupName: m.groupName,
        modifierId: m.modifierOptionId,
        modifierName: m.name,
        price: m.price,
        quantity: m.quantity,
      })),
    }));

    // Delegate to existing order service
    const order = await orderService.createMerchantOrderAtomic(tenantId, {
      merchantId: cart.merchantId,
      customerFirstName: input.customerFirstName,
      customerLastName: input.customerLastName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      orderMode: input.orderMode,
      salesChannel: cart.salesChannel as Exclude<SalesChannel, "giftcard">,
      paymentType: "in_store",
      items: orderItems,
      deliveryAddress: input.deliveryAddress,
      tipAmount: input.tipAmount,
      notes: input.notes,
    });

    // Mark cart as submitted
    await cartRepository.updateStatus(tenantId, cartId, "submitted");

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  }

  private mapCartItem(item: {
    id: string;
    menuItemId: string;
    name: string;
    unitPrice: unknown;
    quantity: number;
    totalPrice: unknown;
    specialInstructions: string | null;
    imageUrl: string | null;
    sortOrder: number;
    modifiers: Array<{
      id: string;
      modifierGroupId: string;
      modifierOptionId: string;
      groupName: string;
      name: string;
      price: unknown;
      quantity: number;
    }>;
  }): CartItemData {
    return {
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.name,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      totalPrice: Number(item.totalPrice),
      specialInstructions: item.specialInstructions,
      imageUrl: item.imageUrl,
      sortOrder: item.sortOrder,
      modifiers: item.modifiers.map((m): CartItemModifierData => ({
        id: m.id,
        modifierGroupId: m.modifierGroupId,
        modifierOptionId: m.modifierOptionId,
        groupName: m.groupName,
        name: m.name,
        price: Number(m.price),
        quantity: m.quantity,
      })),
    };
  }
}

export const cartService = new CartService();
