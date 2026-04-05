/**
 * 🕵️ Proxy Management Service
 * Rotates between an array of residential or mobile proxies to prevent IP bans.
 * Update PROXY_LIST under environment variables for production.
 */
let proxyIndex = 0;
const PROXY_LIST = process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [];

/**
 * Returns a proxy URL for the next request.
 * Implements round-robin rotation.
 * @returns {string|null} - Proxy URL or null if no proxies defined.
 */
function getNextProxy() {
    if (PROXY_LIST.length === 0) return null;
    
    const proxy = PROXY_LIST[proxyIndex];
    proxyIndex = (proxyIndex + 1) % PROXY_LIST.length;
    
    return proxy;
}

/**
 * Formats a proxy string into an Axios-compatible object or string.
 * Supports protocols like http, https, and socks5.
 * @param {string} proxyStr - Proxy string (e.g. http://user:pass@host:port)
 */
function parseProxy(proxyStr) {
    if (!proxyStr) return null;
    return proxyStr; // Standard Axios proxy format
}

module.exports = {
    getNextProxy,
    parseProxy,
    count: PROXY_LIST.length
};
