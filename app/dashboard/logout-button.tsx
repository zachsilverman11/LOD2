"use client";

import { destroySession } from "@/lib/auth-simple";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await destroySession();
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 text-sm text-[#55514D] border border-[#E4DDD3] rounded-md hover:bg-[#FBF3E7] transition-colors"
    >
      Logout
    </button>
  );
}
