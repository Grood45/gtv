const redisClient = require('../utils/redis');
const httpClient = require('../utils/httpClient');
const { getNextProxy, parseProxy } = require('./proxy.service');
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

            const exactUrl = `${FANCY_API_URL};jsessionid=${queryPass}`;

            const payload = new URLSearchParams({
                eventId: String(eventId),
                version: "0",
                oddsSettingVersion: "0",
                selectionTs: "0"
            }).toString();

            const proxyUrl = getNextProxy();

            const config = {
                headers: {
                    "Authorization": queryPass,
                    "Cookie": cookie,
                    "Origin": DEFAULT_ORIGIN,
                    "Referer": DEFAULT_REFERER,
                    "X-Requested-With": "XMLHttpRequest",
                    "Source": "1"
                },
                validateStatus: (status) => status === 200 || status === 410
            };

            if (proxyUrl) config.proxy = parseProxy(proxyUrl);

            const res = await httpClient.post(exactUrl, payload, config);

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
                    await generateCookie(token);
                    await new Promise(r => setTimeout(r, 200));
                    return await getFancyOdds(eventId, false, true);
                } catch (e) {}
            }
            
            // STALE-IF-ERROR FALLBACK TRIGGER
            if (staleData) {
                console.log(`🛡️ [FANCY] API Failed (${error.message}). Returning STALE 24H Backup for Event: ${eventId}`);
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
