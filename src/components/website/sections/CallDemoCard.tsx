"use client";

import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/config/site";

interface CallDemoCardProps {
  compact?: boolean;
}

const CONVERSATION = [
  {
    sender: "ava" as const,
    text: "Hi! Welcome to the restaurant. What can I get for you today?",
  },
  {
    sender: "customer" as const,
    text: "I'd like a large pepperoni pizza and a Coke please",
  },
  {
    sender: "ava" as const,
    text: "Great choice! That'll be $18.99. Pickup or delivery?",
  },
];

export function CallDemoCard({ compact = false }: CallDemoCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || hasAnimated) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimated(true);
          observer.disconnect();

          // Stagger bubble appearance
          let count = 0;
          const showNext = () => {
            if (count < CONVERSATION.length) {
              // If the next message is from Ava (not the first), show typing first
              if (count > 0 && CONVERSATION[count].sender === "ava") {
                setShowTyping(true);
                setTimeout(() => {
                  setShowTyping(false);
                  count++;
                  setVisibleCount(count);
                  setTimeout(showNext, 800);
                }, 1200);
              } else {
                count++;
                setVisibleCount(count);
                setTimeout(showNext, 800);
              }
            }
          };
          // Start after a short delay
          setTimeout(showNext, 400);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasAnimated]);

  const avatarSize = compact ? "size-10" : "size-12";
  const iconSize = compact ? "size-4" : "size-5";
  const padding = compact ? "p-5" : "p-6 md:p-8";
  const rounded = compact ? "rounded-3xl" : "rounded-3xl md:rounded-[36px]";
  const gap = compact ? "gap-4" : "gap-5";
  const nameSize = compact
    ? "text-base font-extrabold"
    : "text-lg font-extrabold";
  const maxWidth = compact ? "max-w-xl" : "w-full max-w-3xl";

  return (
    <div
      ref={containerRef}
      className={`relative ${maxWidth} ${rounded} bg-white/70 ${padding} shadow-[0px_10px_40px_0px_rgba(255,191,0,0.12)] backdrop-blur-sm`}
    >
      {/* Phone ring animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes phoneRing {
              0%, 100% { transform: rotate(0deg); }
              5% { transform: rotate(15deg); }
              10% { transform: rotate(-13deg); }
              15% { transform: rotate(12deg); }
              20% { transform: rotate(-10deg); }
              25% { transform: rotate(6deg); }
              30% { transform: rotate(0deg); }
            }
            .phone-ring { animation: phoneRing 2.5s ease-in-out infinite; transform-origin: 50% 50%; }
          `,
        }}
      />

      {/* Border overlay */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${rounded} border border-[rgba(225,212,191,0.3)]`}
      />

      <div className={`relative flex flex-col ${gap}`}>
        {/* Header: Agent identity */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-[rgba(255,191,0,0.3)]" />
            <div
              className={`relative flex ${avatarSize} items-center justify-center rounded-full border border-[rgba(255,191,0,0.2)] bg-white shadow-xl`}
            >
              <svg
                className={`${iconSize} text-[#ffbf00]`}
                viewBox="0 0 27 30"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M26.28 21.09l-5.72-2.86a1.71 1.71 0 00-2 .5l-2.53 3.09a13.24 13.24 0 01-6.33-6.33l3.09-2.53a1.7 1.7 0 00.5-2L10.43.24A1.72 1.72 0 008.47.05L1.33 1.48A1.71 1.71 0 000 3.14 25.72 25.72 0 0025.71 28.86a1.71 1.71 0 001.67-1.33l1.43-7.14a1.73 1.73 0 00-.53-1.9z" />
              </svg>
            </div>
          </div>
          <div>
            <h3
              className={`${nameSize} tracking-tight text-ws-text-heading leading-tight`}
            >
              Ava
            </h3>
            <p className="text-xs font-medium text-ws-text-body opacity-70">
              AI Voice Agent
            </p>
          </div>
          {/* LIVE indicator */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-green-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">
              Live
            </span>
          </div>
        </div>

        {/* Conversation bubbles */}
        <div className="flex flex-col gap-3">
          {CONVERSATION.map((msg, i) => {
            const isVisible = i < visibleCount;
            const isAva = msg.sender === "ava";

            return (
              <div
                key={i}
                className={`flex ${isAva ? "justify-start" : "justify-end"} transition-all duration-500 ${
                  isVisible
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-3 opacity-0"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isAva
                      ? "rounded-tl-sm bg-gray-100 text-ws-text-heading"
                      : "rounded-tr-sm bg-[#1c1b1b] text-white"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {showTyping && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3">
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                  @keyframes typingBounce {
                    0%, 60%, 100% { transform: translateY(0); }
                    30% { transform: translateY(-4px); }
                  }
                  .typing-dot { animation: typingBounce 1.4s ease-in-out infinite; }
                  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
                  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
                `,
                  }}
                />
                <span className="typing-dot size-1.5 rounded-full bg-gray-400" />
                <span className="typing-dot size-1.5 rounded-full bg-gray-400" />
                <span className="typing-dot size-1.5 rounded-full bg-gray-400" />
              </div>
            </div>
          )}
        </div>

        {/* CTA Button */}
        <a
          href="/playground"
          className="mt-1 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#ffbf00] px-6 py-3.5 font-bold text-[#1c1b1b] shadow-md transition-all hover:shadow-lg hover:brightness-105"
        >
          <svg
            className="phone-ring size-4"
            viewBox="0 0 18.4 18.4"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M17.45 13.52L13.1 11.34a1.16 1.16 0 00-1.34.34L10.08 13.74a8.87 8.87 0 01-4.23-4.23l2.06-1.69a1.14 1.14 0 00.34-1.34L6.07.13A1.15 1.15 0 004.73.01L.9.99A1.15 1.15 0 000 2.13 16.27 16.27 0 0016.27 18.4a1.15 1.15 0 001.14-.9l.98-3.83a1.16 1.16 0 00-.94-1.15z" />
          </svg>
          Try It Yourself — Call Now
        </a>
      </div>
    </div>
  );
}
