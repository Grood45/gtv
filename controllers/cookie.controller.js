const axios = require("axios");
const SystemConfig = require("../models/SystemConfig");
const { BIGWIN_KEY_URL, AUTH } = require("../config/config");
const { getTokens } = require("../storage/token");

let GLOBAL_COOKIE = null;
let COOKIE_REFRESHING = false;

/**
 * Robust cookie generator
 */
async function generateBigwinCookie() {
  const { token, usernameToken } = getTokens();
  if (!token || !usernameToken) throw new Error("TOKENS_NOT_READY");

  const keyRes = await axios.post(`${BIGWIN_KEY_URL}?site_auth_key=${AUTH.site_auth_key}`, 
    {
      eventType: 4,
      providerName: "9Wicket"
    },
    {
      headers: {
        "token": token,
        "usernametoken": usernameToken,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0",
      },
      timeout: 15000
    }
  );

  if (!keyRes.data?.success || !keyRes.data?.loginUrl) {
    console.log("❌ BIGWIN KEY API FAILED:", keyRes.data?.message || "No Login URL");
    throw new Error("BIGWIN_KEY_API_FAILED");
  }

  const { loginUrl } = keyRes.data;

  const sessionRes = await axios.post(loginUrl, {}, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0",
    },
    timeout: 20000,
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const setCookie = sessionRes.headers["set-cookie"];
  if (!setCookie) throw new Error("COOKIE_HEADER_MISSING_FROM_BIGWIN");

  const jsessionHeader = setCookie.find((c) => c.includes("JSESSIONID"));
  if (!jsessionHeader) throw new Error("JSESSIONID_NOT_FOUND_FROM_BIGWIN");

  const jsessionValue = jsessionHeader.split("JSESSIONID=")[1]?.split(";")[0];
  if (!jsessionValue) throw new Error("INVALID_JSESSIONID_FROM_BIGWIN");

  return jsessionValue;
}

async function generateSkypuntCookie() {
  const skyRes = await axios.post("https://skypunt1.com/api/login_into_cricket/13", {}, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0",
    },
    timeout: 15000
  });

  if (skyRes.data?.status !== "success" || !skyRes.data?.url) {
    console.log("❌ SKYPUNT API FAILED:", skyRes.data);
    throw new Error("SKYPUNT_KEY_API_FAILED");
  }

  const gameUrl = skyRes.data.url;

  const sessionRes = await axios.get(gameUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0",
    },
    timeout: 20000,
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  // Extract cookies. Axios sets them in response.headers or request.res.headers when following redirects
  const setCookie = sessionRes.headers["set-cookie"] || (sessionRes.request && sessionRes.request.res && sessionRes.request.res.headers["set-cookie"]);
  
  if (!setCookie || !Array.isArray(setCookie)) throw new Error("COOKIE_HEADER_MISSING_FROM_SKYPUNT");

  const jsessionHeader = setCookie.find((c) => c.includes("JSESSIONID"));
  if (!jsessionHeader) throw new Error("JSESSIONID_NOT_FOUND_FROM_SKYPUNT");

  const jsessionValue = jsessionHeader.split("JSESSIONID=")[1]?.split(";")[0];
  if (!jsessionValue) throw new Error("INVALID_JSESSIONID_FROM_SKYPUNT");

  return jsessionValue;
}

async function generateCookie() {
  if (COOKIE_REFRESHING) return GLOBAL_COOKIE || (await loadCookie());
  COOKIE_REFRESHING = true;

  try {
    let newCookieValue = null;
    let providerName = "UNKNOWN";

    const useSkypunt = process.env.USE_SKYPUNT_PROVIDER === 'true';
    const useBigwin = process.env.USE_BIGWIN_PROVIDER === 'true';

    if (useSkypunt) {
      console.log("📡 FETCHING COOKIE VIA SKYPUNT...");
      providerName = "SKYPUNT";
      newCookieValue = await generateSkypuntCookie();
    } else if (useBigwin) {
      console.log("📡 FETCHING COOKIE VIA BIGWIN...");
      providerName = "BIGWIN";
      newCookieValue = await generateBigwinCookie();
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

    console.log(`✅ COOKIE UPDATED SAFELY (${providerName} FLOW)`);
    return GLOBAL_COOKIE;

  } catch (e) {
    console.log("❌ COOKIE ERROR:", e.response?.data || e.message);
    throw e;
  } finally {
    COOKIE_REFRESHING = false;
  }
}

/**
 * Returns current cookie, or loads it from DB if missing
 */
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
