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

async function getFancyOdds(eventId, retry = true) {
    const cacheKey = `fancy_odds:${eventId}`;

    // 🏎️ 1. Try L1 Memory Cache First
    const l1Entry = L1_CACHE.get(cacheKey);
    if (l1Entry && l1Entry.expiry > Date.now()) return l1Entry.data;

    // 🏎️ 2. Read from Redis Envelope for Stale-If-Error Support
    let staleData = null;
    try {
        const cachedStr = await redisClient.get(cacheKey);
        if (cachedStr) {
            const envelope = JSON.parse(cachedStr);
            if (envelope.savedAt && envelope.payload) {
                const age = Date.now() - envelope.savedAt;
                if (age < 2000) { // Fresh (< 2 seconds)
                    L1_CACHE.set(cacheKey, { data: envelope.payload, expiry: Date.now() + L1_TTL });
                    return envelope.payload;
                }
                staleData = envelope.payload; // Stale (older than 2s), keep as fallback
            } else {
                staleData = envelope; // Legacy fallback
            }
        }
    } catch(e) {}

    try {
        const cookie = getCookie();
        if (!cookie) throw new Error("COOKIE_NOT_READY");

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

        // 🕵️ Expert URL Refactor: semicolon jsessionid
        const exactUrl = `${FANCY_API_URL};jsessionid=${queryPass}`;

        const payload = new URLSearchParams({
            eventId: String(eventId),
            version: "0",
            oddsSettingVersion: "0",
            selectionTs: "0"
        }).toString();

        const proxyUrl = getNextProxy();
        // console.log(`📡 [FANCY] Fetching fresh data for Event: ${eventId}`);

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
            // console.log(`✅ [FANCY] Cache updated (SelectionTS: ${res.data?.selectionTs || 'N/A'})`);
            return res.data;
        }

    } catch (error) {
        if (retry && (error.message === "NOT_AUTHORIZED" || error.message === "COOKIE_NOT_READY")) {
            try {
                const token = await login();
                await generateCookie(token);
                await new Promise(r => setTimeout(r, 200));
                return await getFancyOdds(eventId, false);
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
}

module.exports = { getFancyOdds };
