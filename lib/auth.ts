import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const adminUsername = process.env.ADMIN_USERNAME || "admin";
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
          throw new Error("ADMIN_PASSWORD not configured");
        }

        if (
          credentials.username === adminUsername &&
          credentials.password === adminPassword
        ) {
          return {
            id: "admin",
            name: "Admin",
            email: "admin@inspiredmortgage.ca",
          };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: async ({ auth }) => {
      return !!auth;
    },
  },
});
