const axios = require("axios");
const puppeteer = require("puppeteer");
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
      return GLOBAL_COOKIE; // 👈 fallback: old cookie
    }

    const { url, params } = apiRes.data.data;

    // 🔹 STEP 2: Puppeteer se session generate
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(`
      <form id="f" method="POST" action="${url}">
        ${Object.entries(params || {})
        .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`)
        .join("")}
      </form>
      <script>document.getElementById('f').submit()</script>
    `);

    await page.waitForNavigation({
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    const cookies = await page.cookies();
    await browser.close();

    const jsession = cookies.find(c => c.name === "JSESSIONID");

    if (!jsession || !jsession.value) {
      console.log("⚠️ JSESSIONID NOT FOUND");
      return GLOBAL_COOKIE;
    }

    // ✅ NEW COOKIE READY
    NEW_COOKIE = `JSESSIONID=${jsession.value}`;

    // 🔥 Only replace global cookie now
    GLOBAL_COOKIE = NEW_COOKIE;

    await SystemConfig.findOneAndUpdate(
      { key: "COOKIE" },
      { value: jsession },
      { upsert: true, new: true }
    );

    console.log("✅ COOKIE UPDATED SAFELY");
    return GLOBAL_COOKIE;

  } catch (e) {
    console.log("❌ COOKIE ERROR:", e.message);
    return GLOBAL_COOKIE; // fallback: old cookie
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
