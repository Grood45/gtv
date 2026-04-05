const axios = require('axios');
const http = require('http');
const https = require('https');

// 🚀 Highly optimized Agents for Keep-Alive
// This avoids expensive TCP handshakes on every request, 
// saving ~100-200ms of latency per poll.
const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 200, // Handle high concurrency
    maxFreeSockets: 20,
    timeout: 30000,
    freeSocketTimeout: 15000,
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 200,
    maxFreeSockets: 20,
    timeout: 30000,
    freeSocketTimeout: 15000,
    // 🕵️ Expert TLS Stealth: Mimic Chrome's Cipher Suite
    // This helps bypass JA3 fingerprinting used by anti-bot systems.
    ciphers: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-CHACHA20-POLY1305',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256'
    ].join(':'),
    honorCipherOrder: true,
    minVersion: 'TLSv1.2'
});

/**
 * Creates a pre-configured Axios instance for the betting API.
 * Includes stealth headers and optimized timeout settings.
 */
const httpClient = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 8000, // Slightly longer timeout for resilience
    headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'X-Requested-With': 'XMLHttpRequest'
    }
});

module.exports = httpClient;
