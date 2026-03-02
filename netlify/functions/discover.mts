import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const params = url.searchParams;

  const baseUrl = "https://api.us.socrata.com/api/catalog/v1";
  const apiParams = new URLSearchParams();
  apiParams.set("published", "true");

  const passthrough = [
    "q", "only", "limit", "offset", "order",
    "min_should_match", "search_context", "domains",
    "categories", "tags", "for_user"
  ];

  for (const key of passthrough) {
    const val = params.get(key);
    if (val) apiParams.set(key, val);
  }

  if (!params.get("limit")) apiParams.set("limit", "25");
  if (!params.get("order")) apiParams.set("order", "page_views_last_month");

  const apiUrl = `${baseUrl}?${apiParams.toString()}`;

  try {
    const appToken = Netlify.env.get("SOCRATA_APP_TOKEN") || "";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (appToken) headers["X-App-Token"] = appToken;

    const response = await fetch(apiUrl, { headers });
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Socrata API ${response.status}`, detail: await response.text() }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Proxy error", message: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = { path: "/api/discover" };
