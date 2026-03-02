import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");
  const id = url.searchParams.get("id");

  if (!domain || !id) {
    return new Response(
      JSON.stringify({ error: "domain and id params required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Fetch metadata from the SODA API
    const metaUrl = `https://${domain}/api/views/${id}.json`;
    const appToken = Netlify.env.get("SOCRATA_APP_TOKEN") || "";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (appToken) headers["X-App-Token"] = appToken;

    const response = await fetch(metaUrl, { headers });
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Metadata fetch failed: ${response.status}` }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Also try to get a small sample of data
    let sample = null;
    try {
      const sampleUrl = `https://${domain}/resource/${id}.json?$limit=5`;
      const sampleResp = await fetch(sampleUrl, { headers });
      if (sampleResp.ok) sample = await sampleResp.json();
    } catch (_) {}

    return new Response(JSON.stringify({ metadata: data, sample }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Metadata proxy error", message: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = { path: "/api/metadata" };
