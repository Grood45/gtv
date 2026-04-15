const httpClient = require('../utils/httpClient');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { FANCY_RESULT_API, EVENT_RESULTS_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');
const { getNextProxy, parseProxy } = require('./proxy.service');

/**
 * Fetch results for a specific Fancy market
 * @param {string|number} eventId - The ID of the event
 */
async function fetchFancyResult(eventId, retry = true) {
    try {
        const cookie = getCookie();
        if (!cookie) throw new Error("COOKIE_NOT_READY");

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

        // 🕵️ Expert URL Refactor: semicolon jsessionid in path
        const exactUrl = `${FANCY_RESULT_API};jsessionid=${queryPass}`;

        const body = new URLSearchParams({
            eventId: String(eventId),
            marketGroup: "1"
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
            timeout: 20000,
            validateStatus: (status) => status === 200 || status === 410
        };

        if (proxyUrl) config.proxy = parseProxy(proxyUrl);

        const res = await httpClient.post(exactUrl, body, config);

        if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
            throw new Error("NOT_AUTHORIZED");
        }

        return res.data;

    } catch (error) {
        console.error(`❌ Error fetching fancy results for event ID ${eventId}:`, error.message);

        // 🔄 SELF-HEALING: Retry ONCE if unauthorized
        if (retry && (
            error.message === "NOT_AUTHORIZED" || 
            error.message === "COOKIE_NOT_READY" ||
            error.response?.status === 401 ||
            error.response?.status === 410
        )) {
            console.log(`🚑 [FANCY_RESULT] Self-healing activated for event ${eventId}...`);
            try {
                const token = await login();
                await generateCookie(token);
                await new Promise(r => setTimeout(r, 200));
                return await fetchFancyResult(eventId, false);
            } catch (retryErr) {
                console.error("❌ Self-healing failed for fancy result:", retryErr.message);
            }
        }
        throw error;
    }
}

/**
 * Fetch general event results
 * @param {string} type - Timeframe ("today" or "yesterday")
 * @param {string|number} sportId - The ID of the sport
 */
async function fetchEventResults(type = "today", sportId = "4", retry = true) {
    try {
        const cookie = getCookie();
        if (!cookie) throw new Error("COOKIE_NOT_READY");

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

        // 🕵️ URL Refactor: Include jsessionid for Event API as well
        const exactUrl = `${EVENT_RESULTS_API};jsessionid=${queryPass}`;

        const body = new URLSearchParams({
            type: String(type),
            sport: String(sportId)
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
            timeout: 20000,
            validateStatus: (status) => status === 200 || status === 410
        };

        if (proxyUrl) config.proxy = parseProxy(proxyUrl);

        const res = await httpClient.post(exactUrl, body, config);

        if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
            throw new Error("NOT_AUTHORIZED");
        }

        return res.data;

    } catch (error) {
        console.error(`❌ Error fetching event results for sport ${sportId} (${type}):`, error.message);

        // 🔄 SELF-HEALING: Retry ONCE if unauthorized
        if (retry && (
            error.message === "NOT_AUTHORIZED" || 
            error.message === "COOKIE_NOT_READY" ||
            error.response?.status === 401 ||
            error.response?.status === 410
        )) {
            console.log(`🚑 [EVENT_RESULTS] Self-healing activated...`);
            try {
                const token = await login();
                await generateCookie(token);
                await new Promise(r => setTimeout(r, 200));
                return await fetchEventResults(type, sportId, false);
            } catch (retryErr) {
                console.error("❌ Self-healing failed for event results:", retryErr.message);
            }
        }
        throw error;
    }
}

module.exports = {
    fetchFancyResult,
    fetchEventResults
};
