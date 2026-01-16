import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@/app/generated/prisma";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Email from "next-auth/providers/email";

// Create a dedicated prisma client for auth to avoid import issues
const prisma = new PrismaClient();

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "ADMIN" | "ADVISOR";
      image?: string | null;
    };
  }
}

// Custom email sending using SendGrid HTTP API
async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  provider: { from?: string };
}) {
  const { identifier: email, url, provider } = params;
  const fromEmail = provider.from || process.env.FROM_EMAIL || "noreply@inspired.mortgage";
  const sendgridApiKey = process.env.SENDGRID_API_KEY;

  if (!sendgridApiKey) {
    throw new Error("SENDGRID_API_KEY is not configured");
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #FBF3E7;">
        <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <h1 style="font-size: 24px; color: #1C1B1A; margin: 0 0 8px 0; text-align: center;">
            <span style="font-style: italic;">inspired </span>mortgage.
          </h1>
          <p style="color: #55514D; text-align: center; margin: 0 0 32px 0;">Sign in to your account</p>

          <a href="${url}" style="display: block; background-color: #625FFF; color: white; text-decoration: none; padding: 14px 24px; border-radius: 12px; text-align: center; font-weight: 500; margin-bottom: 24px;">
            Sign in to LOD
          </a>

          <p style="color: #8E8983; font-size: 14px; text-align: center; margin: 0;">
            This link expires in 24 hours and can only be used once.
          </p>
        </div>
      </body>
    </html>
  `;

  const textContent = `Sign in to Inspired Mortgage\n\nClick here to sign in: ${url}\n\nThis link expires in 24 hours and can only be used once.`;

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sendgridApiKey}`,
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email }],
          subject: "Sign in to Inspired Mortgage",
        },
      ],
      from: { email: fromEmail, name: "Inspired Mortgage" },
      content: [
        { type: "text/plain", value: textContent },
        { type: "text/html", value: htmlContent },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send verification email: ${error}`);
  }
}

const config: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Email({
      from: process.env.FROM_EMAIL || "noreply@inspired.mortgage",
      maxAge: 24 * 60 * 60, // 24 hours
      sendVerificationRequest,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow sign in if user exists in our User table and is active
      if (!user.email) {
        return false;
      }

      // Case-insensitive email lookup
      const dbUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: user.email,
            mode: "insensitive",
          },
        },
      });

      return dbUser?.isActive ?? false;
    },
    async jwt({ token, user }) {
      // On initial sign-in, look up user data and add to token
      if (user?.email) {
        const dbUser = await prisma.user.findFirst({
          where: {
            email: {
              equals: user.email,
              mode: "insensitive",
            },
          },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Add user data from JWT token to session
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "ADVISOR";
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/login/verify",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
};

export const { handlers, signIn, signOut, auth } = NextAuth(config);
