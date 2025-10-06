"use client";

import { authenticate } from "./actions";
import { useFormState, useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#625FFF] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#4F4DCC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Signing in..." : "Sign In"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(authenticate, undefined);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBF3E7] via-[#B1AFFF]/20 to-[#F6D7FF]/30 flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-[#E4DDD3] p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-[#1C1B1A] mb-2">
            <span className="italic text-[#625FFF]">inspired</span>{" "}
            <span className="font-bold">mortgage.</span>
          </h1>
          <p className="text-[#55514D]">Dashboard Login</p>
        </div>

        <form action={formAction} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-[#1C1B1A] mb-2">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className="w-full px-4 py-3 border border-[#E4DDD3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#625FFF] focus:border-transparent"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#1C1B1A] mb-2">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="w-full px-4 py-3 border border-[#E4DDD3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#625FFF] focus:border-transparent"
              required
            />
          </div>

          {state?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {state.error}
            </div>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
