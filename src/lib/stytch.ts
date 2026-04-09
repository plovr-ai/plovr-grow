import * as stytch from "stytch";

let serverClient: stytch.Client | null = null;

export function getStytchServerClient(): stytch.Client {
  if (serverClient) return serverClient;

  const projectId = process.env.STYTCH_PROJECT_ID;
  const secret = process.env.STYTCH_SECRET;

  if (!projectId) {
    throw new Error("Missing required environment variable: STYTCH_PROJECT_ID");
  }
  if (!secret) {
    throw new Error("Missing required environment variable: STYTCH_SECRET");
  }

  serverClient = new stytch.Client({
    project_id: projectId,
    secret: secret,
  });

  return serverClient;
}
