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
    websiteTemplate: "fast_casual",
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
    websiteTemplate: "cafe_bakery",
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
    },
    {
      id: "bella-item-baguette",
      tenantId: bellaTenant.id,
      name: "French Baguette",
      description: "Traditional French baguette with a golden crust",
      price: 4.49,
      imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop",
      tags: ["vegetarian", "vegan"],
    },
    {
      id: "bella-item-focaccia",
      tenantId: bellaTenant.id,
      name: "Rosemary Focaccia",
      description: "Italian flatbread with fresh rosemary and sea salt",
      price: 6.99,
      imageUrl: "https://images.unsplash.com/photo-1621583441131-ec7572d5e6ae?w=800&h=600&fit=crop",
      tags: ["vegetarian", "vegan"],
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
    },
    {
      id: "bella-item-almond-danish",
      tenantId: bellaTenant.id,
      name: "Almond Danish",
      description: "Sweet almond cream in a buttery Danish pastry",
      price: 5.29,
      imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
    },
    {
      id: "bella-item-chocolate-croissant",
      tenantId: bellaTenant.id,
      name: "Chocolate Croissant",
      description: "Buttery croissant filled with rich dark chocolate",
      price: 4.99,
      imageUrl: "https://images.unsplash.com/photo-1623334044303-241021148842?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
    },
    {
      id: "bella-item-cinnamon-roll",
      tenantId: bellaTenant.id,
      name: "Cinnamon Roll",
      description: "Warm, gooey cinnamon roll with cream cheese frosting",
      price: 5.49,
      imageUrl: "https://images.unsplash.com/photo-1619985632461-f33748ef8df3?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
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
    },
    {
      id: "bella-item-latte",
      tenantId: bellaTenant.id,
      name: "Café Latte",
      description: "Smooth espresso with steamed milk",
      price: 5.49,
      imageUrl: "https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
    },
    {
      id: "bella-item-drip-coffee",
      tenantId: bellaTenant.id,
      name: "Drip Coffee",
      description: "House blend drip coffee",
      price: 2.99,
      imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&h=600&fit=crop",
      tags: ["vegetarian", "vegan"],
    },
  ];

  for (const item of bellaMenuItems) {
    const { id: _id, tenantId: _tenantId, ...updateData } = item;
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
    },
    {
      id: "item-pepperoni-pizza",
      tenantId: tenant.id,
      name: "Pepperoni Pizza",
      description: "Classic pepperoni with premium mozzarella cheese",
      price: 21.99,
      imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop",
      tags: ["popular"],
    },
    {
      id: "item-margherita-pizza",
      tenantId: tenant.id,
      name: "Margherita Pizza",
      description: "Fresh tomatoes, mozzarella, basil, and olive oil",
      price: 19.99,
      imageUrl: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=400&h=300&fit=crop",
      tags: ["vegetarian"],
    },
    {
      id: "item-supreme-pizza",
      tenantId: tenant.id,
      name: "Supreme Pizza",
      description: "Pepperoni, sausage, peppers, onions, and mushrooms",
      price: 24.99,
      imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
      tags: [],
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
    },
    {
      id: "item-fettuccine-alfredo",
      tenantId: tenant.id,
      name: "Fettuccine Alfredo",
      description: "Creamy parmesan alfredo sauce over fettuccine",
      price: 15.99,
      imageUrl: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=400&h=300&fit=crop",
      tags: ["vegetarian"],
    },
    {
      id: "item-baked-ziti",
      tenantId: tenant.id,
      name: "Baked Ziti",
      description: "Ziti pasta baked with ricotta, mozzarella, and marinara",
      price: 14.99,
      imageUrl: "https://images.unsplash.com/photo-1629115916087-7e8c114a24ed?w=400&h=300&fit=crop",
      tags: ["vegetarian"],
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
    },
    {
      id: "item-mozzarella-sticks",
      tenantId: tenant.id,
      name: "Mozzarella Sticks",
      description: "Crispy fried mozzarella served with marinara (6 pieces)",
      price: 7.99,
      imageUrl: "https://images.unsplash.com/photo-1531749668029-2db88e4276c7?w=400&h=300&fit=crop",
      tags: ["vegetarian"],
    },
    {
      id: "item-caesar-salad",
      tenantId: tenant.id,
      name: "Caesar Salad",
      description: "Crisp romaine, parmesan, croutons, and caesar dressing",
      price: 8.99,
      imageUrl: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400&h=300&fit=crop",
      tags: ["vegetarian"],
    },
    // Drinks
    {
      id: "item-fountain-drink",
      tenantId: tenant.id,
      name: "Fountain Drink",
      description: "Coca-Cola, Sprite, Fanta, or Lemonade",
      price: 2.99,
      tags: [],
    },
    {
      id: "item-italian-soda",
      tenantId: tenant.id,
      name: "Italian Soda",
      description: "Sparkling water with your choice of flavor",
      price: 3.99,
      tags: [],
    },
    {
      id: "item-water",
      tenantId: tenant.id,
      name: "Bottled Water",
      description: "Purified spring water",
      price: 1.99,
      tags: [],
    },
  ];

  for (const item of menuItems) {
    const { id: _id, tenantId: _tenantId, ...updateData } = item;
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: updateData,
      create: item,
    });
  }

  console.log(`Created ${menuItems.length} menu items`);

  // Seed modifier groups, options, and junction records
  type ModifierOptionSeed = { id: string; name: string; price: number; isDefault?: boolean };
  type ModifierGroupSeed = { id: string; name: string; required: boolean; minSelect: number; maxSelect: number; allowQuantity?: boolean; maxQuantityPerModifier?: number; options: ModifierOptionSeed[] };
  const seedModifierData: { tenantId: string; menuItemId: string; groups: ModifierGroupSeed[] }[] = [
    // ==================== Joe's Pizza modifiers ====================
    {
      tenantId: tenant.id,
      menuItemId: "item-cheese-pizza",
      groups: [
        {
          id: "item-cheese-pizza-size",
          name: "Size",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "item-cheese-pizza-size-small", name: 'Small (10")', price: 0, isDefault: true },
            { id: "item-cheese-pizza-size-medium", name: 'Medium (14")', price: 4 },
            { id: "item-cheese-pizza-size-large", name: 'Large (18")', price: 8 },
          ],
        },
        {
          id: "item-cheese-pizza-toppings",
          name: "Extra Toppings",
          required: false,
          minSelect: 0,
          maxSelect: 5,
          allowQuantity: true,
          maxQuantityPerModifier: 3,
          options: [
            { id: "item-cheese-pizza-toppings-pepperoni", name: "Pepperoni", price: 2 },
            { id: "item-cheese-pizza-toppings-mushrooms", name: "Mushrooms", price: 1.5 },
            { id: "item-cheese-pizza-toppings-olives", name: "Black Olives", price: 1.5 },
            { id: "item-cheese-pizza-toppings-peppers", name: "Bell Peppers", price: 1.5 },
            { id: "item-cheese-pizza-toppings-onions", name: "Onions", price: 1 },
          ],
        },
      ],
    },
    {
      tenantId: tenant.id,
      menuItemId: "item-pepperoni-pizza",
      groups: [
        {
          id: "item-pepperoni-pizza-size",
          name: "Size",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "item-pepperoni-pizza-size-small", name: 'Small (10")', price: 0, isDefault: true },
            { id: "item-pepperoni-pizza-size-medium", name: 'Medium (14")', price: 4 },
            { id: "item-pepperoni-pizza-size-large", name: 'Large (18")', price: 8 },
          ],
        },
      ],
    },
    {
      tenantId: tenant.id,
      menuItemId: "item-margherita-pizza",
      groups: [
        {
          id: "item-margherita-pizza-size",
          name: "Size",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "item-margherita-pizza-size-small", name: 'Small (10")', price: 0, isDefault: true },
            { id: "item-margherita-pizza-size-medium", name: 'Medium (14")', price: 4 },
            { id: "item-margherita-pizza-size-large", name: 'Large (18")', price: 8 },
          ],
        },
      ],
    },
    {
      tenantId: tenant.id,
      menuItemId: "item-supreme-pizza",
      groups: [
        {
          id: "item-supreme-pizza-size",
          name: "Size",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "item-supreme-pizza-size-small", name: 'Small (10")', price: 0, isDefault: true },
            { id: "item-supreme-pizza-size-medium", name: 'Medium (14")', price: 4 },
            { id: "item-supreme-pizza-size-large", name: 'Large (18")', price: 8 },
          ],
        },
      ],
    },
    {
      tenantId: tenant.id,
      menuItemId: "item-fettuccine-alfredo",
      groups: [
        {
          id: "item-fettuccine-alfredo-protein",
          name: "Add Protein",
          required: false,
          minSelect: 0,
          maxSelect: 3,
          options: [
            { id: "item-fettuccine-alfredo-protein-chicken", name: "Grilled Chicken", price: 4 },
            { id: "item-fettuccine-alfredo-protein-shrimp", name: "Shrimp", price: 5 },
            { id: "item-fettuccine-alfredo-protein-meatballs", name: "Meatballs (3)", price: 3 },
          ],
        },
      ],
    },
    {
      tenantId: tenant.id,
      menuItemId: "item-caesar-salad",
      groups: [
        {
          id: "item-caesar-salad-dressing",
          name: "Dressing",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "item-caesar-salad-dressing-caesar", name: "Caesar", price: 0, isDefault: true },
            { id: "item-caesar-salad-dressing-ranch", name: "Ranch", price: 0 },
            { id: "item-caesar-salad-dressing-italian", name: "Italian", price: 0 },
            { id: "item-caesar-salad-dressing-balsamic", name: "Balsamic Vinaigrette", price: 0 },
          ],
        },
        {
          id: "item-caesar-salad-extras",
          name: "Add Extras",
          required: false,
          minSelect: 0,
          maxSelect: 3,
          options: [
            { id: "item-caesar-salad-extras-chicken", name: "Grilled Chicken", price: 4 },
            { id: "item-caesar-salad-extras-bacon", name: "Bacon Bits", price: 2 },
            { id: "item-caesar-salad-extras-avocado", name: "Avocado", price: 2.5 },
          ],
        },
      ],
    },
    {
      tenantId: tenant.id,
      menuItemId: "item-fountain-drink",
      groups: [
        {
          id: "item-fountain-drink-size",
          name: "Size",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "item-fountain-drink-size-small", name: "Small", price: 0, isDefault: true },
            { id: "item-fountain-drink-size-medium", name: "Medium", price: 0.5 },
            { id: "item-fountain-drink-size-large", name: "Large", price: 1 },
          ],
        },
      ],
    },
    {
      tenantId: tenant.id,
      menuItemId: "item-italian-soda",
      groups: [
        {
          id: "item-italian-soda-size",
          name: "Size",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "item-italian-soda-size-small", name: "Small", price: 0, isDefault: true },
            { id: "item-italian-soda-size-medium", name: "Medium", price: 0.5 },
            { id: "item-italian-soda-size-large", name: "Large", price: 1 },
          ],
        },
      ],
    },
    // ==================== Bella's Bakery modifiers ====================
    {
      tenantId: bellaTenant.id,
      menuItemId: "bella-item-cappuccino",
      groups: [
        {
          id: "bella-item-cappuccino-size",
          name: "Size",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "bella-item-cappuccino-size-small", name: "Small (8 oz)", price: 0, isDefault: true },
            { id: "bella-item-cappuccino-size-large", name: "Large (12 oz)", price: 1.5 },
          ],
        },
        {
          id: "bella-item-cappuccino-milk",
          name: "Milk",
          required: false,
          minSelect: 0,
          maxSelect: 1,
          options: [
            { id: "bella-item-cappuccino-milk-whole", name: "Whole Milk", price: 0, isDefault: true },
            { id: "bella-item-cappuccino-milk-oat", name: "Oat Milk", price: 0.75 },
            { id: "bella-item-cappuccino-milk-almond", name: "Almond Milk", price: 0.75 },
          ],
        },
      ],
    },
    {
      tenantId: bellaTenant.id,
      menuItemId: "bella-item-latte",
      groups: [
        {
          id: "bella-item-latte-size",
          name: "Size",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "bella-item-latte-size-small", name: "Small (8 oz)", price: 0, isDefault: true },
            { id: "bella-item-latte-size-large", name: "Large (12 oz)", price: 1.5 },
          ],
        },
        {
          id: "bella-item-latte-milk",
          name: "Milk",
          required: false,
          minSelect: 0,
          maxSelect: 1,
          options: [
            { id: "bella-item-latte-milk-whole", name: "Whole Milk", price: 0, isDefault: true },
            { id: "bella-item-latte-milk-oat", name: "Oat Milk", price: 0.75 },
            { id: "bella-item-latte-milk-almond", name: "Almond Milk", price: 0.75 },
          ],
        },
      ],
    },
    {
      tenantId: bellaTenant.id,
      menuItemId: "bella-item-drip-coffee",
      groups: [
        {
          id: "bella-item-drip-coffee-size",
          name: "Size",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "bella-item-drip-coffee-size-small", name: "Small (12 oz)", price: 0, isDefault: true },
            { id: "bella-item-drip-coffee-size-large", name: "Large (16 oz)", price: 1 },
          ],
        },
      ],
    },
  ];

  for (const itemMod of seedModifierData) {
    for (let groupIdx = 0; groupIdx < itemMod.groups.length; groupIdx++) {
      const group = itemMod.groups[groupIdx];

      await prisma.modifierGroup.upsert({
        where: { id: group.id },
        update: { name: group.name, required: group.required, minSelect: group.minSelect, maxSelect: group.maxSelect, allowQuantity: group.allowQuantity ?? false, maxQuantityPerModifier: group.maxQuantityPerModifier ?? 1 },
        create: { id: group.id, tenantId: itemMod.tenantId, name: group.name, required: group.required, minSelect: group.minSelect, maxSelect: group.maxSelect, allowQuantity: group.allowQuantity ?? false, maxQuantityPerModifier: group.maxQuantityPerModifier ?? 1 },
      });

      for (let optIdx = 0; optIdx < group.options.length; optIdx++) {
        const opt = group.options[optIdx];
        await prisma.modifierOption.upsert({
          where: { id: opt.id },
          update: { name: opt.name, price: opt.price, isDefault: opt.isDefault ?? false, sortOrder: optIdx },
          create: { id: opt.id, tenantId: itemMod.tenantId, groupId: group.id, name: opt.name, price: opt.price, isDefault: opt.isDefault ?? false, isAvailable: true, sortOrder: optIdx },
        });
      }

      await prisma.menuItemModifierGroup.upsert({
        where: { menuItemId_modifierGroupId: { menuItemId: itemMod.menuItemId, modifierGroupId: group.id } },
        update: { sortOrder: groupIdx },
        create: { id: `mimg-${group.id}`, menuItemId: itemMod.menuItemId, modifierGroupId: group.id, sortOrder: groupIdx },
      });
    }
  }

  console.log("Created modifier groups and options");

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

  // ==================== Template Demo: The Capital Grille (Fine Dining) ====================
  console.log("\nCreating The Capital Grille (fine_dining template)...");

  const capitalGrilleSettings = {
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    defaultTimezone: "America/New_York",
    websiteTemplate: "fine_dining",
    themePreset: "purple",
    website: {
      tagline: "An Exceptional Fine Dining Experience",
      heroImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&h=1080&fit=crop",
      socialLinks: [
        { platform: "facebook", url: "https://facebook.com/capitalgrille" },
        { platform: "instagram", url: "https://instagram.com/capitalgrille" },
      ],
      reviews: [
        {
          id: "cg-review-1",
          customerName: "Robert H.",
          rating: 5,
          content: "Impeccable service and the finest dry-aged steaks I've ever had. The wine pairing was exceptional. A truly memorable evening.",
          date: "2024-02-15",
          source: "google",
        },
        {
          id: "cg-review-2",
          customerName: "Catherine W.",
          rating: 5,
          content: "The ambiance is unmatched. Every dish was a work of art. The lobster bisque and filet mignon were outstanding.",
          date: "2024-02-10",
          source: "yelp",
        },
        {
          id: "cg-review-3",
          customerName: "Jonathan P.",
          rating: 5,
          content: "Perfect for special occasions. The sommelier's recommendations were spot-on and the service was attentive without being intrusive.",
          date: "2024-02-05",
          source: "google",
        },
      ],
    },
  };

  const capitalGrilleTenant = await prisma.tenant.upsert({
    where: { id: "tenant-capital-grille" },
    update: { settings: capitalGrilleSettings },
    create: {
      id: "tenant-capital-grille",
      slug: "capital-grille",
      name: "The Capital Grille",
      description: "An exceptional fine dining experience featuring dry-aged steaks and fresh seafood",
      logoUrl: "https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=200&h=200&fit=crop",
      websiteUrl: "https://capitalgrille.com",
      supportEmail: "info@capitalgrille.com",
      supportPhone: "(212) 555-0300",
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
      settings: capitalGrilleSettings,
    },
  });

  console.log(`Created tenant: ${capitalGrilleTenant.name}`);

  const capitalGrilleMerchant = await prisma.merchant.upsert({
    where: { slug: "capital-grille-manhattan" },
    update: {},
    create: {
      id: "merchant-capital-grille-manhattan",
      tenantId: capitalGrilleTenant.id,
      slug: "capital-grille-manhattan",
      name: "The Capital Grille - Manhattan",
      description: "Our flagship location on Madison Avenue",
      address: "155 E 42nd St",
      city: "New York",
      state: "NY",
      zipCode: "10017",
      country: "US",
      phone: "(212) 555-0300",
      email: "manhattan@capitalgrille.com",
      logoUrl: "https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=200&h=200&fit=crop",
      bannerUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&h=600&fit=crop",
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      businessHours: {
        mon: { open: "17:00", close: "23:00" },
        tue: { open: "17:00", close: "23:00" },
        wed: { open: "17:00", close: "23:00" },
        thu: { open: "17:00", close: "23:00" },
        fri: { open: "17:00", close: "00:00" },
        sat: { open: "16:00", close: "00:00" },
        sun: { open: "16:00", close: "22:00" },
      },
      settings: {
        accepts_pickup: false,
        accepts_delivery: false,
        estimated_prep_time: 45,
        tip_config: {
          mode: "percentage",
          tiers: [0.18, 0.2, 0.25],
          allowCustom: true,
        },
        fee_config: { fees: [] },
      },
    },
  });

  console.log(`Created merchant: ${capitalGrilleMerchant.name}`);

  // ==================== Template Demo: The Neighborhood Kitchen (Casual) ====================
  console.log("\nCreating The Neighborhood Kitchen (casual template)...");

  const neighborhoodSettings = {
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    defaultTimezone: "America/Chicago",
    websiteTemplate: "casual",
    themePreset: "green",
    website: {
      tagline: "Family-Style Comfort Food Made Fresh Daily",
      heroImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&h=1080&fit=crop",
      socialLinks: [
        { platform: "facebook", url: "https://facebook.com/neighborhoodkitchen" },
        { platform: "instagram", url: "https://instagram.com/neighborhoodkitchen" },
        { platform: "yelp", url: "https://yelp.com/biz/neighborhood-kitchen" },
      ],
      reviews: [
        {
          id: "nk-review-1",
          customerName: "Maria G.",
          rating: 5,
          content: "This place feels like home! The meatloaf is just like my grandmother used to make. Great portions and even better prices.",
          date: "2024-01-20",
          source: "google",
        },
        {
          id: "nk-review-2",
          customerName: "Tom B.",
          rating: 5,
          content: "Perfect family dinner spot. Kids loved the mac and cheese, and the fried chicken is the best in town. Will be back!",
          date: "2024-01-18",
          source: "yelp",
        },
        {
          id: "nk-review-3",
          customerName: "Amy R.",
          rating: 5,
          content: "Warm atmosphere, friendly staff, and generous portions. The homemade pies are a must-try. A real neighborhood gem!",
          date: "2024-01-15",
          source: "google",
        },
      ],
    },
  };

  const neighborhoodTenant = await prisma.tenant.upsert({
    where: { id: "tenant-neighborhood-kitchen" },
    update: { settings: neighborhoodSettings },
    create: {
      id: "tenant-neighborhood-kitchen",
      slug: "neighborhood-kitchen",
      name: "The Neighborhood Kitchen",
      description: "Family-style comfort food made fresh daily with locally sourced ingredients",
      logoUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop",
      websiteUrl: "https://neighborhoodkitchen.com",
      supportEmail: "hello@neighborhoodkitchen.com",
      supportPhone: "(312) 555-0400",
      currency: "USD",
      locale: "en-US",
      timezone: "America/Chicago",
      settings: neighborhoodSettings,
    },
  });

  console.log(`Created tenant: ${neighborhoodTenant.name}`);

  const neighborhoodMerchant = await prisma.merchant.upsert({
    where: { slug: "neighborhood-kitchen-lincoln-park" },
    update: {},
    create: {
      id: "merchant-neighborhood-lincoln-park",
      tenantId: neighborhoodTenant.id,
      slug: "neighborhood-kitchen-lincoln-park",
      name: "The Neighborhood Kitchen - Lincoln Park",
      description: "Our cozy Lincoln Park location",
      address: "2345 N Lincoln Ave",
      city: "Chicago",
      state: "IL",
      zipCode: "60614",
      country: "US",
      phone: "(312) 555-0400",
      email: "lincolnpark@neighborhoodkitchen.com",
      logoUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop",
      bannerUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&h=600&fit=crop",
      timezone: "America/Chicago",
      currency: "USD",
      locale: "en-US",
      businessHours: {
        mon: { open: "11:00", close: "21:00" },
        tue: { open: "11:00", close: "21:00" },
        wed: { open: "11:00", close: "21:00" },
        thu: { open: "11:00", close: "21:00" },
        fri: { open: "11:00", close: "22:00" },
        sat: { open: "10:00", close: "22:00" },
        sun: { open: "10:00", close: "21:00" },
      },
      settings: {
        accepts_pickup: true,
        accepts_delivery: true,
        delivery_radius: 5,
        minimum_order_amount: 20,
        estimated_prep_time: 25,
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

  console.log(`Created merchant: ${neighborhoodMerchant.name}`);

  // ==================== Template Demo: The Velvet Lounge (Bar & Lounge) ====================
  console.log("\nCreating The Velvet Lounge (bar_lounge template)...");

  const velvetLoungeSettings = {
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    defaultTimezone: "America/Los_Angeles",
    websiteTemplate: "bar_lounge",
    themePreset: "red",
    website: {
      tagline: "Craft Cocktails & Late Night Bites",
      heroImage: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1920&h=1080&fit=crop",
      socialLinks: [
        { platform: "facebook", url: "https://facebook.com/velvetlounge" },
        { platform: "instagram", url: "https://instagram.com/velvetlounge" },
      ],
      reviews: [
        {
          id: "vl-review-1",
          customerName: "Alex D.",
          rating: 5,
          content: "Best cocktail bar in LA! The mixologists are true artists. The smoky old fashioned is a must-try. Incredible atmosphere.",
          date: "2024-02-20",
          source: "google",
        },
        {
          id: "vl-review-2",
          customerName: "Nicole F.",
          rating: 5,
          content: "Amazing vibe and even better drinks. The speakeasy feel is authentic, not gimmicky. Late night food menu is surprisingly good.",
          date: "2024-02-18",
          source: "yelp",
        },
        {
          id: "vl-review-3",
          customerName: "Marcus J.",
          rating: 5,
          content: "Perfect spot for date night. Live jazz on Fridays, craft cocktails, and the dim lighting creates an unforgettable mood.",
          date: "2024-02-14",
          source: "google",
        },
      ],
    },
  };

  const velvetLoungeTenant = await prisma.tenant.upsert({
    where: { id: "tenant-velvet-lounge" },
    update: { settings: velvetLoungeSettings },
    create: {
      id: "tenant-velvet-lounge",
      slug: "velvet-lounge",
      name: "The Velvet Lounge",
      description: "Craft cocktails and late night bites in an intimate speakeasy setting",
      logoUrl: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=200&h=200&fit=crop",
      websiteUrl: "https://velvetlounge.com",
      supportEmail: "info@velvetlounge.com",
      supportPhone: "(323) 555-0500",
      currency: "USD",
      locale: "en-US",
      timezone: "America/Los_Angeles",
      settings: velvetLoungeSettings,
    },
  });

  console.log(`Created tenant: ${velvetLoungeTenant.name}`);

  const velvetLoungeMerchant = await prisma.merchant.upsert({
    where: { slug: "velvet-lounge-hollywood" },
    update: {},
    create: {
      id: "merchant-velvet-lounge-hollywood",
      tenantId: velvetLoungeTenant.id,
      slug: "velvet-lounge-hollywood",
      name: "The Velvet Lounge - Hollywood",
      description: "Our flagship speakeasy on Sunset Boulevard",
      address: "8765 Sunset Blvd",
      city: "Los Angeles",
      state: "CA",
      zipCode: "90069",
      country: "US",
      phone: "(323) 555-0500",
      email: "hollywood@velvetlounge.com",
      logoUrl: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=200&h=200&fit=crop",
      bannerUrl: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1920&h=600&fit=crop",
      timezone: "America/Los_Angeles",
      currency: "USD",
      locale: "en-US",
      businessHours: {
        mon: { open: "17:00", close: "02:00" },
        tue: { open: "17:00", close: "02:00" },
        wed: { open: "17:00", close: "02:00" },
        thu: { open: "17:00", close: "02:00" },
        fri: { open: "16:00", close: "03:00" },
        sat: { open: "16:00", close: "03:00" },
        sun: { closed: true },
      },
      settings: {
        accepts_pickup: false,
        accepts_delivery: false,
        estimated_prep_time: 15,
        tip_config: {
          mode: "percentage",
          tiers: [0.18, 0.2, 0.25],
          allowCustom: true,
        },
        fee_config: { fees: [] },
      },
    },
  });

  console.log(`Created merchant: ${velvetLoungeMerchant.name}`);

  // ==================== Users for All Tenants ====================
  console.log("\nCreating users for all tenants...");

  const sharedPasswordHash = await bcrypt.hash("test123", 10);

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
      passwordHash: sharedPasswordHash,
      name: "Joe Smith",
      role: "owner",
      status: "active",
    },
  });

  console.log(`Created Joe's Pizza user: ${joesUser.email}`);

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
      passwordHash: sharedPasswordHash,
      name: "Bella Martinez",
      role: "owner",
      status: "active",
    },
  });

  console.log(`Created Bella's Bakery user: ${bellaUser.email}`);

  const capitalGrilleUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: capitalGrilleTenant.id,
        email: "chef@capitalgrille.com",
      },
    },
    update: {},
    create: {
      id: "user-capital-grille-owner",
      tenantId: capitalGrilleTenant.id,
      email: "chef@capitalgrille.com",
      passwordHash: sharedPasswordHash,
      name: "Richard Laurent",
      role: "owner",
      status: "active",
    },
  });

  console.log(`Created Capital Grille user: ${capitalGrilleUser.email}`);

  const neighborhoodUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: neighborhoodTenant.id,
        email: "mike@neighborhoodkitchen.com",
      },
    },
    update: {},
    create: {
      id: "user-neighborhood-kitchen-owner",
      tenantId: neighborhoodTenant.id,
      email: "mike@neighborhoodkitchen.com",
      passwordHash: sharedPasswordHash,
      name: "Mike Johnson",
      role: "owner",
      status: "active",
    },
  });

  console.log(`Created Neighborhood Kitchen user: ${neighborhoodUser.email}`);

  const velvetLoungeUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: velvetLoungeTenant.id,
        email: "owner@velvetlounge.com",
      },
    },
    update: {},
    create: {
      id: "user-velvet-lounge-owner",
      tenantId: velvetLoungeTenant.id,
      email: "owner@velvetlounge.com",
      passwordHash: sharedPasswordHash,
      name: "Diana Chen",
      role: "owner",
      status: "active",
    },
  });

  console.log(`Created Velvet Lounge user: ${velvetLoungeUser.email}`);

  // ==================== Phone AI Test Merchant: Burger Shack ====================
  console.log("\nCreating Burger Shack (phone AI playground test)...");

  const burgerTenantId = "tenant-burger-phone-ai";
  const burgerMerchantId = "merchant-burger-phone-ai";
  const burgerMenuId = "burger-menu-main";

  const burgerWebsiteSettings = {
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    defaultTimezone: "America/Los_Angeles",
    websiteTemplate: "fast_casual",
    website: {
      tagline: "Smash Burgers & Hand-Cut Fries",
      heroImage:
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1920&h=1080&fit=crop",
      socialLinks: [],
    },
  };

  const burgerTenant = await prisma.tenant.upsert({
    where: { id: burgerTenantId },
    update: { settings: burgerWebsiteSettings },
    create: {
      id: burgerTenantId,
      slug: "burger-shack",
      name: "Burger Shack",
      description: "Phone AI testing merchant - smash burgers and hand-cut fries",
      supportEmail: "support@burgershack.test",
      supportPhone: "(415) 555-0900",
      currency: "USD",
      locale: "en-US",
      timezone: "America/Los_Angeles",
      settings: burgerWebsiteSettings,
    },
  });

  console.log(`Created tenant: ${burgerTenant.name} (${burgerTenant.id})`);

  const burgerMerchant = await prisma.merchant.upsert({
    where: { id: burgerMerchantId },
    update: {
      businessHours: {
        mon: { open: "00:00", close: "23:59" },
        tue: { open: "00:00", close: "23:59" },
        wed: { open: "00:00", close: "23:59" },
        thu: { open: "00:00", close: "23:59" },
        fri: { open: "00:00", close: "23:59" },
        sat: { open: "00:00", close: "23:59" },
        sun: { open: "00:00", close: "23:59" },
      },
    },
    create: {
      id: burgerMerchantId,
      tenantId: burgerTenant.id,
      slug: "burger-shack-main",
      name: "Burger Shack - Main",
      description: "Phone AI test location",
      address: "789 Market St",
      city: "San Francisco",
      state: "CA",
      zipCode: "94103",
      country: "US",
      phone: "(415) 555-0900",
      email: "main@burgershack.test",
      timezone: "America/Los_Angeles",
      currency: "USD",
      locale: "en-US",
      businessHours: {
        mon: { open: "00:00", close: "23:59" },
        tue: { open: "00:00", close: "23:59" },
        wed: { open: "00:00", close: "23:59" },
        thu: { open: "00:00", close: "23:59" },
        fri: { open: "00:00", close: "23:59" },
        sat: { open: "00:00", close: "23:59" },
        sun: { open: "00:00", close: "23:59" },
      },
      settings: {
        acceptsPickup: true,
        acceptsDelivery: true,
        deliveryRadius: 5,
        minimumOrderAmount: 10,
        estimatedPrepTime: 15,
        tipConfig: {
          mode: "percentage",
          tiers: [0.15, 0.18, 0.2],
          allowCustom: true,
        },
        feeConfig: { fees: [] },
      },
      phoneAiSettings: {
        greetings:
          "Hi, thanks for calling Burger Shack! This is Ava, your AI assistant. How can I help you today?",
        agentWorkSwitch: "1",
        faq: {
          savedFaqs: [
            {
              question: "Do you offer vegetarian or vegan options?",
              answer:
                "Yes! We have a house-made veggie burger, and most burgers can be prepared with a plant-based patty on request.",
            },
            {
              question: "How long does pickup take?",
              answer:
                "Most orders are ready for pickup in about 15 minutes after confirmation.",
            },
          ],
          customFaqs: [
            {
              question: "Is the kitchen nut-free?",
              answer:
                "Our kitchen is not a certified nut-free facility, but we do not use peanuts or tree nuts in any of our recipes.",
            },
          ],
        },
      },
    },
  });

  console.log(`Created merchant: ${burgerMerchant.name}`);

  // Tax configuration
  const burgerTax = await prisma.taxConfig.upsert({
    where: { id: "tax-burger-standard" },
    update: {},
    create: {
      id: "tax-burger-standard",
      tenantId: burgerTenant.id,
      name: "CA Sales Tax",
      description: "California sales tax",
      roundingMethod: "half_up",
      status: "active",
    },
  });

  await prisma.merchantTaxRate.upsert({
    where: {
      merchantId_taxConfigId: {
        merchantId: burgerMerchant.id,
        taxConfigId: burgerTax.id,
      },
    },
    update: { rate: 0.0875 },
    create: {
      id: "mtr-burger-standard",
      merchantId: burgerMerchant.id,
      taxConfigId: burgerTax.id,
      rate: 0.0875,
    },
  });

  // Menu
  const burgerMenu = await prisma.menu.upsert({
    where: { id: burgerMenuId },
    update: {},
    create: {
      id: burgerMenuId,
      tenantId: burgerTenant.id,
      name: "Main Menu",
      sortOrder: 0,
    },
  });

  // Categories
  const burgerCategoryBurgers = await prisma.menuCategory.upsert({
    where: { id: "burger-cat-burgers" },
    update: {},
    create: {
      id: "burger-cat-burgers",
      tenantId: burgerTenant.id,
      menuId: burgerMenu.id,
      name: "Burgers",
      description: "Fresh-ground, smashed to order",
      sortOrder: 1,
    },
  });

  const burgerCategorySides = await prisma.menuCategory.upsert({
    where: { id: "burger-cat-sides" },
    update: {},
    create: {
      id: "burger-cat-sides",
      tenantId: burgerTenant.id,
      menuId: burgerMenu.id,
      name: "Sides",
      description: "Hand-cut fries and more",
      sortOrder: 2,
    },
  });

  const burgerCategoryDrinks = await prisma.menuCategory.upsert({
    where: { id: "burger-cat-drinks" },
    update: {},
    create: {
      id: "burger-cat-drinks",
      tenantId: burgerTenant.id,
      menuId: burgerMenu.id,
      name: "Drinks",
      description: "Sodas, shakes, and more",
      sortOrder: 3,
    },
  });

  const burgerCategoryDesserts = await prisma.menuCategory.upsert({
    where: { id: "burger-cat-desserts" },
    update: {},
    create: {
      id: "burger-cat-desserts",
      tenantId: burgerTenant.id,
      menuId: burgerMenu.id,
      name: "Desserts",
      description: "Sweet treats",
      sortOrder: 4,
    },
  });

  // Menu items
  const burgerItems: Array<{
    id: string;
    tenantId: string;
    name: string;
    description: string;
    price: number;
    imageUrl?: string;
    tags?: string[];
  }> = [
    // Burgers
    {
      id: "burger-item-classic-cheese",
      tenantId: burgerTenant.id,
      name: "Classic Cheeseburger",
      description:
        "Single 4oz smash patty with American cheese, lettuce, tomato, pickles, onion, and house sauce on a toasted potato bun",
      price: 9.99,
      imageUrl:
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop",
      tags: ["popular"],
    },
    {
      id: "burger-item-double-cheese",
      tenantId: burgerTenant.id,
      name: "Double Cheeseburger",
      description:
        "Two 4oz smash patties, double American cheese, lettuce, pickles, onion, and house sauce",
      price: 12.99,
      imageUrl:
        "https://images.unsplash.com/photo-1550317138-10000687a72b?w=800&h=600&fit=crop",
      tags: ["popular"],
    },
    {
      id: "burger-item-bacon-cheese",
      tenantId: burgerTenant.id,
      name: "Bacon Cheeseburger",
      description:
        "Smash patty with crispy bacon, cheddar, lettuce, tomato, and smoky BBQ mayo",
      price: 11.99,
      imageUrl:
        "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800&h=600&fit=crop",
      tags: ["popular"],
    },
    {
      id: "burger-item-mushroom-swiss",
      tenantId: burgerTenant.id,
      name: "Mushroom Swiss Burger",
      description:
        "Smash patty with sauteed mushrooms, melted Swiss, caramelized onions, and garlic aioli",
      price: 11.49,
      imageUrl:
        "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&h=600&fit=crop",
      tags: [],
    },
    {
      id: "burger-item-spicy-jalapeno",
      tenantId: burgerTenant.id,
      name: "Spicy Jalapeno Burger",
      description:
        "Smash patty with pepper jack, pickled jalapenos, chipotle mayo, and crispy onions",
      price: 10.99,
      imageUrl:
        "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=800&h=600&fit=crop",
      tags: ["spicy"],
    },
    {
      id: "burger-item-bbq-bacon",
      tenantId: burgerTenant.id,
      name: "BBQ Bacon Burger",
      description:
        "Smash patty with cheddar, bacon, onion rings, and tangy BBQ sauce",
      price: 12.49,
      imageUrl:
        "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=800&h=600&fit=crop",
      tags: [],
    },
    {
      id: "burger-item-veggie",
      tenantId: burgerTenant.id,
      name: "Veggie Burger",
      description:
        "House-made black bean and quinoa patty, avocado, lettuce, tomato, and chipotle aioli",
      price: 9.49,
      imageUrl:
        "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
    },
    {
      id: "burger-item-chicken-sandwich",
      tenantId: burgerTenant.id,
      name: "Crispy Chicken Sandwich",
      description:
        "Buttermilk-fried chicken with pickles, coleslaw, and honey mustard on a brioche bun",
      price: 10.49,
      imageUrl:
        "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&h=600&fit=crop",
      tags: [],
    },
    // Sides
    {
      id: "burger-item-fries",
      tenantId: burgerTenant.id,
      name: "Hand-Cut Fries",
      description: "Fresh-cut and double-fried in beef tallow, dusted with sea salt",
      price: 3.99,
      imageUrl:
        "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
    },
    {
      id: "burger-item-onion-rings",
      tenantId: burgerTenant.id,
      name: "Onion Rings",
      description: "Beer-battered crispy onion rings with spicy ranch",
      price: 4.49,
      imageUrl:
        "https://images.unsplash.com/photo-1639024471283-03518883512d?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
    },
    {
      id: "burger-item-sweet-fries",
      tenantId: burgerTenant.id,
      name: "Sweet Potato Fries",
      description: "Crispy sweet potato fries with chipotle dip",
      price: 4.99,
      imageUrl:
        "https://images.unsplash.com/photo-1630431341973-02e1b662ec35?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
    },
    {
      id: "burger-item-side-salad",
      tenantId: burgerTenant.id,
      name: "Side Salad",
      description: "Mixed greens, cherry tomatoes, cucumber, and balsamic vinaigrette",
      price: 4.99,
      tags: ["vegetarian", "vegan"],
    },
    // Drinks
    {
      id: "burger-item-soda",
      tenantId: burgerTenant.id,
      name: "Fountain Soda",
      description: "Coke, Diet Coke, Sprite, Dr Pepper, or Lemonade",
      price: 2.49,
      tags: [],
    },
    {
      id: "burger-item-milkshake",
      tenantId: burgerTenant.id,
      name: "Milkshake",
      description: "Hand-spun shake with real ice cream",
      price: 5.99,
      imageUrl:
        "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&h=600&fit=crop",
      tags: ["vegetarian"],
    },
    {
      id: "burger-item-iced-tea",
      tenantId: burgerTenant.id,
      name: "Iced Tea",
      description: "Freshly brewed unsweetened iced tea",
      price: 2.99,
      tags: ["vegetarian", "vegan"],
    },
    {
      id: "burger-item-water",
      tenantId: burgerTenant.id,
      name: "Bottled Water",
      description: "Purified spring water",
      price: 1.99,
      tags: [],
    },
    // Desserts
    {
      id: "burger-item-brownie",
      tenantId: burgerTenant.id,
      name: "Chocolate Brownie",
      description: "Warm fudgy brownie with a scoop of vanilla ice cream",
      price: 4.99,
      tags: ["vegetarian"],
    },
    {
      id: "burger-item-apple-pie",
      tenantId: burgerTenant.id,
      name: "Apple Pie",
      description: "Classic hot apple pie with cinnamon sugar crust",
      price: 3.99,
      tags: ["vegetarian"],
    },
  ];

  for (const item of burgerItems) {
    const { id: _id, tenantId: _tenantId, ...updateData } = item;
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: updateData,
      create: item,
    });
  }

  console.log(`Created ${burgerItems.length} menu items for Burger Shack`);

  // Category-item links
  const burgerCategoryLinks = [
    // Burgers
    { categoryId: burgerCategoryBurgers.id, menuItemId: "burger-item-classic-cheese", sortOrder: 1 },
    { categoryId: burgerCategoryBurgers.id, menuItemId: "burger-item-double-cheese", sortOrder: 2 },
    { categoryId: burgerCategoryBurgers.id, menuItemId: "burger-item-bacon-cheese", sortOrder: 3 },
    { categoryId: burgerCategoryBurgers.id, menuItemId: "burger-item-mushroom-swiss", sortOrder: 4 },
    { categoryId: burgerCategoryBurgers.id, menuItemId: "burger-item-spicy-jalapeno", sortOrder: 5 },
    { categoryId: burgerCategoryBurgers.id, menuItemId: "burger-item-bbq-bacon", sortOrder: 6 },
    { categoryId: burgerCategoryBurgers.id, menuItemId: "burger-item-veggie", sortOrder: 7 },
    { categoryId: burgerCategoryBurgers.id, menuItemId: "burger-item-chicken-sandwich", sortOrder: 8 },
    // Sides
    { categoryId: burgerCategorySides.id, menuItemId: "burger-item-fries", sortOrder: 1 },
    { categoryId: burgerCategorySides.id, menuItemId: "burger-item-onion-rings", sortOrder: 2 },
    { categoryId: burgerCategorySides.id, menuItemId: "burger-item-sweet-fries", sortOrder: 3 },
    { categoryId: burgerCategorySides.id, menuItemId: "burger-item-side-salad", sortOrder: 4 },
    // Drinks
    { categoryId: burgerCategoryDrinks.id, menuItemId: "burger-item-soda", sortOrder: 1 },
    { categoryId: burgerCategoryDrinks.id, menuItemId: "burger-item-milkshake", sortOrder: 2 },
    { categoryId: burgerCategoryDrinks.id, menuItemId: "burger-item-iced-tea", sortOrder: 3 },
    { categoryId: burgerCategoryDrinks.id, menuItemId: "burger-item-water", sortOrder: 4 },
    // Desserts
    { categoryId: burgerCategoryDesserts.id, menuItemId: "burger-item-brownie", sortOrder: 1 },
    { categoryId: burgerCategoryDesserts.id, menuItemId: "burger-item-apple-pie", sortOrder: 2 },
  ];

  for (const link of burgerCategoryLinks) {
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
        tenantId: burgerTenant.id,
        categoryId: link.categoryId,
        menuItemId: link.menuItemId,
        sortOrder: link.sortOrder,
      },
    });
  }

  // Modifier groups (doneness, add-ons, remove, drink size/flavor, shake flavor)
  const burgerModifierData: {
    tenantId: string;
    menuItemId: string;
    groups: {
      id: string;
      name: string;
      required: boolean;
      minSelect: number;
      maxSelect: number;
      allowQuantity?: boolean;
      maxQuantityPerModifier?: number;
      options: { id: string; name: string; price: number; isDefault?: boolean }[];
    }[];
  }[] = [];

  const donenessOptions = (itemId: string) => ({
    id: `${itemId}-doneness`,
    name: "Doneness",
    required: true,
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: `${itemId}-doneness-medium-rare`, name: "Medium Rare", price: 0 },
      { id: `${itemId}-doneness-medium`, name: "Medium", price: 0, isDefault: true },
      { id: `${itemId}-doneness-medium-well`, name: "Medium Well", price: 0 },
      { id: `${itemId}-doneness-well-done`, name: "Well Done", price: 0 },
    ],
  });

  const addonsOptions = (itemId: string) => ({
    id: `${itemId}-addons`,
    name: "Add-ons",
    required: false,
    minSelect: 0,
    maxSelect: 6,
    allowQuantity: true,
    maxQuantityPerModifier: 2,
    options: [
      { id: `${itemId}-addons-extra-patty`, name: "Extra Patty", price: 3.5 },
      { id: `${itemId}-addons-extra-cheese`, name: "Extra Cheese", price: 1 },
      { id: `${itemId}-addons-bacon`, name: "Bacon", price: 2 },
      { id: `${itemId}-addons-avocado`, name: "Avocado", price: 2 },
      { id: `${itemId}-addons-fried-egg`, name: "Fried Egg", price: 1.5 },
      { id: `${itemId}-addons-jalapenos`, name: "Jalapenos", price: 0.75 },
    ],
  });

  const removeOptions = (itemId: string) => ({
    id: `${itemId}-remove`,
    name: "Remove",
    required: false,
    minSelect: 0,
    maxSelect: 5,
    options: [
      { id: `${itemId}-remove-lettuce`, name: "No Lettuce", price: 0 },
      { id: `${itemId}-remove-tomato`, name: "No Tomato", price: 0 },
      { id: `${itemId}-remove-onion`, name: "No Onion", price: 0 },
      { id: `${itemId}-remove-pickles`, name: "No Pickles", price: 0 },
      { id: `${itemId}-remove-sauce`, name: "No Sauce", price: 0 },
    ],
  });

  const beefBurgerIds = [
    "burger-item-classic-cheese",
    "burger-item-double-cheese",
    "burger-item-bacon-cheese",
    "burger-item-mushroom-swiss",
    "burger-item-spicy-jalapeno",
    "burger-item-bbq-bacon",
  ];

  for (const id of beefBurgerIds) {
    burgerModifierData.push({
      tenantId: burgerTenant.id,
      menuItemId: id,
      groups: [donenessOptions(id), addonsOptions(id), removeOptions(id)],
    });
  }

  // Veggie and chicken don't get doneness
  burgerModifierData.push({
    tenantId: burgerTenant.id,
    menuItemId: "burger-item-veggie",
    groups: [addonsOptions("burger-item-veggie"), removeOptions("burger-item-veggie")],
  });
  burgerModifierData.push({
    tenantId: burgerTenant.id,
    menuItemId: "burger-item-chicken-sandwich",
    groups: [addonsOptions("burger-item-chicken-sandwich"), removeOptions("burger-item-chicken-sandwich")],
  });

  // Fries size
  burgerModifierData.push({
    tenantId: burgerTenant.id,
    menuItemId: "burger-item-fries",
    groups: [
      {
        id: "burger-item-fries-size",
        name: "Size",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: "burger-item-fries-size-small", name: "Small", price: 0, isDefault: true },
          { id: "burger-item-fries-size-medium", name: "Medium", price: 1 },
          { id: "burger-item-fries-size-large", name: "Large", price: 2 },
        ],
      },
    ],
  });

  // Soda size and flavor
  burgerModifierData.push({
    tenantId: burgerTenant.id,
    menuItemId: "burger-item-soda",
    groups: [
      {
        id: "burger-item-soda-size",
        name: "Size",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: "burger-item-soda-size-small", name: "Small", price: 0, isDefault: true },
          { id: "burger-item-soda-size-medium", name: "Medium", price: 0.5 },
          { id: "burger-item-soda-size-large", name: "Large", price: 1 },
        ],
      },
      {
        id: "burger-item-soda-flavor",
        name: "Flavor",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: "burger-item-soda-flavor-coke", name: "Coca-Cola", price: 0, isDefault: true },
          { id: "burger-item-soda-flavor-diet", name: "Diet Coke", price: 0 },
          { id: "burger-item-soda-flavor-sprite", name: "Sprite", price: 0 },
          { id: "burger-item-soda-flavor-drpepper", name: "Dr Pepper", price: 0 },
          { id: "burger-item-soda-flavor-lemonade", name: "Lemonade", price: 0 },
        ],
      },
    ],
  });

  // Milkshake flavor
  burgerModifierData.push({
    tenantId: burgerTenant.id,
    menuItemId: "burger-item-milkshake",
    groups: [
      {
        id: "burger-item-milkshake-flavor",
        name: "Flavor",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: "burger-item-milkshake-flavor-vanilla", name: "Vanilla", price: 0, isDefault: true },
          { id: "burger-item-milkshake-flavor-chocolate", name: "Chocolate", price: 0 },
          { id: "burger-item-milkshake-flavor-strawberry", name: "Strawberry", price: 0 },
          { id: "burger-item-milkshake-flavor-oreo", name: "Oreo", price: 0.75 },
        ],
      },
    ],
  });

  for (const itemMod of burgerModifierData) {
    for (let groupIdx = 0; groupIdx < itemMod.groups.length; groupIdx++) {
      const group = itemMod.groups[groupIdx];

      await prisma.modifierGroup.upsert({
        where: { id: group.id },
        update: {
          name: group.name,
          required: group.required,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          allowQuantity: group.allowQuantity ?? false,
          maxQuantityPerModifier: group.maxQuantityPerModifier ?? 1,
        },
        create: {
          id: group.id,
          tenantId: itemMod.tenantId,
          name: group.name,
          required: group.required,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          allowQuantity: group.allowQuantity ?? false,
          maxQuantityPerModifier: group.maxQuantityPerModifier ?? 1,
        },
      });

      for (let optIdx = 0; optIdx < group.options.length; optIdx++) {
        const opt = group.options[optIdx];
        await prisma.modifierOption.upsert({
          where: { id: opt.id },
          update: { name: opt.name, price: opt.price, isDefault: opt.isDefault ?? false, sortOrder: optIdx },
          create: {
            id: opt.id,
            tenantId: itemMod.tenantId,
            groupId: group.id,
            name: opt.name,
            price: opt.price,
            isDefault: opt.isDefault ?? false,
            isAvailable: true,
            sortOrder: optIdx,
          },
        });
      }

      await prisma.menuItemModifierGroup.upsert({
        where: {
          menuItemId_modifierGroupId: {
            menuItemId: itemMod.menuItemId,
            modifierGroupId: group.id,
          },
        },
        update: { sortOrder: groupIdx },
        create: {
          id: `mimg-${group.id}`,
          menuItemId: itemMod.menuItemId,
          modifierGroupId: group.id,
          sortOrder: groupIdx,
        },
      });
    }
  }

  // Featured items
  const burgerFeaturedIds = [
    "burger-item-classic-cheese",
    "burger-item-double-cheese",
    "burger-item-bacon-cheese",
    "burger-item-fries",
  ];
  for (let i = 0; i < burgerFeaturedIds.length; i++) {
    const menuItemId = burgerFeaturedIds[i];
    await prisma.featuredItem.upsert({
      where: {
        tenantId_menuItemId: {
          tenantId: burgerTenant.id,
          menuItemId,
        },
      },
      update: { sortOrder: i + 1 },
      create: {
        id: `featured-burger-${menuItemId}`,
        tenantId: burgerTenant.id,
        menuItemId,
        sortOrder: i + 1,
      },
    });
  }

  // Tax associations for all items
  for (const item of burgerItems) {
    await prisma.menuItemTax.upsert({
      where: {
        menuItemId_taxConfigId: {
          menuItemId: item.id,
          taxConfigId: burgerTax.id,
        },
      },
      update: {},
      create: {
        id: `mit-${item.id}-standard`,
        tenantId: burgerTenant.id,
        menuItemId: item.id,
        taxConfigId: burgerTax.id,
      },
    });
  }

  // Loyalty config
  await prisma.loyaltyConfig.upsert({
    where: { id: "loyalty-config-burger-phone-ai" },
    update: {},
    create: {
      id: "loyalty-config-burger-phone-ai",
      tenantId: burgerTenant.id,
      pointsPerDollar: 1,
      status: "active",
    },
  });

  console.log(`✅ Burger Shack ready for phone AI testing`);
  console.log(`   NEXT_PUBLIC_PLAYGROUND_TENANT_ID=${burgerTenant.id}`);
  console.log(`   NEXT_PUBLIC_PLAYGROUND_MERCHANT_ID=${burgerMerchant.id}`);

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
      passwordHash: sharedPasswordHash,
      name: "Onboarding Test User",
      role: "owner",
      status: "active",
    },
  });

  console.log(`Created onboarding test user: ${onboardingUser.email}`);
  console.log("\n✅ All accounts ready!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Template       | Tenant                    | Slug                         | Email / Password");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("fast_casual    | Joe's Pizza               | /joes-pizza                  | joe@joespizza.com");
  console.log("cafe_bakery    | Bella's Bakery            | /bellas-bakery               | bella@bellasbakery.com");
  console.log("fine_dining    | The Capital Grille        | /capital-grille              | chef@capitalgrille.com");
  console.log("casual         | The Neighborhood Kitchen  | /neighborhood-kitchen        | mike@neighborhoodkitchen.com");
  console.log("bar_lounge     | The Velvet Lounge         | /velvet-lounge               | owner@velvetlounge.com");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("(onboarding)   | New Restaurant            | /onboarding-test             | test@example.com");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("All passwords: test123\n");

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
