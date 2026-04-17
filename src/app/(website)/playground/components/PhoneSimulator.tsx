"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import type { PipecatClient } from "@pipecat-ai/client-js";
import {
  startCall,
  endCall,
  CALL_STATUS,
  type CallStatus,
  type ConversationMessage,
  type PlaygroundConfig,
} from "@/lib/pipecat";
import { ConversationLog } from "./ConversationLog";
import { CallControls } from "./CallControls";

const config: PlaygroundConfig = {
  apiUrl: process.env.NEXT_PUBLIC_PHONE_AI_API_URL ?? "",
  tenantId: process.env.NEXT_PUBLIC_PLAYGROUND_TENANT_ID ?? "",
  merchantId: process.env.NEXT_PUBLIC_PLAYGROUND_MERCHANT_ID ?? "",
};

export function PhoneSimulator() {
  const clientRef = useRef<PipecatClient | null>(null);
  const [status, setStatus] = useState<CallStatus>(CALL_STATUS.IDLE);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [interimText, setInterimText] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Call duration timer
  useEffect(() => {
    if (status === CALL_STATUS.CONNECTED) {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStart = useCallback(async () => {
    setError(null);
    setMessages([]);
    setElapsed(0);

    if (!config.apiUrl || !config.tenantId || !config.merchantId) {
      setError("Playground environment variables not configured");
      return;
    }

    try {
      const client = await startCall(config, {
        onStatusChange: (s) => setStatus(s),
        onMessage: (msg) => setMessages((prev) => [...prev, msg]),
        onInterimTranscript: (text) => setInterimText(text),
        onError: (err) => setError(err),
      });
      clientRef.current = client;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call");
      setStatus(CALL_STATUS.DISCONNECTED);
    }
  }, []);

  const handleEnd = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      setStatus(CALL_STATUS.DISCONNECTED);
      return;
    }
    clientRef.current = null;
    try {
      await endCall(client);
    } catch {
      // disconnect may throw if media/WebSocket already closed —
      // force disconnect at transport level as fallback
      try {
        client.transport.disconnect();
      } catch {
        // ignore
      }
    }
    setStatus(CALL_STATUS.DISCONNECTED);
  }, []);

  const handleToggleMute = useCallback(() => {
    if (clientRef.current && status === CALL_STATUS.CONNECTED) {
      const next = !isMuted;
      clientRef.current.enableMic(!next);
      setIsMuted(next);
    }
  }, [isMuted, status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="flex items-center justify-center">
      {/* Phone frame */}
      <div className="flex h-[680px] w-[340px] flex-col overflow-hidden rounded-[3rem] border-[6px] border-gray-800 bg-white shadow-2xl">
        {/* Status bar */}
        <div className="flex items-center justify-between bg-gray-900 px-6 pb-3 pt-4 text-white">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-[#ffbf00]">
              <svg
                className="size-4 text-gray-900"
                viewBox="0 0 27 30"
                fill="currentColor"
              >
                <path d="M26.28 21.09l-5.72-2.86a1.71 1.71 0 00-2 .5l-2.53 3.09a13.24 13.24 0 01-6.33-6.33l3.09-2.53a1.7 1.7 0 00.5-2L10.43.24A1.72 1.72 0 008.47.05L1.33 1.48A1.71 1.71 0 000 3.14 25.72 25.72 0 0025.71 28.86a1.71 1.71 0 001.67-1.33l1.43-7.14a1.73 1.73 0 00-.53-1.9z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Ava</p>
              <p className="text-[10px] text-gray-400">AI Voice Agent</p>
            </div>
          </div>
          <div className="text-right">
            {status === CALL_STATUS.CONNECTED && (
              <>
                <div className="flex items-center gap-1">
                  <span className="size-1.5 animate-pulse rounded-full bg-green-400" />
                  <span className="text-[10px] text-green-400">Live</span>
                </div>
                <p className="text-xs tabular-nums text-gray-400">
                  {formatTime(elapsed)}
                </p>
              </>
            )}
            {status === CALL_STATUS.DISCONNECTED && (
              <span className="text-[10px] text-gray-500">Call Ended</span>
            )}
          </div>
        </div>

        {/* Conversation area */}
        <ConversationLog
          messages={messages}
          interimText={interimText}
          isConnected={status === CALL_STATUS.CONNECTED}
        />

        {/* Error display */}
        {error && (
          <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="border-t border-gray-100">
          <CallControls
            status={status}
            isMuted={isMuted}
            onStart={handleStart}
            onEnd={handleEnd}
            onToggleMute={handleToggleMute}
          />
        </div>
      </div>
    </div>
  );
}
