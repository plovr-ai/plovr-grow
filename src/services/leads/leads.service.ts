import { leadRepository } from "@/repositories/lead.repository";

export interface CalculatorLeadInput {
  email: string;
  revenue: number;
  aov: number;
  platform: "doordash" | "ubereats" | "both";
  monthlyLoss: number;
  source?: "calculator" | "customer-loss";
}

export interface DemoLeadInput {
  restaurantName: string;
  placeId?: string;
  address?: string;
  locations?: string;
  posSystem?: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone: string;
  smsConsent?: boolean;
  landingPage?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  lgref?: string;
}

/**
 * Create a lead captured from the revenue calculator / customer-loss widget.
 */
async function createCalculatorLead(input: CalculatorLeadInput) {
  return leadRepository.create(input);
}

/**
 * Create a lead captured from a landing page "Request Demo" form.
 */
async function createDemoLead(input: DemoLeadInput) {
  return leadRepository.create({
    ...input,
    source: "landing-page",
  });
}

export const leadsService = {
  createCalculatorLead,
  createDemoLead,
};
