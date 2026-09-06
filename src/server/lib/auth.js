import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { unauthorized, badRequest } from "./errors.js";
import { ensureSubscription } from "../services/subscriptionService.js";

const COOKIE = "pm_session";
const SESSION_DAYS = 30;

function hashToken(token) {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET || "podmind-dev").update(token).digest("hex");
}

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl, preferences: u.preferences || {}, createdAt: u.createdAt };
}

export async function registerUser({ email, password, name }) {
  email = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("Please enter a valid email address.");
  if (!password || password.length < 8) throw badRequest("Password must be at least 8 characters.");
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) throw badRequest("An account with this email already exists.", "EMAIL_TAKEN");
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: (name || email.split("@")[0]).trim().slice(0, 80) })
    .returning();
  await ensureSubscription(user.id);
  return user;
}

export async function authenticate({ email, password }) {
  email = String(email || "").trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw badRequest("Invalid email or password.", "INVALID_CREDENTIALS");
  const ok = await bcrypt.compare(password || "", user.passwordHash);
  if (!ok) throw badRequest("Invalid email or password.", "INVALID_CREDENTIALS");
  return user;
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user || null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}
