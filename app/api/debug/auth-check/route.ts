import { NextResponse } from "next/server";

// Temporary debug endpoint - DELETE after fixing auth
export async function GET() {
  const checks = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    AUTH_SECRET_length: process.env.AUTH_SECRET?.length || 0,
    SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
    AUTH_SENDGRID_KEY: !!process.env.AUTH_SENDGRID_KEY,
    FROM_EMAIL: process.env.FROM_EMAIL || "not set",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "not set",
    AUTH_URL: process.env.AUTH_URL || "not set",
    DATABASE_URL: !!process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  return NextResponse.json(checks);
}
