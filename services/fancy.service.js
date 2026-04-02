const axios = require('axios');
const redisClient = require('../utils/redis');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');

const FANCY_API_URL = "https://bkqawscf.gu21go76.xyz/exchange/member/playerService/queryFancyBetMarkets";

async function getFancyOdds(eventId, retry = true) {
    const cacheKey = `fancy_odds:${eventId}`;

    try {
        // 1. Check Redis Cache First
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
            console.log(`⚡ [CACHE HIT] Serving Fancy Odds from Redis for Event: ${eventId}`);
            return JSON.parse(cachedData);
        }

        // 2. Cache Miss - Fetch from Upstream API
        console.log(`🌐 [CACHE MISS] Fetching Fancy Odds from Skyinplay API for Event: ${eventId}`);

        const cookie = getCookie();
        if (!cookie) {
            throw new Error("COOKIE_NOT_READY");
        }

        // Dynamically extract JSESSIONID
        let queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) {
             throw new Error("INVALID_COOKIE_FORMAT_NO_JSESSIONID");
        }

        // User's trace uses the raw JSESSIONID token for 'queryPass' but passing it as JSESSIONID parameter in URL is also acceptable if needed.
        // Wait, the new trace shows: 
        // URL: /exchange/member/playerService/queryFancyBetMarkets;jsessionid=42308EA7CB8D3240D50B108E0C676828.player13
        // Payload: eventId, version, oddsSettingVersion, selectionTs (queryPass is NOT in the new payload!)
        
        // Exact URL generation with jsessionid parameter
        const exactUrl = `${FANCY_API_URL};jsessionid=${queryPass}`;

        const payload = new URLSearchParams({
            eventId: String(eventId),
            version: "0",
            oddsSettingVersion: "0",
            selectionTs: "0"
        }).toString();

        const res = await axios.post(exactUrl, payload, {
            headers: {
                "Accept": "application/json, text/plain, */*",
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Accept-Language": "en-US,en;q=0.9",
                "Authorization": queryPass, // Trace uses JSESSIONID value as Authorization header
                "Connection": "keep-alive",
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": cookie,
                "Host": "bkqawscf.gu21go76.xyz",
                "Origin": "https://www.gu21go76.xyz",
                "Referer": "https://www.gu21go76.xyz/",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-site",
                "source": "1",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:148.0) Gecko/20100101 Firefox/148.0"
            },
            timeout: 10000, // 10 seconds timeout for upstream
            validateStatus: (status) => {
                return status >= 200 && status < 500; 
            }
        });

        // Skyinplay sometimes returns 200 OK but with HTML "You have logged out!!"
        if (
            res.status === 410 || 
            (res.data && res.data.message === "You have logged out!! Please login and try again!!") ||
            (typeof res.data === 'string' && res.data.includes("You have logged out!!"))
        ) {
            throw new Error("NOT_AUTHORIZED");
        }

        const fancyData = res.data;

        // 3. Save to Redis with 2 seconds TTL
        // Using EX (seconds) for expiration
        if (fancyData && fancyData.status === "1" || fancyData.fancyBetMarkets) {
             await redisClient.set(cacheKey, JSON.stringify(fancyData), {
                EX: 2 // ⚡ 2 SECONDS TTL: Highly optimized for real-time without banning
            });
            console.log(`💾 [CACHE SAVE] Cached Fancy Odds for Event: ${eventId} for 2s`);
        } else {
             console.log(`⚠️ [API WARNING] Unexpected response format from Fancy API for Event: ${eventId}`);
             // Depending on the response, you might or might not want to cache a failed/empty state.
             // For now, let's cache empty/error states for a very short time (1s) to prevent spamming on failure.
             await redisClient.set(cacheKey, JSON.stringify(fancyData), { EX: 1 });
        }

        return fancyData;

    } catch (error) {
        console.error(`❌ [FANCY_SERVICE_ERROR] Failed to fetch fancy odds for ${eventId}:`, error.message);

        // 🔄 SELF-HEALING: Retry ONCE if unauthorized or cookie issue
        if (retry && (
            error.message === "NOT_AUTHORIZED" ||
            error.message === "COOKIE_NOT_READY" ||
            error.response?.status === 401 ||
            error.response?.status === 403 ||
            error.response?.status === 410
        )) {
            console.log("🚑 SELF-HEALING ACTIVATED: Refreshing Session for Fancy API...");
            try {
                // Generate New Cookie
                const token = await login();
                await generateCookie(token);

                // Retry Fetch
                console.log("🔄 Retrying Fancy Fetch with New Session...");
                return await getFancyOdds(eventId, false);

            } catch (retryError) {
                console.log("❌ SELF-HEAL FAILED FANCY API:", retryError.message);
                throw error; 
            }
        }

        throw error;
    }
}

module.exports = { getFancyOdds };
