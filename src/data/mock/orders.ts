import type { Order } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { OrderStatus, OrderType } from "@/types";

// Mock merchant IDs (these should match your test data)
const MERCHANT_IDS = [
  "mock_merchant_1",
  "mock_merchant_2",
  "mock_merchant_3",
];

const MERCHANT_NAMES = [
  "Downtown Location",
  "Westside Location",
  "Airport Location",
];

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

const ORDER_TYPES: OrderType[] = ["pickup", "delivery", "dine_in"];

const CUSTOMER_NAMES = [
  "John Smith",
  "Emily Johnson",
  "Michael Brown",
  "Sarah Davis",
  "David Wilson",
  "Jessica Martinez",
  "James Anderson",
  "Jennifer Taylor",
  "Robert Thomas",
  "Linda Garcia",
];

const CUSTOMER_PHONES = [
  "+1 (555) 123-4567",
  "+1 (555) 234-5678",
  "+1 (555) 345-6789",
  "+1 (555) 456-7890",
  "+1 (555) 567-8901",
  "+1 (555) 678-9012",
  "+1 (555) 789-0123",
  "+1 (555) 890-1234",
  "+1 (555) 901-2345",
  "+1 (555) 012-3456",
];

// Sample order items
const SAMPLE_ITEMS = [
  [
    {
      menuItemId: "item_1",
      name: "Margherita Pizza",
      price: 14.99,
      quantity: 2,
      selectedModifiers: [],
      totalPrice: 29.98,
    },
  ],
  [
    {
      menuItemId: "item_2",
      name: "Pepperoni Pizza",
      price: 16.99,
      quantity: 1,
      selectedModifiers: [],
      totalPrice: 16.99,
    },
    {
      menuItemId: "item_3",
      name: "Caesar Salad",
      price: 8.99,
      quantity: 1,
      selectedModifiers: [],
      totalPrice: 8.99,
    },
  ],
  [
    {
      menuItemId: "item_4",
      name: "Burger Combo",
      price: 12.99,
      quantity: 3,
      selectedModifiers: [],
      totalPrice: 38.97,
    },
  ],
  [
    {
      menuItemId: "item_5",
      name: "Spaghetti Carbonara",
      price: 15.99,
      quantity: 1,
      selectedModifiers: [],
      totalPrice: 15.99,
    },
  ],
  [
    {
      menuItemId: "item_6",
      name: "Chicken Wings (12pc)",
      price: 13.99,
      quantity: 1,
      selectedModifiers: [],
      totalPrice: 13.99,
    },
    {
      menuItemId: "item_7",
      name: "French Fries",
      price: 4.99,
      quantity: 2,
      selectedModifiers: [],
      totalPrice: 9.98,
    },
  ],
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomDate(daysAgo: number): Date {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysAgo);
  const randomHours = Math.floor(Math.random() * 24);
  const randomMinutes = Math.floor(Math.random() * 60);

  const date = new Date(now);
  date.setDate(date.getDate() - randomDays);
  date.setHours(randomHours, randomMinutes, 0, 0);

  return date;
}

function generateOrderNumber(index: number): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `ORD-${dateStr}-${String(index).padStart(4, "0")}`;
}

function calculateTotal(items: typeof SAMPLE_ITEMS[0]): number {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const tax = subtotal * 0.0875; // 8.75% tax
  const tip = Math.random() > 0.5 ? subtotal * 0.15 : 0; // 15% tip sometimes
  return subtotal + tax + tip;
}

/**
 * Generate mock orders data
 * @param tenantId - Tenant ID for filtering
 * @param count - Number of orders to generate (default: 60)
 */
export function getMockOrders(
  _tenantId: string,
  count: number = 60
): Omit<Order, "tenant">[] {
  const orders: Omit<Order, "tenant">[] = [];

  for (let i = 1; i <= count; i++) {
    const merchantId = getRandomElement(MERCHANT_IDS);
    const merchantIndex = MERCHANT_IDS.indexOf(merchantId);
    const status = getRandomElement(ORDER_STATUSES);
    const orderType = getRandomElement(ORDER_TYPES);
    const items = getRandomElement(SAMPLE_ITEMS);
    const customerName = getRandomElement(CUSTOMER_NAMES);
    const customerPhone = getRandomElement(CUSTOMER_PHONES);

    const createdAt = getRandomDate(30); // Within last 30 days
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = subtotal * 0.0875;
    const tipAmount = Math.random() > 0.5 ? subtotal * 0.15 : 0;
    const deliveryFee = orderType === "delivery" ? 3.99 : 0;
    const totalAmount = subtotal + taxAmount + tipAmount + deliveryFee;

    // Set timestamps based on status
    let confirmedAt: Date | null = null;
    let completedAt: Date | null = null;
    let cancelledAt: Date | null = null;

    if (status !== "pending") {
      confirmedAt = new Date(createdAt.getTime() + 5 * 60 * 1000); // +5 min
    }

    if (status === "completed") {
      completedAt = new Date(createdAt.getTime() + 45 * 60 * 1000); // +45 min
    }

    if (status === "cancelled") {
      cancelledAt = new Date(createdAt.getTime() + 10 * 60 * 1000); // +10 min
    }

    orders.push({
      id: `mock_order_${i}`,
      tenantId: _tenantId,
      merchantId,
      customerId: null,
      orderNumber: generateOrderNumber(i),
      customerName,
      customerPhone,
      customerEmail: `${customerName.toLowerCase().replace(" ", ".")}@example.com`,
      orderType,
      status,
      items: JSON.stringify(items),
      subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
      taxAmount: new Prisma.Decimal(taxAmount.toFixed(2)),
      tipAmount: new Prisma.Decimal(tipAmount.toFixed(2)),
      deliveryFee: new Prisma.Decimal(deliveryFee.toFixed(2)),
      discount: new Prisma.Decimal("0.00"),
      totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
      notes: Math.random() > 0.7 ? "Extra napkins please" : null,
      deliveryAddress:
        orderType === "delivery"
          ? JSON.stringify({
              street: "123 Main St",
              city: "San Francisco",
              state: "CA",
              zipCode: "94102",
            })
          : null,
      scheduledAt: null,
      createdAt,
      updatedAt: createdAt,
      confirmedAt,
      completedAt,
      cancelledAt,
      cancelReason:
        status === "cancelled" ? "Customer requested cancellation" : null,
    });
  }

  // Sort by createdAt descending (newest first)
  orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return orders;
}

/**
 * Get order by ID
 */
export function getMockOrderById(
  tenantId: string,
  orderId: string
): Omit<Order, "tenant"> | null {
  const orders = getMockOrders(tenantId);
  return orders.find((order) => order.id === orderId) || null;
}
