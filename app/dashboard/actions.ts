"use server";

import { destroySession } from "@/lib/auth-simple";
import { redirect } from "next/navigation";

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
