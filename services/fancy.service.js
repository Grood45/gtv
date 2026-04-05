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
        console.log(`📡 [FANCY] Fetching fresh data for Event: ${eventId}`);

        const config = {
            headers: {
                "Authorization": queryPass,
                "Cookie": cookie,
                "Origin": DEFAULT_ORIGIN,
                "Referer": DEFAULT_REFERER,
                "X-Requested-With": "XMLHttpRequest",
                "Source": "1"
            },
            validateStatus: (status) => status >= 200 && status < 500
        };

        if (proxyUrl) config.proxy = parseProxy(proxyUrl);

        const res = await httpClient.post(exactUrl, payload, config);

        if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
            throw new Error("NOT_AUTHORIZED");
        }

        if (res.data) {
            L1_CACHE.set(cacheKey, { data: res.data, expiry: Date.now() + L1_TTL });
            await redisClient.set(cacheKey, JSON.stringify(res.data), { EX: 2 });
            console.log(`✅ [FANCY] Cache updated (SelectionTS: ${res.data?.selectionTs || 'N/A'})`);
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
        console.error(`❌ [FANCY] Error ${eventId}:`, error.message);
    }
    return null;
}

module.exports = { getFancyOdds };
