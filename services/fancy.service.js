const axios = require('axios');
const redisClient = require('../utils/redis');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');

const FANCY_API_URL = "https://bxawscf.gu21go76.xyz/exchange/member/playerService/queryFancyBetMarkets";

// 🚀 L1 MEMORY CACHE
const L1_CACHE = new Map();
const L1_TTL = 1500; // 1.5s TTL for Fancy

// 🛡️ STAMPEDE LOCK (Mutex Map)
const inFlightRequests = new Map();

async function getFancyOdds(eventId, retry = true, forceFetch = false) {
    const cacheKey = `fancy_odds:${eventId}`;
    const lockKey = String(eventId);

    // 🏎️ 1. Try L1 Memory Cache First (Only for Readers, Writers force a fetch)
    if (!forceFetch) {
        const l1Entry = L1_CACHE.get(cacheKey);
        if (l1Entry && l1Entry.expiry > Date.now()) return l1Entry.data;

        // 🏎️ 2. Read from Redis Envelope (Readers ALWAYS take what's in cache)
        try {
            const cachedStr = await redisClient.get(cacheKey);
            if (cachedStr) {
                const envelope = JSON.parse(cachedStr);
                if (envelope.payload) {
                    L1_CACHE.set(cacheKey, { data: envelope.payload, expiry: Date.now() + L1_TTL });
                    return envelope.payload;
                }
                return envelope; // Legacy fallback
            }
        } catch(e) {}
    }

    // 🛡️ 3. If no cache exists OR it's a forceFetch, we lock it so 5000 users wait on ONE fetch.
    if (inFlightRequests.has(lockKey)) {
        return inFlightRequests.get(lockKey);
    }

    const fetchPromise = (async () => {
        let staleData = null;
        try {
            const cachedStr = await redisClient.get(cacheKey);
            if (cachedStr) {
                const envelope = JSON.parse(cachedStr);
                staleData = envelope.payload || envelope;
            }
        } catch(e) {}

        try {
            const cookie = getCookie();
            if (!cookie) throw new Error("COOKIE_NOT_READY");

            const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
            if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

            const exactUrl = FANCY_API_URL;

            const payload = new URLSearchParams({
                eventId: String(eventId),
                version: "0",
                oddsSettingVersion: "0",
                selectionTs: "0"
            }).toString();


            const res = await axios.post(exactUrl, payload, {
                headers: {
                    "Accept": "application/json, text/plain, */*",
                    "Authorization": queryPass,
                    "Cookie": cookie,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Origin": DEFAULT_ORIGIN,
                    "Referer": DEFAULT_REFERER,
                    "X-Requested-With": "XMLHttpRequest",
                    "Source": "1",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
                },
                timeout: 15000,
                validateStatus: (status) => status === 200 || status === 410
            });

            if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
                throw new Error("NOT_AUTHORIZED");
            }

            if (res.data) {
                const envelope = { savedAt: Date.now(), payload: res.data };
                L1_CACHE.set(cacheKey, { data: res.data, expiry: Date.now() + L1_TTL });
                await redisClient.set(cacheKey, JSON.stringify(envelope), { EX: 86400 }); // 24H Backup Profile
                return res.data;
            }

        } catch (error) {
            if (retry && (error.message === "NOT_AUTHORIZED" || error.message === "COOKIE_NOT_READY")) {
                try {
                    const token = await login();
                    await generateCookie();
                    await new Promise(r => setTimeout(r, 200));
                    return await getFancyOdds(eventId, false, true);
                } catch (e) {}
            }
            
            // STALE-IF-ERROR FALLBACK (Limited to 1 second to prevent permanent "stuck" states)
            if (staleData && (Date.now() - JSON.parse(await redisClient.get(cacheKey)).savedAt < 1000)) {
                console.log(`🛡️ [FANCY] API Failed (${error.message}). Returning STALE 1s Backup for Event: ${eventId}`);
                return staleData;
            }

            console.error(`❌ [FANCY] Error ${eventId}:`, error.message);
        }
        return staleData || null;
    })();

    inFlightRequests.set(lockKey, fetchPromise);
    try {
        const result = await fetchPromise;
        return result;
    } finally {
        inFlightRequests.delete(lockKey);
    }
}

module.exports = { getFancyOdds };
