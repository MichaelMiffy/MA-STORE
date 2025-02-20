const mongoose = require('mongoose');

const userDataSchema = new mongoose.Schema(
    {
        phone: { type: String, required: true, unique: true },
        realName: { type: String, required: true },
        code: { type: String, required: true },
        link: { type: String, required: true },
        balance: { type: Number, required: true, default: 0 },
        message: { type: String, required: true },
    },
    { collection: 'UserData' }
);

module.exports = mongoose.model('UserData', userDataSchema);
