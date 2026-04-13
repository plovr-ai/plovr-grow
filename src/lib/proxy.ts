/**
 * Returns an undici ProxyAgent dispatcher when a proxy URL is configured
 * via environment variables. Works with Node.js native fetch.
 */
export function getProxyDispatcher(): import("undici").Dispatcher | undefined {
  const proxyUrl =
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY;
  if (!proxyUrl) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ProxyAgent } = require("undici") as typeof import("undici");
    return new ProxyAgent(proxyUrl);
  } catch {
    return undefined;
  }
}
