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
