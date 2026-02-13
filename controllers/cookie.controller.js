const axios = require("axios");
const SystemConfig = require("../models/SystemConfig");
const { GAME_API } = require("../config/config");
const { getToken } = require("../storage/token"); // ✅ latest token use

let GLOBAL_COOKIE = null;
let COOKIE_REFRESHING = false;

async function generateCookie(providedToken) {
  // 🔒 agar already process chal raha hai
  if (COOKIE_REFRESHING) return GLOBAL_COOKIE;

  COOKIE_REFRESHING = true;
  let NEW_COOKIE = null;

  try {
    // 🔹 STEP 0: token check
    const token = providedToken || getToken();
    if (!token) throw new Error("TOKEN_NOT_READY");

    // 🔹 STEP 1: GAME URL API (AUTH TOKEN REQUIRED)
    const apiRes = await axios.get(GAME_API, {
      headers: {
        Authorization: token,
        Origin: "https://www.gugobet.net",
        Referer: "https://www.gugobet.net/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      timeout: 15000,
      validateStatus: () => true, // ❗ prevent crash on 410
    });

    if (apiRes.status !== 200 || !apiRes.data?.data?.url) {
      console.log("⚠️ GAME API FAILED:", apiRes.status);
      throw new Error(`GAME_API_FAILED_${apiRes.status}`);
    }

    const { url, params } = apiRes.data.data;

    // 🔹 STEP 2: NO-BROWSER FETCH (Axios manually handles the POST)
    console.log("📡 FETCHING SESSION COOKIE (AXIOS)...");
    const sessionRes = await axios.post(url, new URLSearchParams(params).toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      timeout: 20000,
      maxRedirects: 0, // We only need the headers from the first response
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const setCookie = sessionRes.headers["set-cookie"];
    if (!setCookie || setCookie.length === 0) {
      console.log("⚠️ NO COOKIE IN RESPONSE HEADERS");
      throw new Error("COOKIE_HEADER_MISSING");
    }

    // Find JSESSIONID in array of cookies
    const jsessionHeader = setCookie.find((c) => c.includes("JSESSIONID"));
    if (!jsessionHeader) {
      console.log("⚠️ JSESSIONID NOT FOUND IN HEADERS");
      throw new Error("JSESSIONID_NOT_FOUND_IN_HEADERS");
    }

    const jsessionValue = jsessionHeader.split("JSESSIONID=")[1]?.split(";")[0];
    if (!jsessionValue) {
      throw new Error("INVALID_JSESSIONID_VALUE");
    }

    // ✅ NEW COOKIE READY
    NEW_COOKIE = `JSESSIONID=${jsessionValue}`;

    // 🔥 Only replace global cookie now
    GLOBAL_COOKIE = NEW_COOKIE;

    await SystemConfig.findOneAndUpdate(
      { key: "COOKIE" },
      { value: { value: jsessionValue } },
      { upsert: true, returnDocument: 'after' }
    );

    console.log("✅ COOKIE UPDATED SAFELY");
    return GLOBAL_COOKIE;

  } catch (e) {
    console.log("❌ COOKIE ERROR:", e.message);
    throw e; // ❗ Throw error so retry logic knows it failed
  } finally {
    COOKIE_REFRESHING = false;
  }
}

// 🔹 Getter (streaming will use this)
function getCookie() {
  return GLOBAL_COOKIE;
}

async function loadCookie() {
  try {
    const doc = await SystemConfig.findOne({ key: "COOKIE" });
    if (doc && doc.value && doc.value.value) {
      // Reconstruct cookie string: JSESSIONID=value
      const cookieStr = `JSESSIONID=${doc.value.value}`;
      GLOBAL_COOKIE = cookieStr;
      console.log("✅ LOADED COOKIE FROM DB");
      return GLOBAL_COOKIE;
    }
  } catch (e) {
    console.log("⚠️ COULD NOT LOAD COOKIE FROM DB:", e.message);
  }
  return null;
}

module.exports = { generateCookie, getCookie, loadCookie };
