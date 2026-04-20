# Space Invaders: Defense Grid

Mobile-first arcade shooter prepared for TikTok Mini Games HTML runtime while still running in a normal browser for local development.

The original loop is still here: player ship, invader formation, shields, enemy fire, waves, lives, score, and particles. The conversion adds TikTok-safe platform adapters, portrait layout, coins, daily rewards, unlocks, one rewarded revive per run, and a post-run rewarded bonus.

## Run Locally

Use Node.js 20 or newer.

```bash
npm run dev
```

Open `http://localhost:3000`.

Browser mode uses mocks for TikTok-only features:

- Silent login returns a fake local player.
- Rewarded ads can be toggled in Settings.
- Storage uses `localStorage`.
- Shortcut reward is simulated.
- Pause and resume use browser visibility events.

## Build

```bash
npm run lint
npm run build
npm run preview
```

The build output is `dist/`. It contains `index.html`, `styles.css`, `src/`, `minigame.config.json`, `minis.config.json`, and support pages.

## Package For TikTok

```bash
npm run package
```

This rebuilds `dist/` and creates `release/space-invaders-defense-grid-tiktok.zip`.

TikTok CLI flow:

```bash
npm install @ttmg/cli@latest -g
npm run build
cd dist
ttmg init --h5
ttmg dev
ttmg build
```

Use `dist/index.html` as the HTML entry.

## TikTok Adapter

Runtime detection lives in `src/platform/index.js`.

- `src/platform/browser.js` is the browser mock.
- `src/platform/tiktok.js` wraps `TTMinis.game`.
- `src/main.js` only calls the unified platform API.

The exposed platform calls are:

- `init()`
- `login()`
- `canUse(featureName)`
- `showRewardedAd(placement)`
- `addShortcut()`
- `claimShortcutReward()`
- `getStorage(key)`
- `setStorage(key, value)`
- `getLaunchContext()`
- `logPlatformEvent(name, payload)`
- `pauseHooks(listener)`
- `resumeHooks(listener)`

## Integration Map

Replace these placeholders before TikTok review:

- `TIKTOK_CLIENT_KEY`: `src/config.js`, `minigame.config.json`, `minis.config.json`
- `TIKTOK_REWARDED_AD_UNIT_ID`: `src/config.js`, `minigame.config.json`
- `TRUSTED_API_DOMAINS`: `src/config.js`, `minigame.config.json`, `minis.config.json`
- App name, bundle ID, version: `minigame.config.json`
- Public policy URLs: `minigame.config.json`

## Trusted Domains

Runtime network access is centralized in `src/services/network.js`. Add production domains to:

- `src/config.js` under `network.trustedApiDomains`
- `minigame.config.json` under `trustedDomains`
- `minis.config.json` under `trustedDomains`
- TikTok Developer Portal security settings

Current placeholders:

- `https://api.example.com`
- `https://analytics.example.com`

## Review Notes

The safety lint checks the runtime for:

- `eval()`
- `new Function`
- string-based timers
- dynamic script creation
- direct `fetch()` calls outside `src/services/network.js`
- unexpected external scripts

The only external script in `index.html` is the official TikTok Mini Games SDK bootstrap URL. If TikTok CLI injects the SDK during packaging in your final workflow, you can remove that tag and keep the platform adapter unchanged.

## Manual Portal Setup

Still required outside the repo:

- Create or configure the TikTok Mini Game app.
- Replace the client key.
- Create and activate the rewarded ad placement.
- Replace the rewarded ad unit ID.
- Add trusted domains in the TikTok portal.
- Upload app icon and screenshots.
- Complete business verification and qualification review.
- Add test users.
- Test preview QR launch, silent login, shortcut reward, revive ad, and double-coins ad.
- Confirm English review copy and metadata.

## Backend

No backend is required for this base version. Silent login currently stores the TikTok login code client-side only long enough to report success. A backend may be needed later for OAuth token exchange, advanced user sync, commerce, anti-cheat, or server-side rewards.
