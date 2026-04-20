# Release Checklist

Code readiness:

- Run `npm run lint`.
- Run `npm run build`.
- Run `npm run preview`.
- Test portrait phone viewport.
- Test keyboard fallback in browser.
- Test daily reward persistence.
- Test shop purchase and equip persistence.
- Test browser rewarded ad success and failure toggle.
- Test revive once per run.
- Test post-run double coins.

TikTok DevTool readiness:

- Install Node.js 20 or newer.
- Install `@ttmg/cli` globally.
- Run `npm run build`.
- Run `ttmg init --h5` from `dist`.
- Run `ttmg dev` from `dist`.
- Scan preview QR with a configured TikTok test account.

Manual TikTok portal setup:

- TikTok client key.
- TikTok app and organization configuration.
- Rewarded ad unit ID.
- Trusted domains allowlist.
- App icon.
- Screenshots and promo assets.
- Business verification or qualification status.
- Test user setup.
- Preview QR testing.
- English review readiness.

Manual repo placeholders:

- `src/config.js`
- `minigame.config.json`
- `minis.config.json`
- `privacy.html`
- `terms.html`
