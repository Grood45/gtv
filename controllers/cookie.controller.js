const SystemConfig = require("../models/SystemConfig");
const bigwinAdapter = require("../adapters/bigwin.adapter");
const skypuntAdapter = require("../adapters/skypunt.adapter");

let GLOBAL_COOKIE = null;
let refreshPromise = null;

async function generateCookie() {
  if (refreshPromise) return await refreshPromise;

  refreshPromise = (async () => {
    try {
      let newCookieValue = null;
      let providerName = "UNKNOWN";

      const useSkypunt = process.env.USE_SKYPUNT_PROVIDER === 'true';
      const useBigwin = process.env.USE_BIGWIN_PROVIDER === 'true';

      // 🚀 STRATEGY PATTERN: Delegate to the active adapter
      if (useSkypunt) {
        providerName = "SKYPUNT";
        newCookieValue = await skypuntAdapter.initSession();
      } else if (useBigwin) {
        providerName = "BIGWIN";
        newCookieValue = await bigwinAdapter.initSession();
      } else {
        throw new Error("NO_COOKIE_PROVIDER_ENABLED_IN_ENV");
      }

      if (!newCookieValue) throw new Error("FAILED_TO_GENERATE_COOKIE");

      GLOBAL_COOKIE = `JSESSIONID=${newCookieValue}`;

      await SystemConfig.findOneAndUpdate(
        { key: "COOKIE" },
        { value: { value: newCookieValue }, updatedAt: new Date() },
        { upsert: true }
      );

      console.log(`✅ COOKIE UPDATED SAFELY (${providerName} ADAPTER)`);
      return GLOBAL_COOKIE;

    } catch (e) {
      console.log("❌ COOKIE ERROR:", e.response?.data || e.message);
      throw e;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function getValidCookie() {
    if (GLOBAL_COOKIE) return GLOBAL_COOKIE;
    return await loadCookie();
}

function getCookie() {
  return GLOBAL_COOKIE;
}

async function loadCookie() {
  try {
    const doc = await SystemConfig.findOne({ key: "COOKIE" });
    if (doc && doc.value && doc.value.value) {
      GLOBAL_COOKIE = `JSESSIONID=${doc.value.value}`;
      console.log("✅ LOADED COOKIE FROM DB");
      return GLOBAL_COOKIE;
    }
  } catch (e) {
    console.log("⚠️ COULD NOT LOAD COOKIE FROM DB:", e.message);
  }
  return null;
}

module.exports = { generateCookie, getCookie, loadCookie, getValidCookie };
