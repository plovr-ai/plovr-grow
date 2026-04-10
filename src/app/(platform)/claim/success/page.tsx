import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ company?: string }>;
}

export default async function ClaimSuccessPage({ searchParams }: PageProps) {
  const { company: companySlug } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2">Congratulations!</h1>
        <p className="text-gray-600 mb-6">Your website is now active.</p>

        {companySlug && (
          <a
            href={`/${companySlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-blue-600 hover:underline mb-8 text-sm"
          >
            View your website &rarr;
          </a>
        )}

        <div className="block">
          <Link
            href="/dashboard/login"
            className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Set Up Your Restaurant &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
