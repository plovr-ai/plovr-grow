import type { WebsiteData } from "@/types/website";

export const mockWebsiteData: WebsiteData = {
  merchant: {
    name: "Joe's Pizza",
    tagline: "Authentic New York Style Pizza Since 1985",
    address: "123 Main Street",
    city: "New York",
    state: "NY",
    zipCode: "10001",
    phone: "(212) 555-0123",
    email: "info@joespizza.com",
    logo: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop",
    heroImage: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=1920&h=1080&fit=crop",
    businessHours: {
      mon: { open: "11:00", close: "22:00" },
      tue: { open: "11:00", close: "22:00" },
      wed: { open: "11:00", close: "22:00" },
      thu: { open: "11:00", close: "22:00" },
      fri: { open: "11:00", close: "23:00" },
      sat: { open: "11:00", close: "23:00" },
      sun: { open: "12:00", close: "21:00" },
    },
    socialLinks: [
      { platform: "facebook", url: "https://facebook.com/joespizza" },
      { platform: "instagram", url: "https://instagram.com/joespizza" },
      { platform: "yelp", url: "https://yelp.com/biz/joes-pizza" },
      { platform: "google", url: "https://g.page/joespizza" },
    ],
    currency: "USD",
    locale: "en-US",
    tipConfig: {
      mode: "percentage",
      tiers: [0.15, 0.18, 0.2],
      allowCustom: true,
    },
  },
  featuredItems: [
    {
      id: "1",
      name: "Classic Cheese Pizza",
      description: "Our signature pizza with fresh mozzarella and house-made tomato sauce",
      price: 18.99,
      image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
      category: "Pizza",
    },
    {
      id: "2",
      name: "Pepperoni Pizza",
      description: "Classic pepperoni with premium mozzarella cheese",
      price: 21.99,
      image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop",
      category: "Pizza",
    },
    {
      id: "3",
      name: "Margherita Pizza",
      description: "Fresh tomatoes, mozzarella, basil, and olive oil",
      price: 19.99,
      image: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=400&h=300&fit=crop",
      category: "Pizza",
    },
    {
      id: "4",
      name: "Garlic Knots",
      description: "Fresh baked knots with garlic butter (6 pieces)",
      price: 5.99,
      image: "https://images.unsplash.com/photo-1619531040576-f9416740661b?w=400&h=300&fit=crop",
      category: "Sides",
    },
  ],
  reviews: [
    {
      id: "1",
      customerName: "Michael S.",
      rating: 5,
      content: "Best pizza in the city! The crust is perfectly crispy and the sauce is amazing. Been coming here for 10 years and it never disappoints.",
      date: "2024-01-10",
      source: "google",
    },
    {
      id: "2",
      customerName: "Sarah L.",
      rating: 5,
      content: "Authentic NY pizza that reminds me of home. Fast delivery and always fresh. The garlic knots are a must-try!",
      date: "2024-01-08",
      source: "yelp",
    },
    {
      id: "3",
      customerName: "David K.",
      rating: 5,
      content: "Finally found a pizza place that gets it right. Great value for the quality. Online ordering is super convenient.",
      date: "2024-01-05",
      source: "google",
    },
  ],
};

// Helper function to get mock data by tenant slug
export function getMockWebsiteData(slug: string): WebsiteData {
  // In the future, this could return different data based on slug
  // For now, return the same mock data
  return mockWebsiteData;
}
