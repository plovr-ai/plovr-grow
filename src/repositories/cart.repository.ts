import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import type { CartStatus } from "@/services/cart/cart.types";

export class CartRepository {
  async create(
    tenantId: string,
    merchantId: string,
    data: { salesChannel: string; notes?: string }
  ) {
    return prisma.cart.create({
      data: {
        id: generateEntityId(),
        tenantId,
        merchantId,
        salesChannel: data.salesChannel,
        notes: data.notes ?? null,
      },
    });
  }

  async findByIdWithItems(tenantId: string, cartId: string) {
    return prisma.cart.findFirst({
      where: { id: cartId, tenantId, deleted: false },
      include: {
        cartItems: {
          where: { deleted: false },
          orderBy: { sortOrder: "asc" },
          include: {
            modifiers: {
              where: { deleted: false },
            },
          },
        },
      },
    });
  }

  async findById(tenantId: string, cartId: string) {
    return prisma.cart.findFirst({
      where: { id: cartId, tenantId, deleted: false },
    });
  }

  async updateStatus(tenantId: string, cartId: string, status: CartStatus) {
    return prisma.cart.updateMany({
      where: { id: cartId, tenantId, deleted: false },
      data: { status },
    });
  }

  async claimForCheckout(tenantId: string, cartId: string) {
    // Use raw SQL to get a true atomic CAS. Prisma's `updateMany` splits into
    // SELECT + UPDATE, so concurrent callers can both see status='active' in
    // their snapshot and both succeed. Raw UPDATE with conditional WHERE is
    // a single statement and row-locking serializes concurrent calls, so
    // exactly one caller observes affectedRows=1 (the winner).
    const affected = await prisma.$executeRaw`
      UPDATE carts
      SET status = 'submitted', updated_at = NOW(3)
      WHERE id = ${cartId}
        AND tenant_id = ${tenantId}
        AND status = 'active'
        AND deleted = false
    `;
    return { count: affected };
  }

  async rollbackCheckoutClaim(tenantId: string, cartId: string) {
    // Same reasoning as claimForCheckout: use raw SQL so the WHERE predicate
    // and UPDATE happen atomically under a single row lock.
    const affected = await prisma.$executeRaw`
      UPDATE carts
      SET status = 'active', updated_at = NOW(3)
      WHERE id = ${cartId}
        AND tenant_id = ${tenantId}
        AND status = 'submitted'
        AND order_id IS NULL
        AND deleted = false
    `;
    return { count: affected };
  }

  async attachOrderId(tenantId: string, cartId: string, orderId: string) {
    return prisma.cart.updateMany({
      where: { id: cartId, tenantId, deleted: false },
      data: { orderId },
    });
  }

  async addItem(
    cartId: string,
    data: {
      menuItemId: string;
      name: string;
      unitPrice: number;
      quantity: number;
      totalPrice: number;
      specialInstructions?: string;
      imageUrl?: string | null;
      sortOrder: number;
      modifiers: Array<{
        modifierGroupId: string;
        modifierOptionId: string;
        groupName: string;
        name: string;
        price: number;
        quantity: number;
      }>;
    }
  ) {
    const itemId = generateEntityId();
    return prisma.cartItem.create({
      data: {
        id: itemId,
        cartId,
        menuItemId: data.menuItemId,
        name: data.name,
        unitPrice: data.unitPrice,
        quantity: data.quantity,
        totalPrice: data.totalPrice,
        specialInstructions: data.specialInstructions ?? null,
        imageUrl: data.imageUrl ?? null,
        sortOrder: data.sortOrder,
        modifiers: {
          create: data.modifiers.map((m) => ({
            id: generateEntityId(),
            modifierGroupId: m.modifierGroupId,
            modifierOptionId: m.modifierOptionId,
            groupName: m.groupName,
            name: m.name,
            price: m.price,
            quantity: m.quantity,
          })),
        },
      },
      include: {
        modifiers: { where: { deleted: false } },
      },
    });
  }

  async findItemById(cartId: string, itemId: string) {
    return prisma.cartItem.findFirst({
      where: { id: itemId, cartId, deleted: false },
      include: { modifiers: { where: { deleted: false } } },
    });
  }

  async updateItem(
    itemId: string,
    data: {
      quantity?: number;
      totalPrice?: number;
      specialInstructions?: string;
    }
  ) {
    return prisma.cartItem.update({
      where: { id: itemId },
      data,
      include: { modifiers: { where: { deleted: false } } },
    });
  }

  async replaceItemModifiers(
    itemId: string,
    modifiers: Array<{
      modifierGroupId: string;
      modifierOptionId: string;
      groupName: string;
      name: string;
      price: number;
      quantity: number;
    }>
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.cartItemModifier.updateMany({
        where: { cartItemId: itemId, deleted: false },
        data: { deleted: true },
      });

      if (modifiers.length > 0) {
        await tx.cartItemModifier.createMany({
          data: modifiers.map((m) => ({
            id: generateEntityId(),
            cartItemId: itemId,
            modifierGroupId: m.modifierGroupId,
            modifierOptionId: m.modifierOptionId,
            groupName: m.groupName,
            name: m.name,
            price: m.price,
            quantity: m.quantity,
          })),
        });
      }
    });
  }

  async softDeleteItem(itemId: string) {
    await prisma.$transaction(async (tx) => {
      await tx.cartItemModifier.updateMany({
        where: { cartItemId: itemId, deleted: false },
        data: { deleted: true },
      });
      await tx.cartItem.update({
        where: { id: itemId },
        data: { deleted: true },
      });
    });
  }

  async getNextSortOrder(cartId: string) {
    const maxItem = await prisma.cartItem.findFirst({
      where: { cartId, deleted: false },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return (maxItem?.sortOrder ?? -1) + 1;
  }
}

export const cartRepository = new CartRepository();
