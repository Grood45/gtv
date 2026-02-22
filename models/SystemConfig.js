const mongoose = require("mongoose");

const systemConfigSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true, // "AUTH_TOKEN", "COOKIE"
    },
    value: {
        type: mongoose.Schema.Types.Mixed, // Stores string or object
        required: true,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("SystemConfig", systemConfigSchema);
