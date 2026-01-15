"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("sendgrid", {
        email,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setError("This email is not authorized. Contact your administrator.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBF3E7]">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#625FFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-[#625FFF]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[#1C1B1A] mb-2">
            Check your email
          </h1>
          <p className="text-[#55514D]">
            We sent a sign-in link to{" "}
            <strong className="text-[#1C1B1A]">{email}</strong>
          </p>
          <p className="text-sm text-[#8E8983] mt-4">
            Click the link in your email to sign in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF3E7]">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#1C1B1A]">
            <span className="italic">inspired </span>mortgage.
          </h1>
          <p className="text-[#55514D] mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-[#55514D] mb-2">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@inspired.mortgage"
            className="w-full p-3 border border-[#E5E0D8] rounded-xl focus:border-[#625FFF] focus:ring-2 focus:ring-[#B1AFFF] focus:outline-none mb-4 text-[#1C1B1A]"
            required
            disabled={isLoading}
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm mb-4">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send sign-in link"}
          </Button>
        </form>

        <p className="text-center text-xs text-[#8E8983] mt-6">
          Only authorized team members can sign in. v2
        </p>
      </div>
    </div>
  );
}
