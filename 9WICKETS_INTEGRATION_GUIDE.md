# 9Wickets Provider Integration Guide & Runbook

This runbook outlines the integration of the **9Wickets** (`saapipl.9wickets.com`) provider into the `gtv-main` project.

---

## Part 1: Two-Step Session & Login Verification (Passes Correctly)

The 9Wickets authentication is protected and requires a two-step validation:
1. **Initial GET**: Fetch `https://saapipl.9wickets.com/` to retrieve the initial `JSESSIONID` cookie and extract a hidden `valid` token from the HTML body.
2. **Form Login POST**: Send a POST request containing the logged-in cookie and a salted double SHA-1 password:
   Formula: `sha1( sha1(plainPassword) + validToken )`

### 1.1 The Verification Script
We have created this script in `scratch/test_9wicket_login.js`. It contains the complete automated session initialization, parsing, and authentication sequence.

```javascript
const axios = require('axios');
const crypto = require('crypto');

function sha1(str) {
    return crypto.createHash('sha1').update(str).digest('hex');
}

async function test9WicketsLogin() {
    const loginName = "9wdemo15";
    const plainPassword = "Abcd1234"; 

    try {
        console.log("=========================================");
        console.log("🚀 STEP 1: Fetching Initial HTML & Cookie...");
        console.log("=========================================");

        const initRes = await axios.get("https://saapipl.9wickets.com/", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0"
            },
            timeout: 10000
        });

        const initCookie = initRes.headers["set-cookie"] || (initRes.request?.res?.headers["set-cookie"]);
        if (!initCookie || !Array.isArray(initCookie)) {
            throw new Error("No cookies returned from initialization GET request");
        }

        const jsessionHeader = initCookie.find((c) => c.includes("JSESSIONID"));
        if (!jsessionHeader) {
            throw new Error("JSESSIONID cookie missing from initial response headers");
        }

        const initialJSessionId = jsessionHeader.split(";")[0];
        console.log("✅ Initial JSESSIONID Extracted:", initialJSessionId);

        // Extract valid token using RegExp from HTML body
        const html = initRes.data;
        const validMatch = html.match(/name="valid"\s+type="hidden"\s+value="([^"]+)"/) || 
                           html.match(/id="loginBoxValid"[^>]*value="([^"]+)"/);
        
        if (!validMatch) {
            throw new Error("Failed to find 'valid' hidden token in the HTML body");
        }

        const validToken = validMatch[1];
        console.log("✅ Validation Token Extracted:", validToken);

        console.log("\n=========================================");
        console.log("🚀 STEP 2: Executing Salted Double SHA-1 Hashing...");
        console.log("=========================================");

        // Formula: sha1( sha1(plainPassword) + validToken )
        const firstHash = sha1(plainPassword);
        const passwordPayload = sha1(firstHash + validToken);

        console.log(`Plain Password: "${plainPassword}"`);
        console.log(`Step 1 Hash: "${firstHash}"`);
        console.log(`Final Password Payload: "${passwordPayload}"`);

        console.log("\n=========================================");
        console.log("🚀 STEP 3: Executing POST Login...");
        console.log(`Username: ${loginName}`);
        console.log("=========================================");

        const payload = new URLSearchParams();
        payload.append('loginName', loginName);
        payload.append('valid', validToken);
        payload.append('password', passwordPayload);
        payload.append('validCode', '');
        payload.append('resetPassword', 'false');
        payload.append('termsVersion', '[]');

        const loginRes = await axios.post("https://saapipl.9wickets.com/login/memberAuthController/login", payload.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json, text/plain, */*",
                "source": "1",
                "Cookie": initialJSessionId,
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
                "Origin": "https://www.9wickets.com",
                "Referer": "https://www.9wickets.com/"
            },
            timeout: 15000
        });

        console.log("Login Response Status:", loginRes.status);
        console.log("Login Response Data:", JSON.stringify(loginRes.data, null, 2));

        if (loginRes.data?.status === "0000" && loginRes.data?.status_msg === "Success") {
            console.log("\n=========================================");
            console.log("🎉 SUCCESS! 9WICKETS LOGIN COMPLETED SUCCESSFULLY.");
            
            let finalJSession = initialJSessionId;
            const loggedInCookies = loginRes.headers["set-cookie"] || (loginRes.request?.res?.headers["set-cookie"]);
            if (loggedInCookies && Array.isArray(loggedInCookies)) {
                const loggedInJSessionHeader = loggedInCookies.find((c) => c.includes("JSESSIONID"));
                if (loggedInJSessionHeader) {
                    finalJSession = loggedInJSessionHeader.split(";")[0];
                }
            }
            console.log(`FINAL AUTHORIZED COOKIE = ${finalJSession}`);
            console.log("=========================================");
        } else {
            console.error("\n❌ Login reported failure status:", loginRes.data);
        }

    } catch (err) {
        console.error("\n❌ TEST FAILED!");
        console.error("Error Message:", err.message);
    }
}

test9WicketsLogin();
```

### 1.2 Execution Command
```bash
node scratch/test_9wicket_login.js
```

---

## Part 2: Integration Steps

Once valid credentials are provided and Step 1 outputs `🎉 SUCCESS!`, apply these modifications to register 9Wickets as a system provider.

### 2.1 Step 1: Update Configuration

#### 1. In `config/config.js`
Add `NINEWICKETS` config inside `module.exports`:
```javascript
  NINEWICKETS: {
    username: process.env.NINEWICKETS_USERNAME || "9wdemo15",
    password: process.env.NINEWICKETS_PASSWORD || "Abcd1234",
  }
```

#### 2. In `.env`
Add the feature flags and credentials:
```properties
# COOKIE PROVIDER FEATURE FLAGS
USE_BIGWIN_PROVIDER=false
USE_SKYPUNT_PROVIDER=false
USE_JEETWIN_PROVIDER=false
USE_NINEWICKETS_PROVIDER=true

# 9Wickets Credentials
NINEWICKETS_USERNAME=9wdemo15
NINEWICKETS_PASSWORD=Abcd1234
```

---

### 2.2 Step 2: Create the 9Wickets Adapter
Create `adapters/ninewickets.adapter.js`:

```javascript
const axios = require('axios');
const crypto = require('crypto');
const { NINEWICKETS } = require('../config/config');

function sha1(str) {
    return crypto.createHash('sha1').update(str).digest('hex');
}

class NineWicketsAdapter {
    constructor() {
        this.cookiePromise = null;
    }

    async initSession() {
        if (this.cookiePromise) return this.cookiePromise;

        this.cookiePromise = (async () => {
            try {
                console.log("📡 FETCHING COOKIE VIA 9WICKETS ADAPTER...");
                
                // 1. Fetch the initial landing page to get the validation session cookie & hidden input token
                const initRes = await axios.get("https://saapipl.9wickets.com/", {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0"
                    },
                    timeout: 10000
                });

                const initCookie = initRes.headers["set-cookie"] || (initRes.request?.res?.headers["set-cookie"]);
                if (!initCookie || !Array.isArray(initCookie)) {
                    throw new Error("NINEWICKETS_INIT_COOKIE_MISSING");
                }

                const jsessionHeader = initCookie.find((c) => c.includes("JSESSIONID"));
                if (!jsessionHeader) {
                    throw new Error("NINEWICKETS_INIT_JSESSIONID_MISSING");
                }

                const initialJSessionId = jsessionHeader.split(";")[0];

                const html = initRes.data;
                const validMatch = html.match(/name="valid"\s+type="hidden"\s+value="([^"]+)"/) || 
                                   html.match(/id="loginBoxValid"[^>]*value="([^"]+)"/);
                
                if (!validMatch) {
                    throw new Error("NINEWICKETS_VALIDATION_TOKEN_MISSING");
                }

                const validToken = validMatch[1];

                // 2. Encrypt Password using the salted double SHA-1 algorithm
                const firstHash = sha1(NINEWICKETS.password);
                const passwordPayload = sha1(firstHash + validToken);

                // 3. Perform the actual POST login with the encrypted password and session cookie
                const payload = new URLSearchParams();
                payload.append('loginName', NINEWICKETS.username);
                payload.append('valid', validToken);
                payload.append('password', passwordPayload);
                payload.append('validCode', '');
                payload.append('resetPassword', 'false');
                payload.append('termsVersion', '[]');

                const loginRes = await axios.post("https://saapipl.9wickets.com/login/memberAuthController/login", payload.toString(), {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Accept": "application/json, text/plain, */*",
                        "source": "1",
                        "Cookie": initialJSessionId,
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
                        "Origin": "https://www.9wickets.com",
                        "Referer": "https://www.9wickets.com/"
                    },
                    timeout: 15000
                });

                if (loginRes.data?.status !== "0000" || loginRes.data?.status_msg !== "Success") {
                    throw new Error(`9WICKETS_LOGIN_FAILED: ${loginRes.data?.status_msg || 'Unknown Status'}`);
                }

                let finalJSession = initialJSessionId;
                const loggedInCookies = loginRes.headers["set-cookie"] || (loginRes.request?.res?.headers["set-cookie"]);
                if (loggedInCookies && Array.isArray(loggedInCookies)) {
                    const loggedInJSessionHeader = loggedInCookies.find((c) => c.includes("JSESSIONID"));
                    if (loggedInJSessionHeader) {
                        finalJSession = loggedInJSessionHeader.split(";")[0];
                    }
                }

                const finalJSessionValue = finalJSession.split("JSESSIONID=")[1]?.split(";")[0];
                console.log("✅ 9WICKETS SESSION COOKIE RETRIEVED:", finalJSessionValue);
                return finalJSessionValue;
            } finally {
                this.cookiePromise = null;
            }
        })();

        return this.cookiePromise;
    }
}

module.exports = new NineWicketsAdapter();
```

---

### 2.3 Step 3: Register in Cookie Controller

In `controllers/cookie.controller.js`:

1. **Import the Adapter**:
   ```javascript
   const ninewicketsAdapter = require("../adapters/ninewickets.adapter");
   ```

2. **Update the Strategy inside `generateCookie()`**:
   ```javascript
         const useSkypunt = process.env.USE_SKYPUNT_PROVIDER === 'true';
         const useBigwin = process.env.USE_BIGWIN_PROVIDER === 'true';
         const useJeetwin = process.env.USE_JEETWIN_PROVIDER === 'true';
         const useNineWickets = process.env.USE_NINEWICKETS_PROVIDER === 'true'; // Add 9Wickets flag
   
         if (useSkypunt) {
           providerName = "SKYPUNT";
           newCookieValue = await skypuntAdapter.initSession();
         } else if (useBigwin) {
           providerName = "BIGWIN";
           newCookieValue = await bigwinAdapter.initSession();
         } else if (useJeetwin) {
           providerName = "JEETWIN";
           newCookieValue = await jeetwinAdapter.initSession();
         } else if (useNineWickets) {
           providerName = "NINEWICKETS"; // Add 9Wickets strategy
           newCookieValue = await ninewicketsAdapter.initSession();
         } else {
           throw new Error("NO_COOKIE_PROVIDER_ENABLED_IN_ENV");
         }
   ```
