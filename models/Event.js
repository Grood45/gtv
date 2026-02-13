const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    eventId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    eventType: { type: String }, // Cricket, Soccer, etc.
    marketId: { type: String },
    openDate: { type: Date },
    rawData: { type: Object }, // Store full object for flexibility
    streamUrl: { type: String, default: null }, // ⚡ PRE-FETCHED URL
    updatedAt: { type: Date, default: Date.now }
});

// ⚡ Indexes for High Performance
eventSchema.index({ "rawData.streamingChannel": 1 });

module.exports = mongoose.model("Event", eventSchema);
