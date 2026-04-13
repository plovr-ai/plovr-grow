import { describe, it, expect } from "vitest";
import {
  calculateCustomerLoss,
  CHURN_RATE,
  ORDERS_PER_CUSTOMER,
} from "../customer-loss.utils";

describe("calculateCustomerLoss", () => {
  it("calculates estimated customers from monthly orders", () => {
    const result = calculateCustomerLoss(200, 25);
    expect(result.estimatedCustomers).toBe(100);
  });

  it("calculates lost customers at 25% churn rate", () => {
    const result = calculateCustomerLoss(200, 25);
    expect(result.lostCustomers).toBe(25);
  });

  it("calculates monthly revenue loss", () => {
    const result = calculateCustomerLoss(200, 25);
    expect(result.monthlyRevenueLoss).toBe(1250);
  });

  it("calculates yearly revenue loss", () => {
    const result = calculateCustomerLoss(200, 25);
    expect(result.yearlyRevenueLoss).toBe(15000);
  });

  it("rounds estimated customers to nearest integer", () => {
    const result = calculateCustomerLoss(75, 30);
    expect(result.estimatedCustomers).toBe(38);
  });

  it("rounds lost customers to nearest integer", () => {
    const result = calculateCustomerLoss(75, 30);
    expect(result.lostCustomers).toBe(10);
  });

  it("handles small order counts", () => {
    const result = calculateCustomerLoss(10, 20);
    expect(result.estimatedCustomers).toBe(5);
    expect(result.lostCustomers).toBe(1);
    expect(result.monthlyRevenueLoss).toBe(40);
    expect(result.yearlyRevenueLoss).toBe(480);
  });

  it("handles high AOV", () => {
    const result = calculateCustomerLoss(400, 50);
    expect(result.estimatedCustomers).toBe(200);
    expect(result.lostCustomers).toBe(50);
    expect(result.monthlyRevenueLoss).toBe(5000);
    expect(result.yearlyRevenueLoss).toBe(60000);
  });
});

describe("constants", () => {
  it("CHURN_RATE is 25%", () => {
    expect(CHURN_RATE).toBe(0.25);
  });

  it("ORDERS_PER_CUSTOMER is 2", () => {
    expect(ORDERS_PER_CUSTOMER).toBe(2);
  });
});
