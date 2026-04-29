const mongoose = require('mongoose');
require('dotenv').config();

async function checkDB() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/glivestreaming_local';
    console.log('Connecting to:', mongoUri);
    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Connection Successful');
        const dbs = await mongoose.connection.db.admin().listDatabases();
        console.log('Databases:', dbs.databases.map(d => d.name));
    } catch (e) {
        console.error('❌ Connection Failed:', e.message);
    }
    process.exit(0);
}

checkDB();
