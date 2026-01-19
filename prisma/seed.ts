import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function main() {
  console.log("Seeding database...");

  // Create a demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: "tenant-joes-pizza" },
    update: {},
    create: {
      id: "tenant-joes-pizza",
      name: "Joe's Pizza",
      subscriptionPlan: "free",
      subscriptionStatus: "active",
    },
  });

  console.log(`Created tenant: ${tenant.name} (${tenant.id})`);

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
      featuredItems: [
        {
          id: "featured-1",
          name: "Classic Cheese Pizza",
          description: "Our signature pizza with fresh mozzarella and house-made tomato sauce",
          price: 18.99,
          image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
          category: "Pizza",
        },
        {
          id: "featured-2",
          name: "Pepperoni Pizza",
          description: "Classic pepperoni with premium mozzarella cheese",
          price: 21.99,
          image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop",
          category: "Pizza",
        },
        {
          id: "featured-3",
          name: "Margherita Pizza",
          description: "Fresh tomatoes, mozzarella, basil, and olive oil",
          price: 19.99,
          image: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=400&h=300&fit=crop",
          category: "Pizza",
        },
        {
          id: "featured-4",
          name: "Garlic Knots",
          description: "Fresh baked knots with garlic butter (6 pieces)",
          price: 5.99,
          image: "https://images.unsplash.com/photo-1619531040576-f9416740661b?w=400&h=300&fit=crop",
          category: "Sides",
        },
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

  // Company data (shared between create and update)
  const joesPizzaCompanyData = {
    name: "Joe's Pizza",
    legalName: "Joe's Pizza Inc.",
    description: "Authentic New York style pizza since 1985",
    logoUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop",
    websiteUrl: "https://joespizza.com",
    supportEmail: "support@joespizza.com",
    supportPhone: "(212) 555-0100",
    settings: joesPizzaWebsiteSettings,
  };

  // Create company (brand)
  const company = await prisma.company.upsert({
    where: { tenantId: tenant.id },
    update: joesPizzaCompanyData,
    create: {
      id: "company-joes-pizza",
      tenantId: tenant.id,
      slug: "joes-pizza",
      ...joesPizzaCompanyData,
    },
  });

  console.log(`Created company: ${company.name} (${company.id})`);

  // Create merchant (store)
  const merchant = await prisma.merchant.upsert({
    where: { slug: "joes-pizza" },
    update: {},
    create: {
      id: "merchant-joes-pizza-main",
      companyId: company.id,
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
      taxRate: 0.08875, // NYC tax rate
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
        acceptsPickup: true,
        acceptsDelivery: true,
        deliveryRadius: 5,
        minimumOrderAmount: 15,
        estimatedPrepTime: 20,
        tipConfig: {
          mode: "percentage",
          tiers: [0.15, 0.18, 0.2],
          allowCustom: true,
        },
        feeConfig: {
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
      companyId: company.id,
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
      taxRate: 0.08875,
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
        acceptsPickup: true,
        acceptsDelivery: true,
        deliveryRadius: 5,
        minimumOrderAmount: 15,
        estimatedPrepTime: 20,
        tipConfig: {
          mode: "percentage",
          tiers: [0.15, 0.18, 0.2],
          allowCustom: true,
        },
        feeConfig: {
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
      companyId: company.id,
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
      taxRate: 0.08875,
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
        acceptsPickup: true,
        acceptsDelivery: true,
        deliveryRadius: 3,
        minimumOrderAmount: 20,
        estimatedPrepTime: 15,
        tipConfig: {
          mode: "percentage",
          tiers: [0.15, 0.18, 0.2],
          allowCustom: true,
        },
        feeConfig: {
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

  // ==================== Bella's Bakery (Single Location) ====================
  console.log("\nCreating Bella's Bakery (single location)...");

  // Create tenant for Bella's Bakery
  const bellaTenant = await prisma.tenant.upsert({
    where: { id: "tenant-bellas-bakery" },
    update: {},
    create: {
      id: "tenant-bellas-bakery",
      name: "Bella's Bakery",
      subscriptionPlan: "free",
      subscriptionStatus: "active",
    },
  });

  console.log(`Created tenant: ${bellaTenant.name} (${bellaTenant.id})`);

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
      featuredItems: [
        {
          id: "bella-featured-1",
          name: "Sourdough Loaf",
          description: "Our signature 24-hour fermented sourdough with a crispy crust",
          price: 8.99,
          image: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&h=300&fit=crop",
          category: "Bread",
        },
        {
          id: "bella-featured-2",
          name: "Butter Croissant",
          description: "Flaky, golden layers of French butter perfection",
          price: 4.49,
          image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=300&fit=crop",
          category: "Pastry",
        },
        {
          id: "bella-featured-3",
          name: "Almond Danish",
          description: "Sweet almond cream in a buttery Danish pastry",
          price: 5.29,
          image: "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=400&h=300&fit=crop",
          category: "Pastry",
        },
        {
          id: "bella-featured-4",
          name: "Cappuccino",
          description: "Rich espresso with perfectly steamed milk",
          price: 4.99,
          image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop",
          category: "Coffee",
        },
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

  // Company data for Bella's Bakery
  const bellasBakeryCompanyData = {
    name: "Bella's Bakery",
    legalName: "Bella's Artisan Bakery LLC",
    description: "Artisan breads and pastries handcrafted daily since 2010",
    logoUrl: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=200&h=200&fit=crop",
    websiteUrl: "https://bellasbakery.com",
    supportEmail: "hello@bellasbakery.com",
    supportPhone: "(415) 555-0200",
    settings: bellasBakeryWebsiteSettings,
  };

  // Create company for Bella's Bakery
  const bellaCompany = await prisma.company.upsert({
    where: { tenantId: bellaTenant.id },
    update: bellasBakeryCompanyData,
    create: {
      id: "company-bellas-bakery",
      tenantId: bellaTenant.id,
      slug: "bellas-bakery",
      ...bellasBakeryCompanyData,
    },
  });

  console.log(`Created company: ${bellaCompany.name} (${bellaCompany.id})`);

  // Create single merchant for Bella's Bakery
  const bellaMerchant = await prisma.merchant.upsert({
    where: { slug: "bellas-bakery-sf" },
    update: {},
    create: {
      id: "merchant-bellas-sf",
      companyId: bellaCompany.id,
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
      taxRate: 0.0875, // SF tax rate
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
        acceptsPickup: true,
        acceptsDelivery: false,
        minimumOrderAmount: 10,
        estimatedPrepTime: 10,
        tipConfig: {
          mode: "percentage",
          tiers: [0.15, 0.18, 0.2],
          allowCustom: true,
        },
        feeConfig: {
          fees: [],
        },
      },
    },
  });

  console.log(`Created merchant: ${bellaMerchant.name} (single location)`);

  // Create menu categories for Bella's Bakery
  const bellaBreadCategory = await prisma.menuCategory.upsert({
    where: { id: "bella-cat-bread" },
    update: {},
    create: {
      id: "bella-cat-bread",
      tenantId: bellaTenant.id,
      merchantId: bellaMerchant.id,
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
      merchantId: bellaMerchant.id,
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
      merchantId: bellaMerchant.id,
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
      merchantId: bellaMerchant.id,
      categoryId: bellaBreadCategory.id,
      name: "Sourdough Loaf",
      description: "Our signature 24-hour fermented sourdough with a crispy crust and soft interior",
      price: 8.99,
      sortOrder: 1,
      tags: ["vegetarian", "vegan"],
      options: [],
    },
    {
      id: "bella-item-baguette",
      tenantId: bellaTenant.id,
      merchantId: bellaMerchant.id,
      categoryId: bellaBreadCategory.id,
      name: "French Baguette",
      description: "Traditional French baguette with a golden crust",
      price: 4.49,
      sortOrder: 2,
      tags: ["vegetarian", "vegan"],
      options: [],
    },
    {
      id: "bella-item-focaccia",
      tenantId: bellaTenant.id,
      merchantId: bellaMerchant.id,
      categoryId: bellaBreadCategory.id,
      name: "Rosemary Focaccia",
      description: "Italian flatbread with fresh rosemary and sea salt",
      price: 6.99,
      sortOrder: 3,
      tags: ["vegetarian", "vegan"],
      options: [],
    },
    // Pastries
    {
      id: "bella-item-croissant",
      tenantId: bellaTenant.id,
      merchantId: bellaMerchant.id,
      categoryId: bellaPastryCategory.id,
      name: "Butter Croissant",
      description: "Flaky, golden layers of French butter perfection",
      price: 4.49,
      sortOrder: 1,
      tags: ["vegetarian"],
      options: [],
    },
    {
      id: "bella-item-almond-danish",
      tenantId: bellaTenant.id,
      merchantId: bellaMerchant.id,
      categoryId: bellaPastryCategory.id,
      name: "Almond Danish",
      description: "Sweet almond cream in a buttery Danish pastry",
      price: 5.29,
      sortOrder: 2,
      tags: ["vegetarian"],
      options: [],
    },
    {
      id: "bella-item-chocolate-croissant",
      tenantId: bellaTenant.id,
      merchantId: bellaMerchant.id,
      categoryId: bellaPastryCategory.id,
      name: "Chocolate Croissant",
      description: "Buttery croissant filled with rich dark chocolate",
      price: 4.99,
      sortOrder: 3,
      tags: ["vegetarian"],
      options: [],
    },
    {
      id: "bella-item-cinnamon-roll",
      tenantId: bellaTenant.id,
      merchantId: bellaMerchant.id,
      categoryId: bellaPastryCategory.id,
      name: "Cinnamon Roll",
      description: "Warm, gooey cinnamon roll with cream cheese frosting",
      price: 5.49,
      sortOrder: 4,
      tags: ["vegetarian"],
      options: [],
    },
    // Coffee & Drinks
    {
      id: "bella-item-cappuccino",
      tenantId: bellaTenant.id,
      merchantId: bellaMerchant.id,
      categoryId: bellaCoffeeCategory.id,
      name: "Cappuccino",
      description: "Rich espresso with perfectly steamed milk and foam",
      price: 4.99,
      sortOrder: 1,
      tags: ["vegetarian"],
      options: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          choices: [
            { id: "small", name: "Small (8 oz)", price: 0 },
            { id: "large", name: "Large (12 oz)", price: 1.5 },
          ],
        },
        {
          id: "milk",
          name: "Milk",
          type: "single",
          required: false,
          choices: [
            { id: "whole", name: "Whole Milk", price: 0 },
            { id: "oat", name: "Oat Milk", price: 0.75 },
            { id: "almond", name: "Almond Milk", price: 0.75 },
          ],
        },
      ],
    },
    {
      id: "bella-item-latte",
      tenantId: bellaTenant.id,
      merchantId: bellaMerchant.id,
      categoryId: bellaCoffeeCategory.id,
      name: "Café Latte",
      description: "Smooth espresso with steamed milk",
      price: 5.49,
      sortOrder: 2,
      tags: ["vegetarian"],
      options: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          choices: [
            { id: "small", name: "Small (8 oz)", price: 0 },
            { id: "large", name: "Large (12 oz)", price: 1.5 },
          ],
        },
      ],
    },
    {
      id: "bella-item-drip-coffee",
      tenantId: bellaTenant.id,
      merchantId: bellaMerchant.id,
      categoryId: bellaCoffeeCategory.id,
      name: "Drip Coffee",
      description: "House blend drip coffee",
      price: 2.99,
      sortOrder: 3,
      tags: ["vegetarian", "vegan"],
      options: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          choices: [
            { id: "small", name: "Small (12 oz)", price: 0 },
            { id: "large", name: "Large (16 oz)", price: 1 },
          ],
        },
      ],
    },
  ];

  for (const item of bellaMenuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    });
  }

  console.log(`Created ${bellaMenuItems.length} menu items for Bella's Bakery`);
  console.log("✅ Bella's Bakery (single location) created!");

  // Create menu categories (with both tenantId for legacy and merchantId for new)
  const pizzaCategory = await prisma.menuCategory.upsert({
    where: {
      id: "cat-pizza",
    },
    update: {},
    create: {
      id: "cat-pizza",
      tenantId: tenant.id,
      merchantId: merchant.id,
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
      merchantId: merchant.id,
      name: "Sides",
      description: "Appetizers and sides",
      sortOrder: 2,
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
      merchantId: merchant.id,
      name: "Drinks",
      description: "Beverages",
      sortOrder: 3,
    },
  });

  console.log("Created menu categories");

  // Create menu items (with both tenantId for legacy and merchantId for new)
  const menuItems = [
    // Pizzas
    {
      id: "item-cheese-pizza",
      tenantId: tenant.id,
      merchantId: merchant.id,
      categoryId: pizzaCategory.id,
      name: "Classic Cheese Pizza",
      description: "Our signature pizza with fresh mozzarella and house-made tomato sauce",
      price: 18.99,
      sortOrder: 1,
      tags: ["vegetarian"],
      options: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          choices: [
            { id: "small", name: "Small (10\")", price: 0 },
            { id: "medium", name: "Medium (14\")", price: 4 },
            { id: "large", name: "Large (18\")", price: 8 },
          ],
        },
        {
          id: "crust",
          name: "Crust",
          type: "single",
          required: false,
          choices: [
            { id: "regular", name: "Regular", price: 0 },
            { id: "thin", name: "Thin Crust", price: 0 },
            { id: "thick", name: "Thick Crust", price: 2 },
          ],
        },
      ],
    },
    {
      id: "item-pepperoni-pizza",
      tenantId: tenant.id,
      merchantId: merchant.id,
      categoryId: pizzaCategory.id,
      name: "Pepperoni Pizza",
      description: "Classic pepperoni with mozzarella cheese",
      price: 21.99,
      sortOrder: 2,
      tags: [],
      options: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          choices: [
            { id: "small", name: "Small (10\")", price: 0 },
            { id: "medium", name: "Medium (14\")", price: 4 },
            { id: "large", name: "Large (18\")", price: 8 },
          ],
        },
      ],
    },
    {
      id: "item-margherita-pizza",
      tenantId: tenant.id,
      merchantId: merchant.id,
      categoryId: pizzaCategory.id,
      name: "Margherita Pizza",
      description: "Fresh tomatoes, mozzarella, basil, and olive oil",
      price: 19.99,
      sortOrder: 3,
      tags: ["vegetarian"],
      options: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          choices: [
            { id: "small", name: "Small (10\")", price: 0 },
            { id: "medium", name: "Medium (14\")", price: 4 },
            { id: "large", name: "Large (18\")", price: 8 },
          ],
        },
      ],
    },
    {
      id: "item-meat-lovers-pizza",
      tenantId: tenant.id,
      merchantId: merchant.id,
      categoryId: pizzaCategory.id,
      name: "Meat Lovers Pizza",
      description: "Pepperoni, sausage, bacon, and ham",
      price: 24.99,
      sortOrder: 4,
      tags: [],
      options: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          choices: [
            { id: "small", name: "Small (10\")", price: 0 },
            { id: "medium", name: "Medium (14\")", price: 4 },
            { id: "large", name: "Large (18\")", price: 8 },
          ],
        },
      ],
    },
    // Sides
    {
      id: "item-garlic-knots",
      tenantId: tenant.id,
      merchantId: merchant.id,
      categoryId: sidesCategory.id,
      name: "Garlic Knots",
      description: "Fresh baked knots with garlic butter (6 pieces)",
      price: 5.99,
      sortOrder: 1,
      tags: ["vegetarian"],
      options: [],
    },
    {
      id: "item-mozzarella-sticks",
      tenantId: tenant.id,
      merchantId: merchant.id,
      categoryId: sidesCategory.id,
      name: "Mozzarella Sticks",
      description: "Crispy fried mozzarella with marinara sauce (6 pieces)",
      price: 8.99,
      sortOrder: 2,
      tags: ["vegetarian"],
      options: [],
    },
    {
      id: "item-caesar-salad",
      tenantId: tenant.id,
      merchantId: merchant.id,
      categoryId: sidesCategory.id,
      name: "Caesar Salad",
      description: "Romaine lettuce, parmesan, croutons, and Caesar dressing",
      price: 9.99,
      sortOrder: 3,
      tags: ["vegetarian"],
      options: [
        {
          id: "protein",
          name: "Add Protein",
          type: "single",
          required: false,
          choices: [
            { id: "none", name: "No Protein", price: 0 },
            { id: "chicken", name: "Grilled Chicken", price: 4 },
            { id: "shrimp", name: "Shrimp", price: 6 },
          ],
        },
      ],
    },
    // Drinks
    {
      id: "item-soda",
      tenantId: tenant.id,
      merchantId: merchant.id,
      categoryId: drinksCategory.id,
      name: "Soda",
      description: "Coca-Cola, Sprite, or Fanta",
      price: 2.49,
      sortOrder: 1,
      tags: [],
      options: [
        {
          id: "flavor",
          name: "Flavor",
          type: "single",
          required: true,
          choices: [
            { id: "coke", name: "Coca-Cola", price: 0 },
            { id: "sprite", name: "Sprite", price: 0 },
            { id: "fanta", name: "Fanta Orange", price: 0 },
          ],
        },
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          choices: [
            { id: "regular", name: "Regular (12 oz)", price: 0 },
            { id: "large", name: "Large (20 oz)", price: 1 },
          ],
        },
      ],
    },
    {
      id: "item-water",
      tenantId: tenant.id,
      merchantId: merchant.id,
      categoryId: drinksCategory.id,
      name: "Bottled Water",
      description: "Purified spring water",
      price: 1.99,
      sortOrder: 2,
      tags: [],
      options: [],
    },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    });
  }

  console.log(`Created ${menuItems.length} menu items`);

  // ==================== Onboarding Test Account ====================
  console.log("\nCreating onboarding test account...");

  // Create onboarding test tenant
  const onboardingTenant = await prisma.tenant.upsert({
    where: { id: "tenant-onboarding-test" },
    update: {},
    create: {
      id: "tenant-onboarding-test",
      name: "Onboarding Test Restaurant",
      subscriptionPlan: "free",
      subscriptionStatus: "active",
    },
  });

  console.log(`Created onboarding tenant: ${onboardingTenant.name}`);

  // Create company with onboarding NOT completed
  const onboardingCompany = await prisma.company.upsert({
    where: { tenantId: onboardingTenant.id },
    update: {},
    create: {
      id: "company-onboarding-test",
      tenantId: onboardingTenant.id,
      slug: "onboarding-test",
      name: "New Restaurant",
      description: "Testing onboarding flow",
      supportEmail: "test@example.com",
      supportPhone: "(555) 555-5555",
    },
  });

  console.log(`Created onboarding company: ${onboardingCompany.name} (status: ${onboardingCompany.onboardingStatus})`);

  // Create a merchant for the onboarding test (needed for dashboard route)
  const onboardingMerchant = await prisma.merchant.upsert({
    where: { slug: "test-restaurant" },
    update: {},
    create: {
      id: "merchant-onboarding-test",
      companyId: onboardingCompany.id,
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
      taxRate: 0.0875,
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
      companyId: onboardingCompany.id,
      email: "test@example.com",
      passwordHash: passwordHash,
      name: "Onboarding Test User",
      role: "owner",
      status: "active",
    },
  });

  console.log(`Created onboarding test user: ${onboardingUser.email}`);
  console.log("\n✅ Onboarding test account ready!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📧 Email: test@example.com");
  console.log("🔑 Password: test123");
  console.log("🏪 Merchant URL: /dashboard/merchant-onboarding-test");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
