"use client";

import { loginAction } from "./actions";
import { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const result = await loginAction(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // If successful, redirect happens in server action
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBF3E7] via-[#B1AFFF]/20 to-[#F6D7FF]/30 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md border border-[#E4DDD3]">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-[#1C1B1A] mb-2">
            <span className="italic text-[#625FFF]">inspired</span>{" "}
            <span className="font-bold">mortgage.</span>
          </h1>
          <p className="text-[#55514D]">Lead Conversion Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-[#1C1B1A] mb-2"
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              required
              autoComplete="username"
              className="w-full px-4 py-2 border border-[#E4DDD3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#625FFF] focus:border-transparent"
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[#1C1B1A] mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full px-4 py-2 border border-[#E4DDD3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#625FFF] focus:border-transparent"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#625FFF] text-white py-3 rounded-lg font-semibold hover:bg-[#625FFF]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
