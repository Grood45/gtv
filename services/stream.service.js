const axios = require("axios");
const { STREAM_API } = require("../config/config");
const { getCookie } = require("../controllers/cookie.controller");

const { login } = require("../controllers/auth.controller");
const { generateCookie } = require("../controllers/cookie.controller");

async function fetchStream(matchId, retry = true) {
  try {
    const cookie = getCookie();



    if (!cookie) throw new Error("COOKIE_NOT_READY");

    // const token = cookie.split("JSESSIONID=")[1]?.split(";")[0] || "";
    // Extract token from cookie (Dynamic)
    const token = cookie.split("JSESSIONID=")[1]?.split(";")[0] || "";

    const url = new URL(STREAM_API);
    const host = url.host;
    const origin = `${url.protocol}//${url.host.replace('bkqawscf.', 'www.')}`;

    const res = await axios.post(
      STREAM_API,
      new URLSearchParams({ matchId }).toString(),
      {
        headers: {
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'x-requested-with,Authorization,content-type,token,source',
          'access-control-allow-methods': 'POST, GET, OPTIONS',
          'access-control-allow-origin': origin,
          'access-control-max-age': '600',
          'X-Firefox-Spdy': 'h2',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          'Authorization': token,
          'Connection': 'keep-alive',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookie,
          'Host': host,
          'Origin': origin,
          'Referer': `${origin}/`,
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'source': '1',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0'
        },
        timeout: 15000,
      }
    );

    // Check for API-level authorization failure (200 OK but 1001 status)
    if (res.data?.status === "1001" || res.data?.status_msg === "Not Authorized") {
      throw new Error("NOT_AUTHORIZED");
    }

    return res.data;

  } catch (e) {
    console.log(`⚠️ STREAM FETCH FAILED (Match: ${matchId}):`, e.message);
    if (e.response) {
      console.log("Response Status:", e.response.status);
      console.log("Response Data:", JSON.stringify(e.response.data));
    }

    // 🔄 SELF-HEALING: Retry ONCE if unauthorized or cookie issue
    if (retry && (
      e.message === "NOT_AUTHORIZED" ||
      e.response?.status === 401 ||
      e.response?.status === 403 ||
      e.message === "COOKIE_NOT_READY"
    )) {
      console.log("🚑 SELF-HEALING ACTIVATED: Refreshing Session...");
      try {
        // 1. Generate New Cookie (Login logic internal to generateCookie or login+generateCookie)
        // Note: The original code imported login/generateCookie. We must ensure they work.
        // Assuming login() returns token, and generateCookie(token) sets the cookie.
        const token = await login();
        await generateCookie(token);

        // 2. Retry Fetch (Recursion with retry = false)
        console.log("🔄 Retrying Stream Fetch with New Session...");
        return await fetchStream(matchId, false);

      } catch (retryError) {
        console.log("❌ SELF-HEAL FAILED:", retryError.message);
        // Return original error or null, don't crash the server
        throw e; // Throw original error to let caller handle it
      }
    }

    throw e;
  }
}

module.exports = { fetchStream };
