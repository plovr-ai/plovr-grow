# Square POS Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Square POS integration (core framework + OAuth + catalog sync) from Java allinone service to TypeScript.

**Architecture:** Generic integration infrastructure (IntegrationConnection, ExternalIdMapping, IntegrationSyncRecord) with Square-specific services using the official Square SDK. Follows existing project patterns: singleton services, repository layer, AppError + error codes.

**Tech Stack:** TypeScript, Prisma ORM, Square SDK (`square` npm), Next.js App Router, Zod, crypto (Node.js built-in)

**Spec:** `docs/superpowers/specs/2026-04-08-square-integration-design.md`

---

### Task 1: Prisma Schema — Add Integration Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add IntegrationConnection model**

Append after the `Lead` model (line 918) in `prisma/schema.prisma`:

```prisma
model IntegrationConnection {
  id                 String    @id
  tenantId           String    @map("tenant_id")
  merchantId         String    @map("merchant_id")
  type               String    // "POS_SQUARE", "LISTING_GBP"
  category           String    // "POS", "LISTING"
  status             String    @default("active")
  externalAccountId  String?   @map("external_account_id")
  externalLocationId String?   @map("external_location_id")
  accessToken        String?   @map("access_token") @db.Text
  refreshToken       String?   @map("refresh_token") @db.Text
  tokenExpiresAt     DateTime? @map("token_expires_at")
  scopes             String?
  deleted            Boolean   @default(false)
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  merchant    Merchant @relation(fields: [merchantId], references: [id])
  syncRecords IntegrationSyncRecord[]

  @@unique([tenantId, merchantId, type])
  @@index([tenantId])
  @@index([merchantId])
  @@map("integration_connections")
}

model ExternalIdMapping {
  id             String   @id
  tenantId       String   @map("tenant_id")
  internalType   String   @map("internal_type")
  internalId     String   @map("internal_id")
  externalSource String   @map("external_source")
  externalType   String   @map("external_type")
  externalId     String   @map("external_id")
  deleted        Boolean  @default(false)
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, externalSource, externalId])
  @@index([tenantId])
  @@index([internalType, internalId])
  @@map("external_id_mappings")
}

model IntegrationSyncRecord {
  id            String    @id
  tenantId      String    @map("tenant_id")
  connectionId  String    @map("connection_id")
  syncType      String    @map("sync_type")
  status        String    // "running", "success", "failed"
  objectsSynced Int       @default(0) @map("objects_synced")
  objectsMapped Int       @default(0) @map("objects_mapped")
  cursor        String?
  errorMessage  String?   @map("error_message") @db.Text
  startedAt     DateTime  @map("started_at")
  finishedAt    DateTime? @map("finished_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  tenant     Tenant                @relation(fields: [tenantId], references: [id])
  connection IntegrationConnection @relation(fields: [connectionId], references: [id])

  @@index([tenantId])
  @@index([connectionId])
  @@map("integration_sync_records")
}
```

- [ ] **Step 2: Add relations to Tenant and Merchant models**

Add to the `Tenant` model (after the existing relation fields):

```prisma
  integrationConnections IntegrationConnection[]
  externalIdMappings     ExternalIdMapping[]
  integrationSyncRecords IntegrationSyncRecord[]
```

Add to the `Merchant` model (after the existing relation fields):

```prisma
  integrationConnections IntegrationConnection[]
```

- [ ] **Step 3: Generate Prisma client and push schema**

Run:
```bash
npm run db:generate
npm run db:push
```

Expected: Prisma client regenerated, schema synced to database.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add integration Prisma models (IntegrationConnection, ExternalIdMapping, IntegrationSyncRecord) #3"
```

---

### Task 2: Error Codes & i18n Messages

**Files:**
- Modify: `src/lib/errors/error-codes.ts`
- Modify: `src/messages/shared/en.json`

- [ ] **Step 1: Add error codes**

Add these entries to the `ErrorCodes` object in `src/lib/errors/error-codes.ts`, before the `// Generic errors` section:

```typescript
  // Integration errors
  INTEGRATION_NOT_CONNECTED: "INTEGRATION_NOT_CONNECTED",
  INTEGRATION_TOKEN_EXPIRED: "INTEGRATION_TOKEN_EXPIRED",
  INTEGRATION_OAUTH_STATE_INVALID: "INTEGRATION_OAUTH_STATE_INVALID",
  SQUARE_CATALOG_SYNC_FAILED: "SQUARE_CATALOG_SYNC_FAILED",
  SQUARE_SYNC_ALREADY_RUNNING: "SQUARE_SYNC_ALREADY_RUNNING",
  SQUARE_NOT_CONFIGURED: "SQUARE_NOT_CONFIGURED",
```

- [ ] **Step 2: Add i18n messages**

Add these entries to the `errors` object in `src/messages/shared/en.json`:

```json
    "INTEGRATION_NOT_CONNECTED": "No integration connection found",
    "INTEGRATION_TOKEN_EXPIRED": "Integration token expired and could not be refreshed",
    "INTEGRATION_OAUTH_STATE_INVALID": "Invalid OAuth state parameter",
    "SQUARE_CATALOG_SYNC_FAILED": "Failed to sync catalog from Square",
    "SQUARE_SYNC_ALREADY_RUNNING": "A catalog sync is already in progress",
    "SQUARE_NOT_CONFIGURED": "Square integration is not configured",
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/errors/error-codes.ts src/messages/shared/en.json
git commit -m "feat: add integration error codes and i18n messages #3"
```

---

### Task 3: Install Square SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install square package**

Run:
```bash
npm install square
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add square SDK dependency #3"
```

---

### Task 4: Integration Repository

**Files:**
- Create: `src/repositories/integration.repository.ts`
- Test: `src/repositories/__tests__/integration.repository.test.ts`

- [ ] **Step 1: Write failing tests for IntegrationRepository**

Create `src/repositories/__tests__/integration.repository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    integrationConnection: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    externalIdMapping: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    integrationSyncRecord: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return { default: mockPrisma };
});

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(() => "test-id-123"),
}));

import prisma from "@/lib/db";
import { IntegrationRepository } from "../integration.repository";

const mockPrisma = vi.mocked(prisma);

describe("IntegrationRepository", () => {
  let repo: IntegrationRepository;

  beforeEach(() => {
    repo = new IntegrationRepository();
    vi.clearAllMocks();
  });

  describe("getConnection", () => {
    it("should find connection by tenantId, merchantId, and type", async () => {
      const mockConnection = {
        id: "conn-1",
        tenantId: "t1",
        merchantId: "m1",
        type: "POS_SQUARE",
        status: "active",
      };
      mockPrisma.integrationConnection.findUnique.mockResolvedValue(
        mockConnection as never
      );

      const result = await repo.getConnection("t1", "m1", "POS_SQUARE");

      expect(
        mockPrisma.integrationConnection.findUnique
      ).toHaveBeenCalledWith({
        where: {
          tenantId_merchantId_type: {
            tenantId: "t1",
            merchantId: "m1",
            type: "POS_SQUARE",
          },
          deleted: false,
        },
      });
      expect(result).toEqual(mockConnection);
    });
  });

  describe("upsertConnection", () => {
    it("should create a new connection", async () => {
      const input = {
        type: "POS_SQUARE",
        category: "POS",
        externalAccountId: "sq-merchant-1",
        accessToken: "token-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date("2026-05-08"),
        scopes: "ITEMS_READ",
      };
      mockPrisma.integrationConnection.upsert =
        vi.fn().mockResolvedValue({ id: "test-id-123", ...input }) as never;

      await repo.upsertConnection("t1", "m1", input);

      expect(mockPrisma.integrationConnection.upsert).toHaveBeenCalled();
    });
  });

  describe("createSyncRecord", () => {
    it("should create a sync record with running status", async () => {
      mockPrisma.integrationSyncRecord.create.mockResolvedValue({
        id: "test-id-123",
        status: "running",
      } as never);

      const result = await repo.createSyncRecord("t1", "conn-1", "CATALOG_FULL");

      expect(
        mockPrisma.integrationSyncRecord.create
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "test-id-123",
          tenantId: "t1",
          connectionId: "conn-1",
          syncType: "CATALOG_FULL",
          status: "running",
        }),
      });
      expect(result).toEqual(
        expect.objectContaining({ status: "running" })
      );
    });
  });

  describe("getRunningSync", () => {
    it("should find running sync record", async () => {
      mockPrisma.integrationSyncRecord.findFirst.mockResolvedValue({
        id: "sync-1",
        status: "running",
      } as never);

      const result = await repo.getRunningSync("conn-1");

      expect(
        mockPrisma.integrationSyncRecord.findFirst
      ).toHaveBeenCalledWith({
        where: {
          connectionId: "conn-1",
          status: "running",
          startedAt: { gte: expect.any(Date) },
        },
      });
      expect(result).toBeTruthy();
    });
  });

  describe("upsertIdMapping", () => {
    it("should upsert an external ID mapping", async () => {
      const mapping = {
        internalType: "MenuItem",
        internalId: "item-1",
        externalSource: "SQUARE",
        externalType: "ITEM",
        externalId: "sq-item-1",
      };
      mockPrisma.externalIdMapping.upsert.mockResolvedValue({
        id: "test-id-123",
        ...mapping,
      } as never);

      await repo.upsertIdMapping("t1", mapping);

      expect(mockPrisma.externalIdMapping.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_externalSource_externalId: {
            tenantId: "t1",
            externalSource: "SQUARE",
            externalId: "sq-item-1",
          },
        },
        create: expect.objectContaining({
          id: "test-id-123",
          tenantId: "t1",
          ...mapping,
        }),
        update: expect.objectContaining({
          internalType: "MenuItem",
          internalId: "item-1",
          externalType: "ITEM",
        }),
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/repositories/__tests__/integration.repository.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement IntegrationRepository**

Create `src/repositories/integration.repository.ts`:

```typescript
import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export interface UpsertConnectionInput {
  type: string;
  category: string;
  externalAccountId?: string;
  externalLocationId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes?: string;
}

export interface UpdateTokensInput {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}

export interface UpsertIdMappingInput {
  internalType: string;
  internalId: string;
  externalSource: string;
  externalType: string;
  externalId: string;
}

const SYNC_STALE_MINUTES = 10;

export class IntegrationRepository {
  async getConnection(tenantId: string, merchantId: string, type: string) {
    return prisma.integrationConnection.findUnique({
      where: {
        tenantId_merchantId_type: { tenantId, merchantId, type },
        deleted: false,
      },
    });
  }

  async upsertConnection(
    tenantId: string,
    merchantId: string,
    data: UpsertConnectionInput,
    tx?: DbClient
  ) {
    const db = tx ?? prisma;
    return db.integrationConnection.upsert({
      where: {
        tenantId_merchantId_type: {
          tenantId,
          merchantId,
          type: data.type,
        },
      },
      create: {
        id: generateEntityId(),
        tenantId,
        merchantId,
        type: data.type,
        category: data.category,
        status: "active",
        externalAccountId: data.externalAccountId,
        externalLocationId: data.externalLocationId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
      },
      update: {
        status: "active",
        externalAccountId: data.externalAccountId,
        externalLocationId: data.externalLocationId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
        deleted: false,
      },
    });
  }

  async updateTokens(connectionId: string, data: UpdateTokensInput) {
    return prisma.integrationConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
      },
    });
  }

  async softDeleteConnection(connectionId: string) {
    return prisma.integrationConnection.update({
      where: { id: connectionId },
      data: { deleted: true, status: "inactive" },
    });
  }

  async createSyncRecord(
    tenantId: string,
    connectionId: string,
    syncType: string
  ) {
    return prisma.integrationSyncRecord.create({
      data: {
        id: generateEntityId(),
        tenantId,
        connectionId,
        syncType,
        status: "running",
        startedAt: new Date(),
      },
    });
  }

  async updateSyncRecord(
    recordId: string,
    data: {
      status: string;
      objectsSynced?: number;
      objectsMapped?: number;
      errorMessage?: string;
      cursor?: string;
    }
  ) {
    return prisma.integrationSyncRecord.update({
      where: { id: recordId },
      data: {
        ...data,
        finishedAt: data.status !== "running" ? new Date() : undefined,
      },
    });
  }

  async getRunningSync(connectionId: string) {
    const staleThreshold = new Date(
      Date.now() - SYNC_STALE_MINUTES * 60 * 1000
    );
    return prisma.integrationSyncRecord.findFirst({
      where: {
        connectionId,
        status: "running",
        startedAt: { gte: staleThreshold },
      },
    });
  }

  async upsertIdMapping(tenantId: string, data: UpsertIdMappingInput, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.externalIdMapping.upsert({
      where: {
        tenantId_externalSource_externalId: {
          tenantId,
          externalSource: data.externalSource,
          externalId: data.externalId,
        },
      },
      create: {
        id: generateEntityId(),
        tenantId,
        internalType: data.internalType,
        internalId: data.internalId,
        externalSource: data.externalSource,
        externalType: data.externalType,
        externalId: data.externalId,
      },
      update: {
        internalType: data.internalType,
        internalId: data.internalId,
        externalType: data.externalType,
        deleted: false,
      },
    });
  }

  async getIdMappingsBySource(
    tenantId: string,
    externalSource: string,
    internalType?: string
  ) {
    return prisma.externalIdMapping.findMany({
      where: {
        tenantId,
        externalSource,
        ...(internalType && { internalType }),
        deleted: false,
      },
    });
  }

  async getIdMappingByExternalId(
    tenantId: string,
    externalSource: string,
    externalId: string
  ) {
    return prisma.externalIdMapping.findFirst({
      where: {
        tenantId,
        externalSource,
        externalId,
        deleted: false,
      },
    });
  }
}

export const integrationRepository = new IntegrationRepository();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/repositories/__tests__/integration.repository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/repositories/integration.repository.ts src/repositories/__tests__/integration.repository.test.ts
git commit -m "feat: add IntegrationRepository for connection, sync, and mapping CRUD #3"
```

---

### Task 5: Square Config

**Files:**
- Create: `src/services/square/square.config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Create Square config**

Create `src/services/square/square.config.ts`:

```typescript
import { AppError, ErrorCodes } from "@/lib/errors";

export const squareConfig = {
  get enabled() {
    return process.env.SQUARE_ENABLED === "true";
  },
  get appId() {
    return process.env.SQUARE_APP_ID ?? "";
  },
  get appSecret() {
    return process.env.SQUARE_APP_SECRET ?? "";
  },
  get environment() {
    return (process.env.SQUARE_ENVIRONMENT ?? "sandbox") as
      | "sandbox"
      | "production";
  },
  get oauthStateSecret() {
    return process.env.SQUARE_OAUTH_STATE_SECRET ?? "";
  },
  get oauthRedirectUrl() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return `${baseUrl}/api/integration/square/oauth/callback`;
  },
  get oauthBaseUrl() {
    const env = process.env.SQUARE_ENVIRONMENT ?? "sandbox";
    return env === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
  },

  assertConfigured() {
    if (!this.enabled || !this.appId || !this.appSecret) {
      throw new AppError(ErrorCodes.SQUARE_NOT_CONFIGURED, undefined, 500);
    }
  },
} as const;
```

- [ ] **Step 2: Update .env.example**

Add to `.env.example`:

```env
# Square Integration
SQUARE_ENABLED=false
SQUARE_APP_ID=
SQUARE_APP_SECRET=
SQUARE_ENVIRONMENT=sandbox
SQUARE_OAUTH_STATE_SECRET=
```

- [ ] **Step 3: Commit**

```bash
git add src/services/square/square.config.ts .env.example
git commit -m "feat: add Square configuration and env vars #3"
```

---

### Task 6: Square OAuth Service

**Files:**
- Create: `src/services/square/square.types.ts`
- Create: `src/services/square/square-oauth.service.ts`
- Test: `src/services/square/__tests__/square-oauth.test.ts`

- [ ] **Step 1: Create Square types**

Create `src/services/square/square.types.ts`:

```typescript
export interface SquareTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  merchantId: string;
}

export interface SquareLocation {
  id: string;
  name: string;
  address?: {
    addressLine1?: string;
    locality?: string;
    administrativeDistrictLevel1?: string;
    postalCode?: string;
    country?: string;
  };
  status: string;
}

export interface OAuthState {
  tenantId: string;
  merchantId: string;
  returnUrl: string;
}

export interface SquareConnectionStatus {
  connected: boolean;
  externalAccountId?: string;
  externalLocationId?: string;
  tokenExpiresAt?: Date;
}
```

- [ ] **Step 2: Write failing tests for SquareOAuthService**

Create `src/services/square/__tests__/square-oauth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

vi.mock("square", () => {
  const mockOAuthApi = {
    obtainToken: vi.fn(),
  };
  const mockLocationsApi = {
    listLocations: vi.fn(),
  };
  return {
    Client: vi.fn().mockImplementation(() => ({
      oAuthApi: mockOAuthApi,
      locationsApi: mockLocationsApi,
    })),
    Environment: { Sandbox: "sandbox", Production: "production" },
    __mockOAuthApi: mockOAuthApi,
    __mockLocationsApi: mockLocationsApi,
  };
});

vi.mock("../square.config", () => ({
  squareConfig: {
    appId: "test-app-id",
    appSecret: "test-app-secret",
    environment: "sandbox",
    oauthStateSecret: "test-secret-key-32-chars-long!!!",
    oauthRedirectUrl: "http://localhost:3000/api/integration/square/oauth/callback",
    oauthBaseUrl: "https://connect.squareupsandbox.com",
    enabled: true,
    assertConfigured: vi.fn(),
  },
}));

import { SquareOAuthService } from "../square-oauth.service";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const squareMock = require("square");
const mockOAuthApi = squareMock.__mockOAuthApi;
const mockLocationsApi = squareMock.__mockLocationsApi;

describe("SquareOAuthService", () => {
  let service: SquareOAuthService;

  beforeEach(() => {
    service = new SquareOAuthService();
    vi.clearAllMocks();
  });

  describe("buildAuthorizationUrl", () => {
    it("should build a valid Square OAuth URL with signed state", () => {
      const url = service.buildAuthorizationUrl("t1", "m1", "http://example.com/dashboard");

      expect(url).toContain("https://connect.squareupsandbox.com/oauth2/authorize");
      expect(url).toContain("client_id=test-app-id");
      expect(url).toContain("scope=ITEMS_READ");
      expect(url).toContain("state=");
    });
  });

  describe("verifyAndParseState", () => {
    it("should verify a valid state and return parsed data", () => {
      const url = service.buildAuthorizationUrl("t1", "m1", "http://example.com");
      const stateParam = new URL(url).searchParams.get("state")!;

      const parsed = service.verifyAndParseState(stateParam);

      expect(parsed.tenantId).toBe("t1");
      expect(parsed.merchantId).toBe("m1");
      expect(parsed.returnUrl).toBe("http://example.com");
    });

    it("should throw on tampered state", () => {
      expect(() => service.verifyAndParseState("tampered.signature")).toThrow();
    });
  });

  describe("exchangeCode", () => {
    it("should exchange auth code for tokens", async () => {
      mockOAuthApi.obtainToken.mockResolvedValue({
        result: {
          accessToken: "access-123",
          refreshToken: "refresh-456",
          expiresAt: "2026-05-08T00:00:00Z",
          merchantId: "sq-merchant-1",
        },
      });

      const result = await service.exchangeCode("auth-code-123");

      expect(mockOAuthApi.obtainToken).toHaveBeenCalledWith({
        clientId: "test-app-id",
        clientSecret: "test-app-secret",
        code: "auth-code-123",
        grantType: "authorization_code",
      });
      expect(result.accessToken).toBe("access-123");
      expect(result.refreshToken).toBe("refresh-456");
      expect(result.merchantId).toBe("sq-merchant-1");
    });
  });

  describe("refreshToken", () => {
    it("should refresh an expired token", async () => {
      mockOAuthApi.obtainToken.mockResolvedValue({
        result: {
          accessToken: "new-access",
          refreshToken: "new-refresh",
          expiresAt: "2026-06-08T00:00:00Z",
          merchantId: "sq-merchant-1",
        },
      });

      const result = await service.refreshToken("old-refresh-token");

      expect(mockOAuthApi.obtainToken).toHaveBeenCalledWith({
        clientId: "test-app-id",
        clientSecret: "test-app-secret",
        refreshToken: "old-refresh-token",
        grantType: "refresh_token",
      });
      expect(result.accessToken).toBe("new-access");
    });
  });

  describe("listLocations", () => {
    it("should return mapped locations", async () => {
      mockLocationsApi.listLocations.mockResolvedValue({
        result: {
          locations: [
            {
              id: "loc-1",
              name: "Main Street",
              address: { addressLine1: "123 Main St" },
              status: "ACTIVE",
            },
          ],
        },
      });

      const locations = await service.listLocations("access-token");

      expect(locations).toEqual([
        {
          id: "loc-1",
          name: "Main Street",
          address: { addressLine1: "123 Main St" },
          status: "ACTIVE",
        },
      ]);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/services/square/__tests__/square-oauth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement SquareOAuthService**

Create `src/services/square/square-oauth.service.ts`:

```typescript
import crypto from "crypto";
import { Client, Environment } from "square";
import { squareConfig } from "./square.config";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { SquareTokenResponse, SquareLocation, OAuthState } from "./square.types";

const SCOPES = ["ITEMS_READ", "MERCHANT_PROFILE_READ"];

export class SquareOAuthService {
  private getClient(accessToken?: string): Client {
    return new Client({
      accessToken,
      environment:
        squareConfig.environment === "production"
          ? Environment.Production
          : Environment.Sandbox,
    });
  }

  buildAuthorizationUrl(
    tenantId: string,
    merchantId: string,
    returnUrl: string
  ): string {
    squareConfig.assertConfigured();

    const state = this.signState({ tenantId, merchantId, returnUrl });
    const params = new URLSearchParams({
      client_id: squareConfig.appId,
      scope: SCOPES.join(" "),
      session: "false",
      state,
      redirect_uri: squareConfig.oauthRedirectUrl,
    });

    return `${squareConfig.oauthBaseUrl}/oauth2/authorize?${params.toString()}`;
  }

  verifyAndParseState(state: string): OAuthState {
    const dotIndex = state.lastIndexOf(".");
    if (dotIndex === -1) {
      throw new AppError(ErrorCodes.INTEGRATION_OAUTH_STATE_INVALID);
    }

    const payload = state.slice(0, dotIndex);
    const signature = state.slice(dotIndex + 1);

    const expectedSignature = crypto
      .createHmac("sha256", squareConfig.oauthStateSecret)
      .update(payload)
      .digest("base64url");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      throw new AppError(ErrorCodes.INTEGRATION_OAUTH_STATE_INVALID);
    }

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8")
    ) as OAuthState;
    return decoded;
  }

  async exchangeCode(code: string): Promise<SquareTokenResponse> {
    const client = this.getClient();
    const { result } = await client.oAuthApi.obtainToken({
      clientId: squareConfig.appId,
      clientSecret: squareConfig.appSecret,
      code,
      grantType: "authorization_code",
    });

    return {
      accessToken: result.accessToken!,
      refreshToken: result.refreshToken!,
      expiresAt: new Date(result.expiresAt!),
      merchantId: result.merchantId!,
    };
  }

  async refreshToken(refreshTokenValue: string): Promise<SquareTokenResponse> {
    const client = this.getClient();
    const { result } = await client.oAuthApi.obtainToken({
      clientId: squareConfig.appId,
      clientSecret: squareConfig.appSecret,
      refreshToken: refreshTokenValue,
      grantType: "refresh_token",
    });

    return {
      accessToken: result.accessToken!,
      refreshToken: result.refreshToken!,
      expiresAt: new Date(result.expiresAt!),
      merchantId: result.merchantId!,
    };
  }

  async listLocations(accessToken: string): Promise<SquareLocation[]> {
    const client = this.getClient(accessToken);
    const { result } = await client.locationsApi.listLocations();

    return (result.locations ?? []).map((loc) => ({
      id: loc.id!,
      name: loc.name ?? "",
      address: loc.address
        ? {
            addressLine1: loc.address.addressLine1 ?? undefined,
            locality: loc.address.locality ?? undefined,
            administrativeDistrictLevel1:
              loc.address.administrativeDistrictLevel1 ?? undefined,
            postalCode: loc.address.postalCode ?? undefined,
            country: loc.address.country ?? undefined,
          }
        : undefined,
      status: loc.status ?? "UNKNOWN",
    }));
  }

  private signState(data: OAuthState): string {
    const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", squareConfig.oauthStateSecret)
      .update(payload)
      .digest("base64url");
    return `${payload}.${signature}`;
  }
}

export const squareOAuthService = new SquareOAuthService();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/services/square/__tests__/square-oauth.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/square/square.types.ts src/services/square/square-oauth.service.ts src/services/square/__tests__/square-oauth.test.ts
git commit -m "feat: add SquareOAuthService with state signing and token exchange #3"
```

---

### Task 7: Square Catalog Service

**Files:**
- Create: `src/services/square/square-catalog.service.ts`
- Test: `src/services/square/__tests__/square-catalog.test.ts`

- [ ] **Step 1: Write failing tests for SquareCatalogService**

Create `src/services/square/__tests__/square-catalog.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("square", () => {
  const mockCatalogApi = {
    listCatalog: vi.fn(),
  };
  return {
    Client: vi.fn().mockImplementation(() => ({
      catalogApi: mockCatalogApi,
    })),
    Environment: { Sandbox: "sandbox", Production: "production" },
    __mockCatalogApi: mockCatalogApi,
  };
});

vi.mock("../square.config", () => ({
  squareConfig: {
    environment: "sandbox",
    assertConfigured: vi.fn(),
  },
}));

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(() => "gen-id-" + Math.random().toString(36).slice(2, 8)),
}));

import { SquareCatalogService } from "../square-catalog.service";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const squareMock = require("square");
const mockCatalogApi = squareMock.__mockCatalogApi;

describe("SquareCatalogService", () => {
  let service: SquareCatalogService;

  beforeEach(() => {
    service = new SquareCatalogService();
    vi.clearAllMocks();
  });

  describe("fetchFullCatalog", () => {
    it("should fetch and group catalog objects by type", async () => {
      mockCatalogApi.listCatalog.mockResolvedValue({
        result: {
          objects: [
            {
              type: "CATEGORY",
              id: "cat-1",
              categoryData: { name: "Appetizers" },
            },
            {
              type: "ITEM",
              id: "item-1",
              itemData: {
                name: "Spring Rolls",
                description: "Crispy rolls",
                categoryId: "cat-1",
                variations: [
                  {
                    id: "var-1",
                    type: "ITEM_VARIATION",
                    itemVariationData: {
                      name: "Regular",
                      priceMoney: { amount: BigInt(899), currency: "USD" },
                    },
                  },
                ],
              },
            },
            {
              type: "TAX",
              id: "tax-1",
              taxData: {
                name: "Sales Tax",
                percentage: "8.5",
                enabled: true,
              },
            },
          ],
          cursor: undefined,
        },
      });

      const result = await service.fetchFullCatalog("access-token");

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].id).toBe("cat-1");
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("item-1");
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0].id).toBe("tax-1");
    });

    it("should handle pagination with cursor", async () => {
      mockCatalogApi.listCatalog
        .mockResolvedValueOnce({
          result: {
            objects: [
              { type: "CATEGORY", id: "cat-1", categoryData: { name: "A" } },
            ],
            cursor: "page2",
          },
        })
        .mockResolvedValueOnce({
          result: {
            objects: [
              { type: "CATEGORY", id: "cat-2", categoryData: { name: "B" } },
            ],
            cursor: undefined,
          },
        });

      const result = await service.fetchFullCatalog("token");

      expect(mockCatalogApi.listCatalog).toHaveBeenCalledTimes(2);
      expect(result.categories).toHaveLength(2);
    });
  });

  describe("mapToMenuModels", () => {
    it("should map single-variation item to MenuItem with base price", () => {
      const catalog = {
        categories: [
          { type: "CATEGORY", id: "cat-1", categoryData: { name: "Mains" } },
        ],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Burger",
              description: "Beef burger",
              imageIds: undefined,
              categoryId: "cat-1",
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(1299), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        modifierLists: [],
        taxes: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].name).toBe("Mains");

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Burger");
      expect(result.items[0].price).toBe(12.99);
      expect(result.items[0].categoryExternalIds).toContain("cat-1");
    });

    it("should map multi-variation item to MenuItem with modifier group", () => {
      const catalog = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Coffee",
              description: null,
              categoryId: undefined,
              variations: [
                {
                  id: "var-s",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Small",
                    priceMoney: { amount: BigInt(399), currency: "USD" },
                  },
                },
                {
                  id: "var-l",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Large",
                    priceMoney: { amount: BigInt(599), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        modifierLists: [],
        taxes: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.price).toBe(3.99); // first variation price
      expect(item.modifiers?.groups).toHaveLength(1);
      expect(item.modifiers!.groups[0].name).toBe("Size");
      expect(item.modifiers!.groups[0].options).toHaveLength(2);
      expect(item.modifiers!.groups[0].options[0].name).toBe("Small");
      expect(item.modifiers!.groups[0].options[0].price).toBe(0); // base price = 0 delta
      expect(item.modifiers!.groups[0].options[1].name).toBe("Large");
      expect(item.modifiers!.groups[0].options[1].price).toBe(2); // 5.99 - 3.99
    });

    it("should map CatalogModifierList to modifier group", () => {
      const catalog = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Salad",
              description: null,
              categoryId: undefined,
              modifierListInfo: [
                { modifierListId: "ml-1", enabled: true },
              ],
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(999), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        modifierLists: [
          {
            type: "MODIFIER_LIST",
            id: "ml-1",
            modifierListData: {
              name: "Dressing",
              selectionType: "SINGLE",
              modifiers: [
                {
                  id: "mod-1",
                  type: "MODIFIER",
                  modifierData: {
                    name: "Ranch",
                    priceMoney: { amount: BigInt(0), currency: "USD" },
                  },
                },
                {
                  id: "mod-2",
                  type: "MODIFIER",
                  modifierData: {
                    name: "Caesar",
                    priceMoney: { amount: BigInt(50), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        taxes: [],
      };

      const result = service.mapToMenuModels(catalog);

      const item = result.items[0];
      expect(item.modifiers?.groups).toHaveLength(1);
      const group = item.modifiers!.groups[0];
      expect(group.name).toBe("Dressing");
      expect(group.required).toBe(false);
      expect(group.maxSelect).toBe(1); // SINGLE selection
      expect(group.options).toHaveLength(2);
      expect(group.options[1].price).toBe(0.5); // 50 cents
    });

    it("should map taxes", () => {
      const catalog = {
        categories: [],
        items: [],
        modifierLists: [],
        taxes: [
          {
            type: "TAX",
            id: "tax-1",
            taxData: {
              name: "Sales Tax",
              percentage: "8.5",
              enabled: true,
            },
          },
        ],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0].name).toBe("Sales Tax");
      expect(result.taxes[0].percentage).toBe(8.5);
      expect(result.taxes[0].externalId).toBe("tax-1");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/square/__tests__/square-catalog.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SquareCatalogService**

Create `src/services/square/square-catalog.service.ts`:

```typescript
import { Client, Environment } from "square";
import type { CatalogObject } from "square";
import { squareConfig } from "./square.config";

export interface SquareCatalogResult {
  categories: CatalogObject[];
  items: CatalogObject[];
  modifierLists: CatalogObject[];
  taxes: CatalogObject[];
}

export interface MappedModifierGroup {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: {
    name: string;
    price: number;
    externalId: string;
  }[];
}

export interface MappedModifiers {
  groups: MappedModifierGroup[];
}

export interface MappedMenuItem {
  externalId: string;
  name: string;
  description: string | null;
  price: number;
  categoryExternalIds: string[];
  modifiers: MappedModifiers | null;
  variationMappings: { externalId: string; name: string }[];
}

export interface MappedCategory {
  externalId: string;
  name: string;
  sortOrder: number;
}

export interface MappedTax {
  externalId: string;
  name: string;
  percentage: number;
}

export interface MappedCatalog {
  categories: MappedCategory[];
  items: MappedMenuItem[];
  taxes: MappedTax[];
}

export class SquareCatalogService {
  private getClient(accessToken: string): Client {
    return new Client({
      accessToken,
      environment:
        squareConfig.environment === "production"
          ? Environment.Production
          : Environment.Sandbox,
    });
  }

  async fetchFullCatalog(accessToken: string): Promise<SquareCatalogResult> {
    const client = this.getClient(accessToken);
    const allObjects: CatalogObject[] = [];
    let cursor: string | undefined;

    do {
      const { result } = await client.catalogApi.listCatalog(cursor);
      if (result.objects) {
        allObjects.push(...result.objects);
      }
      cursor = result.cursor ?? undefined;
    } while (cursor);

    return {
      categories: allObjects.filter((o) => o.type === "CATEGORY"),
      items: allObjects.filter((o) => o.type === "ITEM"),
      modifierLists: allObjects.filter((o) => o.type === "MODIFIER_LIST"),
      taxes: allObjects.filter((o) => o.type === "TAX"),
    };
  }

  mapToMenuModels(catalog: SquareCatalogResult): MappedCatalog {
    const modifierListMap = new Map(
      catalog.modifierLists.map((ml) => [ml.id, ml])
    );

    const categories: MappedCategory[] = catalog.categories.map(
      (cat, index) => ({
        externalId: cat.id!,
        name: cat.categoryData?.name ?? "Unnamed",
        sortOrder: index,
      })
    );

    const items: MappedMenuItem[] = catalog.items.map((item) => {
      const data = item.itemData!;
      const variations = data.variations ?? [];
      const categoryExternalIds = data.categoryId
        ? [data.categoryId]
        : [];

      // Base price from first variation
      const basePrice = this.moneyToNumber(
        variations[0]?.itemVariationData?.priceMoney?.amount
      );

      // Build modifier groups
      const groups: MappedModifierGroup[] = [];

      // Multi-variation → size/variation modifier group
      if (variations.length > 1) {
        groups.push({
          name: "Size",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: variations.map((v) => {
            const varPrice = this.moneyToNumber(
              v.itemVariationData?.priceMoney?.amount
            );
            return {
              name: v.itemVariationData?.name ?? "Default",
              price: Math.round((varPrice - basePrice) * 100) / 100,
              externalId: v.id!,
            };
          }),
        });
      }

      // Modifier lists → additional modifier groups
      const modifierListInfo = data.modifierListInfo ?? [];
      for (const mlInfo of modifierListInfo) {
        if (!mlInfo.enabled) continue;
        const ml = modifierListMap.get(mlInfo.modifierListId!);
        if (!ml?.modifierListData) continue;

        const mlData = ml.modifierListData;
        const isSingle = mlData.selectionType === "SINGLE";

        groups.push({
          name: mlData.name ?? "Options",
          required: false,
          minSelect: 0,
          maxSelect: isSingle ? 1 : (mlData.modifiers?.length ?? 10),
          options: (mlData.modifiers ?? []).map((mod) => ({
            name: mod.modifierData?.name ?? "Option",
            price: this.moneyToNumber(
              mod.modifierData?.priceMoney?.amount
            ),
            externalId: mod.id!,
          })),
        });
      }

      return {
        externalId: item.id!,
        name: data.name ?? "Unnamed",
        description: data.description ?? null,
        price: basePrice,
        categoryExternalIds,
        modifiers: groups.length > 0 ? { groups } : null,
        variationMappings: variations.map((v) => ({
          externalId: v.id!,
          name: v.itemVariationData?.name ?? "Default",
        })),
      };
    });

    const taxes: MappedTax[] = catalog.taxes
      .filter((t) => t.taxData?.enabled !== false)
      .map((t) => ({
        externalId: t.id!,
        name: t.taxData?.name ?? "Tax",
        percentage: parseFloat(t.taxData?.percentage ?? "0"),
      }));

    return { categories, items, taxes };
  }

  private moneyToNumber(amountCents?: bigint): number {
    if (!amountCents) return 0;
    return Number(amountCents) / 100;
  }
}

export const squareCatalogService = new SquareCatalogService();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/square/__tests__/square-catalog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/square/square-catalog.service.ts src/services/square/__tests__/square-catalog.test.ts
git commit -m "feat: add SquareCatalogService with fetch and mapping logic #3"
```

---

### Task 8: Square Service (Aggregate)

**Files:**
- Create: `src/services/square/square.service.ts`
- Create: `src/services/square/index.ts`
- Test: `src/services/square/__tests__/square.test.ts`

- [ ] **Step 1: Write failing tests for SquareService**

Create `src/services/square/__tests__/square.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../square-oauth.service", () => ({
  squareOAuthService: {
    buildAuthorizationUrl: vi.fn(() => "https://square.com/oauth?state=abc"),
    verifyAndParseState: vi.fn(() => ({
      tenantId: "t1",
      merchantId: "m1",
      returnUrl: "http://example.com",
    })),
    exchangeCode: vi.fn(() => ({
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: new Date("2026-05-08"),
      merchantId: "sq-merchant-1",
    })),
    refreshToken: vi.fn(() => ({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresAt: new Date("2026-06-08"),
      merchantId: "sq-merchant-1",
    })),
    listLocations: vi.fn(() => [
      { id: "loc-1", name: "Main St", status: "ACTIVE" },
    ]),
  },
}));

vi.mock("../square-catalog.service", () => ({
  squareCatalogService: {
    fetchFullCatalog: vi.fn(() => ({
      categories: [],
      items: [],
      modifierLists: [],
      taxes: [],
    })),
    mapToMenuModels: vi.fn(() => ({
      categories: [],
      items: [],
      taxes: [],
    })),
  },
}));

vi.mock("@/repositories/integration.repository", () => ({
  integrationRepository: {
    getConnection: vi.fn(),
    upsertConnection: vi.fn(() => ({ id: "conn-1" })),
    updateTokens: vi.fn(),
    softDeleteConnection: vi.fn(),
    createSyncRecord: vi.fn(() => ({ id: "sync-1" })),
    updateSyncRecord: vi.fn(),
    getRunningSync: vi.fn(() => null),
    upsertIdMapping: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => {
  const mockTx = {
    menuCategory: { upsert: vi.fn() },
    menuItem: { upsert: vi.fn() },
    menuCategoryItem: { upsert: vi.fn() },
    taxConfig: { upsert: vi.fn() },
    merchantTaxRate: { upsert: vi.fn() },
    externalIdMapping: { upsert: vi.fn() },
  };
  return {
    default: {
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockTx)),
    },
  };
});

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(() => "gen-" + Math.random().toString(36).slice(2, 8)),
}));

vi.mock("../square.config", () => ({
  squareConfig: {
    enabled: true,
    assertConfigured: vi.fn(),
  },
}));

import { SquareService } from "../square.service";
import { integrationRepository } from "@/repositories/integration.repository";

const mockRepo = vi.mocked(integrationRepository);

describe("SquareService", () => {
  let service: SquareService;

  beforeEach(() => {
    service = new SquareService();
    vi.clearAllMocks();
  });

  describe("getAuthorizationUrl", () => {
    it("should return OAuth URL", () => {
      const url = service.getAuthorizationUrl("t1", "m1", "http://example.com");
      expect(url).toBe("https://square.com/oauth?state=abc");
    });
  });

  describe("handleOAuthCallback", () => {
    it("should exchange code, store connection, and return data", async () => {
      const result = await service.handleOAuthCallback("auth-code", "state-value");

      expect(result.returnUrl).toBe("http://example.com");
      expect(result.locations).toHaveLength(1);
      expect(mockRepo.upsertConnection).toHaveBeenCalledWith(
        "t1",
        "m1",
        expect.objectContaining({
          type: "POS_SQUARE",
          category: "POS",
          accessToken: "access-123",
        })
      );
    });
  });

  describe("getConnectionStatus", () => {
    it("should return connected=false when no connection", async () => {
      mockRepo.getConnection.mockResolvedValue(null);

      const status = await service.getConnectionStatus("t1", "m1");

      expect(status.connected).toBe(false);
    });

    it("should return connected=true with details", async () => {
      mockRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        status: "active",
        externalAccountId: "sq-m1",
        externalLocationId: "loc-1",
        tokenExpiresAt: new Date("2026-05-08"),
      } as never);

      const status = await service.getConnectionStatus("t1", "m1");

      expect(status.connected).toBe(true);
      expect(status.externalAccountId).toBe("sq-m1");
    });
  });

  describe("disconnect", () => {
    it("should soft delete the connection", async () => {
      mockRepo.getConnection.mockResolvedValue({
        id: "conn-1",
      } as never);

      await service.disconnect("t1", "m1");

      expect(mockRepo.softDeleteConnection).toHaveBeenCalledWith("conn-1");
    });

    it("should throw if not connected", async () => {
      mockRepo.getConnection.mockResolvedValue(null);

      await expect(service.disconnect("t1", "m1")).rejects.toThrow();
    });
  });

  describe("syncCatalog", () => {
    it("should reject if sync is already running", async () => {
      mockRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "token",
        tokenExpiresAt: new Date(Date.now() + 86400000),
      } as never);
      mockRepo.getRunningSync.mockResolvedValue({ id: "sync-existing" } as never);

      await expect(service.syncCatalog("t1", "m1", "comp-1")).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/square/__tests__/square.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SquareService**

Create `src/services/square/square.service.ts`:

```typescript
import { squareConfig } from "./square.config";
import { squareOAuthService } from "./square-oauth.service";
import { squareCatalogService } from "./square-catalog.service";
import { integrationRepository } from "@/repositories/integration.repository";
import { AppError, ErrorCodes } from "@/lib/errors";
import { generateEntityId } from "@/lib/id";
import prisma from "@/lib/db";
import type { SquareLocation, SquareConnectionStatus } from "./square.types";

const INTEGRATION_TYPE = "POS_SQUARE";
const INTEGRATION_CATEGORY = "POS";

export class SquareService {
  getAuthorizationUrl(
    tenantId: string,
    merchantId: string,
    returnUrl: string
  ): string {
    squareConfig.assertConfigured();
    return squareOAuthService.buildAuthorizationUrl(
      tenantId,
      merchantId,
      returnUrl
    );
  }

  async handleOAuthCallback(
    code: string,
    state: string
  ): Promise<{ returnUrl: string; locations: SquareLocation[] }> {
    const { tenantId, merchantId, returnUrl } =
      squareOAuthService.verifyAndParseState(state);

    const tokens = await squareOAuthService.exchangeCode(code);
    const locations = await squareOAuthService.listLocations(
      tokens.accessToken
    );

    // Store connection (upsert — idempotent for re-auth)
    await integrationRepository.upsertConnection(tenantId, merchantId, {
      type: INTEGRATION_TYPE,
      category: INTEGRATION_CATEGORY,
      externalAccountId: tokens.merchantId,
      externalLocationId: locations[0]?.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      scopes: "ITEMS_READ MERCHANT_PROFILE_READ",
    });

    return { returnUrl, locations };
  }

  async getConnectionStatus(
    tenantId: string,
    merchantId: string
  ): Promise<SquareConnectionStatus> {
    const connection = await integrationRepository.getConnection(
      tenantId,
      merchantId,
      INTEGRATION_TYPE
    );

    if (!connection) {
      return { connected: false };
    }

    return {
      connected: true,
      externalAccountId: connection.externalAccountId ?? undefined,
      externalLocationId: connection.externalLocationId ?? undefined,
      tokenExpiresAt: connection.tokenExpiresAt ?? undefined,
    };
  }

  async disconnect(tenantId: string, merchantId: string): Promise<void> {
    const connection = await integrationRepository.getConnection(
      tenantId,
      merchantId,
      INTEGRATION_TYPE
    );
    if (!connection) {
      throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
    }
    await integrationRepository.softDeleteConnection(connection.id);
  }

  async syncCatalog(
    tenantId: string,
    merchantId: string,
    companyId: string
  ): Promise<{ objectsSynced: number; objectsMapped: number }> {
    const connection = await integrationRepository.getConnection(
      tenantId,
      merchantId,
      INTEGRATION_TYPE
    );
    if (!connection) {
      throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
    }

    // Concurrency guard
    const runningSync = await integrationRepository.getRunningSync(
      connection.id
    );
    if (runningSync) {
      throw new AppError(ErrorCodes.SQUARE_SYNC_ALREADY_RUNNING, undefined, 409);
    }

    // Ensure token is valid
    const accessToken = await this.ensureValidToken(connection);

    // Create sync record
    const syncRecord = await integrationRepository.createSyncRecord(
      tenantId,
      connection.id,
      "CATALOG_FULL"
    );

    try {
      // Fetch catalog from Square
      const rawCatalog = await squareCatalogService.fetchFullCatalog(
        accessToken
      );

      // Map to internal models
      const mapped = squareCatalogService.mapToMenuModels(rawCatalog);

      // Persist to database in a transaction
      await prisma.$transaction(async (tx) => {
        // Ensure a default menu exists
        let menu = await tx.menu.findFirst({
          where: { tenantId, companyId, deleted: false },
        });
        if (!menu) {
          menu = await tx.menu.create({
            data: {
              id: generateEntityId(),
              tenantId,
              companyId,
              name: "Main Menu",
              sortOrder: 0,
            },
          });
        }

        // Upsert categories
        const categoryIdMap = new Map<string, string>(); // externalId → internalId
        for (const cat of mapped.categories) {
          const existingMapping =
            await integrationRepository.getIdMappingByExternalId(
              tenantId,
              "SQUARE",
              cat.externalId
            );
          const internalId = existingMapping?.internalId ?? generateEntityId();

          await tx.menuCategory.upsert({
            where: { id: internalId },
            create: {
              id: internalId,
              tenantId,
              companyId,
              menuId: menu.id,
              name: cat.name,
              sortOrder: cat.sortOrder,
            },
            update: {
              name: cat.name,
              sortOrder: cat.sortOrder,
              deleted: false,
            },
          });

          categoryIdMap.set(cat.externalId, internalId);

          await integrationRepository.upsertIdMapping(
            tenantId,
            {
              internalType: "MenuCategory",
              internalId,
              externalSource: "SQUARE",
              externalType: "CATEGORY",
              externalId: cat.externalId,
            },
            tx
          );
        }

        // Upsert items
        for (const item of mapped.items) {
          const existingMapping =
            await integrationRepository.getIdMappingByExternalId(
              tenantId,
              "SQUARE",
              item.externalId
            );
          const internalId = existingMapping?.internalId ?? generateEntityId();

          await tx.menuItem.upsert({
            where: { id: internalId },
            create: {
              id: internalId,
              tenantId,
              companyId,
              name: item.name,
              description: item.description,
              price: item.price,
              modifiers: item.modifiers
                ? JSON.parse(JSON.stringify(item.modifiers))
                : null,
            },
            update: {
              name: item.name,
              description: item.description,
              price: item.price,
              modifiers: item.modifiers
                ? JSON.parse(JSON.stringify(item.modifiers))
                : null,
              deleted: false,
            },
          });

          // Link to categories
          for (const catExtId of item.categoryExternalIds) {
            const catInternalId = categoryIdMap.get(catExtId);
            if (!catInternalId) continue;

            const linkId = generateEntityId();
            await tx.menuCategoryItem.upsert({
              where: {
                id: linkId,
              },
              create: {
                id: linkId,
                tenantId,
                categoryId: catInternalId,
                menuItemId: internalId,
                sortOrder: 0,
              },
              update: {
                deleted: false,
              },
            });
          }

          // ID mapping for item
          await integrationRepository.upsertIdMapping(
            tenantId,
            {
              internalType: "MenuItem",
              internalId,
              externalSource: "SQUARE",
              externalType: "ITEM",
              externalId: item.externalId,
            },
            tx
          );

          // ID mappings for variations
          for (const variation of item.variationMappings) {
            await integrationRepository.upsertIdMapping(
              tenantId,
              {
                internalType: "MenuItem",
                internalId,
                externalSource: "SQUARE",
                externalType: "ITEM_VARIATION",
                externalId: variation.externalId,
              },
              tx
            );
          }
        }

        // Upsert taxes
        for (const tax of mapped.taxes) {
          const existingMapping =
            await integrationRepository.getIdMappingByExternalId(
              tenantId,
              "SQUARE",
              tax.externalId
            );
          const internalId = existingMapping?.internalId ?? generateEntityId();

          await tx.taxConfig.upsert({
            where: { id: internalId },
            create: {
              id: internalId,
              tenantId,
              companyId,
              name: tax.name,
            },
            update: {
              name: tax.name,
              deleted: false,
            },
          });

          // Create merchant tax rate
          const rateId = generateEntityId();
          await tx.merchantTaxRate.upsert({
            where: { id: rateId },
            create: {
              id: rateId,
              merchantId,
              taxConfigId: internalId,
              rate: tax.percentage / 100,
            },
            update: {
              rate: tax.percentage / 100,
              deleted: false,
            },
          });

          await integrationRepository.upsertIdMapping(
            tenantId,
            {
              internalType: "TaxConfig",
              internalId,
              externalSource: "SQUARE",
              externalType: "TAX",
              externalId: tax.externalId,
            },
            tx
          );
        }
      });

      const objectsSynced =
        mapped.categories.length + mapped.items.length + mapped.taxes.length;
      const objectsMapped = objectsSynced;

      await integrationRepository.updateSyncRecord(syncRecord.id, {
        status: "success",
        objectsSynced,
        objectsMapped,
      });

      return { objectsSynced, objectsMapped };
    } catch (error) {
      await integrationRepository.updateSyncRecord(syncRecord.id, {
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error",
      });
      throw new AppError(ErrorCodes.SQUARE_CATALOG_SYNC_FAILED, undefined, 500);
    }
  }

  private async ensureValidToken(connection: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
  }): Promise<string> {
    if (!connection.accessToken) {
      throw new AppError(ErrorCodes.INTEGRATION_TOKEN_EXPIRED, undefined, 401);
    }

    // Check if token expires within 5 minutes
    const bufferMs = 5 * 60 * 1000;
    if (
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() < Date.now() + bufferMs
    ) {
      if (!connection.refreshToken) {
        throw new AppError(
          ErrorCodes.INTEGRATION_TOKEN_EXPIRED,
          undefined,
          401
        );
      }

      const newTokens = await squareOAuthService.refreshToken(
        connection.refreshToken
      );
      await integrationRepository.updateTokens(connection.id, {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        tokenExpiresAt: newTokens.expiresAt,
      });
      return newTokens.accessToken;
    }

    return connection.accessToken;
  }
}

export const squareService = new SquareService();
```

- [ ] **Step 4: Create index.ts**

Create `src/services/square/index.ts`:

```typescript
export { squareService } from "./square.service";
export { squareOAuthService } from "./square-oauth.service";
export { squareCatalogService } from "./square-catalog.service";
export { squareConfig } from "./square.config";
export * from "./square.types";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/services/square/__tests__/square.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/square/square.service.ts src/services/square/index.ts src/services/square/__tests__/square.test.ts
git commit -m "feat: add SquareService aggregate with OAuth, catalog sync, and token refresh #3"
```

---

### Task 9: API Routes

**Files:**
- Create: `src/app/api/integration/square/oauth/authorize/route.ts`
- Create: `src/app/api/integration/square/oauth/callback/route.ts`
- Create: `src/app/api/integration/square/catalog/sync/route.ts`
- Create: `src/app/api/integration/square/status/route.ts`

- [ ] **Step 1: Create OAuth authorize route**

Create `src/app/api/integration/square/oauth/authorize/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { squareService } from "@/services/square";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const merchantId = searchParams.get("merchantId");
    const returnUrl = searchParams.get("returnUrl") ?? "/dashboard";

    if (!merchantId) {
      return NextResponse.json(
        { success: false, error: "merchantId is required" },
        { status: 400 }
      );
    }

    const url = squareService.getAuthorizationUrl(
      session.user.tenantId,
      merchantId,
      returnUrl
    );

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[Square OAuth Authorize] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initiate Square OAuth" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create OAuth callback route**

Create `src/app/api/integration/square/oauth/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { squareService } from "@/services/square";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json(
      { success: false, error: "Missing code or state parameter" },
      { status: 400 }
    );
  }

  try {
    const { returnUrl } = await squareService.handleOAuthCallback(code, state);
    return NextResponse.redirect(new URL(returnUrl, request.nextUrl.origin));
  } catch (error) {
    console.error("[Square OAuth Callback] Error:", error);
    const fallbackUrl = new URL("/dashboard", request.nextUrl.origin);
    fallbackUrl.searchParams.set("error", "square_oauth_failed");
    return NextResponse.redirect(fallbackUrl);
  }
}
```

- [ ] **Step 3: Create catalog sync route**

Create `src/app/api/integration/square/catalog/sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { squareService } from "@/services/square";
import { z } from "zod";

const syncSchema = z.object({
  merchantId: z.string().min(1),
  companyId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = syncSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          fieldErrors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { merchantId, companyId } = validation.data;
    const result = await squareService.syncCatalog(
      session.user.tenantId,
      merchantId,
      companyId
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Square Catalog Sync] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to sync catalog";
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
```

- [ ] **Step 4: Create status route**

Create `src/app/api/integration/square/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { squareService } from "@/services/square";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const merchantId = request.nextUrl.searchParams.get("merchantId");
    if (!merchantId) {
      return NextResponse.json(
        { success: false, error: "merchantId is required" },
        { status: 400 }
      );
    }

    const status = await squareService.getConnectionStatus(
      session.user.tenantId,
      merchantId
    );

    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error("[Square Status] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get Square connection status" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/integration/
git commit -m "feat: add Square integration API routes (OAuth, catalog sync, status) #3"
```

---

### Task 10: Type Check & Lint

**Files:**
- Possibly fix issues in any of the above files

- [ ] **Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors. Fix any type errors found.

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No errors. Fix any lint violations found.

- [ ] **Step 3: Run all tests**

Run: `npm run test:run`
Expected: All tests pass including new integration tests.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type check and lint issues in Square integration #3"
```

---

### Task 11: Integration Test (Optional)

**Files:**
- Create: `src/services/square/__tests__/square-catalog-mapping.test.ts`

- [ ] **Step 1: Write a comprehensive mapping test with realistic Square data**

Create `src/services/square/__tests__/square-catalog-mapping.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("../square.config", () => ({
  squareConfig: { environment: "sandbox", assertConfigured: vi.fn() },
}));

import { SquareCatalogService } from "../square-catalog.service";

describe("SquareCatalogService — realistic mapping scenarios", () => {
  const service = new SquareCatalogService();

  it("should handle a full restaurant catalog with categories, items, modifiers, and taxes", () => {
    const catalog = {
      categories: [
        { type: "CATEGORY", id: "cat-appetizers", categoryData: { name: "Appetizers" } },
        { type: "CATEGORY", id: "cat-mains", categoryData: { name: "Main Courses" } },
      ],
      items: [
        {
          type: "ITEM",
          id: "item-wings",
          itemData: {
            name: "Chicken Wings",
            description: "Crispy fried wings",
            categoryId: "cat-appetizers",
            variations: [
              {
                id: "var-wings-6pc",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "6 Piece",
                  priceMoney: { amount: BigInt(1099), currency: "USD" },
                },
              },
              {
                id: "var-wings-12pc",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "12 Piece",
                  priceMoney: { amount: BigInt(1899), currency: "USD" },
                },
              },
            ],
            modifierListInfo: [
              { modifierListId: "ml-sauce", enabled: true },
            ],
          },
        },
        {
          type: "ITEM",
          id: "item-steak",
          itemData: {
            name: "Ribeye Steak",
            description: null,
            categoryId: "cat-mains",
            variations: [
              {
                id: "var-steak",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "Regular",
                  priceMoney: { amount: BigInt(3499), currency: "USD" },
                },
              },
            ],
          },
        },
      ],
      modifierLists: [
        {
          type: "MODIFIER_LIST",
          id: "ml-sauce",
          modifierListData: {
            name: "Sauce",
            selectionType: "MULTIPLE",
            modifiers: [
              { id: "mod-bbq", type: "MODIFIER", modifierData: { name: "BBQ", priceMoney: { amount: BigInt(0), currency: "USD" } } },
              { id: "mod-buffalo", type: "MODIFIER", modifierData: { name: "Buffalo", priceMoney: { amount: BigInt(0), currency: "USD" } } },
              { id: "mod-truffle", type: "MODIFIER", modifierData: { name: "Truffle Aioli", priceMoney: { amount: BigInt(150), currency: "USD" } } },
            ],
          },
        },
      ],
      taxes: [
        { type: "TAX", id: "tax-sales", taxData: { name: "Sales Tax", percentage: "8.875", enabled: true } },
        { type: "TAX", id: "tax-disabled", taxData: { name: "Old Tax", percentage: "5.0", enabled: false } },
      ],
    };

    const result = service.mapToMenuModels(catalog);

    // Categories
    expect(result.categories).toHaveLength(2);
    expect(result.categories[0].name).toBe("Appetizers");
    expect(result.categories[1].name).toBe("Main Courses");

    // Wings — multi-variation + modifier list
    const wings = result.items.find((i) => i.name === "Chicken Wings")!;
    expect(wings.price).toBe(10.99); // base price = first variation
    expect(wings.modifiers!.groups).toHaveLength(2); // Size + Sauce
    expect(wings.modifiers!.groups[0].name).toBe("Size");
    expect(wings.modifiers!.groups[0].options[1].price).toBe(8); // 18.99 - 10.99
    expect(wings.modifiers!.groups[1].name).toBe("Sauce");
    expect(wings.modifiers!.groups[1].maxSelect).toBe(3); // MULTIPLE = count of modifiers
    expect(wings.modifiers!.groups[1].options[2].price).toBe(1.5); // truffle aioli

    // Steak — single variation, no modifiers
    const steak = result.items.find((i) => i.name === "Ribeye Steak")!;
    expect(steak.price).toBe(34.99);
    expect(steak.modifiers).toBeNull();

    // Taxes — disabled tax filtered out
    expect(result.taxes).toHaveLength(1);
    expect(result.taxes[0].percentage).toBe(8.875);
  });

  it("should handle item with no variations gracefully", () => {
    const catalog = {
      categories: [],
      items: [
        {
          type: "ITEM",
          id: "item-empty",
          itemData: {
            name: "Mystery Item",
            description: null,
            categoryId: undefined,
            variations: [],
          },
        },
      ],
      modifierLists: [],
      taxes: [],
    };

    const result = service.mapToMenuModels(catalog);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].price).toBe(0);
    expect(result.items[0].modifiers).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/services/square/__tests__/square-catalog-mapping.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/services/square/__tests__/square-catalog-mapping.test.ts
git commit -m "test: add comprehensive catalog mapping tests for realistic Square data #3"
```
