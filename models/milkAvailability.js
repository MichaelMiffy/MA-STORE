const mongoose = require('mongoose');

const milkSchema = new mongoose.Schema(
    {
        number: { type: Number, required: true },
        volume: { type: Number, required: true },
    },
    { collection: "MilkAvailability" } // Explicitly define the collection name
);

module.exports = mongoose.models.MilkAvailability || mongoose.model('MilkAvailability', milkSchema);
