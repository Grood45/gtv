const axios = require('axios');
const { BIGWIN_KEY_URL, AUTH } = require('../config/config');
const { getTokens } = require('../storage/token');
const { login } = require('../controllers/auth.controller');

class BigwinAdapter {
    constructor() {
        this.cookiePromise = null;
    }

    async initSession() {
        if (this.cookiePromise) return this.cookiePromise;
        
        this.cookiePromise = (async () => {
            try {
                // Step 1: Bigwin requires a login token before fetching the cookie
                const token = await login();
                
                // Step 2: Fetch the actual cookie
                const { usernameToken } = getTokens();
                if (!token || !usernameToken) throw new Error("TOKENS_NOT_READY");

                console.log("📡 FETCHING COOKIE VIA BIGWIN ADAPTER...");
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
                            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0"
                        },
                        timeout: 15000
                    }
                );

                if (!keyRes.data?.success || !keyRes.data?.loginUrl) {
                    throw new Error("BIGWIN_KEY_API_FAILED");
                }

                const sessionRes = await axios.post(keyRes.data.loginUrl, {}, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0"
                    },
                    timeout: 20000,
                    maxRedirects: 0,
                    validateStatus: (status) => status >= 200 && status < 400
                });

                const setCookie = sessionRes.headers["set-cookie"];
                if (!setCookie) throw new Error("COOKIE_HEADER_MISSING_FROM_BIGWIN");

                const jsessionHeader = setCookie.find((c) => c.includes("JSESSIONID"));
                if (!jsessionHeader) throw new Error("JSESSIONID_NOT_FOUND_FROM_BIGWIN");

                const jsessionValue = jsessionHeader.split("JSESSIONID=")[1]?.split(";")[0];
                if (!jsessionValue) throw new Error("INVALID_JSESSIONID_FROM_BIGWIN");

                return jsessionValue;
            } finally {
                this.cookiePromise = null;
            }
        })();

        return this.cookiePromise;
    }
}

module.exports = new BigwinAdapter();
