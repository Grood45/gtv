require('dotenv').config();

const PROXY_LIST = process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [];
let proxyIndex = 0;

/**
 * Filter out placeholder proxies that cause ECONNREFUSED ::1
 */
const VALID_PROXIES = PROXY_LIST.filter(p => 
    p.trim() !== "" && 
    !p.includes("host1") && 
    !p.includes("port") && 
    p.startsWith("http")
);

function getNextProxy() {
    if (VALID_PROXIES.length === 0) return null;
    const proxy = VALID_PROXIES[proxyIndex];
    proxyIndex = (proxyIndex + 1) % VALID_PROXIES.length;
    return proxy;
}

/**
 * Parses proxy string into Axios compatible object
 * @param {string} proxyUrl - Example: http://user:pass@host:port
 */
function parseProxy(proxyUrl) {
    try {
        const url = new URL(proxyUrl);
        return {
            protocol: url.protocol.replace(':', ''),
            host: url.hostname,
            port: parseInt(url.port),
            auth: {
                username: url.username,
                password: url.password
            }
        };
    } catch (e) {
        console.error("❌ Invalid Proxy URL:", proxyUrl);
        return null;
    }
}

module.exports = { getNextProxy, parseProxy };
