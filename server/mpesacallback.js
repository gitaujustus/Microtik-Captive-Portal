// // callback.js
// async function mpesaCallback(req, res) {
//     try {
//         console.log("This is a callback is called");

//         const payload = await req.json();

//         // Extract key information from callback
//         const {
//             MerchantRequestID,
//             CheckoutRequestID,
//             ResultCode,
//             ResultDesc,
//             TransactionDate,
//             PhoneNumber
//         } = payload.Body.stkCallback;

//         // Log the entire payload for debugging
//         console.log('Mpesa Callback Payload:', JSON.stringify(payload, null, 2));

//         // Handle different transaction results
//         if (ResultCode === 0) {
//             await handleSuccessfulTransaction({
//                 merchantRequestId: MerchantRequestID,
//                 checkoutRequestId: CheckoutRequestID,
//                 phoneNumber: PhoneNumber,
//                 transactionDate: TransactionDate
//             });
//         } else {
//             await handleFailedTransaction({
//                 merchantRequestId: MerchantRequestID,
//                 checkoutRequestId: CheckoutRequestID,
//                 resultCode: ResultCode,
//                 resultDescription: ResultDesc
//             });
//         }

//         // Respond to Safaricom to acknowledge receipt
//         return res.status(200).json({ status: 'success' });

//     } catch (error) {
//         console.error('Mpesa Callback Error:', error);
//         return res.status(500).json({ error: error.message });
//     }
// }

// // Helper function to handle successful transaction
// async function handleSuccessfulTransaction(transactionData) {
//     console.log('Successful Transaction:', transactionData);
//     // Implement database update logic here
// }

// // Helper function to handle failed transaction
// async function handleFailedTransaction(transactionData) {
//     console.log('Failed Transaction:', transactionData);
//     // Implement error handling logic here
// }

// module.exports = { mpesaCallback };


// callback.js
// import { getTransaction, removeTransaction } from './stkpush'; // Adjust path if needed
const { getTransaction, removeTransaction } = require('./stkpush');

/**
 * Handles M-Pesa callback, retrieves stored data, and processes successful payments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function mpesaCallback(req, res) {
    try {
        console.log("This is a callback is called");

        // Assuming req.json() is handled by middleware or similar; otherwise, use req.body directly
        const payload = req.body; // Adjust based on your setup

        // Extract key information from callback
        const {
            MerchantRequestID,
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            TransactionDate,
            PhoneNumber
        } = payload.Body.stkCallback;

        // Log the entire payload for debugging
        console.log('Mpesa Callback Payload:', JSON.stringify(payload, null, 2));

        // Handle different transaction results
        if (ResultCode === 0) {
            // Retrieve stored mac and hours
            const transactionData = getTransaction(CheckoutRequestID);

            if (!transactionData) {
                console.error(`No transaction data found for CheckoutRequestID: ${CheckoutRequestID}`);
                return res.status(500).json({ error: "Transaction data not found" });
            }

            const { mac, hours } = transactionData;

            await handleSuccessfulTransaction({
                merchantRequestId: MerchantRequestID,
                checkoutRequestId: CheckoutRequestID,
                phoneNumber: PhoneNumber,
                transactionDate: TransactionDate,
                mac,
                hours
            });

            // Clean up after successful processing
            removeTransaction(CheckoutRequestID);
        } else {
            await handleFailedTransaction({
                merchantRequestId: MerchantRequestID,
                checkoutRequestId: CheckoutRequestID,
                resultCode: ResultCode,
                resultDescription: ResultDesc
            });
        }

        // Respond to Safaricom to acknowledge receipt
        return res.status(200).json({ status: 'success' });

    } catch (error) {
        console.error('Mpesa Callback Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

/**
 * Handles successful transaction by processing mac and hours
 * @param {Object} transactionData - Transaction details including mac and hours
 */
async function handleSuccessfulTransaction(transactionData) {
    const { checkoutRequestId, phoneNumber, mac, hours } = transactionData;
    console.log('Successful Transaction:', {
        checkoutRequestId,
        phoneNumber,
        mac,
        hours
    });
    // Implement database update logic here, e.g., grant WiFi access
    // await updateDatabase(checkoutRequestId, phoneNumber, mac, hours);
}

/**
 * Handles failed transaction
 * @param {Object} transactionData - Transaction details
 */
async function handleFailedTransaction(transactionData) {
    console.log('Failed Transaction:', transactionData);
    // Implement error handling logic here
}

// export default { mpesaCallback };
module.exports = { mpesaCallback };