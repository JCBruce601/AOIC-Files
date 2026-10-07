// Core logic for the shared program dashboard, kept free of Netlify imports so it can be tested with a fake store.
// Each record lives under its own key ("<kind>/<id>"), so two people editing different items never overwrite each other.

export const KINDS = ["actions", "decisions", "updates", "status"] as const;
type Kind = (typeof KINDS)[number];

export interface BlobStore {
  get(key: string, opts?: { type?: "json"; consistency?: "strong" | "eventual" }): Promise<any>;
  setJSON(key: string, value: unknown): Promise<unknown>;
  list(opts?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>;
}

const MAX_BODY = 20_000;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

// Allowed fields per record kind: [field, max length]. Anything else is dropped.
const FIELDS: Record<Kind, [string, number][]> = {
  actions: [["title", 300], ["owner", 80], ["ws", 20], ["status", 12], ["waitingOn", 80], ["due", 10], ["priority", 8], ["source", 300], ["link", 500], ["notes", 2000]],
  decisions: [["question", 300], ["decider", 80], ["needBy", 10], ["ws", 20], ["status", 12], ["outcome", 1000], ["options", 1000]],
  updates: [["date", 10], ["author", 80], ["ws", 20], ["text", 3000]],
  status: [["rag", 8], ["headline", 400]]
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export function sanitize(kind: Kind, input: any, editor: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Body must be a JSON object.");
  const out: Record<string, unknown> = {};
  for (const [field, max] of FIELDS[kind]) {
    const v = input[field];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string") throw new Error(`Field "${field}" must be text.`);
    out[field] = v.slice(0, max);
  }
  if (input.deleted === true) out.deleted = true;
  out.updatedAt = new Date().toISOString();
  out.updatedBy = String(editor || "Someone").slice(0, 80);
  return out;
}

export async function readAll(store: BlobStore) {
  const result: Record<string, Record<string, unknown>[]> = { actions: [], decisions: [], updates: [], status: [] };
  const { blobs } = await store.list();
  const entries = await Promise.all(
    blobs.map(async ({ key }) => [key, await store.get(key, { type: "json", consistency: "strong" })] as const)
  );
  for (const [key, value] of entries) {
    const [kind, id] = key.split("/");
    if (value && (KINDS as readonly string[]).includes(kind) && id) result[kind].push({ ...value, id });
  }
  return result;
}

export async function handle(req: Request, store: BlobStore, params: { kind?: string; id?: string }) {
  try {
    if (req.method === "GET") {
      return json({ ok: true, serverTime: new Date().toISOString(), ...(await readAll(store)) });
    }
    const { kind, id } = params;
    if (!kind || !(KINDS as readonly string[]).includes(kind)) return json({ ok: false, error: "Unknown record type." }, 404);
    if (!id || !ID_RE.test(id)) return json({ ok: false, error: "Invalid record id." }, 400);
    if (req.method !== "PUT") return json({ ok: false, error: "Use GET or PUT." }, 405);
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ ok: false, error: "Record is too large." }, 413);
    let body: any;
    try { body = JSON.parse(text); } catch { return json({ ok: false, error: "Body is not valid JSON." }, 400); }
    const editor = req.headers.get("x-editor") || "";
    const record = sanitize(kind as Kind, body, editor);
    await store.setJSON(`${kind}/${id}`, record);
    return json({ ok: true, record: { ...record, id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    console.error("board error:", message);
    return json({ ok: false, error: message }, 400);
  }
}
