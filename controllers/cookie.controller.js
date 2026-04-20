const axios = require("axios");
const SystemConfig = require("../models/SystemConfig");
const { BIGWIN_KEY_URL, AUTH } = require("../config/config");
const { getTokens } = require("../storage/token");

let GLOBAL_COOKIE = null;
let COOKIE_REFRESHING = false;

async function generateCookie() {
  if (COOKIE_REFRESHING) return GLOBAL_COOKIE;
  COOKIE_REFRESHING = true;

  try {
    const { token, usernameToken } = getTokens();
    if (!token || !usernameToken) throw new Error("TOKENS_NOT_READY");

    console.log("📡 FETCHING BIGWIN LOGIN URL...");
    
    // Step 1: Get Login URL from Bigwin
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

    // Step 2: Fetch Session Cookie from Login URL
    console.log("📡 FETCHING SESSION COOKIE FROM PROVIDER...");
    const sessionRes = await axios.post(loginUrl, {}, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0",
      },
      timeout: 20000,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const setCookie = sessionRes.headers["set-cookie"];
    if (!setCookie) throw new Error("COOKIE_HEADER_MISSING");

    const jsessionHeader = setCookie.find((c) => c.includes("JSESSIONID"));
    if (!jsessionHeader) throw new Error("JSESSIONID_NOT_FOUND");

    const jsessionValue = jsessionHeader.split("JSESSIONID=")[1]?.split(";")[0];
    if (!jsessionValue) throw new Error("INVALID_JSESSIONID");

    GLOBAL_COOKIE = `JSESSIONID=${jsessionValue}`;

    await SystemConfig.findOneAndUpdate(
      { key: "COOKIE" },
      { value: { value: jsessionValue }, updatedAt: new Date() },
      { upsert: true }
    );

    console.log("✅ COOKIE UPDATED SAFELY (BIGWIN FLOW)");
    return GLOBAL_COOKIE;

  } catch (e) {
    console.log("❌ COOKIE ERROR:", e.response?.data || e.message);
    throw e;
  } finally {
    COOKIE_REFRESHING = false;
  }
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

module.exports = { generateCookie, getCookie, loadCookie };
