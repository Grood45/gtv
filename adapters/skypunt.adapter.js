const axios = require('axios');

class SkypuntAdapter {
    constructor() {
        this.cookiePromise = null;
    }

    async initSession() {
        if (this.cookiePromise) return this.cookiePromise;

        this.cookiePromise = (async () => {
            try {
                console.log("📡 FETCHING COOKIE VIA SKYPUNT ADAPTER...");
                
                // Skypunt does NOT need any pre-login token. It directly fetches the game URL.
                const skyRes = await axios.post("https://skypunt1.com/api/login_into_cricket/13", {}, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0"
                    },
                    timeout: 15000
                });

                if (skyRes.data?.status !== "success" || !skyRes.data?.url) {
                    throw new Error("SKYPUNT_KEY_API_FAILED");
                }

                const gameUrl = skyRes.data.url;

                const sessionRes = await axios.get(gameUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0"
                    },
                    timeout: 20000,
                    maxRedirects: 5,
                    validateStatus: (status) => status >= 200 && status < 400
                });

                const setCookie = sessionRes.headers["set-cookie"] || (sessionRes.request?.res?.headers["set-cookie"]);
                if (!setCookie || !Array.isArray(setCookie)) throw new Error("COOKIE_HEADER_MISSING_FROM_SKYPUNT");

                const jsessionHeader = setCookie.find((c) => c.includes("JSESSIONID"));
                if (!jsessionHeader) throw new Error("JSESSIONID_NOT_FOUND_FROM_SKYPUNT");

                const jsessionValue = jsessionHeader.split("JSESSIONID=")[1]?.split(";")[0];
                if (!jsessionValue) throw new Error("INVALID_JSESSIONID_FROM_SKYPUNT");

                return jsessionValue;
            } finally {
                this.cookiePromise = null;
            }
        })();

        return this.cookiePromise;
    }
}

module.exports = new SkypuntAdapter();
