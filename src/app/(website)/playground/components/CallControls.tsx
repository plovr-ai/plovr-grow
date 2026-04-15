"use client";

import type { CallStatus } from "@/lib/pipecat";

interface CallControlsProps {
  status: CallStatus;
  isMuted: boolean;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
}

export function CallControls({
  status,
  isMuted,
  onStart,
  onEnd,
  onToggleMute,
}: CallControlsProps) {
  if (status === "idle" || status === "disconnected") {
    return (
      <div className="flex items-center justify-center px-4 py-4">
        <button
          onClick={onStart}
          className="flex items-center gap-2 rounded-full bg-green-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-green-600 active:scale-95"
        >
          <PhoneIcon className="size-4" />
          {status === "disconnected" ? "Call Again" : "Start Call"}
        </button>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="flex items-center justify-center px-4 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="size-2 animate-pulse rounded-full bg-yellow-400" />
          Connecting...
        </div>
      </div>
    );
  }

  // connected
  return (
    <div className="flex items-center justify-center gap-6 px-4 py-4">
      <button
        onClick={onToggleMute}
        className={`flex size-12 items-center justify-center rounded-full transition-all active:scale-95 ${
          isMuted
            ? "bg-red-100 text-red-600"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
      </button>
      <button
        onClick={onEnd}
        className="flex size-14 items-center justify-center rounded-full bg-red-500 text-white transition-all hover:bg-red-600 active:scale-95"
        title="End call"
      >
        <PhoneEndIcon className="size-5" />
      </button>
    </div>
  );
}

// Inline SVG icons

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.58.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.58 1 1 0 01-.25 1.01l-2.2 2.2z" />
    </svg>
  );
}

function PhoneEndIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.59 10.52c1.05-.51 2.04-1.15 2.96-1.91.18-.16.29-.38.29-.63V4.5a.5.5 0 00-.8-.4c-2.07 1.45-4.46 2.42-7.04 2.74V3.5a.5.5 0 00-.5-.5h-3a.5.5 0 00-.5.5v3.34C7.63 6.52 5.24 5.55 3.17 4.1a.5.5 0 00-.8.4v3.48c0 .25.11.47.29.63.92.76 1.91 1.4 2.96 1.91C3.22 11.67 1.5 13.38 1.5 15.5v1a.5.5 0 00.5.5h20a.5.5 0 00.5-.5v-1c0-2.12-1.72-3.83-3.91-4.98z" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-4 7.93A7.001 7.001 0 0019 12h-2a5 5 0 01-10 0H5a7.001 7.001 0 006 6.93V22h2v-3.07z" />
    </svg>
  );
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 11a7 7 0 01-9.9 6.34l1.45-1.45A5 5 0 0017 11h2zm-2 0a5 5 0 01-5-5V4.07l5 5V11zM4.27 3L3 4.27l6 6V11a3 3 0 004.52 2.59l1.46 1.46A4.98 4.98 0 0112 16a5 5 0 01-5-5H5a7.001 7.001 0 006 6.93V21h2v-3.07c1.03-.13 2-.49 2.85-1.02l3.88 3.88L21 19.73 4.27 3z" />
    </svg>
  );
}
