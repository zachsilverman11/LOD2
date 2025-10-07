"use client";

import { logoutAction } from "./actions";

export function LogoutButton() {
  return (
    <button
      onClick={() => logoutAction()}
      className="px-4 py-2 text-sm text-[#55514D] border border-[#E4DDD3] rounded-md hover:bg-[#FBF3E7] transition-colors"
    >
      Logout
    </button>
  );
}
