import { ZuploRequest, ZuploContext } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
  try {
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Unauthorized", message: "API Key missing" }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      context.log.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
      return new Response(JSON.stringify({ error: "Internal Server Error", message: "Infrastructure misconfigured" }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const fetchUrl = `${supabaseUrl}/rest/v1/profiles?api_key=eq.${apiKey}&select=*`;
    
    const response = await fetch(fetchUrl, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      context.log.error(`Supabase Fetch Error: ${response.status} - ${errText}`);
      return new Response(JSON.stringify({ error: "Internal Server Error", message: "Auth lookup failed" }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const profiles = await response.json();

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ error: "Unauthorized", message: "Invalid API Key" }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const userProfile = profiles[0];

    // Populate the request.user object
    request.user = {
      sub: userProfile.id,
      email: userProfile.email,
      groups: [userProfile.tier || "Starter"]
    };

    return request;
  } catch (err) {
    context.log.error(`Supabase Auth Critical Error: ${err.message}`);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
