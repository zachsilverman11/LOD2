/**
 * Simple cookie-based authentication
 * No external libraries, just Next.js built-in features
 */

import { cookies } from "next/headers";

const SESSION_COOKIE = "lod2_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

/**
 * Simple hash function (SHA-256)
 * In production, you'd use bcrypt, but for simplicity we'll use a basic hash
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify login credentials
 */
export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const validUsername = process.env.AUTH_USERNAME || "admin";
  const validPasswordHash = process.env.AUTH_PASSWORD_HASH;

  if (!validPasswordHash) {
    console.error("AUTH_PASSWORD_HASH not set in environment");
    return false;
  }

  // Check username
  if (username !== validUsername) {
    return false;
  }

  // Check password
  const passwordHash = await hashPassword(password);
  return passwordHash === validPasswordHash;
}

/**
 * Create a session (set cookie)
 */
export async function createSession(username: string) {
  const cookieStore = await cookies();
  const sessionData = {
    username,
    createdAt: Date.now(),
  };

  cookieStore.set(SESSION_COOKIE, JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie) {
    return false;
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    const age = Date.now() - sessionData.createdAt;

    // Check if session has expired
    if (age > SESSION_MAX_AGE * 1000) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get current session data
 */
export async function getSession(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie) {
    return null;
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    return { username: sessionData.username };
  } catch {
    return null;
  }
}

/**
 * Destroy session (logout)
 */
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Helper to generate password hash for env var
 * Run this once to generate the hash for your password
 */
export async function generatePasswordHash(password: string): Promise<string> {
  return hashPassword(password);
}
