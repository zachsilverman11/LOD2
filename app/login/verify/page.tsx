export default function VerifyRequestPage() {
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
          A sign-in link has been sent to your email address.
        </p>
        <p className="text-sm text-[#8E8983] mt-4">
          Click the link in your email to sign in.
        </p>
      </div>
    </div>
  );
}
