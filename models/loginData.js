const mongoose = require('mongoose');

const loginDataSchema = new mongoose.Schema(
    {
        phone: { type: String, required: true, unique: true },
        pin: { type: String, required: true },
    },
    { collection: 'LoginData' } // Explicitly use the 'LoginData' collection
);

module.exports = mongoose.model('LoginData', loginDataSchema, 'LoginData'); 
