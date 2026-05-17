import { ZuploRequest, ZuploContext } from "@zuplo/runtime";

const TIER_CONFIGS = {
  Starter: {
    monthly_limit: 250,
    rpm: 2
  },
  Pro: {
    monthly_limit: 5000,
    rpm: 30
  },
  Business: {
    monthly_limit: 20000,
    rpm: 120
  },
  Enterprise: {
    monthly_limit: 100000,
    rpm: 300
  }
};

export function getRateLimit(request: ZuploRequest, context: ZuploContext) {
  // Identify group - default to Free if not found
  const groups = request.user?.data?.groups || [];
  const activeTierName = (Object.keys(TIER_CONFIGS).find(tier => groups.includes(tier)) || 'Starter') as keyof typeof TIER_CONFIGS;
  const config = TIER_CONFIGS[activeTierName];

  return {
    key: request.user?.sub || request.headers.get("true-client-ip") || "anonymous",
    requestsAllowed: config.rpm,
    timeWindowMinutes: 1
  };
}

export function getQuota(request: ZuploRequest, context: ZuploContext) {
  // Identify group - default to Free if not found
  const groups = request.user?.data?.groups || [];
  const activeTierName = (Object.keys(TIER_CONFIGS).find(tier => groups.includes(tier)) || 'Starter') as keyof typeof TIER_CONFIGS;
  const config = TIER_CONFIGS[activeTierName];

  return {
    key: request.user?.sub || "anonymous",
    requestsAllowed: config.monthly_limit,
    timeWindowMinutes: 43200 // 30 days in minutes
  };
}
