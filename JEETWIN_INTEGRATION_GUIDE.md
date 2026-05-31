# Jeetwin Provider Integration Guide & Runbook

This runbook provides step-by-step instructions for integrating the **Jeetwin** (`www.jeetwin.pro`) provider into the `gtv-main` project. 

> [!WARNING]
> **CRITICAL PRE-REQUISITE**: `www.jeetwin.pro` blocks automated/non-browser requests unless routed through a valid network route (such as an Indian residential proxy or a specialized proxy agent). 
> Before performing the integration, you **MUST** ensure you have a working proxy. The default proxy inside `.env` returned an **HTTP 402 (Payment Required)** error during testing, which indicates it has expired.

---

## Part 1: Verification Flow (MUST Run & Pass First)

Before making any changes to the core project, you must verify authentication and session cookie extraction using a self-contained test script.

### 1.1 The Verification Script
We have created this script in `scratch/test_jeetwin_login.js`. It contains the complete logic to login, request the game launch URL, and extract the session cookie (`JSESSIONID`) through a proxy agent.

```javascript
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

async function testJeetwinLogin() {
    const username = "sher321";
    const password = "Sher123";
    const fingerprintId = "4af6b16fd12cd1535137a6deff6c4f87";
    const gameId = 6163;

    // 1. UPDATE THIS URL WITH A VALID, WORKING PROXY
    const proxyUrl = process.env.PROXY_LIST || "http://YOUR_WORKING_PROXY_HERE";
    console.log(`Using Proxy: ${proxyUrl}`);
    const agent = new HttpsProxyAgent(proxyUrl);

    try {
        console.log("=========================================");
        console.log("🚀 STEP 1: Attempting Jeetwin Login...");
        console.log(`Username: ${username}`);
        console.log("=========================================");

        const loginRes = await axios.post("https://www.jeetwin.pro/service/auth/login", {
            deviceType: 0,
            pwd: password,
            userFPInfo: {},
            id: fingerprintId,
            username: username
        }, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
                "Origin": "https://www.jeetwin.pro",
                "Referer": "https://www.jeetwin.pro/"
            },
            httpsAgent: agent,
            timeout: 15000
        });

        console.log("Login Response Status:", loginRes.status);
        console.log("Login Response Data:", JSON.stringify(loginRes.data, null, 2));

        if (loginRes.data?.code !== "common.success" || !loginRes.data?.data?.token) {
            throw new Error(`Login failed with code: ${loginRes.data?.code || 'unknown'}`);
        }

        const { token, refreshToken } = loginRes.data.data;
        console.log("\n✅ STEP 1 SUCCESSFUL!");

        console.log("\n=========================================");
        console.log("🚀 STEP 2: Requesting Game Launch URL...");
        console.log(`Game ID: ${gameId}`);
        console.log("=========================================");

        const launchRes = await axios.post("https://www.jeetwin.pro/service/game/launchUrl", {
            deviceType: 0,
            domain: "https://www.jeetwin.pro",
            gameId: gameId
        }, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "authorization": token,
                "refreshtoken": refreshToken,
                "ocms-currency": "INR",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
                "Origin": "https://www.jeetwin.pro",
                "Referer": "https://www.jeetwin.pro/"
            },
            httpsAgent: agent,
            timeout: 15000
        });

        console.log("Launch Response Status:", launchRes.status);
        console.log("Launch Response Data:", JSON.stringify(launchRes.data, null, 2));

        if (launchRes.data?.code !== "common.success" || !launchRes.data?.data?.gameLaunch) {
            throw new Error(`Launch URL failed with code: ${launchRes.data?.code || 'unknown'}`);
        }

        const gameLaunchUrl = launchRes.data.data.gameLaunch;
        console.log("\n✅ STEP 2 SUCCESSFUL!");
        console.log("Game Launch URL:", gameLaunchUrl);

        console.log("\n=========================================");
        console.log("🚀 STEP 3: Visiting Game Launch URL to extract Cookie...");
        console.log("=========================================");

        const sessionRes = await axios.get(gameLaunchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0"
            },
            httpsAgent: agent,
            timeout: 20000,
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400
        });

        console.log("Session Response Status:", sessionRes.status);
        
        const setCookie = sessionRes.headers["set-cookie"] || (sessionRes.request?.res?.headers["set-cookie"]);
        console.log("Response Cookies Found:", setCookie);

        if (!setCookie || !Array.isArray(setCookie)) {
            throw new Error("No cookies returned from launch URL");
        }

        const jsessionHeader = setCookie.find((c) => c.includes("JSESSIONID"));
        if (!jsessionHeader) {
            throw new Error("JSESSIONID not found in set-cookie headers");
        }

        const jsessionValue = jsessionHeader.split("JSESSIONID=")[1]?.split(";")[0];
        if (!jsessionValue) {
            throw new Error("Invalid or empty JSESSIONID value");
        }

        console.log("\n=========================================");
        console.log("🎉 SUCCESS! EXTRACTED JSESSIONID COOKIE:");
        console.log(`JSESSIONID = ${jsessionValue}`);
        console.log("=========================================");

    } catch (err) {
        console.error("\n❌ TEST FAILED!");
        if (err.response) {
            console.error("HTTP Response Error Code:", err.response.status);
            console.error("HTTP Response Error Data:", err.response.data);
        } else {
            console.error("Error Message:", err.message);
        }
    }
}

testJeetwinLogin();
```

### 1.2 Execution Command
Configure your updated proxy inside `.env` or direct script, then run:
```bash
node scratch/test_jeetwin_login.js
```

> [!IMPORTANT]
> **Only proceed to Part 2 if the output displays the final `🎉 SUCCESS! EXTRACTED JSESSIONID COOKIE:` status.**

---

## Part 2: Integration Steps

Once the verification flow succeeds, apply these exact code modifications to register Jeetwin into the active system.

### 2.1 Step 1: Update Configuration

#### 1. In `config/config.js`
Add `JEETWIN` configuration parameters inside `module.exports`:
```javascript
  JEETWIN: {
    username: process.env.JEETWIN_USERNAME || "sher321",
    password: process.env.JEETWIN_PASSWORD || "Sher123",
    gameId: parseInt(process.env.JEETWIN_GAME_ID || "6163", 10),
    fingerprintId: process.env.JEETWIN_FINGERPRINT_ID || "4af6b16fd12cd1535137a6deff6c4f87",
    proxy: process.env.PROXY_LIST
  }
```

#### 2. In `.env`
Add the feature flag, credential variables, and update with the valid proxy string:
```properties
# COOKIE PROVIDER FEATURE FLAGS
USE_BIGWIN_PROVIDER=false
USE_SKYPUNT_PROVIDER=false
USE_JEETWIN_PROVIDER=true

# Jeetwin Credentials
JEETWIN_USERNAME=sher321
JEETWIN_PASSWORD=Sher123
JEETWIN_GAME_ID=6163
JEETWIN_FINGERPRINT_ID=4af6b16fd12cd1535137a6deff6c4f87

# Update with active residential Indian proxy
PROXY_LIST=http://username:password@ip:port
```

---

### 2.2 Step 2: Create the Jeetwin Adapter
Create a new file named `adapters/jeetwin.adapter.js` and paste the following complete production code:

```javascript
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { JEETWIN } = require('../config/config');

class JeetwinAdapter {
    constructor() {
        this.cookiePromise = null;
    }

    async initSession() {
        if (this.cookiePromise) return this.cookiePromise;

        this.cookiePromise = (async () => {
            try {
                console.log("📡 FETCHING COOKIE VIA JEETWIN ADAPTER...");
                
                // Initialize Proxy Agent
                let axiosOptions = { timeout: 15000 };
                if (JEETWIN.proxy) {
                    axiosOptions.httpsAgent = new HttpsProxyAgent(JEETWIN.proxy);
                }

                // 1. Authenticate with Jeetwin
                const loginRes = await axios.post("https://www.jeetwin.pro/service/auth/login", {
                    deviceType: 0,
                    pwd: JEETWIN.password,
                    userFPInfo: {},
                    id: JEETWIN.fingerprintId,
                    username: JEETWIN.username
                }, {
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
                        "Origin": "https://www.jeetwin.pro",
                        "Referer": "https://www.jeetwin.pro/"
                    },
                    ...axiosOptions
                });

                if (loginRes.data?.code !== "common.success" || !loginRes.data?.data?.token) {
                    throw new Error(`JEETWIN_LOGIN_FAILED: ${loginRes.data?.message || 'Invalid Response'}`);
                }

                const { token, refreshToken } = loginRes.data.data;

                // 2. Fetch the game launch URL
                const launchRes = await axios.post("https://www.jeetwin.pro/service/game/launchUrl", {
                    deviceType: 0,
                    domain: "https://www.jeetwin.pro",
                    gameId: JEETWIN.gameId
                }, {
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "authorization": token,
                        "refreshtoken": refreshToken,
                        "ocms-currency": "INR",
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
                        "Origin": "https://www.jeetwin.pro",
                        "Referer": "https://www.jeetwin.pro/"
                    },
                    ...axiosOptions
                });

                if (launchRes.data?.code !== "common.success" || !launchRes.data?.data?.gameLaunch) {
                    throw new Error("JEETWIN_LAUNCH_URL_FAILED");
                }

                const gameLaunchUrl = launchRes.data.data.gameLaunch;

                // 3. Extract the JSESSIONID from the game launch response headers
                const sessionRes = await axios.get(gameLaunchUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0"
                    },
                    maxRedirects: 5,
                    validateStatus: (status) => status >= 200 && status < 400,
                    ...axiosOptions,
                    timeout: 20000
                });

                const setCookie = sessionRes.headers["set-cookie"] || (sessionRes.request?.res?.headers["set-cookie"]);
                if (!setCookie || !Array.isArray(setCookie)) {
                    throw new Error("COOKIE_HEADER_MISSING_FROM_JEETWIN");
                }

                const jsessionHeader = setCookie.find((c) => c.includes("JSESSIONID"));
                if (!jsessionHeader) {
                    throw new Error("JSESSIONID_NOT_FOUND_FROM_JEETWIN");
                }

                const jsessionValue = jsessionHeader.split("JSESSIONID=")[1]?.split(";")[0];
                if (!jsessionValue) {
                    throw new Error("INVALID_JSESSIONID_FROM_JEETWIN");
                }

                console.log("✅ JEETWIN SESSION COOKIE RETRIEVED:", jsessionValue);
                return jsessionValue;
            } finally {
                this.cookiePromise = null;
            }
        })();

        return this.cookiePromise;
    }
}

module.exports = new JeetwinAdapter();
```

---

### 2.3 Step 3: Register in Cookie Controller

In `controllers/cookie.controller.js`:

1. **Import the Adapter** (at the top of the file):
   ```javascript
   const jeetwinAdapter = require("../adapters/jeetwin.adapter");
   ```

2. **Update the Flag Parsing & Adapter Strategy inside `generateCookie()`**:
   ```javascript
         const useSkypunt = process.env.USE_SKYPUNT_PROVIDER === 'true';
         const useBigwin = process.env.USE_BIGWIN_PROVIDER === 'true';
         const useJeetwin = process.env.USE_JEETWIN_PROVIDER === 'true'; // Add Jeetwin parsing
   
         // 🚀 STRATEGY PATTERN: Delegate to the active adapter
         if (useSkypunt) {
           providerName = "SKYPUNT";
           newCookieValue = await skypuntAdapter.initSession();
         } else if (useBigwin) {
           providerName = "BIGWIN";
           newCookieValue = await bigwinAdapter.initSession();
         } else if (useJeetwin) {
           providerName = "JEETWIN"; // Add Jeetwin strategy
           newCookieValue = await jeetwinAdapter.initSession();
         } else {
           throw new Error("NO_COOKIE_PROVIDER_ENABLED_IN_ENV");
         }
   ```

---

## Part 3: Final System Verification

Once integrated, run the dev server or startup warmup logic to confirm it successfully runs:

1. **Start Server:**
   ```bash
   npm run dev
   ```
2. **Inspect Warmup Logs:**
   Ensure you see the following outputs during server boot sequence:
   ```text
   ⚡ WARMUP START
   📡 FETCHING COOKIE VIA JEETWIN ADAPTER...
   ✅ JEETWIN SESSION COOKIE RETRIEVED: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ✅ COOKIE UPDATED SAFELY (JEETWIN ADAPTER)
   🚀 SYSTEM READY (FRESH LOGIN)
   ```
3. **Database Check:**
   Verify inside your MongoDB `SystemConfig` collection that the document `{ key: "COOKIE" }` successfully updated with the newly retrieved Jeetwin `JSESSIONID` string value.
