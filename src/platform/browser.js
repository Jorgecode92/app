const MOCK_ADS_STORAGE_KEY = "space-invaders-mini-mock-rewarded-ads";

function readLocalStorage(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch (error) {
    console.warn("[platform:browser] localStorage read failed", error);
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("[platform:browser] localStorage write failed", error);
    return false;
  }
}

function getMockAdsEnabled() {
  const stored = readLocalStorage(MOCK_ADS_STORAGE_KEY);
  return stored === null ? true : Boolean(stored);
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function createBrowserPlatform(config) {
  const pauseListeners = new Set();
  const resumeListeners = new Set();

  const notifyPause = () => pauseListeners.forEach((listener) => listener());
  const notifyResume = () => resumeListeners.forEach((listener) => listener());

  const visibilityListener = () => {
    if (document.visibilityState === "hidden") {
      notifyPause();
    } else {
      notifyResume();
    }
  };

  return {
    id: "browser",
    label: "Browser mock",
    isTikTok: false,

    async init() {
      document.addEventListener("visibilitychange", visibilityListener);
      console.info("[platform:browser] Using browser mocks for TikTok Mini Games APIs.");
      return {
        ok: true,
        mode: "browser",
        mockRewardedAds: getMockAdsEnabled(),
        appName: config.appName,
      };
    },

    async login() {
      console.info("[platform:browser] Mock silent login completed.");
      return {
        ok: true,
        mocked: true,
        userId: "browser-player",
        code: "BROWSER_MOCK_LOGIN_CODE",
      };
    },

    canUse(featureName) {
      if (featureName === "rewardedAd") {
        return getMockAdsEnabled();
      }

      if (featureName === "addShortcut" || featureName === "getShortcutMissionReward") {
        return true;
      }

      if (featureName === "storage" || featureName === "lifecycle") {
        return true;
      }

      return false;
    },

    async showRewardedAd(placement) {
      const enabled = getMockAdsEnabled();
      console.info(`[platform:browser] Mock rewarded ad requested for ${placement}. Enabled: ${enabled}`);

      if (!enabled) {
        return {
          ok: false,
          completed: false,
          mocked: true,
          error: "Mock rewarded ads are disabled in Settings.",
        };
      }

      await delay(650);
      return {
        ok: true,
        completed: true,
        mocked: true,
        placement,
      };
    },

    async addShortcut() {
      console.info("[platform:browser] Mock shortcut prompt accepted.");
      return {
        ok: true,
        mocked: true,
      };
    },

    async claimShortcutReward() {
      console.info("[platform:browser] Mock shortcut mission reward check.");
      return {
        ok: true,
        mocked: true,
        canReceiveReward: true,
      };
    },

    async getStorage(key) {
      return readLocalStorage(key);
    },

    async setStorage(key, value) {
      return writeLocalStorage(key, value);
    },

    getLaunchContext() {
      return {
        mode: "browser",
        href: window.location.href,
        query: Object.fromEntries(new URLSearchParams(window.location.search)),
        referrer: document.referrer || "",
      };
    },

    logPlatformEvent(name, payload = {}) {
      console.info(`[platform:browser] ${name}`, payload);
    },

    pauseHooks(listener) {
      pauseListeners.add(listener);
      return () => pauseListeners.delete(listener);
    },

    resumeHooks(listener) {
      resumeListeners.add(listener);
      return () => resumeListeners.delete(listener);
    },

    setMockRewardedAds(enabled) {
      writeLocalStorage(MOCK_ADS_STORAGE_KEY, Boolean(enabled));
    },

    getMockRewardedAds() {
      return getMockAdsEnabled();
    },
  };
}
