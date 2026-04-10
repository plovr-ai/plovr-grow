import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

/**
 * Sync loyalty member stats from point transactions
 * Uses point transactions (type='earn') to calculate totalOrders and totalSpent
 * This is more accurate as it tracks exactly which orders earned points
 */
async function syncLoyaltyMemberStats() {
  console.log("\nSyncing loyalty member stats from point transactions...");

  // Get all loyalty members
  const members = await prisma.loyaltyMember.findMany({
    select: {
      id: true,
      phone: true,
    },
  });

  if (members.length === 0) {
    console.log("No loyalty members found");
    return;
  }

  let updatedCount = 0;

  for (const member of members) {
    // Get all "earn" transactions for this member (each represents an order)
    const earnTransactions = await prisma.pointTransaction.findMany({
      where: {
        memberId: member.id,
        type: "earn",
        orderId: { not: null },
      },
      select: {
        orderId: true,
        createdAt: true,
      },
    });

    if (earnTransactions.length === 0) continue;

    // Get unique order IDs (in case of duplicates)
    const orderIds = [...new Set(earnTransactions.map((t) => t.orderId).filter((id): id is string => id !== null))];

    // Get order details for totalSpent calculation
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    const totalOrders = orders.length;
    const totalSpent = orders.reduce(
      (sum, order) => sum.add(order.totalAmount),
      new Prisma.Decimal(0)
    );
    const lastOrderAt = orders
      .map((o) => o.createdAt)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    await prisma.loyaltyMember.update({
      where: { id: member.id },
      data: {
        totalOrders,
        totalSpent,
        lastOrderAt,
      },
    });
    updatedCount++;
    console.log(`  Updated ${member.phone}: ${totalOrders} orders, $${totalSpent}`);
  }

  console.log(`Synced ${updatedCount} loyalty members`);
}

async function main() {
  console.log("Seeding database...");

  // Website settings data (shared between create and update)
  const joesPizzaWebsiteSettings = {
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    defaultTimezone: "America/New_York",
    website: {
      tagline: "Authentic New York Style Pizza Since 1985",
      heroImage: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=1920&h=1080&fit=crop",
      socialLinks: [
        { platform: "facebook", url: "https://facebook.com/joespizza" },
        { platform: "instagram", url: "https://instagram.com/joespizza" },
        { platform: "yelp", url: "https://yelp.com/biz/joes-pizza" },
        { platform: "google", url: "https://g.page/joespizza" },
      ],
      featuredItemIds: [
        "item-cheese-pizza",
        "item-pepperoni-pizza",
        "item-margherita-pizza",
        "item-garlic-knots",
      ],
      reviews: [
        {
          id: "review-1",
          customerName: "Michael S.",
          rating: 5,
          content: "Best pizza in the city! The crust is perfectly crispy and the sauce is amazing. Been coming here for 10 years and it never disappoints.",
          date: "2024-01-10",
          source: "google",
        },
        {
          id: "review-2",
          customerName: "Sarah L.",
          rating: 5,
          content: "Authentic NY pizza that reminds me of home. Fast delivery and always fresh. The garlic knots are a must-try!",
          date: "2024-01-08",
          source: "yelp",
        },
        {
          id: "review-3",
          customerName: "David K.",
          rating: 5,
          content: "Finally found a pizza place that gets it right. Great value for the quality. Online ordering is super convenient.",
          date: "2024-01-05",
          source: "google",
        },
      ],
    },
  };

  // Tenant data (shared between create and update)
  const joesPizzaTenantData = {
    name: "Joe's Pizza",
    description: "Authentic New York style pizza since 1985",
    logoUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop",
    websiteUrl: "https://joespizza.com",
    supportEmail: "support@joespizza.com",
    supportPhone: "(212) 555-0100",
    currency: "USD",
    locale: "en-US",
    timezone: "America/New_York",
    settings: joesPizzaWebsiteSettings,
  };

  // Create tenant (brand + tenant combined)
  const tenant = await prisma.tenant.upsert({
    where: { id: "tenant-joes-pizza" },
    update: joesPizzaTenantData,
    create: {
      id: "tenant-joes-pizza",
      slug: "joes-pizza",
      subscriptionPlan: "free",
      subscriptionStatus: "active",
      ...joesPizzaTenantData,
    },
  });

  console.log(`Created tenant: ${tenant.name} (${tenant.id})`);

  // Create merchant (store)
  const merchant = await prisma.merchant.upsert({
    where: { slug: "joes-pizza" },
    update: {},
    create: {
      id: "merchant-joes-pizza-main",
      tenantId: tenant.id,
      slug: "joes-pizza",
      name: "Joe's Pizza - Main Street",
      description: "Our flagship location in the heart of NYC",
      address: "123 Main Street",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      country: "US",
      phone: "(212) 555-0123",
      email: "info@joespizza.com",
      logoUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop",
      bannerUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=1920&h=600&fit=crop",
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      businessHours: {
        mon: { open: "11:00", close: "22:00" },
        tue: { open: "11:00", close: "22:00" },
        wed: { open: "11:00", close: "22:00" },
        thu: { open: "11:00", close: "22:00" },
        fri: { open: "11:00", close: "23:00" },
        sat: { open: "11:00", close: "23:00" },
        sun: { open: "12:00", close: "21:00" },
      },
      settings: {
        accepts_pickup: true,
        accepts_delivery: true,
        delivery_radius: 5,
        minimum_order_amount: 15,
        estimated_prep_time: 20,
        tip_config: {
          mode: "percentage",
          tiers: [0.15, 0.18, 0.2],
          allowCustom: true,
        },
        fee_config: {
          fees: [
            {
              id: "service-fee",
              name: "service_fee",
              displayName: "Service Fee",
              type: "percentage",
              value: 0.03,
            },
          ],
        },
      },
    },
  });

  console.log(`Created merchant: ${merchant.name}`);

  // Create additional merchants (downtown and midtown locations)
  const merchantDowntown = await prisma.merchant.upsert({
    where: { slug: "joes-pizza-downtown" },
    update: {},
    create: {
      id: "merchant-joes-downtown",
      tenantId: tenant.id,
      slug: "joes-pizza-downtown",
      name: "Joe's Pizza - Downtown",
      description: "Our flagship downtown location",
      address: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      country: "US",
      phone: "(212) 555-0100",
      email: "downtown@joespizza.com",
      logoUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop",
      bannerUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=1920&h=600&fit=crop",
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      businessHours: {
        mon: { open: "11:00", close: "22:00" },
        tue: { open: "11:00", close: "22:00" },
        wed: { open: "11:00", close: "22:00" },
        thu: { open: "11:00", close: "22:00" },
        fri: { open: "11:00", close: "23:00" },
        sat: { open: "11:00", close: "23:00" },
        sun: { open: "12:00", close: "21:00" },
      },
      settings: {
        accepts_pickup: true,
        accepts_delivery: true,
        delivery_radius: 5,
        minimum_order_amount: 15,
        estimated_prep_time: 20,
        tip_config: {
          mode: "percentage",
          tiers: [0.15, 0.18, 0.2],
          allowCustom: true,
        },
        fee_config: {
          fees: [
            {
              id: "service-fee",
              name: "service_fee",
              displayName: "Service Fee",
              type: "percentage",
              value: 0.03,
            },
          ],
        },
      },
    },
  });

  console.log(`Created merchant: ${merchantDowntown.name}`);

  const merchantMidtown = await prisma.merchant.upsert({
    where: { slug: "joes-pizza-midtown" },
    update: {},
    create: {
      id: "merchant-joes-midtown",
      tenantId: tenant.id,
      slug: "joes-pizza-midtown",
      name: "Joe's Pizza - Midtown",
      description: "Convenient midtown location",
      address: "456 Broadway",
      city: "New York",
      state: "NY",
      zipCode: "10018",
      country: "US",
      phone: "(212) 555-0200",
      email: "midtown@joespizza.com",
      logoUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop",
      bannerUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=1920&h=600&fit=crop",
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      businessHours: {
        mon: { open: "10:00", close: "23:00" },
        tue: { open: "10:00", close: "23:00" },
        wed: { open: "10:00", close: "23:00" },
        thu: { open: "10:00", close: "23:00" },
        fri: { open: "10:00", close: "00:00" },
        sat: { open: "10:00", close: "00:00" },
        sun: { open: "11:00", close: "22:00" },
      },
      settings: {
        accepts_pickup: true,
        accepts_delivery: true,
        delivery_radius: 3,
        minimum_order_amount: 20,
        estimated_prep_time: 15,
        tip_config: {
          mode: "percentage",
          tiers: [0.15, 0.18, 0.2],
          allowCustom: true,
        },
        fee_config: {
          fees: [
            {
              id: "service-fee",
              name: "service_fee",
              displayName: "Service Fee",
              type: "percentage",
              value: 0.03,
            },
          ],
        },
      },
    },
  });

  console.log(`Created merchant: ${merchantMidtown.name}`);

  // ==================== Tax Configurations for Joe's Pizza ====================
  console.log("\nCreating tax configurations for Joe's Pizza...");

  // Create tax configs (Company level)
  const standardTax = await prisma.taxConfig.upsert({
    where: { id: "tax-joes-standard" },
    update: {},
    create: {
      id: "tax-joes-standard",
      tenantId: tenant.id,
      name: "Standard Tax",
      description: "Standard sales tax",
      roundingMethod: "half_up",
      status: "active",
    },
  });

  const alcoholTax = await prisma.taxConfig.upsert({
    where: { id: "tax-joes-alcohol" },
    update: {},
    create: {
      id: "tax-joes-alcohol",
      tenantId: tenant.id,
      name: "Alcohol Tax",
      description: "Additional tax for alcoholic beverages",
      roundingMethod: "half_up",
      status: "active",
    },
  });

  console.log(`Created tax configs: ${standardTax.name}, ${alcoholTax.name}`);

  // Create merchant tax rates (different rates for different locations)
  // Main Street location - NYC rate
  await prisma.merchantTaxRate.upsert({
    where: {
      merchantId_taxConfigId: {
        merchantId: merchant.id,
        taxConfigId: standardTax.id,
      },
    },
    update: { rate: 0.08875 },
    create: {
      id: "mtr-main-standard",
      merchantId: merchant.id,
      taxConfigId: standardTax.id,
      rate: 0.08875, // NYC tax rate
    },
  });

  await prisma.merchantTaxRate.upsert({
    where: {
      merchantId_taxConfigId: {
        merchantId: merchant.id,
        taxConfigId: alcoholTax.id,
      },
    },
    update: { rate: 0.1 },
    create: {
      id: "mtr-main-alcohol",
      merchantId: merchant.id,
      taxConfigId: alcoholTax.id,
      rate: 0.1, // 10% alcohol tax
    },
  });

  // Downtown location - same NYC rate
  await prisma.merchantTaxRate.upsert({
    where: {
      merchantId_taxConfigId: {
        merchantId: merchantDowntown.id,
        taxConfigId: standardTax.id,
      },
    },
    update: { rate: 0.08875 },
    create: {
      id: "mtr-downtown-standard",
      merchantId: merchantDowntown.id,
      taxConfigId: standardTax.id,
      rate: 0.08875,
    },
  });

  await prisma.merchantTaxRate.upsert({
    where: {
      merchantId_taxConfigId: {
        merchantId: merchantDowntown.id,
        taxConfigId: alcoholTax.id,
      },
    },
    update: { rate: 0.1 },
    create: {
      id: "mtr-downtown-alcohol",
      merchantId: merchantDowntown.id,
      taxConfigId: alcoholTax.id,
      rate: 0.1,
    },
  });

  // Midtown location - same NYC rate
  await prisma.merchantTaxRate.upsert({
    where: {
      merchantId_taxConfigId: {
        merchantId: merchantMidtown.id,
        taxConfigId: standardTax.id,
      },
    },
    update: { rate: 0.08875 },
    create: {
      id: "mtr-midtown-standard",
      merchantId: merchantMidtown.id,
      taxConfigId: standardTax.id,
      rate: 0.08875,
    },
  });

  await prisma.merchantTaxRate.upsert({
    where: {
      merchantId_taxConfigId: {
        merchantId: merchantMidtown.id,
        taxConfigId: alcoholTax.id,
      },
    },
    update: { rate: 0.1 },
    create: {
      id: "mtr-midtown-alcohol",
      merchantId: merchantMidtown.id,
      taxConfigId: alcoholTax.id,
      rate: 0.1,
    },
  });

  console.log("Created merchant tax rates for all Joe's Pizza locations");

  // ==================== Loyalty Configuration for Joe's Pizza ====================
  console.log("\nCreating loyalty configuration for Joe's Pizza...");

  const joesLoyaltyConfig = await prisma.loyaltyConfig.upsert({
    where: { id: "loyalty-config-joes-pizza" },
    update: {},
    create: {
      id: "loyalty-config-joes-pizza",
      tenantId: tenant.id,
      pointsPerDollar: 1,
      status: "active",
    },
  });

  console.log(`Created loyalty config: ${joesLoyaltyConfig.id} (1 point per dollar)`);

  // ==================== Bella's Bakery (Single Location) ====================
  console.log("\nCreating Bella's Bakery (single location)...");

  // Website settings for Bella's Bakery
  const bellasBakeryWebsiteSettings = {
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    defaultTimezone: "America/Los_Angeles",
    website: {
      tagline: "Artisan Breads & Pastries Since 2010",
      heroImage: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1920&h=1080&fit=crop",
      socialLinks: [
        { platform: "facebook", url: "https://facebook.com/bellasbakery" },
        { platform: "instagram", url: "https://instagram.com/bellasbakery" },
        { platform: "yelp", url: "https://yelp.com/biz/bellas-bakery" },
      ],
      featuredItemIds: [
        "bella-item-sourdough",
        "bella-item-croissant",
        "bella-item-almond-danish",
        "bella-item-cappuccino",
      ],
      reviews: [
        {
          id: "bella-review-1",
          customerName: "Emma W.",
          rating: 5,
          content: "The best bakery in San Francisco! Their sourdough is absolutely incredible. I come here every Sunday morning.",
          date: "2024-01-12",
          source: "google",
        },
        {
          id: "bella-review-2",
          customerName: "James T.",
          rating: 5,
          content: "Finally found a place with authentic French croissants. The pastries are flaky and buttery just like in Paris!",
          date: "2024-01-09",
          source: "yelp",
        },
        {
          id: "bella-review-3",
          customerName: "Lisa M.",
          rating: 5,
          content: "Cozy atmosphere, friendly staff, and amazing coffee. The almond danish is to die for!",
          date: "2024-01-06",
          source: "google",
        },
      ],
    },
  };

  // Tenant data for Bella's Bakery
  const bellasBakeryTenantData = {
    name: "Bella's Bakery",
    description: "Artisan breads and pastries handcrafted daily since 2010",
    logoUrl: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=200&h=200&fit=crop",
    websiteUrl: "https://bellasbakery.com",
    supportEmail: "hello@bellasbakery.com",
    supportPhone: "(415) 555-0200",
    currency: "USD",
    locale: "en-US",
    timezone: "America/Los_Angeles",
    settings: bellasBakeryWebsiteSettings,
  };

  // Create tenant for Bella's Bakery
  const bellaTenant = await prisma.tenant.upsert({
    where: { id: "tenant-bellas-bakery" },
    update: bellasBakeryTenantData,
    create: {
      id: "tenant-bellas-bakery",
      slug: "bellas-bakery",
      subscriptionPlan: "free",
      subscriptionStatus: "active",
      ...bellasBakeryTenantData,
    },
  });

  console.log(`Created tenant: ${bellaTenant.name} (${bellaTenant.id})`);

  // Create single merchant for Bella's Bakery
  const bellaMerchant = await prisma.merchant.upsert({
    where: { slug: "bellas-bakery-sf" },
    update: {},
    create: {
      id: "merchant-bellas-sf",
      tenantId: bellaTenant.id,
      slug: "bellas-bakery-sf",
      name: "Bella's Bakery",
      description: "Our cozy bakery in the heart of San Francisco's Mission District",
      address: "456 Valencia St",
      city: "San Francisco",
      state: "CA",
      zipCode: "94103",
      country: "US",
      phone: "(415) 555-0200",
      email: "hello@bellasbakery.com",
      logoUrl: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=200&h=200&fit=crop",
      bannerUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1920&h=600&fit=crop",
      timezone: "America/Los_Angeles",
      currency: "USD",
      locale: "en-US",
      businessHours: {
        mon: { open: "07:00", close: "18:00" },
        tue: { open: "07:00", close: "18:00" },
        wed: { open: "07:00", close: "18:00" },
        thu: { open: "07:00", close: "18:00" },
        fri: { open: "07:00", close: "19:00" },
        sat: { open: "08:00", close: "19:00" },
        sun: { open: "08:00", close: "17:00" },
      },
      settings: {
        accepts_pickup: true,
        accepts_delivery: false,
        minimum_order_amount: 10,
        estimated_prep_time: 10,
        tip_config: {
          mode: "percentage",
          tiers: [0.15, 0.18, 0.2],
          allowCustom: true,
        },
        fee_config: {
          fees: [],
        },
      },
    },
  });

  console.log(`Created merchant: ${bellaMerchant.name} (single location)`);

  // Create menu for Bella's Bakery
  const bellaMenu = await prisma.menu.upsert({
    where: { id: "bella-menu-main" },
    update: {},
    create: {
      id: "bella-menu-main",
      tenantId: bellaTenant.id,
      name: "Main Menu",
      sortOrder: 0,
    },
  });

  console.log(`Created menu: ${bellaMenu.name}`);

  // Create menu categories for Bella's Bakery (company-level menu)
  const bellaBreadCategory = await prisma.menuCategory.upsert({
    where: { id: "bella-cat-bread" },
    update: {},
    create: {
      id: "bella-cat-bread",
      tenantId: bellaTenant.id,
      menuId: bellaMenu.id,
      name: "Artisan Breads",
      description: "Handcrafted breads baked fresh daily",
      sortOrder: 1,
    },
  });

  const bellaPastryCategory = await prisma.menuCategory.upsert({
    where: { id: "bella-cat-pastry" },
    update: {},
    create: {
      id: "bella-cat-pastry",
      tenantId: bellaTenant.id,
      menuId: bellaMenu.id,
      name: "Pastries",
      description: "Sweet and savory pastries",
      sortOrder: 2,
    },
  });

  const bellaCoffeeCategory = await prisma.menuCategory.upsert({
    where: { id: "bella-cat-coffee" },
    update: {},
    create: {
      id: "bella-cat-coffee",
      tenantId: bellaTenant.id,
      menuId: bellaMenu.id,
      name: "Coffee & Drinks",
      description: "Specialty coffee and beverages",
      sortOrder: 3,
    },
  });

  console.log("Created Bella's Bakery menu categories");

  // Create menu items for Bella's Bakery
  const bellaMenuItems = [
    // Breads
    {
      id: "bella-item-sourdough",
      tenantId: bellaTenant.id,
      name: "Sourdough Loaf",
      description: "Our signature 24-hour fermented sourdough with a crispy crust and soft interior",
      price: 8.99,
      imageUrl: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=800&h=600&fit=crop",
      tags: ["vegetarian", "vegan"],
      modifiers: [],
    },
    {
      id: "bella-item-baguette",
      tenantId: bellaTenant.id,
      name: "French Baguette",
      description: "Traditional French baguette with a golden crust",
      price: 4.49,
      imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop",
      tags: ["vegetarian", "vegan"],
      modifiers: [],
    },
    {
      id: "bella-item-focaccia",
      tenantId: bellaTenant.id,
      name: "Rosemary Focaccia",
      description: "Italian flatbread with fresh rosemary and sea salt",
      price: 6.99,
      imageUrl: "https://images.unsplash.com/photo-1621583441131-ec7572d5e6ae?w=800&h=600&fit=crop",
      tags: ["vegetarian", "vegan"],
      modifiers: [],
    },
    // Pastries
    {
      id: "bella-item-croissant",
      tenantId: bellaTenant.id,
      name: "Butter Croissant",
      description: "Flaky, golden layers of French butter perfection",
      price: 4.49,
      imageUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
      modifiers: [],
    },
    {
      id: "bella-item-almond-danish",
      tenantId: bellaTenant.id,
      name: "Almond Danish",
      description: "Sweet almond cream in a buttery Danish pastry",
      price: 5.29,
      imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
      modifiers: [],
    },
    {
      id: "bella-item-chocolate-croissant",
      tenantId: bellaTenant.id,
      name: "Chocolate Croissant",
      description: "Buttery croissant filled with rich dark chocolate",
      price: 4.99,
      imageUrl: "https://images.unsplash.com/photo-1623334044303-241021148842?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
      modifiers: [],
    },
    {
      id: "bella-item-cinnamon-roll",
      tenantId: bellaTenant.id,
      name: "Cinnamon Roll",
      description: "Warm, gooey cinnamon roll with cream cheese frosting",
      price: 5.49,
      imageUrl: "https://images.unsplash.com/photo-1619985632461-f33748ef8df3?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
      modifiers: [],
    },
    // Coffee & Drinks
    {
      id: "bella-item-cappuccino",
      tenantId: bellaTenant.id,
      name: "Cappuccino",
      description: "Rich espresso with perfectly steamed milk and foam",
      price: 4.99,
      imageUrl: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
      modifiers: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "small", name: "Small (8 oz)", price: 0, isDefault: true },
            { id: "large", name: "Large (12 oz)", price: 1.5 },
          ],
        },
        {
          id: "milk",
          name: "Milk",
          type: "single",
          required: false,
          modifiers: [
            { id: "whole", name: "Whole Milk", price: 0, isDefault: true },
            { id: "oat", name: "Oat Milk", price: 0.75 },
            { id: "almond", name: "Almond Milk", price: 0.75 },
          ],
        },
      ],
    },
    {
      id: "bella-item-latte",
      tenantId: bellaTenant.id,
      name: "Café Latte",
      description: "Smooth espresso with steamed milk",
      price: 5.49,
      imageUrl: "https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
      modifiers: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "small", name: "Small (8 oz)", price: 0, isDefault: true },
            { id: "large", name: "Large (12 oz)", price: 1.5 },
          ],
        },
      ],
    },
    {
      id: "bella-item-drip-coffee",
      tenantId: bellaTenant.id,
      name: "Drip Coffee",
      description: "House blend drip coffee",
      price: 2.99,
      imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&h=600&fit=crop",
      tags: ["vegetarian", "vegan"],
      modifiers: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "small", name: "Small (12 oz)", price: 0, isDefault: true },
            { id: "large", name: "Large (16 oz)", price: 1 },
          ],
        },
      ],
    },
  ];

  for (const item of bellaMenuItems) {
    const { id, tenantId, ...updateData } = item;
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: updateData,
      create: item,
    });
  }

  console.log(`Created ${bellaMenuItems.length} menu items for Bella's Bakery`);

  // Create menu category item associations for Bella's Bakery
  const bellaCategoryItemLinks = [
    // Breads
    { categoryId: bellaBreadCategory.id, menuItemId: "bella-item-sourdough", sortOrder: 1 },
    { categoryId: bellaBreadCategory.id, menuItemId: "bella-item-baguette", sortOrder: 2 },
    { categoryId: bellaBreadCategory.id, menuItemId: "bella-item-focaccia", sortOrder: 3 },
    // Pastries
    { categoryId: bellaPastryCategory.id, menuItemId: "bella-item-croissant", sortOrder: 1 },
    { categoryId: bellaPastryCategory.id, menuItemId: "bella-item-almond-danish", sortOrder: 2 },
    { categoryId: bellaPastryCategory.id, menuItemId: "bella-item-chocolate-croissant", sortOrder: 3 },
    { categoryId: bellaPastryCategory.id, menuItemId: "bella-item-cinnamon-roll", sortOrder: 4 },
    // Coffee & Drinks
    { categoryId: bellaCoffeeCategory.id, menuItemId: "bella-item-cappuccino", sortOrder: 1 },
    { categoryId: bellaCoffeeCategory.id, menuItemId: "bella-item-latte", sortOrder: 2 },
    { categoryId: bellaCoffeeCategory.id, menuItemId: "bella-item-drip-coffee", sortOrder: 3 },
  ];

  for (const link of bellaCategoryItemLinks) {
    await prisma.menuCategoryItem.upsert({
      where: {
        categoryId_menuItemId: {
          categoryId: link.categoryId,
          menuItemId: link.menuItemId,
        },
      },
      update: { sortOrder: link.sortOrder },
      create: {
        id: `mci-${link.menuItemId}`,
        tenantId: bellaTenant.id,
        categoryId: link.categoryId,
        menuItemId: link.menuItemId,
        sortOrder: link.sortOrder,
      },
    });
  }

  console.log("Created menu category item associations for Bella's Bakery");

  // Create featured items for Bella's Bakery
  const bellaFeaturedItemIds = [
    "bella-item-sourdough",
    "bella-item-croissant",
    "bella-item-almond-danish",
    "bella-item-cappuccino",
  ];

  for (let i = 0; i < bellaFeaturedItemIds.length; i++) {
    const menuItemId = bellaFeaturedItemIds[i];
    await prisma.featuredItem.upsert({
      where: {
        tenantId_menuItemId: {
          tenantId: bellaTenant.id,
          menuItemId,
        },
      },
      update: { sortOrder: i + 1 },
      create: {
        id: `featured-bella-${menuItemId}`,
        tenantId: bellaTenant.id,
        menuItemId,
        sortOrder: i + 1,
      },
    });
  }

  console.log(`Created ${bellaFeaturedItemIds.length} featured items for Bella's Bakery`);

  // Create tax config for Bella's Bakery
  const bellaTax = await prisma.taxConfig.upsert({
    where: { id: "tax-bella-standard" },
    update: {},
    create: {
      id: "tax-bella-standard",
      tenantId: bellaTenant.id,
      name: "CA Sales Tax",
      description: "California sales tax",
      roundingMethod: "half_up",
      status: "active",
    },
  });

  // Set merchant tax rate for Bella's Bakery
  await prisma.merchantTaxRate.upsert({
    where: {
      merchantId_taxConfigId: {
        merchantId: bellaMerchant.id,
        taxConfigId: bellaTax.id,
      },
    },
    update: { rate: 0.0875 },
    create: {
      id: "mtr-bella-standard",
      merchantId: bellaMerchant.id,
      taxConfigId: bellaTax.id,
      rate: 0.0875, // SF tax rate
    },
  });

  // Associate all Bella's menu items with the standard tax
  for (const item of bellaMenuItems) {
    await prisma.menuItemTax.upsert({
      where: {
        menuItemId_taxConfigId: {
          menuItemId: item.id,
          taxConfigId: bellaTax.id,
        },
      },
      update: {},
      create: {
        id: `mit-${item.id}-standard`,
        tenantId: bellaTenant.id,
        menuItemId: item.id,
        taxConfigId: bellaTax.id,
      },
    });
  }

  console.log("Created tax configuration for Bella's Bakery");

  // Loyalty Configuration for Bella's Bakery
  const bellaLoyaltyConfig = await prisma.loyaltyConfig.upsert({
    where: { id: "loyalty-config-bellas-bakery" },
    update: {},
    create: {
      id: "loyalty-config-bellas-bakery",
      tenantId: bellaTenant.id,
      pointsPerDollar: 2, // 2 points per dollar for bakery
      status: "active",
    },
  });

  console.log(`Created loyalty config for Bella's Bakery: ${bellaLoyaltyConfig.id}`);
  console.log("✅ Bella's Bakery (single location) created!");

  // Create menu for Joe's Pizza
  const joesMenu = await prisma.menu.upsert({
    where: { id: "joes-menu-main" },
    update: {},
    create: {
      id: "joes-menu-main",
      tenantId: tenant.id,
      name: "Main Menu",
      sortOrder: 0,
    },
  });

  console.log(`Created menu: ${joesMenu.name}`);

  // Create menu categories (company-level menu)
  const pizzaCategory = await prisma.menuCategory.upsert({
    where: {
      id: "cat-pizza",
    },
    update: {},
    create: {
      id: "cat-pizza",
      tenantId: tenant.id,
      menuId: joesMenu.id,
      name: "Pizza",
      description: "Our famous New York style pizzas",
      sortOrder: 1,
    },
  });

  const sidesCategory = await prisma.menuCategory.upsert({
    where: {
      id: "cat-sides",
    },
    update: {},
    create: {
      id: "cat-sides",
      tenantId: tenant.id,
      menuId: joesMenu.id,
      name: "Sides",
      description: "Appetizers and sides",
      sortOrder: 2,
    },
  });

  const pastaCategory = await prisma.menuCategory.upsert({
    where: {
      id: "cat-pasta",
    },
    update: {},
    create: {
      id: "cat-pasta",
      tenantId: tenant.id,
      menuId: joesMenu.id,
      name: "Pasta",
      description: "Homemade pasta dishes",
      sortOrder: 3,
    },
  });

  const drinksCategory = await prisma.menuCategory.upsert({
    where: {
      id: "cat-drinks",
    },
    update: {},
    create: {
      id: "cat-drinks",
      tenantId: tenant.id,
      menuId: joesMenu.id,
      name: "Drinks",
      description: "Beverages",
      sortOrder: 4,
    },
  });

  console.log("Created menu categories");

  // Create menu items (company-level menu)
  const menuItems = [
    // Pizzas
    {
      id: "item-cheese-pizza",
      tenantId: tenant.id,
      name: "Classic Cheese Pizza",
      description: "Our signature pizza with fresh mozzarella and house-made tomato sauce",
      price: 18.99,
      imageUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
      tags: ["vegetarian", "popular"],
      modifiers: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "size-s", name: "Small (10\")", price: 0, isDefault: true },
            { id: "size-m", name: "Medium (14\")", price: 4 },
            { id: "size-l", name: "Large (18\")", price: 8 },
          ],
        },
        {
          id: "toppings",
          name: "Extra Toppings",
          type: "multiple",
          required: false,
          allowQuantity: true,
          maxQuantityPerModifier: 3,
          modifiers: [
            { id: "topping-pepperoni", name: "Pepperoni", price: 2 },
            { id: "topping-mushrooms", name: "Mushrooms", price: 1.5 },
            { id: "topping-olives", name: "Black Olives", price: 1.5 },
            { id: "topping-peppers", name: "Bell Peppers", price: 1.5 },
            { id: "topping-onions", name: "Onions", price: 1 },
          ],
        },
      ],
    },
    {
      id: "item-pepperoni-pizza",
      tenantId: tenant.id,
      name: "Pepperoni Pizza",
      description: "Classic pepperoni with premium mozzarella cheese",
      price: 21.99,
      imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop",
      tags: ["popular"],
      modifiers: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "size-s", name: "Small (10\")", price: 0, isDefault: true },
            { id: "size-m", name: "Medium (14\")", price: 4 },
            { id: "size-l", name: "Large (18\")", price: 8 },
          ],
        },
      ],
    },
    {
      id: "item-margherita-pizza",
      tenantId: tenant.id,
      name: "Margherita Pizza",
      description: "Fresh tomatoes, mozzarella, basil, and olive oil",
      price: 19.99,
      imageUrl: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=400&h=300&fit=crop",
      tags: ["vegetarian"],
      modifiers: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "size-s", name: "Small (10\")", price: 0, isDefault: true },
            { id: "size-m", name: "Medium (14\")", price: 4 },
            { id: "size-l", name: "Large (18\")", price: 8 },
          ],
        },
      ],
    },
    {
      id: "item-supreme-pizza",
      tenantId: tenant.id,
      name: "Supreme Pizza",
      description: "Pepperoni, sausage, peppers, onions, and mushrooms",
      price: 24.99,
      imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
      tags: [],
      modifiers: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "size-s", name: "Small (10\")", price: 0, isDefault: true },
            { id: "size-m", name: "Medium (14\")", price: 4 },
            { id: "size-l", name: "Large (18\")", price: 8 },
          ],
        },
      ],
    },
    // Pasta
    {
      id: "item-spaghetti-meatballs",
      tenantId: tenant.id,
      name: "Spaghetti & Meatballs",
      description: "Classic spaghetti with house-made meatballs and marinara sauce",
      price: 16.99,
      imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
      tags: [],
      modifiers: [],
    },
    {
      id: "item-fettuccine-alfredo",
      tenantId: tenant.id,
      name: "Fettuccine Alfredo",
      description: "Creamy parmesan alfredo sauce over fettuccine",
      price: 15.99,
      imageUrl: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=400&h=300&fit=crop",
      tags: ["vegetarian"],
      modifiers: [
        {
          id: "protein",
          name: "Add Protein",
          type: "multiple",
          required: false,
          modifiers: [
            { id: "protein-chicken", name: "Grilled Chicken", price: 4 },
            { id: "protein-shrimp", name: "Shrimp", price: 5 },
            { id: "protein-meatballs", name: "Meatballs (3)", price: 3 },
          ],
        },
      ],
    },
    {
      id: "item-baked-ziti",
      tenantId: tenant.id,
      name: "Baked Ziti",
      description: "Ziti pasta baked with ricotta, mozzarella, and marinara",
      price: 14.99,
      imageUrl: "https://images.unsplash.com/photo-1629115916087-7e8c114a24ed?w=400&h=300&fit=crop",
      tags: ["vegetarian"],
      modifiers: [],
    },
    // Sides
    {
      id: "item-garlic-knots",
      tenantId: tenant.id,
      name: "Garlic Knots",
      description: "Fresh baked knots with garlic butter (6 pieces)",
      price: 5.99,
      imageUrl: "https://images.unsplash.com/photo-1619531040576-f9416740661b?w=400&h=300&fit=crop",
      tags: ["vegetarian", "popular"],
      modifiers: [],
    },
    {
      id: "item-mozzarella-sticks",
      tenantId: tenant.id,
      name: "Mozzarella Sticks",
      description: "Crispy fried mozzarella served with marinara (6 pieces)",
      price: 7.99,
      imageUrl: "https://images.unsplash.com/photo-1531749668029-2db88e4276c7?w=400&h=300&fit=crop",
      tags: ["vegetarian"],
      modifiers: [],
    },
    {
      id: "item-caesar-salad",
      tenantId: tenant.id,
      name: "Caesar Salad",
      description: "Crisp romaine, parmesan, croutons, and caesar dressing",
      price: 8.99,
      imageUrl: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400&h=300&fit=crop",
      tags: ["vegetarian"],
      modifiers: [
        {
          id: "dressing",
          name: "Dressing",
          type: "single",
          required: true,
          modifiers: [
            { id: "dressing-caesar", name: "Caesar", price: 0, isDefault: true },
            { id: "dressing-ranch", name: "Ranch", price: 0 },
            { id: "dressing-italian", name: "Italian", price: 0 },
            { id: "dressing-balsamic", name: "Balsamic Vinaigrette", price: 0 },
          ],
        },
        {
          id: "extras",
          name: "Add Extras",
          type: "multiple",
          required: false,
          modifiers: [
            { id: "extra-chicken", name: "Grilled Chicken", price: 4 },
            { id: "extra-bacon", name: "Bacon Bits", price: 2 },
            { id: "extra-avocado", name: "Avocado", price: 2.5 },
          ],
        },
      ],
    },
    // Drinks
    {
      id: "item-fountain-drink",
      tenantId: tenant.id,
      name: "Fountain Drink",
      description: "Coca-Cola, Sprite, Fanta, or Lemonade",
      price: 2.99,
      tags: [],
      modifiers: [
        {
          id: "size-drink",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "drink-small", name: "Small", price: 0, isDefault: true },
            { id: "drink-medium", name: "Medium", price: 0.5 },
            { id: "drink-large", name: "Large", price: 1 },
          ],
        },
      ],
    },
    {
      id: "item-italian-soda",
      tenantId: tenant.id,
      name: "Italian Soda",
      description: "Sparkling water with your choice of flavor",
      price: 3.99,
      tags: [],
      modifiers: [
        {
          id: "size-drink",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "drink-small", name: "Small", price: 0, isDefault: true },
            { id: "drink-medium", name: "Medium", price: 0.5 },
            { id: "drink-large", name: "Large", price: 1 },
          ],
        },
      ],
    },
    {
      id: "item-water",
      tenantId: tenant.id,
      name: "Bottled Water",
      description: "Purified spring water",
      price: 1.99,
      tags: [],
      modifiers: [],
    },
  ];

  for (const item of menuItems) {
    const { id, tenantId, ...updateData } = item;
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: updateData,
      create: item,
    });
  }

  console.log(`Created ${menuItems.length} menu items`);

  // Create menu category item associations for Joe's Pizza
  const joesCategoryItemLinks = [
    // Pizzas
    { categoryId: pizzaCategory.id, menuItemId: "item-cheese-pizza", sortOrder: 1 },
    { categoryId: pizzaCategory.id, menuItemId: "item-pepperoni-pizza", sortOrder: 2 },
    { categoryId: pizzaCategory.id, menuItemId: "item-margherita-pizza", sortOrder: 3 },
    { categoryId: pizzaCategory.id, menuItemId: "item-supreme-pizza", sortOrder: 4 },
    // Pasta
    { categoryId: pastaCategory.id, menuItemId: "item-spaghetti-meatballs", sortOrder: 1 },
    { categoryId: pastaCategory.id, menuItemId: "item-fettuccine-alfredo", sortOrder: 2 },
    { categoryId: pastaCategory.id, menuItemId: "item-baked-ziti", sortOrder: 3 },
    // Sides
    { categoryId: sidesCategory.id, menuItemId: "item-garlic-knots", sortOrder: 1 },
    { categoryId: sidesCategory.id, menuItemId: "item-mozzarella-sticks", sortOrder: 2 },
    { categoryId: sidesCategory.id, menuItemId: "item-caesar-salad", sortOrder: 3 },
    // Drinks
    { categoryId: drinksCategory.id, menuItemId: "item-fountain-drink", sortOrder: 1 },
    { categoryId: drinksCategory.id, menuItemId: "item-italian-soda", sortOrder: 2 },
    { categoryId: drinksCategory.id, menuItemId: "item-water", sortOrder: 3 },
  ];

  for (const link of joesCategoryItemLinks) {
    await prisma.menuCategoryItem.upsert({
      where: {
        categoryId_menuItemId: {
          categoryId: link.categoryId,
          menuItemId: link.menuItemId,
        },
      },
      update: { sortOrder: link.sortOrder },
      create: {
        id: `mci-${link.menuItemId}`,
        tenantId: tenant.id,
        categoryId: link.categoryId,
        menuItemId: link.menuItemId,
        sortOrder: link.sortOrder,
      },
    });
  }

  console.log("Created menu category item associations for Joe's Pizza");

  // Create featured items for Joe's Pizza
  const joesFeaturedItemIds = [
    "item-cheese-pizza",
    "item-pepperoni-pizza",
    "item-margherita-pizza",
    "item-garlic-knots",
  ];

  for (let i = 0; i < joesFeaturedItemIds.length; i++) {
    const menuItemId = joesFeaturedItemIds[i];
    await prisma.featuredItem.upsert({
      where: {
        tenantId_menuItemId: {
          tenantId: tenant.id,
          menuItemId,
        },
      },
      update: { sortOrder: i + 1 },
      create: {
        id: `featured-joes-${menuItemId}`,
        tenantId: tenant.id,
        menuItemId,
        sortOrder: i + 1,
      },
    });
  }

  console.log(`Created ${joesFeaturedItemIds.length} featured items for Joe's Pizza`);

  // Associate Joe's Pizza menu items with standard tax
  for (const item of menuItems) {
    await prisma.menuItemTax.upsert({
      where: {
        menuItemId_taxConfigId: {
          menuItemId: item.id,
          taxConfigId: standardTax.id,
        },
      },
      update: {},
      create: {
        id: `mit-${item.id}-standard`,
        tenantId: tenant.id,
        menuItemId: item.id,
        taxConfigId: standardTax.id,
      },
    });
  }

  console.log("Associated menu items with tax configs");

  // ==================== Users for Joe's Pizza and Bella's Bakery ====================
  console.log("\nCreating users for Joe's Pizza and Bella's Bakery...");

  const joesPasswordHash = await bcrypt.hash("test123", 10);

  const joesUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "joe@joespizza.com",
      },
    },
    update: {},
    create: {
      id: "user-joes-pizza-owner",
      tenantId: tenant.id,
      email: "joe@joespizza.com",
      passwordHash: joesPasswordHash,
      name: "Joe Smith",
      role: "owner",
      status: "active",
    },
  });

  console.log(`Created Joe's Pizza user: ${joesUser.email}`);

  const bellaPasswordHash = await bcrypt.hash("test123", 10);

  const bellaUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: bellaTenant.id,
        email: "bella@bellasbakery.com",
      },
    },
    update: {},
    create: {
      id: "user-bellas-bakery-owner",
      tenantId: bellaTenant.id,
      email: "bella@bellasbakery.com",
      passwordHash: bellaPasswordHash,
      name: "Bella Martinez",
      role: "owner",
      status: "active",
    },
  });

  console.log(`Created Bella's Bakery user: ${bellaUser.email}`);

  // ==================== Onboarding Test Account ====================
  console.log("\nCreating onboarding test account...");

  // Create onboarding test tenant (with onboarding NOT completed)
  const onboardingTenant = await prisma.tenant.upsert({
    where: { id: "tenant-onboarding-test" },
    update: {},
    create: {
      id: "tenant-onboarding-test",
      slug: "onboarding-test",
      name: "New Restaurant",
      description: "Testing onboarding flow",
      supportEmail: "test@example.com",
      supportPhone: "(555) 555-5555",
      currency: "USD",
      locale: "en-US",
      timezone: "America/Los_Angeles",
      subscriptionPlan: "free",
      subscriptionStatus: "active",
    },
  });

  console.log(`Created onboarding tenant: ${onboardingTenant.name} (status: ${onboardingTenant.onboardingStatus})`);

  // Create a merchant for the onboarding test (needed for dashboard route)
  const onboardingMerchant = await prisma.merchant.upsert({
    where: { slug: "test-restaurant" },
    update: {},
    create: {
      id: "merchant-onboarding-test",
      tenantId: onboardingTenant.id,
      slug: "test-restaurant",
      name: "Test Restaurant - Main Location",
      description: "Onboarding test location",
      address: "123 Test Street",
      city: "Test City",
      state: "CA",
      zipCode: "90001",
      country: "US",
      phone: "(555) 555-5555",
      email: "test@example.com",
      timezone: "America/Los_Angeles",
      currency: "USD",
      locale: "en-US",
    },
  });

  console.log(`Created onboarding merchant: ${onboardingMerchant.name}`);

  // Create test user for login (password: "test123")
  // Password hash for "test123" using bcrypt
  const passwordHash = await bcrypt.hash("test123", 10);

  const onboardingUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: onboardingTenant.id,
        email: "test@example.com",
      },
    },
    update: {},
    create: {
      id: "user-onboarding-test",
      tenantId: onboardingTenant.id,
      email: "test@example.com",
      passwordHash: passwordHash,
      name: "Onboarding Test User",
      role: "owner",
      status: "active",
    },
  });

  console.log(`Created onboarding test user: ${onboardingUser.email}`);
  console.log("\n✅ All accounts ready!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Joe's Pizza:      joe@joespizza.com / test123");
  console.log("Bella's Bakery:   bella@bellasbakery.com / test123");
  console.log("Onboarding Test:  test@example.com / test123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Sync loyalty member stats from historical orders
  await syncLoyaltyMemberStats();

  console.log("\nSeeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
