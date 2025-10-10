import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBF3E7] via-[#B1AFFF]/20 to-[#F6D7FF]/30 p-8 flex flex-col items-center justify-center">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-5xl font-extrabold text-[#1C1B1A] mb-4">
          <span className="italic text-[#625FFF]">inspired</span> <span className="font-bold">mortgage.</span>
        </h1>
        <p className="text-[#55514D] text-xl mb-12">AI-powered lead conversion system for Canadian mortgage advisors</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/dashboard"
            className="bg-[#625FFF] text-white px-8 py-6 rounded-lg hover:bg-[#4E4BCC] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <div className="text-2xl font-bold mb-2">Lead Dashboard</div>
            <div className="text-sm opacity-90">Track leads through your pipeline</div>
          </Link>

          <Link
            href="/dev-board"
            className="bg-white text-[#625FFF] border-2 border-[#625FFF] px-8 py-6 rounded-lg hover:bg-[#625FFF] hover:text-white transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <div className="text-2xl font-bold mb-2">Dev Board</div>
            <div className="text-sm opacity-90">Feature requests & bug tracking</div>
          </Link>

          <Link
            href="/dashboard/analytics"
            className="bg-white text-[#55514D] border border-[#E4DDD3] px-8 py-6 rounded-lg hover:border-[#625FFF] hover:text-[#625FFF] transition-all shadow-md hover:shadow-lg transform hover:-translate-y-1"
          >
            <div className="text-2xl font-bold mb-2">Analytics</div>
            <div className="text-sm opacity-90">Performance metrics & insights</div>
          </Link>

          <Link
            href="/login"
            className="bg-white text-[#55514D] border border-[#E4DDD3] px-8 py-6 rounded-lg hover:border-[#625FFF] hover:text-[#625FFF] transition-all shadow-md hover:shadow-lg transform hover:-translate-y-1"
          >
            <div className="text-2xl font-bold mb-2">Login</div>
            <div className="text-sm opacity-90">Access your account</div>
          </Link>
        </div>

        <div className="mt-12 text-[#55514D] text-sm">
          <p>Powered by Holly AI • Built for Inspired Mortgage</p>
        </div>
      </div>
    </div>
  );
}
