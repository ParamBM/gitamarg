export const PAYMENT_PLANS = {
  monthly: {
    id: "monthly",
    label: "Monthly",
    displayPrice: "Rs.49/month",
    amountPaise: 4900,
    currency: "INR",
    durationDays: 30,
  },
  annual: {
    id: "annual",
    label: "Annual",
    displayPrice: "Rs.399/year",
    amountPaise: 39900,
    currency: "INR",
    durationDays: 365,
  },
};

export function getPaymentPlan(planId) {
  return PAYMENT_PLANS[planId] || null;
}
