import Link from "next/link";

export function ThankYouCard() {
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center">
      {/* Checkmark icon */}
      <div className="mb-8 flex size-20 items-center justify-center rounded-full bg-gray-100">
        <div className="flex size-14 items-center justify-center rounded-full bg-[#ffbf00]">
          <svg
            className="size-7 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h1 className="max-w-lg text-4xl font-extrabold leading-tight tracking-tight text-ws-text-heading md:text-5xl">
        Thank You!
        <br />
        Your demo request has been received.
      </h1>

      {/* Description */}
      <p className="mt-4 max-w-md text-lg text-ws-text-body">
        We will reach out to you ASAP to schedule your personalized
        walkthrough.
      </p>

      {/* Return to Home button */}
      <Link
        href="/"
        className="mt-10 inline-flex items-center justify-center rounded-lg bg-[#ffbf00] px-10 py-4 text-lg font-bold text-white transition-colors hover:bg-[#e6ac00]"
      >
        Return to Home
      </Link>
    </div>
  );
}
