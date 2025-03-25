// const axios = require('axios');

// async function generateAccessToken() {
//     const consumer_key = process.env.MPESA_CONSUMER_KEY;
//     const consumer_secret = process.env.MPESA_CONSUMER_SECRET;
//     console.log("STK here", process.env.MPESA_CONSUMER_KEY);
    

    

//     if (!consumer_key || !consumer_secret) {
//         throw new Error('Missing required environment variables');
//     }

//     const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

//     try {
//         const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');

//         const response = await axios.get(url, {
//             headers: {
//                 "Authorization": `Basic ${auth}`
//             }
//         }); 

//         return response.data.access_token;
//     } catch (error) {
//         console.error('Error generating access token:', error);
//         // throw error;
//     }
// }

// async function stkPush(req, res) {
//     try {
//         const { phone, amount } = req.body;
        

//         if (!phone || !amount) {
//             return res.status(400).json({ error: "Missing phone or amount" });
//         }
        

//         const token = await generateAccessToken();

//         // Generate Timestamp and Password
//         const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
//         const passwordRaw = `${process.env.MPESA_BUSINESS_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`;
//         const password = Buffer.from(passwordRaw).toString('base64');

//         // Initiate STK Push
//         const stkPushResponse = await axios.post(
//             'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
//             {
//                 BusinessShortCode: process.env.MPESA_BUSINESS_SHORTCODE,
//                 Password: password,
//                 Timestamp: timestamp,
//                 TransactionType: 'CustomerPayBillOnline',
//                 Amount: amount,
//                 PartyA: phone,
//                 PartyB: process.env.MPESA_BUSINESS_SHORTCODE,
//                 PhoneNumber: phone,
//                 CallBackURL: process.env.MPESA_CALLBACK_URL,
//                 AccountReference: 'JASTUTE SOLUTIONS',
//                 TransactionDesc: 'Payment'
//             },
//             {
//                 headers: {
//                     'Authorization': `Bearer ${token}`,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );

//         if (stkPushResponse.status === 200) {
//             return res.status(200).json({
//                 message: "Payment initiated successfully",
//                 data: stkPushResponse.data
//             });
//         } else {
//             throw new Error(stkPushResponse.data.errorMessage || 'Payment initiation failed');
//         }
//     } catch (error) {
//         console.error('Payment Initiation Error:', error);
//         return res.status(500).json({ error: error.message });
//     }
// }

// module.exports = { stkPush };






const axios = require('axios');

// In-memory storage for pending transactions
const pendingTransactions = {};

/**
 * Stores transaction data temporarily using CheckoutRequestID as the key
 * @param {string} checkoutRequestID - Unique ID from STK push response
 * @param {Object} data - Data to store (e.g., mac, hours)
 */
function setTransaction(checkoutRequestID, data) {
    pendingTransactions[checkoutRequestID] = data;
}

/**
 * Retrieves transaction data using CheckoutRequestID
 * @param {string} checkoutRequestID - Unique ID from STK push response
 * @returns {Object} Stored data (e.g., { mac, hours })
 */
function getTransaction(checkoutRequestID) {
    return pendingTransactions[checkoutRequestID];
}

/**
 * Removes transaction data after processing
 * @param {string} checkoutRequestID - Unique ID from STK push response
 */
function removeTransaction(checkoutRequestID) {
    delete pendingTransactions[checkoutRequestID];
}

/**
 * Generates an access token for M-Pesa API authentication
 * @returns {string} Access token
 */ 
async function generateAccessToken() {
    const consumer_key = process.env.MPESA_CONSUMER_KEY;
    const consumer_secret = process.env.MPESA_CONSUMER_SECRET;
    console.log("STK here", process.env.MPESA_CONSUMER_KEY);

    if (!consumer_key || !consumer_secret) {
        throw new Error('Missing required environment variables');
    }

    const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    try {
        const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');
        const response = await axios.get(url, {
            headers: {
                "Authorization": `Basic ${auth}`
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error generating access token:', error);
        throw error; // Propagate error for better handling
    }
}

/**
 * Initiates an STK push for M-Pesa payment and stores mac and hours
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function stkPush(req, res) {
    try {
        // Extract phone, amount, mac, and hours from request body
        const { phone, amount, mac, hours } = req.body;

        // Validate all required fields
        if (!phone || !amount || !mac || !hours) {
            return res.status(400).json({ error: "Missing required fields (phone, amount, mac, hours)" });
        }

        const token = await generateAccessToken();

        // Generate Timestamp and Password
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const passwordRaw = `${process.env.MPESA_BUSINESS_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`;
        const password = Buffer.from(passwordRaw).toString('base64');

        // Initiate STK Push
        const stkPushResponse = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            {
                BusinessShortCode: process.env.MPESA_BUSINESS_SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: amount,
                PartyA: phone,
                PartyB: process.env.MPESA_BUSINESS_SHORTCODE,
                PhoneNumber: phone,
                CallBackURL: process.env.MPESA_CALLBACK_URL,
                AccountReference: 'JASTUTE SOLUTIONS',
                TransactionDesc: 'Payment'
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (stkPushResponse.status === 200) {
            // Extract CheckoutRequestID from the response
            const checkoutRequestID = stkPushResponse.data.CheckoutRequestID;

            // Store mac and hours in memory
            setTransaction(checkoutRequestID, { mac, hours });

            return res.status(200).json({
                message: "Payment initiated successfully",
                data: stkPushResponse.data
            });
        } else {
            throw new Error(stkPushResponse.data.errorMessage || 'Payment initiation failed');
        }
    } catch (error) {
        console.error('Payment Initiation Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

module.exports = { stkPush, getTransaction, removeTransaction };