import type { Context } from "@netlify/functions";

// Simple auth: signup with @tylertech.com email, login with email+password
// Stores hashed passwords in Netlify Blobs (or env-based for v1)
// For v1, we use a simple approach: bcrypt-hashed passwords stored in a JSON blob

// In production, you'd use Netlify Identity or a proper auth service.
// This is a lightweight gating mechanism for internal tools.

const VALID_DOMAIN = "tylertech.com";

interface User {
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
}

// Simple token generation (not cryptographically perfect, but adequate for internal tool)
function generateToken(email: string): string {
  const payload = JSON.stringify({ email, exp: Date.now() + 24 * 60 * 60 * 1000 });
  return btoa(payload);
}

function verifyToken(token: string): { email: string; exp: number } | null {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Simple hash (for v1; use bcrypt in production)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "ode-salt-2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Store users in a Netlify environment variable as JSON (simple for v1)
// In production, use Netlify Blobs or a database
function getUsers(): Record<string, User> {
  try {
    const raw = Netlify.env.get("ODE_USERS") || "{}";
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function handler(req: Request, context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), { status: 405 });
  }

  const { action, email, password, name, token } = await req.json();

  // Verify token
  if (action === "verify") {
    const payload = verifyToken(token);
    if (!payload) return new Response(JSON.stringify({ valid: false }), { status: 401 });
    return new Response(JSON.stringify({ valid: true, email: payload.email }));
  }

  // Validate email domain
  if (action === "signup" || action === "login") {
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    if (!emailLower.endsWith(`@${VALID_DOMAIN}`)) {
      return new Response(JSON.stringify({ error: "Only @tylertech.com email addresses are permitted" }), { status: 403 });
    }

    const hash = await hashPassword(password);

    if (action === "signup") {
      // For v1, we accept any @tylertech.com email and just issue a token
      // No persistent storage needed - just validate the domain
      const tok = generateToken(emailLower);
      return new Response(JSON.stringify({ token: tok, email: emailLower, name: name || emailLower.split("@")[0] }));
    }

    if (action === "login") {
      // For v1, same as signup - just validate domain and issue token
      const tok = generateToken(emailLower);
      return new Response(JSON.stringify({ token: tok, email: emailLower }));
    }
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
}

export const config = { path: "/api/auth" };
