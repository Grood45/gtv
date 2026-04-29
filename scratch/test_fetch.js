const { fetchAndCacheFullMarkets } = require('../services/fullMarkets.service');
const { fetchAndCacheBookmaker } = require('../services/bookmaker.service');
const { getFancyOdds } = require('../services/fancy.service');
const { generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const redis = require('../utils/redis');
const connectDB = require('../config/db');

async function testFetch() {
    console.log('--- CONNECTING TO DB ---');
    await connectDB();

    const eventId = '35510579';
    const marketId = '1.257050891';

    console.log('--- TESTING FRESH LOGIN ---');
    try {
        await login();
        await generateCookie();
        console.log('Login successful');
    } catch (e) {
        console.error('Login failed:', e.message);
    }

    console.log('\n--- TESTING FULL MARKETS FETCH ---');
    const fullMarkets = await fetchAndCacheFullMarkets(eventId, marketId, true);
    console.log('Full Markets Result:', fullMarkets ? 'SUCCESS' : 'FAILED');
    if (fullMarkets) {
        console.log('Response Content:', JSON.stringify(fullMarkets).substring(0, 500) + '...');
    }

    console.log('\n--- TESTING BOOKMAKER FETCH ---');
    const bookmaker = await fetchAndCacheBookmaker(eventId, true);
    console.log('Bookmaker Result:', bookmaker ? 'SUCCESS' : 'FAILED');

    console.log('\n--- TESTING FANCY FETCH ---');
    const fancy = await getFancyOdds(eventId, true, true);
    console.log('Fancy Result:', fancy ? 'SUCCESS' : 'FAILED');

    process.exit(0);
}

testFetch().catch(err => {
    console.error(err);
    process.exit(1);
});
