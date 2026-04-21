import { isPlaceholder } from "../config.js";

function getGameApi() {
  return globalThis.TTMinis?.game || null;
}

function callAsyncApi(apiFn, params = {}) {
  return new Promise((resolve) => {
    const fail = (error) => resolve({ ok: false, error });
    apiFn({
      ...params,
      success: (result) => resolve({ ok: true, result }),
      fail,
      error: fail,
    });
  });
}

export function createTikTokPlatform(config) {
  const pauseListeners = new Set();
  const resumeListeners = new Set();
  let initialized = false;

  const notifyPause = () => pauseListeners.forEach((listener) => listener());
  const notifyResume = () => resumeListeners.forEach((listener) => listener());

  return {
    id: "tiktok",
    label: "TikTok Mini Game",
    isTikTok: true,

    async init() {
      const game = getGameApi();
      if (!game) {
        return {
          ok: false,
          error: "TikTok Mini Games SDK is not available.",
        };
      }

      if (typeof game.init === "function" && !initialized) {
        try {
          game.init({
            clientKey: config.tiktok.clientKey,
          });
          initialized = true;
        } catch (error) {
          return {
            ok: false,
            error: "TikTok SDK initialization failed.",
            details: error,
          };
        }
      }

      if (typeof game.onHide === "function") {
        game.onHide(notifyPause);
      }
      if (typeof game.onShow === "function") {
        game.onShow(notifyResume);
      }
      if (typeof game.setLoadingProgress === "function") {
        game.setLoadingProgress({ progress: 1 });
      }

      return {
        ok: true,
        mode: "tiktok",
        clientKeyPlaceholder: isPlaceholder(config.tiktok.clientKey),
      };
    },

    async login() {
      const game = getGameApi();
      if (!game || typeof game.login !== "function") {
        return {
          ok: false,
          error: "TikTok silent login is unavailable.",
        };
      }

      return new Promise((resolve) => {
        game.login({
          success: (result) => {
            resolve({
              ok: true,
              code: result?.code || "",
              raw: result,
            });
          },
          fail: (error) => {
            resolve({
              ok: false,
              error,
            });
          },
          complete: () => {},
        });
      });
    },

    canUse(featureName) {
      const game = getGameApi();
      if (!game) {
        return false;
      }

      const schemaByFeature = {
        rewardedAd: "createRewardedVideoAd",
        addShortcut: "addShortcut",
        getShortcutMissionReward: "getShortcutMissionReward",
        storage: "getStorage",
        lifecycle: "onShow",
      };
      const schema = schemaByFeature[featureName] || featureName;

      if (typeof game.canIUse === "function") {
        try {
          return Boolean(game.canIUse(schema));
        } catch (error) {
          console.warn("[platform:tiktok] canIUse failed", schema, error);
        }
      }

      return typeof game[schema] === "function";
    },

    async showRewardedAd(placement) {
      const game = getGameApi();
      const adUnitId = config.tiktok.rewardedAdUnitId;

      if (!game || typeof game.createRewardedVideoAd !== "function") {
        return {
          ok: false,
          completed: false,
          placement,
          error: "Rewarded ads are unavailable in this TikTok client.",
        };
      }

      if (isPlaceholder(adUnitId)) {
        return {
          ok: false,
          completed: false,
          placement,
          error: "TIKTOK_REWARDED_AD_UNIT_ID has not been configured.",
        };
      }

      return new Promise((resolve) => {
        let settled = false;
        let ad = null;
        let timeoutId = 0;

        const finish = (result) => {
          if (settled) {
            return;
          }

          settled = true;
          window.clearTimeout(timeoutId);

          if (ad) {
            if (typeof ad.offClose === "function") {
              ad.offClose(onClose);
            }
            if (typeof ad.offError === "function") {
              ad.offError(onError);
            }
          }

          resolve(result);
        };

        const onClose = (result = {}) => {
          finish({
            ok: Boolean(result.isEnded),
            completed: Boolean(result.isEnded),
            placement,
          });
        };

        const onError = (error) => {
          finish({
            ok: false,
            completed: false,
            placement,
            error,
          });
        };

        try {
          ad = game.createRewardedVideoAd({ adUnitId });
          ad.onClose(onClose);
          ad.onError(onError);
          timeoutId = window.setTimeout(() => {
            finish({
              ok: false,
              completed: false,
              placement,
              error: "Rewarded ad timed out.",
            });
          }, 120000);
          ad.show().catch(onError);
        } catch (error) {
          finish({
            ok: false,
            completed: false,
            placement,
            error,
          });
        }
      });
    },

    async addShortcut() {
      const game = getGameApi();
      if (!game || typeof game.addShortcut !== "function") {
        return {
          ok: false,
          error: "Shortcut API is unavailable.",
        };
      }

      return callAsyncApi(game.addShortcut.bind(game));
    },

    async claimShortcutReward() {
      const game = getGameApi();
      if (!game || typeof game.getShortcutMissionReward !== "function") {
        return {
          ok: false,
          canReceiveReward: false,
          error: "Shortcut reward API is unavailable.",
        };
      }

      const response = await callAsyncApi(game.getShortcutMissionReward.bind(game));
      return {
        ok: response.ok,
        canReceiveReward: Boolean(response.result?.canReceiveReward),
        raw: response.result,
        error: response.error,
      };
    },

    async getStorage(key) {
      const game = getGameApi();
      if (!game) {
        return null;
      }

      if (typeof game.getStorage === "function") {
        const response = await callAsyncApi(game.getStorage.bind(game), { key });
        return response.ok ? response.result?.data ?? null : null;
      }

      if (typeof game.getStorageSync === "function") {
        try {
          return game.getStorageSync(key) ?? null;
        } catch (error) {
          console.warn("[platform:tiktok] getStorageSync failed", error);
        }
      }

      return null;
    },

    async setStorage(key, value) {
      const game = getGameApi();
      if (!game) {
        return false;
      }

      if (typeof game.setStorage === "function") {
        const response = await callAsyncApi(game.setStorage.bind(game), {
          key,
          data: value,
        });
        return response.ok;
      }

      if (typeof game.setStorageSync === "function") {
        try {
          game.setStorageSync(key, value);
          return true;
        } catch (error) {
          console.warn("[platform:tiktok] setStorageSync failed", error);
        }
      }

      return false;
    },

    getLaunchContext() {
      const game = getGameApi();
      return {
        mode: "tiktok",
        launch: typeof game?.getLaunchOptionsSync === "function" ? game.getLaunchOptionsSync() : null,
        enter: typeof game?.getEnterOptionsSync === "function" ? game.getEnterOptionsSync() : null,
      };
    },

    logPlatformEvent(name, payload = {}) {
      const game = getGameApi();
      if (typeof game?.reportAnalytics === "function") {
        game.reportAnalytics(name, payload);
        return;
      }

      console.info(`[platform:tiktok] ${name}`, payload);
    },

    pauseHooks(listener) {
      pauseListeners.add(listener);
      return () => pauseListeners.delete(listener);
    },

    resumeHooks(listener) {
      resumeListeners.add(listener);
      return () => resumeListeners.delete(listener);
    },
  };
}
