const mongoose = require('mongoose');

const ItemOrderSchema = new mongoose.Schema({
    message: String,  // Order details (description, quantity, delivery, etc.)
    msisdn: String,   // Phone number
    amount: Number,   // Total amount
    refCode: String,  // Reference code
    createdAt: { type: Date, default: Date.now }  // Timestamp
});

// Ensure the collection is named 'itemOrders'
module.exports = mongoose.model('ItemOrder', ItemOrderSchema, 'itemOrders');