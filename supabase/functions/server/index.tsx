import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();
app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-App-Session"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ─── Allowed value enums ───────────────────────────────────────────────────
const VALID_CAMERA_STATUSES = [
  "available", "borrowed", "overdue", "maintenance", "unavailable", "defective",
];
const VALID_TXN_STATUSES = ["active", "returned", "overdue"];
const VALID_USER_ROLES = ["admin", "staff"];

// ─── Password hashing – Web Crypto PBKDF2 (no native deps) ────────────────
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 150_000 },
    keyMaterial, 256,
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return `pbkdf2:${saltB64}:${hashB64}`;
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // Legacy plaintext migration path – compare directly then re-hash on success
  if (!stored.startsWith("pbkdf2:")) return plain === stored;
  const [, saltB64, expectedB64] = stored.split(":");
  const salt = Uint8Array.from(atob(saltB64), (ch) => ch.charCodeAt(0));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(plain), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 150_000 },
    keyMaterial, 256,
  );
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return hashB64 === expectedB64;
}

// ─── Session management (tokens stored in KV with TTL) ────────────────────
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

async function createSession(
  userId: string, role: string, name: string,
): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await kv.set(`session:${token}`, { userId, role, name, expiresAt });
  return token;
}

interface SessionData { userId: string; role: string; name: string; }

async function validateSession(token: string | null): Promise<SessionData | null> {
  if (!token) return null;
  // Accept only 64-char hex strings – reject obviously malformed tokens early
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  try {
    const session = await kv.get(`session:${token}`);
    if (!session) return null;
    if (new Date(session.expiresAt) < new Date()) {
      await kv.del(`session:${token}`);
      return null;
    }
    return { userId: session.userId, role: session.role, name: session.name };
  } catch (e) {
    console.log("Session validation error:", e);
    return null;
  }
}

/** Read the X-App-Session header and validate it. */
async function getSession(c: any): Promise<SessionData | null> {
  return validateSession(c.req.header("X-App-Session") ?? null);
}

// ─── Input validation ──────────────────────────────────────────────────────
function stripPassword(user: any): any {
  if (!user) return user;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...safe } = user;
  return safe;
}

function validateCameraInput(d: any): string | null {
  if (!d.name || typeof d.name !== "string" || !d.name.trim() || d.name.length > 200)
    return "Camera name is required (max 200 chars)";
  if (!d.brand || typeof d.brand !== "string" || d.brand.length > 100)
    return "Brand is required (max 100 chars)";
  if (!d.model || typeof d.model !== "string" || d.model.length > 100)
    return "Model is required (max 100 chars)";
  if (!d.serialNumber || typeof d.serialNumber !== "string" || d.serialNumber.length > 100)
    return "Serial number is required (max 100 chars)";
  if (d.status && !VALID_CAMERA_STATUSES.includes(d.status))
    return `Status must be one of: ${VALID_CAMERA_STATUSES.join(", ")}`;
  return null;
}

function validateUserInput(d: any, requirePassword: boolean): string | null {
  if (!d.name || typeof d.name !== "string" || !d.name.trim() || d.name.length > 100)
    return "Name is required (max 100 chars)";
  if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    return "A valid email address is required";
  if (requirePassword && (!d.password || String(d.password).length < 8))
    return "Password must be at least 8 characters";
  if (d.role && !VALID_USER_ROLES.includes(d.role))
    return `Role must be one of: ${VALID_USER_ROLES.join(", ")}`;
  return null;
}

// ─── Health ────────────────────────────────────────────────────────────────
app.get("/make-server-355b453c/health", (c) => c.json({ status: "ok" }));

// ─── Login (no session required) ──────────────────────────────────────────
app.post("/make-server-355b453c/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body ?? {};
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const users = await kv.getByPrefix("user:");
    const user = users?.find(
      (u: any) => u.email?.toLowerCase() === String(email).toLowerCase(),
    );

    // Use a generic error to avoid leaking whether the email exists
    if (!user) return c.json({ error: "Invalid email or password" }, 401);

    if (!user.active) {
      return c.json(
        { error: "Account is deactivated. Please contact an administrator." }, 403,
      );
    }

    const valid = await verifyPassword(String(password), user.password ?? "");
    if (!valid) return c.json({ error: "Invalid email or password" }, 401);

    // Migrate plaintext password to PBKDF2 hash on first successful login
    if (!user.password.startsWith("pbkdf2:")) {
      const hashed = await hashPassword(String(password));
      await kv.set(`user:${user.id}`, { ...user, password: hashed });
    }

    const token = await createSession(user.id, user.role, user.name);
    return c.json({ token, user: stripPassword(user) });
  } catch (e) {
    console.log("Login error:", e);
    return c.json({ error: "Login failed due to an internal error" }, 500);
  }
});

// ─── Logout ────────────────────────────────────────────────────────────────
app.post("/make-server-355b453c/logout", async (c) => {
  try {
    const token = c.req.header("X-App-Session");
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      await kv.del(`session:${token}`);
    }
    return c.json({ success: true });
  } catch (e) {
    console.log("Logout error:", e);
    return c.json({ error: "Logout failed" }, 500);
  }
});

// ─── Seed (hashes passwords; idempotent) ──────────────────────────────────
app.post("/make-server-355b453c/seed", async (c) => {
  try {
    const existing = await kv.getByPrefix("camera:");
    if (existing && existing.length > 0) {
      return c.json({ message: "Already seeded", count: existing.length });
    }

    const [adminHash, staffHash] = await Promise.all([
      hashPassword("admin123"),
      hashPassword("staff123"),
    ]);

    const initialUsers = [
      { id: "USR-001", name: "Admin User", email: "admin@cameralab.edu", password: adminHash, role: "admin", department: "Administration", active: true, createdAt: "2025-01-01T08:00:00" },
      { id: "USR-002", name: "Maria Santos", email: "maria@cameralab.edu", password: staffHash, role: "staff", department: "Media Laboratory", active: true, createdAt: "2025-01-15T08:00:00" },
      { id: "USR-003", name: "John Rivera", email: "john@cameralab.edu", password: staffHash, role: "staff", department: "Photography Department", active: true, createdAt: "2025-02-01T08:00:00" },
    ];
    const initialCameras = [
      { id: "CAM-001", barcode: "CRMLAB-2024-001", name: "Canon EOS R5", brand: "Canon", model: "EOS R5", serialNumber: "SN-CR5-001234", status: "available", description: "45MP full-frame mirrorless camera with 8K RAW video", archived: false, addedDate: "2024-01-10T08:00:00" },
      { id: "CAM-002", barcode: "CRMLAB-2024-002", name: "Sony Alpha A7 IV", brand: "Sony", model: "Alpha A7 IV", serialNumber: "SN-SA7-002345", status: "borrowed", description: "33MP full-frame mirrorless with advanced autofocus", archived: false, addedDate: "2024-01-10T08:00:00" },
      { id: "CAM-003", barcode: "CRMLAB-2024-003", name: "Nikon Z6 II", brand: "Nikon", model: "Z6 II", serialNumber: "SN-NZ6-003456", status: "overdue", description: "24.5MP full-frame mirrorless, excellent low-light performance", archived: false, addedDate: "2024-02-15T08:00:00" },
      { id: "CAM-004", barcode: "CRMLAB-2024-004", name: "Canon EOS 5D Mark IV", brand: "Canon", model: "EOS 5D Mark IV", serialNumber: "SN-C5D-004567", status: "available", description: "30.4MP full-frame DSLR, versatile for photography and video", archived: false, addedDate: "2024-02-15T08:00:00" },
      { id: "CAM-005", barcode: "CRMLAB-2024-005", name: "Sony A6400", brand: "Sony", model: "Alpha A6400", serialNumber: "SN-SA6-005678", status: "maintenance", description: "24.2MP APS-C mirrorless, compact and lightweight", archived: false, addedDate: "2024-03-01T08:00:00", notes: "Sensor cleaning scheduled for March 2026" },
      { id: "CAM-006", barcode: "CRMLAB-2024-006", name: "Panasonic Lumix GH5", brand: "Panasonic", model: "Lumix GH5", serialNumber: "SN-PLG-006789", status: "borrowed", description: "20.3MP Micro Four Thirds, 4K 60fps video capability", archived: false, addedDate: "2024-03-01T08:00:00" },
      { id: "CAM-007", barcode: "CRMLAB-2024-007", name: "Fujifilm X-T4", brand: "Fujifilm", model: "X-T4", serialNumber: "SN-FXT-007890", status: "available", description: "26.1MP APS-C, 5-axis IBIS, cinematic 4K video", archived: false, addedDate: "2024-04-01T08:00:00" },
      { id: "CAM-008", barcode: "CRMLAB-2025-008", name: "Canon EOS R6 Mark II", brand: "Canon", model: "EOS R6 Mark II", serialNumber: "SN-CR6-008901", status: "available", description: "24.2MP full-frame mirrorless, 40fps burst, 6K RAW video", archived: false, addedDate: "2025-01-05T08:00:00" },
    ];
    const initialTransactions = [
      { id: "TRX-001", cameraId: "CAM-002", cameraName: "Sony Alpha A7 IV", cameraBarcode: "CRMLAB-2024-002", borrowerName: "Ana Reyes", borrowerIdNumber: "STU-2023-0451", department: "Multimedia Arts", borrowedAt: "2026-02-20T10:30:00", expectedReturnAt: "2026-02-28T17:00:00", approvedBy: "Maria Santos", status: "active", notes: "For thesis documentation project" },
      { id: "TRX-002", cameraId: "CAM-003", cameraName: "Nikon Z6 II", cameraBarcode: "CRMLAB-2024-003", borrowerName: "Carlos Mendoza", borrowerIdNumber: "STU-2023-0287", department: "Communication Arts", borrowedAt: "2026-02-15T09:00:00", expectedReturnAt: "2026-02-20T17:00:00", approvedBy: "Admin User", status: "overdue", notes: "Event coverage request" },
      { id: "TRX-003", cameraId: "CAM-006", cameraName: "Panasonic Lumix GH5", cameraBarcode: "CRMLAB-2024-006", borrowerName: "Liza Tan", borrowerIdNumber: "EMP-2021-0034", department: "Broadcast Media", borrowedAt: "2026-02-22T14:00:00", expectedReturnAt: "2026-03-01T17:00:00", approvedBy: "Maria Santos", status: "active", notes: "Semester project - short film production" },
      { id: "TRX-004", cameraId: "CAM-001", cameraName: "Canon EOS R5", cameraBarcode: "CRMLAB-2024-001", borrowerName: "Marco Villanueva", borrowerIdNumber: "STU-2022-0198", department: "Multimedia Arts", borrowedAt: "2026-02-10T08:00:00", expectedReturnAt: "2026-02-14T17:00:00", returnedAt: "2026-02-14T15:30:00", approvedBy: "Admin User", status: "returned", notes: "Product photography for marketing class" },
      { id: "TRX-005", cameraId: "CAM-004", cameraName: "Canon EOS 5D Mark IV", cameraBarcode: "CRMLAB-2024-004", borrowerName: "Sofia Aquino", borrowerIdNumber: "STU-2022-0345", department: "Photography", borrowedAt: "2026-02-05T09:30:00", expectedReturnAt: "2026-02-08T17:00:00", returnedAt: "2026-02-08T16:45:00", approvedBy: "John Rivera", status: "returned" },
      { id: "TRX-006", cameraId: "CAM-007", cameraName: "Fujifilm X-T4", cameraBarcode: "CRMLAB-2024-007", borrowerName: "Pedro Santos", borrowerIdNumber: "STU-2023-0512", department: "Visual Communication", borrowedAt: "2026-01-28T10:00:00", expectedReturnAt: "2026-02-01T17:00:00", returnedAt: "2026-02-01T14:20:00", approvedBy: "Maria Santos", status: "returned", notes: "Street photography project" },
      { id: "TRX-007", cameraId: "CAM-008", cameraName: "Canon EOS R6 Mark II", cameraBarcode: "CRMLAB-2025-008", borrowerName: "Ella Cruz", borrowerIdNumber: "STU-2024-0089", department: "Film and Television", borrowedAt: "2026-01-20T13:00:00", expectedReturnAt: "2026-01-25T17:00:00", returnedAt: "2026-01-25T17:00:00", approvedBy: "Admin User", status: "returned", notes: "Documentary class requirement" },
      { id: "TRX-008", cameraId: "CAM-001", cameraName: "Canon EOS R5", cameraBarcode: "CRMLAB-2024-001", borrowerName: "Ray Bautista", borrowerIdNumber: "EMP-2020-0012", department: "IT Department", borrowedAt: "2026-01-15T09:00:00", expectedReturnAt: "2026-01-18T17:00:00", returnedAt: "2026-01-18T16:00:00", approvedBy: "Admin User", status: "returned" },
    ];

    await Promise.all([
      ...initialUsers.map((u) => kv.set(`user:${u.id}`, u)),
      ...initialCameras.map((cam) => kv.set(`camera:${cam.id}`, cam)),
      ...initialTransactions.map((t) => kv.set(`transaction:${t.id}`, t)),
    ]);

    return c.json({ message: "Seeded successfully" });
  } catch (e) {
    console.log("Seed error:", e);
    return c.json({ error: "Seeding failed" }, 500);
  }
});

// ─── Forgot Password (generates temp password, shown on-screen – no email server) ──
app.post("/make-server-355b453c/forgot-password", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body ?? {};
    if (!email || typeof email !== "string") {
      return c.json({ error: "Email is required" }, 400);
    }

    const users = await kv.getByPrefix("user:");
    const user = users?.find(
      (u: any) => u.email?.toLowerCase() === String(email).toLowerCase(),
    );

    // Always return success to avoid leaking whether the email exists
    if (!user || !user.active) {
      return c.json({
        message: "If that email exists in the system, a temporary password has been generated.",
        tempPassword: null,
      });
    }

    // Generate a random 10-character alphanumeric temp password
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const tempPassword = Array.from(
      crypto.getRandomValues(new Uint8Array(10)),
      (b) => chars[b % chars.length],
    ).join("");

    const hashed = await hashPassword(tempPassword);
    await kv.set(`user:${user.id}`, { ...user, password: hashed, mustChangePassword: true });

    return c.json({
      message: "Temporary password generated successfully.",
      tempPassword,
      userName: user.name,
    });
  } catch (e) {
    console.log("Forgot password error:", e);
    return c.json({ error: "Failed to process request" }, 500);
  }
});

// ─── Reset Admin Password to Default ──────────────────────────────────────────
app.post("/make-server-355b453c/reset-admin-password", async (c) => {
  try {
    const body = await c.req.json();
    // Simple recovery secret to prevent unauthorized resets
    if (body?.resetKey !== "DNG-RESET-2026") {
      return c.json({ error: "Invalid reset key" }, 403);
    }

    const adminUser = await kv.get("user:USR-001");
    if (!adminUser) {
      return c.json({ error: "Admin user not found. Please ensure the system has been seeded." }, 404);
    }

    const defaultHash = await hashPassword("admin123");
    await kv.set("user:USR-001", {
      ...adminUser,
      password: defaultHash,
      active: true,
      mustChangePassword: false,
    });

    return c.json({ message: "Admin password has been reset to the default successfully." });
  } catch (e) {
    console.log("Reset admin password error:", e);
    return c.json({ error: "Failed to reset admin password" }, 500);
  }
});

// ─── Cameras ───────────────────────────────────────────────────────────────
app.get("/make-server-355b453c/cameras", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  try {
    return c.json((await kv.getByPrefix("camera:")) ?? []);
  } catch (e) {
    console.log("Error fetching cameras:", e);
    return c.json({ error: "Failed to fetch cameras" }, 500);
  }
});

app.post("/make-server-355b453c/cameras", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  try {
    const body = await c.req.json();
    const err = validateCameraInput(body);
    if (err) return c.json({ error: err }, 400);

    // Validate ID format and check uniqueness (prevent POST-as-overwrite)
    if (!body.id || !/^CAM-\d{3,}$/.test(body.id))
      return c.json({ error: "Invalid camera ID format" }, 400);
    const existing = await kv.get(`camera:${body.id}`);
    if (existing) return c.json({ error: "A camera with this ID already exists" }, 409);

    // Duplicate serial number check
    const all = (await kv.getByPrefix("camera:")) ?? [];
    if (all.some((cam: any) => cam.serialNumber === body.serialNumber))
      return c.json({ error: "A camera with this serial number already exists" }, 409);

    // Whitelist fields — never trust the client blindly
    const safe = {
      id: body.id,
      barcode: body.barcode,
      name: String(body.name).trim(),
      brand: String(body.brand).trim(),
      model: String(body.model).trim(),
      serialNumber: String(body.serialNumber).trim(),
      amrNumber: body.amrNumber ? String(body.amrNumber).trim() : "",
      status: VALID_CAMERA_STATUSES.includes(body.status) ? body.status : "available",
      description: body.description ? String(body.description).trim().slice(0, 500) : "",
      notes: body.notes ? String(body.notes).trim().slice(0, 1000) : "",
      archived: false,         // always false on creation
      addedDate: body.addedDate ?? new Date().toISOString(),
    };
    await kv.set(`camera:${safe.id}`, safe);
    return c.json(safe, 201);
  } catch (e) {
    console.log("Error creating camera:", e);
    return c.json({ error: "Failed to create camera" }, 500);
  }
});

app.put("/make-server-355b453c/cameras/:id", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const existing = await kv.get(`camera:${id}`);
    if (!existing) return c.json({ error: "Camera not found" }, 404);

    // Whitelist — only allow these fields to be updated
    const allowed = ["name", "brand", "model", "serialNumber", "amrNumber", "status", "description", "notes", "archived"] as const;
    const safe: Record<string, any> = {};
    for (const field of allowed) {
      if (field in updates) safe[field] = updates[field];
    }
    if (safe.status && !VALID_CAMERA_STATUSES.includes(safe.status))
      return c.json({ error: "Invalid status value" }, 400);
    if (typeof safe.archived !== "undefined") safe.archived = Boolean(safe.archived);

    const updated = { ...existing, ...safe };
    await kv.set(`camera:${id}`, updated);
    return c.json(updated);
  } catch (e) {
    console.log("Error updating camera:", e);
    return c.json({ error: "Failed to update camera" }, 500);
  }
});

app.delete("/make-server-355b453c/cameras/:id", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  // Server-side role check — not just hidden in the UI
  if (session.role !== "admin") return c.json({ error: "Forbidden: admin role required" }, 403);
  try {
    const id = c.req.param("id");
    const txns = (await kv.getByPrefix("transaction:")) ?? [];
    const hasActive = txns.some(
      (t: any) => t.cameraId === id && (t.status === "active" || t.status === "overdue"),
    );
    if (hasActive)
      return c.json({ error: "Cannot delete: camera has active or overdue transactions" }, 409);
    await kv.del(`camera:${id}`);
    return c.json({ success: true });
  } catch (e) {
    console.log("Error deleting camera:", e);
    return c.json({ error: "Failed to delete camera" }, 500);
  }
});

// ─── Transactions ──────────────────────────────────────────────────────────
app.get("/make-server-355b453c/transactions", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  try {
    return c.json((await kv.getByPrefix("transaction:")) ?? []);
  } catch (e) {
    console.log("Error fetching transactions:", e);
    return c.json({ error: "Failed to fetch transactions" }, 500);
  }
});

app.post("/make-server-355b453c/transactions", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  try {
    const body = await c.req.json();
    const required = ["id", "cameraId", "borrowerName", "borrowerIdNumber", "department", "expectedReturnAt", "approvedBy"];
    for (const f of required) {
      if (!body[f]) return c.json({ error: `Missing required field: ${f}` }, 400);
    }

    // Server-side double-borrow prevention
    const camera = await kv.get(`camera:${body.cameraId}`);
    if (!camera) return c.json({ error: "Camera not found" }, 404);
    if (camera.status !== "available")
      return c.json({ error: "Camera is not available for borrowing" }, 409);

    const allTxns = (await kv.getByPrefix("transaction:")) ?? [];
    const alreadyBorrowed = allTxns.some(
      (t: any) => t.cameraId === body.cameraId && (t.status === "active" || t.status === "overdue"),
    );
    if (alreadyBorrowed)
      return c.json({ error: "Camera already has an active borrow transaction" }, 409);

    if (new Date(body.expectedReturnAt) <= new Date())
      return c.json({ error: "Expected return date must be in the future" }, 400);

    // Whitelist fields
    const safe = {
      id: String(body.id),
      cameraId: String(body.cameraId),
      cameraName: String(body.cameraName ?? "").trim().slice(0, 200),
      cameraBarcode: String(body.cameraBarcode ?? "").trim().slice(0, 100),
      borrowerName: String(body.borrowerName).trim().slice(0, 200),
      borrowerIdNumber: String(body.borrowerIdNumber).trim().slice(0, 100),
      department: String(body.department).trim().slice(0, 200),
      borrowedAt: body.borrowedAt ?? new Date().toISOString(),
      expectedReturnAt: String(body.expectedReturnAt),
      approvedBy: String(body.approvedBy).trim().slice(0, 200),
      notes: body.notes ? String(body.notes).trim().slice(0, 1000) : "",
      status: "active",
    };

    await kv.set(`transaction:${safe.id}`, safe);
    await kv.set(`camera:${safe.cameraId}`, { ...camera, status: "borrowed" });
    return c.json(safe, 201);
  } catch (e) {
    console.log("Error creating transaction:", e);
    return c.json({ error: "Failed to create transaction" }, 500);
  }
});

app.put("/make-server-355b453c/transactions/:id", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const existing = await kv.get(`transaction:${id}`);
    if (!existing) return c.json({ error: "Transaction not found" }, 404);

    // Whitelist update fields — clients cannot change cameraId, borrowerName, etc.
    const safe: Record<string, any> = {};
    if ("status" in updates) {
      if (!VALID_TXN_STATUSES.includes(updates.status))
        return c.json({ error: "Invalid transaction status" }, 400);
      safe.status = updates.status;
    }
    if ("returnedAt" in updates) safe.returnedAt = updates.returnedAt;
    if ("notes" in updates) safe.notes = String(updates.notes ?? "").trim().slice(0, 1000);

    const updated = { ...existing, ...safe };
    await kv.set(`transaction:${id}`, updated);

    if (safe.status === "returned" && existing.cameraId) {
      const cam = await kv.get(`camera:${existing.cameraId}`);
      if (cam) await kv.set(`camera:${existing.cameraId}`, { ...cam, status: "available" });
    }
    return c.json(updated);
  } catch (e) {
    console.log("Error updating transaction:", e);
    return c.json({ error: "Failed to update transaction" }, 500);
  }
});

// ─── Users ─────────────────────────────────────────────────────────────────
app.get("/make-server-355b453c/users", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  try {
    const users = (await kv.getByPrefix("user:")) ?? [];
    // NEVER return password hashes to clients
    return c.json(users.map(stripPassword));
  } catch (e) {
    console.log("Error fetching users:", e);
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

app.post("/make-server-355b453c/users", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  if (session.role !== "admin") return c.json({ error: "Forbidden: admin role required" }, 403);
  try {
    const body = await c.req.json();
    const err = validateUserInput(body, true);
    if (err) return c.json({ error: err }, 400);

    const allUsers = (await kv.getByPrefix("user:")) ?? [];
    if (allUsers.some((u: any) => u.email?.toLowerCase() === body.email.toLowerCase()))
      return c.json({ error: "Email address already in use" }, 409);

    const hashedPw = await hashPassword(String(body.password));
    const safe = {
      id: String(body.id),
      name: String(body.name).trim(),
      email: String(body.email).toLowerCase().trim(),
      password: hashedPw,
      role: VALID_USER_ROLES.includes(body.role) ? body.role : "staff",
      department: body.department ? String(body.department).trim().slice(0, 200) : "",
      active: body.active !== undefined ? Boolean(body.active) : true,
      createdAt: body.createdAt ?? new Date().toISOString(),
    };
    await kv.set(`user:${safe.id}`, safe);
    return c.json(stripPassword(safe), 201);
  } catch (e) {
    console.log("Error creating user:", e);
    return c.json({ error: "Failed to create user" }, 500);
  }
});

app.put("/make-server-355b453c/users/:id", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  if (session.role !== "admin") return c.json({ error: "Forbidden: admin role required" }, 403);
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const existing = await kv.get(`user:${id}`);
    if (!existing) return c.json({ error: "User not found" }, 404);

    const safe: Record<string, any> = {};
    if ("name" in updates) safe.name = String(updates.name).trim().slice(0, 100);
    if ("email" in updates) {
      const newEmail = String(updates.email).toLowerCase().trim();
      const allUsers = (await kv.getByPrefix("user:")) ?? [];
      const conflict = allUsers.some((u: any) => u.email?.toLowerCase() === newEmail && u.id !== id);
      if (conflict) return c.json({ error: "Email address already in use" }, 409);
      safe.email = newEmail;
    }
    if ("password" in updates && updates.password) {
      if (String(updates.password).length < 8)
        return c.json({ error: "Password must be at least 8 characters" }, 400);
      safe.password = await hashPassword(String(updates.password));
    }
    if ("role" in updates) {
      if (!VALID_USER_ROLES.includes(updates.role))
        return c.json({ error: "Invalid role" }, 400);
      safe.role = updates.role;
    }
    if ("department" in updates) safe.department = String(updates.department ?? "").trim().slice(0, 200);
    if ("active" in updates) safe.active = Boolean(updates.active);

    const updated = { ...existing, ...safe };
    await kv.set(`user:${id}`, updated);
    return c.json(stripPassword(updated));
  } catch (e) {
    console.log("Error updating user:", e);
    return c.json({ error: "Failed to update user" }, 500);
  }
});

Deno.serve(app.fetch);