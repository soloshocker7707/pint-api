import { ZuploRequest, ZuploContext } from "@zuplo/runtime";

/**
 * Syncs Dodo Payment subscriptions with Zuplo Consumer Groups.
 * Assign this to POST /webhooks/dodo
 */
export default async function (request: ZuploRequest, context: ZuploContext) {
  const body = await request.json();
  
  // 1. Verify Dodo Webhook Secret
  // Note: Replace with actual signature verification if needed
  // const signature = request.headers.get("x-dodo-signature");
  
  const { event_type, data } = body;
  
  // We only care about subscription events or order completions
  if (!['subscription.created', 'subscription.updated', 'order.completed'].includes(event_type)) {
    return { status: "ignored", event: event_type };
  }

  const email = data.customer?.email;
  const planName = data.subscription?.plan_name || data.product?.name; 

  if (!email || !planName) {
    context.log.error("Missing email or planName in Dodo webhook body");
    return { status: "error", message: "Missing data" };
  }

  // 2. Map Dodo Plan Names to Zuplo Consumer Groups
  const planToGroup = {
    "Starter": "Starter",
    "Pro": "Growth",
    "Expert": "Scale"
  };

  const targetGroup = planToGroup[planName] || "Free";

  // 3. Update Zuplo Consumer via Management API
  // You must set ZUPLO_API_KEY and ZUPLO_ACCOUNT_ID in your environment
  try {
    context.log.info(`Syncing user ${email} to group ${targetGroup}`);
    
    // This is a placeholder for the Zuplo Management API call.
    // In Zuplo, you can use the built-in 'context.zuplo.management' if available 
    // or fetch to the Management API directly.
    
    /*
    await fetch(`https://api.zuplo.com/v1/accounts/${process.env.ZUPLO_ACCOUNT_ID}/consumers/${email}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${process.env.ZUPLO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        groups: [targetGroup]
      })
    });
    */

    return { 
      status: "success", 
      user: email, 
      group: targetGroup,
      message: "Sync signal received" 
    };
  } catch (err) {
    context.log.error(`Failed to sync user ${email}: ${err.message}`);
    return { status: "error", message: err.message };
  }
}
