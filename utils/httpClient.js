const axios = require('axios');
const http = require('http');
const https = require('https');

// 🚀 Highly optimized Agents for Keep-Alive
const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 200,
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
 * 🕵️ Expert Level Browser Headers (Mobile Emulation)
 * Based on the user's DH88 Request screenshot.
 */
const DEFAULT_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8',
    'Connection': 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    'sec-ch-ua': '"Chromium";v="146", "Not:A-Brand";v="24", "Google Chrome";v="146"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"iOS"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'X-Requested-With': 'XMLHttpRequest',
    'Source': '1'
};

const httpClient = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 10000,
    headers: DEFAULT_HEADERS
});

module.exports = httpClient;
