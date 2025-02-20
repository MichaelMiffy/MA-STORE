const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    description: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    image: { type: Buffer },  // Storing image as a buffer
    contentType: { type: String },
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
