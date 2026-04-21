export const APP_CONFIG = Object.freeze({
  appName: "Space Invaders: Defense Grid",
  version: "0.1.0",
  tiktok: Object.freeze({
    clientKey: "TIKTOK_CLIENT_KEY",
    rewardedAdUnitId: "TIKTOK_REWARDED_AD_UNIT_ID",
    sdkUrl: "https://connect.tiktok-minis.com/game/sdk.js",
  }),
  network: Object.freeze({
    trustedApiDomains: Object.freeze([
      "https://api.example.com",
      "https://analytics.example.com",
    ]),
  }),
  storage: Object.freeze({
    profileKey: "space-invaders-mini-profile-v1",
  }),
});

export function isPlaceholder(value) {
  return typeof value === "string" && /^[A-Z0-9_]+$/.test(value);
}
