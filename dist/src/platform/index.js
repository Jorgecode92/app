import { APP_CONFIG } from "../config.js";
import { createBrowserPlatform } from "./browser.js";
import { createTikTokPlatform } from "./tiktok.js";

export function detectPlatform() {
  if (globalThis.TTMinis?.game) {
    return "tiktok";
  }

  return "browser";
}

export function createPlatform(config = APP_CONFIG) {
  return detectPlatform() === "tiktok"
    ? createTikTokPlatform(config)
    : createBrowserPlatform(config);
}
