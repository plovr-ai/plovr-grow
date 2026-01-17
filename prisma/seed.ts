import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  // Create company (brand)
  const company = await prisma.company.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      id: "company-joes-pizza",
      tenantId: tenant.id,
      slug: "joes-pizza",
      name: "Joe's Pizza",
      description: "Authentic New York style pizza since 1985",
      supportEmail: "support@joespizza.com",
      supportPhone: "(212) 555-0100",
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
      },
    },
  });

  console.log(`Created merchant: ${merchant.name}`);

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
