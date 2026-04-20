# Submission Notes

Runtime:

- HTML Mini Game
- Entry: `dist/index.html`
- Primary config: `dist/minigame.config.json`
- Optional compatibility config: `dist/minis.config.json`

TikTok capabilities prepared:

- SDK initialization wrapper in `src/platform/tiktok.js`
- Silent login wrapper using `TTMinis.game.login`
- Rewarded ads using `TTMinis.game.createRewardedVideoAd`
- Shortcut prompt using `TTMinis.game.addShortcut`
- Shortcut reward check using `TTMinis.game.getShortcutMissionReward`
- Storage through TikTok storage APIs where available
- Pause/resume via `onHide` and `onShow`

Review posture:

- No backend is required for the base version.
- No banner ads or forced ads are used.
- Rewarded ads are offered at natural breakpoints only.
- Runtime network requests are centralized in `src/services/network.js`.
- Browser mode mocks are clearly logged to the console.

Manual notes to complete before submission:

- Replace placeholder client key and ad unit ID.
- Confirm whether the final TikTok DevTool workflow injects the SDK script. If yes, remove the explicit SDK script tag from `index.html`.
- Update privacy and terms contact information.
- Replace placeholder support URLs after the public pages are hosted.
