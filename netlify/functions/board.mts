// Shared program dashboard API. GET returns every record; PUT saves one record.
// The site's password protection is the access gate for this endpoint.
import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { handle } from "../lib/board-core.mts";

export default async (req: Request, context: Context) => {
  const store = getStore({ name: "aoic-dashboard", consistency: "strong" });
  return handle(req, store, context.params as { kind?: string; id?: string });
};

export const config: Config = {
  path: ["/api/board", "/api/board/:kind/:id"],
  method: ["GET", "PUT"]
};
