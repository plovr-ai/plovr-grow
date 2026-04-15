# AI Playground 语音点餐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/playground` page with dual-panel layout — left side shows restaurant menu, right side is a phone simulator for live AI voice ordering via Pipecat SDK.

**Architecture:** Server component fetches menu data from existing `menuService`, passes to client layout. Client-side `PhoneSimulator` manages Pipecat RTVIClient lifecycle (connect → audio stream → transcript events → disconnect). No API proxy — frontend connects directly to plovr-phone-ai backend.

**Tech Stack:** Next.js 16 App Router, Pipecat JS SDK (`@pipecat-ai/client-js`, `@pipecat-ai/websocket-transport`), Tailwind CSS, `formatPrice` utility.

---

### Task 1: Install Pipecat SDK dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
npm install @pipecat-ai/client-js @pipecat-ai/websocket-transport
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
node -e "require('@pipecat-ai/client-js'); require('@pipecat-ai/websocket-transport'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
git add package.json package-lock.json
git commit -m "chore: add pipecat SDK dependencies (#262)"
```

---

### Task 2: Add environment variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add playground env vars to `.env.example`**

Append after the Sentry section (after line 57):

```
# AI Playground (Voice Ordering Demo)
NEXT_PUBLIC_PHONE_AI_API_URL=http://localhost:8000
NEXT_PUBLIC_PLAYGROUND_TENANT_ID=
NEXT_PUBLIC_PLAYGROUND_MERCHANT_ID=
```

- [ ] **Step 2: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
git add .env.example
git commit -m "chore: add AI Playground env vars to .env.example (#262)"
```

---

### Task 3: Create Pipecat client types and wrapper

**Files:**
- Create: `src/lib/pipecat/types.ts`
- Create: `src/lib/pipecat/client.ts`
- Create: `src/lib/pipecat/index.ts`

- [ ] **Step 1: Create types**

Create `src/lib/pipecat/types.ts`:

```typescript
export const CALL_STATUS = {
  IDLE: "idle",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
} as const;

export type CallStatus = (typeof CALL_STATUS)[keyof typeof CALL_STATUS];

export interface ConversationMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: Date;
}

export interface PlaygroundConfig {
  apiUrl: string;
  tenantId: string;
  merchantId: string;
}
```

- [ ] **Step 2: Create client wrapper**

Create `src/lib/pipecat/client.ts`:

```typescript
import { RTVIClient } from "@pipecat-ai/client-js";
import { WebSocketTransport } from "@pipecat-ai/websocket-transport";
import type { PlaygroundConfig, ConversationMessage } from "./types";

interface PipecatCallbacks {
  onStatusChange: (status: "connecting" | "connected" | "disconnected") => void;
  onMessage: (message: ConversationMessage) => void;
  onError: (error: string) => void;
}

let messageCounter = 0;

function createMessageId(): string {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
}

export async function startCall(
  config: PlaygroundConfig,
  callbacks: PipecatCallbacks
): Promise<RTVIClient> {
  callbacks.onStatusChange("connecting");

  // 1. Get WebSocket URL from plovr-phone-ai
  const response = await fetch(
    `${config.apiUrl}/api/ai/admin/playground/put-config`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: config.tenantId,
        org_id: config.merchantId,
        agents: [],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create call session: ${errorText}`);
  }

  const { ws_url } = (await response.json()) as { ws_url: string };

  // 2. Create transport and client
  const transport = new WebSocketTransport({ url: ws_url });
  const client = new RTVIClient({ transport });

  // 3. Wire up event listeners
  client.on("connected", () => {
    callbacks.onStatusChange("connected");
  });

  client.on("disconnected", () => {
    callbacks.onStatusChange("disconnected");
  });

  client.on("transcript", (data: { text: string }) => {
    if (data.text.trim()) {
      callbacks.onMessage({
        id: createMessageId(),
        role: "user",
        text: data.text,
        timestamp: new Date(),
      });
    }
  });

  client.on("botText", (data: { text: string }) => {
    if (data.text.trim()) {
      callbacks.onMessage({
        id: createMessageId(),
        role: "bot",
        text: data.text,
        timestamp: new Date(),
      });
    }
  });

  client.on("error", (error: Error) => {
    callbacks.onError(error.message);
  });

  // 4. Connect
  await client.connect();

  return client;
}

export async function endCall(client: RTVIClient): Promise<void> {
  await client.disconnect();
}
```

- [ ] **Step 3: Create index barrel**

Create `src/lib/pipecat/index.ts`:

```typescript
export { startCall, endCall } from "./client";
export { CALL_STATUS } from "./types";
export type { CallStatus, ConversationMessage, PlaygroundConfig } from "./types";
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
npx tsc --noEmit
```

Expected: No errors (or only pre-existing ones).

- [ ] **Step 5: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
git add src/lib/pipecat/
git commit -m "feat: add Pipecat SDK client wrapper (#262)"
```

---

### Task 4: Create MenuPanel component (read-only menu display)

**Files:**
- Create: `src/app/(website)/playground/components/MenuPanel.tsx`

**Context:** This is a simplified, read-only version of the storefront menu. It runs inside the `(website)` route group which has NO `MerchantProvider` context, so use `formatPrice` from `@/lib/utils` directly (defaults to USD/en-US). No cart, no modifiers, no "Add" buttons.

- [ ] **Step 1: Create MenuPanel**

Create `src/app/(website)/playground/components/MenuPanel.tsx`:

```tsx
import Image from "next/image";
import { formatPrice } from "@/lib/utils";
import type { MenuCategoryWithItems } from "@/services/menu/menu.types";

interface MenuPanelProps {
  categories: MenuCategoryWithItems[];
  currency?: string;
}

export function MenuPanel({ categories, currency = "USD" }: MenuPanelProps) {
  if (categories.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <p>No menu items available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-gray-900">Menu</h2>
      {categories.map((category) => (
        <section key={category.id}>
          <h3 className="mb-3 text-lg font-semibold text-gray-900">
            {category.name}
          </h3>
          {category.description && (
            <p className="mb-3 text-sm text-gray-500">{category.description}</p>
          )}
          <div className="space-y-2">
            {category.menuItems.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3"
              >
                {item.imageUrl && (
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {item.name}
                    </h4>
                    <span className="whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatPrice(Number(item.price), currency)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
git add src/app/\(website\)/playground/
git commit -m "feat: add read-only MenuPanel for playground (#262)"
```

---

### Task 5: Create ConversationLog component

**Files:**
- Create: `src/app/(website)/playground/components/ConversationLog.tsx`

- [ ] **Step 1: Create ConversationLog**

Create `src/app/(website)/playground/components/ConversationLog.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ConversationMessage } from "@/lib/pipecat";

interface ConversationLogProps {
  messages: ConversationMessage[];
  isConnected: boolean;
}

export function ConversationLog({ messages, isConnected }: ConversationLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {messages.length === 0 && isConnected && (
        <p className="text-center text-xs text-gray-400">
          Start speaking to begin the conversation...
        </p>
      )}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              msg.role === "user"
                ? "rounded-tr-sm bg-gray-800 text-white"
                : "rounded-tl-sm bg-gray-100 text-gray-900"
            }`}
          >
            {msg.text}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
git add src/app/\(website\)/playground/components/ConversationLog.tsx
git commit -m "feat: add ConversationLog component (#262)"
```

---

### Task 6: Create CallControls component

**Files:**
- Create: `src/app/(website)/playground/components/CallControls.tsx`

- [ ] **Step 1: Create CallControls**

Create `src/app/(website)/playground/components/CallControls.tsx`:

```tsx
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

// Inline SVG icons — avoids adding an icon library dependency

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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
git add src/app/\(website\)/playground/components/CallControls.tsx
git commit -m "feat: add CallControls component (#262)"
```

---

### Task 7: Create PhoneSimulator component

**Files:**
- Create: `src/app/(website)/playground/components/PhoneSimulator.tsx`

**Context:** This is the main client component that orchestrates the Pipecat client, call state machine, and renders the phone UI. It contains the `RTVIClient` ref and manages all call lifecycle.

- [ ] **Step 1: Create PhoneSimulator**

Create `src/app/(website)/playground/components/PhoneSimulator.tsx`:

```tsx
"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import type { RTVIClient } from "@pipecat-ai/client-js";
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
  const clientRef = useRef<RTVIClient | null>(null);
  const [status, setStatus] = useState<CallStatus>(CALL_STATUS.IDLE);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Call duration timer
  useEffect(() => {
    if (status === CALL_STATUS.CONNECTED) {
      setElapsed(0);
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

    if (!config.apiUrl || !config.tenantId || !config.merchantId) {
      setError("Playground environment variables not configured");
      return;
    }

    try {
      const client = await startCall(config, {
        onStatusChange: (s) => setStatus(s),
        onMessage: (msg) => setMessages((prev) => [...prev, msg]),
        onError: (err) => setError(err),
      });
      clientRef.current = client;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call");
      setStatus(CALL_STATUS.DISCONNECTED);
    }
  }, []);

  const handleEnd = useCallback(async () => {
    if (clientRef.current) {
      await endCall(clientRef.current);
      clientRef.current = null;
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    if (clientRef.current && status === CALL_STATUS.CONNECTED) {
      const next = !isMuted;
      // RTVIClient exposes enableMic / enableMicrophone depending on version
      if (next) {
        clientRef.current.enableMic?.(false);
      } else {
        clientRef.current.enableMic?.(true);
      }
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
              <svg className="size-4 text-gray-900" viewBox="0 0 27 30" fill="currentColor">
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
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
git add src/app/\(website\)/playground/components/PhoneSimulator.tsx
git commit -m "feat: add PhoneSimulator component with call state machine (#262)"
```

---

### Task 8: Create PlaygroundLayout and page

**Files:**
- Create: `src/app/(website)/playground/components/PlaygroundLayout.tsx`
- Create: `src/app/(website)/playground/page.tsx`
- Create: `src/app/(website)/playground/components/index.ts`

**Context:** The page is a server component that fetches menu data. `PlaygroundLayout` handles the dual-column responsive layout. The `PhoneSimulator` is a client component rendered inside the layout.

- [ ] **Step 1: Create barrel export**

Create `src/app/(website)/playground/components/index.ts`:

```typescript
export { MenuPanel } from "./MenuPanel";
export { PhoneSimulator } from "./PhoneSimulator";
export { PlaygroundLayout } from "./PlaygroundLayout";
```

- [ ] **Step 2: Create PlaygroundLayout**

Create `src/app/(website)/playground/components/PlaygroundLayout.tsx`:

```tsx
import type { ReactNode } from "react";

interface PlaygroundLayoutProps {
  menuPanel: ReactNode;
  phoneSimulator: ReactNode;
}

export function PlaygroundLayout({
  menuPanel,
  phoneSimulator,
}: PlaygroundLayoutProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          AI Voice Ordering Playground
        </h1>
        <p className="mt-2 text-gray-500">
          Try our AI voice agent — browse the menu and start a call to order by voice.
        </p>
      </div>
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Menu panel — scrollable on desktop */}
        <div className="order-2 lg:order-1 lg:w-1/2">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50/50 p-6">
            {menuPanel}
          </div>
        </div>
        {/* Phone simulator — centered */}
        <div className="order-1 lg:order-2 lg:w-1/2">
          <div className="sticky top-24">
            {phoneSimulator}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create page**

Create `src/app/(website)/playground/page.tsx`:

```tsx
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { menuService } from "@/services/menu";
import { MenuPanel, PhoneSimulator, PlaygroundLayout } from "./components";

export const metadata: Metadata = {
  title: `AI Voice Ordering Playground | ${siteConfig.name}`,
  description:
    "Try our AI voice agent — browse the menu and order by voice in real time.",
  openGraph: {
    title: `AI Voice Ordering Playground | ${siteConfig.name}`,
    description:
      "Try our AI voice agent — browse the menu and order by voice in real time.",
    url: `${siteConfig.url}/playground`,
    siteName: siteConfig.name,
    images: [{ url: siteConfig.ogImage }],
    locale: siteConfig.locale,
    type: "website",
  },
};

export default async function PlaygroundPage() {
  const tenantId = process.env.NEXT_PUBLIC_PLAYGROUND_TENANT_ID ?? "";
  const merchantId = process.env.NEXT_PUBLIC_PLAYGROUND_MERCHANT_ID ?? "";

  let categories: Awaited<ReturnType<typeof menuService.getMenu>>["categories"] = [];
  let currency = "USD";

  if (tenantId && merchantId) {
    try {
      const response = await menuService.getMenu(tenantId, merchantId);
      categories = response.categories;
      // Try to get currency from tenant if available
    } catch {
      // Menu fetch failed — show empty menu panel
    }
  }

  return (
    <PlaygroundLayout
      menuPanel={<MenuPanel categories={categories} currency={currency} />}
      phoneSimulator={<PhoneSimulator />}
    />
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
git add src/app/\(website\)/playground/
git commit -m "feat: add Playground page with dual-panel layout (#262)"
```

---

### Task 9: Update CallDemoCard CTA to link to playground

**Files:**
- Modify: `src/components/website/sections/CallDemoCard.tsx:206-207`

- [ ] **Step 1: Update CTA href**

In `src/components/website/sections/CallDemoCard.tsx`, change line 206-207:

```tsx
// Before:
<a
  href={siteConfig.cta.secondary.href}

// After:
<a
  href="/playground"
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
git add src/components/website/sections/CallDemoCard.tsx
git commit -m "feat: link CallDemoCard CTA to playground page (#262)"
```

---

### Task 10: Visual verification and polish

**Files:** None new — this is a manual verification step.

- [ ] **Step 1: Start dev server**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
npm run dev
```

- [ ] **Step 2: Verify playground page renders**

Open `http://localhost:3000/playground` in browser. Check:
- Page loads without errors
- Dual-panel layout displays correctly
- Menu panel shows categories and items (if env vars are configured)
- Phone simulator renders with "Start Call" button
- Responsive: resize to mobile width — layout switches to single column

- [ ] **Step 3: Verify CallDemoCard link**

Open `http://localhost:3000` and click the "Try It Yourself — Call Now" button. Verify it navigates to `/playground`.

- [ ] **Step 4: Fix any visual issues found**

Address any layout/styling issues discovered during manual testing.

- [ ] **Step 5: Run lint**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
npm run lint
```

Fix any lint errors.

- [ ] **Step 6: Final commit (if any fixes)**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-262
git add -A
git commit -m "fix: polish playground page layout and fix lint (#262)"
```
