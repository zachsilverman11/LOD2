"use server";

import { verifyCredentials, createSession } from "@/lib/auth-simple";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "Username and password are required" };
  }

  const isValid = await verifyCredentials(username, password);

  if (!isValid) {
    return { error: "Invalid username or password" };
  }

  // Create session
  await createSession(username);

  // Redirect to dashboard
  redirect("/dashboard");
}
