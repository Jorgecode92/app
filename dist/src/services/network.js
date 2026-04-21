import { APP_CONFIG } from "../config.js";

export function getTrustedApiDomains() {
  return [...APP_CONFIG.network.trustedApiDomains];
}

export function isTrustedUrl(url) {
  const parsed = new URL(url, window.location.href);
  return getTrustedApiDomains().some((domain) => parsed.origin === new URL(domain).origin);
}

export async function requestTrusted(url, options = {}) {
  if (!isTrustedUrl(url)) {
    throw new Error(`Blocked request to untrusted domain: ${url}`);
  }

  return fetch(url, {
    ...options,
    credentials: options.credentials || "omit",
  });
}
