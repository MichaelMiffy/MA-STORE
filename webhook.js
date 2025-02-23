const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const ItemOrder = require('./models/ItemOrder');
const UserData = require('./models/userData'); // Import UserData schema
require('dotenv').config();

const router = express.Router();

// ✅ Handle GET /webhook (Prevents 404 errors)
router.get('/', (req, res) => {
    res.status(200).json({ message: 'Webhook endpoint is active' });
});

// ✅ Handle POST /webhook
router.post('/', async (req, res) => {
    try {
        const { ResponseCode, TransactionAmount, Msisdn, TransactionReceipt, TransactionReference } = req.body;

        if (ResponseCode === undefined || TransactionAmount === undefined || !Msisdn) {
            console.log('❌ Missing required webhook fields');
            return res.status(400).json({ error: 'Invalid webhook request' });
        }

        // Retrieve order details from database
        const order = await ItemOrder.findOne({ msisdn: Msisdn });
        if (!order) {
            console.log('❌ No matching order found for:', Msisdn);
            return res.status(404).json({ error: 'Order not found' });
        }

        if (Number(ResponseCode) !== 0) {
            console.log(`❌ Transaction failed. ResponseCode: ${ResponseCode}`);

            // ✅ Delete order even if transaction fails
            try {
                await ItemOrder.deleteOne({ msisdn: Msisdn });
                console.log(`✅ Order deleted for ${Msisdn} despite transaction failure`);
            } catch (deleteError) {
                console.error(`❌ Error deleting order for ${Msisdn}:`, deleteError.message);
            }

            return res.status(400).json({ error: 'Transaction not successful' });
        }

        // ✅ Process the successful transaction
        const { message, refCode } = order;
        const bonus = (12 / 100) * TransactionAmount;

        // ✅ Send SMS to Admin
        const adminSmsPayload = {
            api_key: 'fa009a9f62d4e4c904ab93cbd2675871',
            app_id: 'UMSC401221',
            sender_id: 'UMS_SMS',
            message: `Order Details:\n${message}\nAmount: ${TransactionAmount}\nBonus Earned: ${bonus}\nRef Code: ${refCode}\nTransaction ID: ${TransactionReceipt}`,
            phone: '254113382703'
        };
        await axios.post('https://comms.umeskiasoftwares.com/api/v1/sms/send', adminSmsPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // ✅ Send SMS to Customer
        const customerSmsPayload = {
            api_key: 'fa009a9f62d4e4c904ab93cbd2675871',
            app_id: 'UMSC401221',
            sender_id: 'UMS_SMS',
            message: "Your order has been received for processing, we'll reach out in a moment.",
            phone: Msisdn
        };
        await axios.post('https://comms.umeskiasoftwares.com/api/v1/sms/send', customerSmsPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // ✅ Check if refCode exists in UserData
        const referrer = await UserData.findOne({ code: refCode });

        if (referrer) {
            const { phone, balance } = referrer;
            const phoneLast8 = phone.slice(-8);
            const msisdnLast8 = Msisdn.slice(-8);

            if (phoneLast8 !== msisdnLast8) {
                // ✅ Add bonus to referrer's balance
                const updatedBalance = balance + bonus;
                await UserData.updateOne({ code: refCode }, { $set: { balance: updatedBalance } });

                console.log(`✅ Bonus of ${bonus} added to referrer (${refCode}). New balance: ${updatedBalance}`);
            } else {
                console.log(`ℹ️ No bonus added. Customer used own referral code.`);
            }
        } else {
            console.log(`ℹ️ No referrer found for code: ${refCode}`);
        }

        // ✅ Delete order entry from ItemOrders after successful processing
        await ItemOrder.deleteOne({ msisdn: Msisdn });
        console.log(`✅ Order deleted successfully for ${Msisdn}`);

        res.status(200).json({ message: 'Webhook processed successfully' });

    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
