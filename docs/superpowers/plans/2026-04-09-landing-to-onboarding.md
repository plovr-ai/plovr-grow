# Landing Page to Onboarding Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert trial users (from landing page website generator) into paid users via a floating claim bar, enhanced claim modal, and a claim success page.

**Architecture:** Enhance existing `TrialBanner` → floating bottom `ClaimBar`, upgrade `ClaimModal` with Zod validation + auto-login + redirect to new success page, update claim API to return `companySlug`. All changes are in the storefront and platform route groups.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Zod, NextAuth, Prisma, Vitest

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Replace | `src/app/(storefront)/components/trial/TrialBanner.tsx` → rename to `ClaimBar.tsx` | Floating bottom bar with marketing CTA, dismissible via sessionStorage |
| Rewrite | `src/app/(storefront)/components/trial/ClaimModal.tsx` | Enhanced modal with confirm password, Zod validation, auto signIn, redirect to success page |
| Keep | `src/app/(storefront)/components/trial/TrialCheckoutBlock.tsx` | Update import from TrialBanner to ClaimBar |
| Modify | `src/app/(storefront)/[companySlug]/layout.tsx` | Replace TrialBanner with ClaimBar, pass companySlug |
| Modify | `src/app/(storefront)/r/[merchantSlug]/layout.tsx` | Replace TrialBanner with ClaimBar, pass companySlug |
| Modify | `src/app/api/auth/claim/route.ts` | Return companySlug in response |
| Modify | `src/lib/validations/auth.ts` | Add claimSchema with confirmPassword |
| Create | `src/app/(platform)/claim/success/page.tsx` | Claim success page with CTA to dashboard |
| Modify | `src/app/api/auth/__tests__/claim.route.test.ts` | Update tests for new response shape |
| Create | `src/app/(storefront)/components/trial/__tests__/ClaimBar.test.tsx` | Unit tests for ClaimBar |
| Create | `src/app/(storefront)/components/trial/__tests__/ClaimModal.test.tsx` | Unit tests for ClaimModal |

---

### Task 1: Update claim API to return companySlug

**Files:**
- Modify: `src/app/api/auth/claim/route.ts:60-62`
- Modify: `src/app/api/auth/__tests__/claim.route.test.ts`

- [ ] **Step 1: Update test to expect companySlug in response**

In `src/app/api/auth/__tests__/claim.route.test.ts`, update the success test case:

```typescript
// In "claims a trial tenant and creates owner user" test, change:
expect(data.success).toBe(true);
// to:
expect(data).toEqual({ success: true, companySlug: "test-slug" });
```

Also update the mock to include company slug:

```typescript
vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
  id: "tenant1", subscriptionStatus: "trial", company: { id: "company1", slug: "test-slug" },
} as never);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-20 && npx vitest run src/app/api/auth/__tests__/claim.route.test.ts`

Expected: FAIL — response doesn't include `companySlug`

- [ ] **Step 3: Update claim route to return companySlug**

In `src/app/api/auth/claim/route.ts`, change line 62:

```typescript
// Before:
return NextResponse.json({ success: true }, { status: 200 });

// After:
return NextResponse.json({ success: true, companySlug: tenant.company?.slug }, { status: 200 });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-20 && npx vitest run src/app/api/auth/__tests__/claim.route.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-20
git add src/app/api/auth/claim/route.ts src/app/api/auth/__tests__/claim.route.test.ts
git commit -m "feat(claim): return companySlug in claim API response (#20)"
```

---

### Task 2: Add claimSchema validation to shared validations

**Files:**
- Modify: `src/lib/validations/auth.ts`

- [ ] **Step 1: Add claimSchema to auth validations**

Append to `src/lib/validations/auth.ts`:

```typescript
// Claim schema (for claiming trial websites)
export const claimSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be less than 100 characters"),
    email: z.string().email("Please enter a valid email"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ClaimInput = z.infer<typeof claimSchema>;
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-20 && npx tsc --noEmit`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-20
git add src/lib/validations/auth.ts
git commit -m "feat(claim): add claimSchema with confirmPassword validation (#20)"
```

---

### Task 3: Replace TrialBanner with ClaimBar (floating bottom bar)

**Files:**
- Replace: `src/app/(storefront)/components/trial/TrialBanner.tsx` → `src/app/(storefront)/components/trial/ClaimBar.tsx`
- Modify: `src/app/(storefront)/components/trial/TrialCheckoutBlock.tsx`
- Modify: `src/app/(storefront)/[companySlug]/layout.tsx`
- Modify: `src/app/(storefront)/r/[merchantSlug]/layout.tsx`

- [ ] **Step 1: Create ClaimBar component**

Create `src/app/(storefront)/components/trial/ClaimBar.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { ClaimModal } from "./ClaimModal";

const DISMISS_KEY = "plovr-claim-bar-dismissed";

interface ClaimBarProps {
  tenantId: string;
  companySlug: string;
}

export function ClaimBar({ tenantId, companySlug }: ClaimBarProps) {
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-theme-primary text-theme-primary-foreground py-3 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <p className="text-sm sm:text-base font-medium">
            <span className="hidden sm:inline">This is your restaurant? Claim your free website now!</span>
            <span className="sm:hidden">Claim your free website!</span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="bg-white text-theme-primary font-semibold px-4 py-1.5 rounded-md text-sm hover:bg-gray-100 transition-colors"
            >
              Claim Now &rarr;
            </button>
            <button
              onClick={handleDismiss}
              className="text-theme-primary-foreground/70 hover:text-theme-primary-foreground p-1"
              aria-label="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <ClaimModal tenantId={tenantId} companySlug={companySlug} isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
```

- [ ] **Step 2: Delete old TrialBanner.tsx**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-20
rm src/app/\(storefront\)/components/trial/TrialBanner.tsx
```

- [ ] **Step 3: Update TrialCheckoutBlock import**

In `src/app/(storefront)/components/trial/TrialCheckoutBlock.tsx`, the component imports `ClaimModal` directly (not `TrialBanner`), so no changes needed here.

- [ ] **Step 4: Update companySlug layout to use ClaimBar**

In `src/app/(storefront)/[companySlug]/layout.tsx`:

```typescript
// Change import:
// Before:
import { TrialBanner } from "@storefront/components/trial/TrialBanner";
// After:
import { ClaimBar } from "@storefront/components/trial/ClaimBar";

// Change JSX (inside ThemeProvider):
// Before:
{isTrial && <TrialBanner tenantId={company.tenantId} />}
// After:
{isTrial && <ClaimBar tenantId={company.tenantId} companySlug={company.slug} />}
```

- [ ] **Step 5: Update merchantSlug layout to use ClaimBar**

In `src/app/(storefront)/r/[merchantSlug]/layout.tsx`:

```typescript
// Change import:
// Before:
import { TrialBanner } from "@storefront/components/trial/TrialBanner";
// After:
import { ClaimBar } from "@storefront/components/trial/ClaimBar";

// Change JSX (inside ThemeProvider):
// Before:
{isTrial && tenantId && <TrialBanner tenantId={tenantId} />}
// After:
{isTrial && tenantId && <ClaimBar tenantId={tenantId} companySlug={merchant?.company?.slug ?? ""} />}
```

- [ ] **Step 6: Run type check**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-20 && npx tsc --noEmit`

Expected: PASS (may fail due to ClaimModal props change — that's fine, fixed in next task)

- [ ] **Step 7: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-20
git add -A
git commit -m "feat(claim): replace TrialBanner with floating ClaimBar (#20)"
```

---

### Task 4: Enhance ClaimModal with validation, auto-login, and redirect

**Files:**
- Rewrite: `src/app/(storefront)/components/trial/ClaimModal.tsx`

- [ ] **Step 1: Rewrite ClaimModal**

Replace `src/app/(storefront)/components/trial/ClaimModal.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { claimSchema, type ClaimInput } from "@/lib/validations/auth";

interface ClaimModalProps {
  tenantId: string;
  companySlug: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ClaimModal({ tenantId, companySlug, isOpen, onClose }: ClaimModalProps) {
  const router = useRouter();
  const [form, setForm] = useState<ClaimInput>({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ClaimInput, string>>>({});
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field: keyof ClaimInput, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side validation
    const result = claimSchema.safeParse(form);
    if (!result.success) {
      const errors: Partial<Record<keyof ClaimInput, string>> = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof ClaimInput;
        errors[field] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Failed to claim website");
        return;
      }

      // Auto sign in
      const signInRes = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (signInRes?.error) {
        // Claim succeeded but sign-in failed — redirect to login
        router.push("/dashboard/login");
        return;
      }

      // Redirect to success page
      router.push(`/claim/success?company=${encodeURIComponent(companySlug)}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-bold mb-1">Claim Your Restaurant Website</h2>
        <p className="text-gray-600 mb-6 text-sm">
          Create your account to manage your website
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-theme-primary focus:border-transparent"
              value={form.name} onChange={(e) => handleChange("name", e.target.value)} disabled={loading} />
            {fieldErrors.name && <p className="text-red-600 text-xs mt-1">{fieldErrors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-theme-primary focus:border-transparent"
              value={form.email} onChange={(e) => handleChange("email", e.target.value)} disabled={loading} />
            {fieldErrors.email && <p className="text-red-600 text-xs mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-theme-primary focus:border-transparent"
              placeholder="At least 8 characters"
              value={form.password} onChange={(e) => handleChange("password", e.target.value)} disabled={loading} />
            {fieldErrors.password && <p className="text-red-600 text-xs mt-1">{fieldErrors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-theme-primary focus:border-transparent"
              value={form.confirmPassword} onChange={(e) => handleChange("confirmPassword", e.target.value)} disabled={loading} />
            {fieldErrors.confirmPassword && <p className="text-red-600 text-xs mt-1">{fieldErrors.confirmPassword}</p>}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-theme-primary text-theme-primary-foreground rounded-md hover:bg-theme-primary-hover disabled:opacity-50">
              {loading ? "Creating..." : "Claim Website"}
            </button>
          </div>

          <p className="text-xs text-center text-gray-500">
            Already have an account?{" "}
            <a href="/dashboard/login" className="text-theme-primary hover:underline">Log in</a>
          </p>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-20 && npx tsc --noEmit`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-20
git add src/app/\(storefront\)/components/trial/ClaimModal.tsx
git commit -m "feat(claim): enhance ClaimModal with validation, auto-login, and redirect (#20)"
```

---

### Task 5: Create claim success page

**Files:**
- Create: `src/app/(platform)/claim/success/page.tsx`

- [ ] **Step 1: Create the success page**

Create `src/app/(platform)/claim/success/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface PageProps {
  searchParams: Promise<{ company?: string }>;
}

export default async function ClaimSuccessPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/dashboard/login");
  }

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
            href="/dashboard"
            className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Set Up Your Restaurant &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-20 && npx tsc --noEmit`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-20
git add src/app/\(platform\)/claim/success/page.tsx
git commit -m "feat(claim): add claim success page (#20)"
```

---

### Task 6: Add unit tests for ClaimBar

**Files:**
- Create: `src/app/(storefront)/components/trial/__tests__/ClaimBar.test.tsx`

- [ ] **Step 1: Write ClaimBar tests**

Create `src/app/(storefront)/components/trial/__tests__/ClaimBar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClaimBar } from "../ClaimBar";

// Mock ClaimModal to avoid testing its internals here
vi.mock("../ClaimModal", () => ({
  ClaimModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="claim-modal">Modal</div> : null,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockSessionStorage: Record<string, string> = {};

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
  Object.defineProperty(window, "sessionStorage", {
    value: {
      getItem: (key: string) => mockSessionStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockSessionStorage[key] = value; },
      removeItem: (key: string) => { delete mockSessionStorage[key]; },
    },
    writable: true,
  });
});

describe("ClaimBar", () => {
  it("renders the claim bar with marketing copy", () => {
    render(<ClaimBar tenantId="t1" companySlug="joes-pizza" />);
    expect(screen.getByText("Claim your free website!")).toBeInTheDocument();
    expect(screen.getByText("Claim Now →")).toBeInTheDocument();
  });

  it("opens ClaimModal when Claim Now is clicked", () => {
    render(<ClaimBar tenantId="t1" companySlug="joes-pizza" />);
    expect(screen.queryByTestId("claim-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Claim Now →"));
    expect(screen.getByTestId("claim-modal")).toBeInTheDocument();
  });

  it("hides bar when dismiss button is clicked", () => {
    render(<ClaimBar tenantId="t1" companySlug="joes-pizza" />);
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("Claim Now →")).not.toBeInTheDocument();
    expect(mockSessionStorage["plovr-claim-bar-dismissed"]).toBe("true");
  });

  it("stays hidden when previously dismissed in session", () => {
    mockSessionStorage["plovr-claim-bar-dismissed"] = "true";
    render(<ClaimBar tenantId="t1" companySlug="joes-pizza" />);
    expect(screen.queryByText("Claim Now →")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-20 && npx vitest run src/app/\(storefront\)/components/trial/__tests__/ClaimBar.test.tsx`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-20
git add src/app/\(storefront\)/components/trial/__tests__/ClaimBar.test.tsx
git commit -m "test(claim): add ClaimBar unit tests (#20)"
```

---

### Task 7: Add unit tests for ClaimModal

**Files:**
- Create: `src/app/(storefront)/components/trial/__tests__/ClaimModal.test.tsx`

- [ ] **Step 1: Write ClaimModal tests**

Create `src/app/(storefront)/components/trial/__tests__/ClaimModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClaimModal } from "../ClaimModal";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

const mockSignIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

function fillForm(overrides: Record<string, string> = {}) {
  const defaults = {
    Name: "John Doe",
    Email: "john@test.com",
    Password: "SecurePass1",
    "Confirm Password": "SecurePass1",
  };
  const values = { ...defaults, ...overrides };
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

describe("ClaimModal", () => {
  const defaultProps = {
    tenantId: "t1",
    companySlug: "joes-pizza",
    isOpen: true,
    onClose: vi.fn(),
  };

  it("does not render when isOpen is false", () => {
    render(<ClaimModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Claim Your Restaurant Website")).not.toBeInTheDocument();
  });

  it("renders form fields when open", () => {
    render(<ClaimModal {...defaultProps} />);
    expect(screen.getByText("Claim Your Restaurant Website")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
  });

  it("shows validation error when passwords don't match", async () => {
    render(<ClaimModal {...defaultProps} />);
    fillForm({ "Confirm Password": "DifferentPass1" });
    fireEvent.click(screen.getByText("Claim Website"));
    await waitFor(() => {
      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });
  });

  it("calls claim API and redirects on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve({ success: true, companySlug: "joes-pizza" }),
    } as Response);
    mockSignIn.mockResolvedValue({ error: null });

    render(<ClaimModal {...defaultProps} />);
    fillForm();
    fireEvent.click(screen.getByText("Claim Website"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/claim", expect.objectContaining({
        method: "POST",
      }));
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "john@test.com", password: "SecurePass1", redirect: false,
      });
      expect(mockPush).toHaveBeenCalledWith("/claim/success?company=joes-pizza");
    });
  });

  it("shows server error message on claim failure", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: "Email already exists" }),
    } as Response);

    render(<ClaimModal {...defaultProps} />);
    fillForm();
    fireEvent.click(screen.getByText("Claim Website"));

    await waitFor(() => {
      expect(screen.getByText("Email already exists")).toBeInTheDocument();
    });
  });

  it("redirects to login when sign-in fails after claim", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve({ success: true, companySlug: "joes-pizza" }),
    } as Response);
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });

    render(<ClaimModal {...defaultProps} />);
    fillForm();
    fireEvent.click(screen.getByText("Claim Website"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/login");
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-20 && npx vitest run src/app/\(storefront\)/components/trial/__tests__/ClaimModal.test.tsx`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-20
git add src/app/\(storefront\)/components/trial/__tests__/ClaimModal.test.tsx
git commit -m "test(claim): add ClaimModal unit tests (#20)"
```

---

### Task 8: Run full test suite and lint

- [ ] **Step 1: Run lint**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-20 && npm run lint`

Expected: PASS

- [ ] **Step 2: Run type check**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-20 && npx tsc --noEmit`

Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-20 && npm run test:run`

Expected: All tests PASS

- [ ] **Step 4: Fix any failures and commit**

If any failures, fix them, then:

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-20
git add -A
git commit -m "fix: resolve lint/test issues for claim flow (#20)"
```
