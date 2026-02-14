const axios = require("axios");

/**
 * Extracts the inner stream URL from a FastOdds wrapper page.
 * @param {string} url - The URL to check and unwrap.
 * @returns {Promise<string>} - The inner URL if found, otherwise the original URL.
 */
async function unwrapFastOdds(url) {
    if (!url || !url.includes("fastodds.online")) return url;
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const match = response.data.match(/<iframe\s+src="([^"]+)"/);
        return match && match[1] ? match[1] : url;
    } catch (e) {
        console.log(`❌ Unwrap Error: ${e.message}`);
        return url;
    }
}

module.exports = { unwrapFastOdds };
