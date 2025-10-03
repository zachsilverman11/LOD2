import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">Lead Conversion System</h1>
      <p className="text-gray-600 mb-8">Mortgage lead conversion dashboard for Canadian advisors</p>
      <Link
        href="/dashboard"
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go to Dashboard →
      </Link>
    </div>
  );
}
