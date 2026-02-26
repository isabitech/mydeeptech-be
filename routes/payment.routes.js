const express = require('express');
const router = express.Router();

// Import controllers from the refactored paystack-controller directory
const {
    initializeFreelancerPayment,
    verifyPayment,
    handleWebhook,
    getPaymentDetails,
    getFreelancerPayments,
    getProjectPayments,
    getAllPayments,
    getPaymentStats,
    cancelPayment,
    getPaymentByReference,
    getPendingPayments,
    getFailedPayments,
    getSuccessfulPayments,
    initializeBulkPayment,
    getBulkPaymentStatus,
    retryBulkPayment,
    cancelBulkPayment,
    // New transfer-based methods
    createTransferRecipient,
    getBanks,
    initializeBulkTransfer,
    verifyTransfer,
    checkUserBankDetails,
    testRecipientCreation,
    initializeBulkTransferWithInvoices
} = require('../controllers/paystack-controller/payment-controller');
const { callback } = require('../controllers/paystack-controller/callback.controller');


// Import middleware
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('../middleware/adminAuth');
const validateRequest = require('../middleware/validate-request.middleware');

// Import validations
const {
    validateInitializePayment,
    validateBulkPayment,
    validateRetryBulkPayment,
    validateCancelBulkPayment,
    paymentReferenceSchema,
    paymentIdSchema,
    freelancerIdSchema,
    projectIdSchema,
    paginationSchema,
    cancelPaymentSchema,
    paymentStatsSchema,
    batchIdSchema,
    validateCreateRecipient,
    validateBulkTransfer,
    validateTransferReference
} = require('../validations/freelancerPayment.validation');

/* ================= PAYMENT INITIALIZATION ================= */

/**
 * @route POST /api/payments/initialize
 * @desc Initialize a new freelancer payment
 * @access Private (Authenticated users)
 */
router.post(
    '/initialize',
    authenticateToken,
    validateInitializePayment,
    initializeFreelancerPayment
);

/* ================= PAYMENT VERIFICATION ================= */

/**
 * @route GET /api/payments/verify/:reference
 * @desc Verify a payment using reference
 * @access Private (Authenticated users)
 */
router.get(
    '/verify/:reference',
    authenticateToken,
    validateRequest({ params: paymentReferenceSchema }),
    verifyPayment
);

/**
 * @route GET /api/payments/reference/:reference
 * @desc Get payment details by reference (for callback handling)
 * @access Private (Authenticated users)
 */
router.get(
    '/reference/:reference',
    authenticateToken,
    validateRequest({ params: paymentReferenceSchema }),
    getPaymentByReference
);

/* ================= WEBHOOK HANDLING ================= */

/**
 * @route POST /api/payments/webhook
 * @desc Handle Paystack webhooks
 * @access Public (Paystack webhook)
 * @note No authentication required as this is called by Paystack
 */
router.post('/webhook', handleWebhook);

/**
 * @route GET /api/payments/callback
 * @desc Handle payment callback from Paystack
 * @access Public (Payment callback)
 */
router.get('/callback', callback);

/* ================= PAYMENT DETAILS ================= */

/**
 * @route GET /api/payments/:paymentId
 * @desc Get payment details by ID
 * @access Private (Authenticated users)
 */
router.get(
    '/:paymentId',
    authenticateToken,
    validateRequest({ params: paymentIdSchema }),
    getPaymentDetails
);

/* ================= FREELANCER PAYMENTS ================= */

/**
 * @route GET /api/payments/freelancer/:freelancerId
 * @desc Get all payments for a specific freelancer
 * @access Private (Authenticated users)
 */
router.get(
    '/freelancer/:freelancerId',
    authenticateToken,
    validateRequest({ params: freelancerIdSchema }),
    validateRequest({ query: paginationSchema }),
    getFreelancerPayments
);

/* ================= PROJECT PAYMENTS ================= */

/**
 * @route GET /api/payments/project/:projectId
 * @desc Get all payments for a specific project
 * @access Private (Authenticated users)
 */
router.get(
    '/project/:projectId',
    authenticateToken,
    validateRequest({ params: projectIdSchema }),
    validateRequest({ query: paginationSchema }),
    getProjectPayments
);

/* ================= ADMIN PAYMENT MANAGEMENT ================= */

/**
 * @route GET /api/payments/admin/all
 * @desc Get all payments (admin only)
 * @access Private (Admin only)
 */
router.get(
    '/admin/all',
    authenticateToken,
    authenticateAdmin,
    validateRequest({ query: paginationSchema }),
    getAllPayments
);

/**
 * @route GET /api/payments/admin/pending
 * @desc Get all pending payments (admin only)
 * @access Private (Admin only)
 */
router.get(
    '/admin/pending',
    authenticateToken,
    authenticateAdmin,
    validateRequest({ query: paginationSchema }),
    getPendingPayments
);

/**
 * @route GET /api/payments/admin/failed
 * @desc Get all failed payments (admin only)
 * @access Private (Admin only)
 */
router.get(
    '/admin/failed',
    authenticateToken,
    authenticateAdmin,
    validateRequest({ query: paginationSchema }),
    getFailedPayments
);

/**
 * @route GET /api/payments/admin/successful
 * @desc Get all successful payments (admin only)
 * @access Private (Admin only)
 */
router.get(
    '/admin/successful',
    authenticateToken,
    authenticateAdmin,
    validateRequest({ query: paginationSchema }),
    getSuccessfulPayments
);

/* ================= PAYMENT STATISTICS ================= */

/**
 * @route GET /api/payments/admin/stats
 * @desc Get payment statistics
 * @access Private (Admin only)
 */
router.get(
    '/admin/stats',
    authenticateToken,
    authenticateAdmin,
    validateRequest({ query: paymentStatsSchema }),
    getPaymentStats
);

/* ================= PAYMENT CANCELLATION ================= */

/**
 * @route PUT /api/payments/:paymentId/cancel
 * @desc Cancel a payment
 * @access Private (Authenticated users)
 */
router.put(
    '/:paymentId/cancel',
    authenticateToken,
    validateRequest({ params: paymentIdSchema }),
    validateRequest({ body: cancelPaymentSchema }),
    cancelPayment
);

/* ================= ALTERNATIVE ROUTE PATTERNS ================= */

// Alternative route for getting payments by status
/**
 * @route GET /api/payments/status/:status
 * @desc Get payments by status
 * @access Private (Admin only)
 */
router.get(
    '/status/:status',
    authenticateToken,
    authenticateAdmin,
    validateRequest({ query: paginationSchema }),
    (req, res, next) => {
        req.query.status = req.params.status;
        next();
    },
    getAllPayments
);

/* ================= SEARCH ENDPOINTS ================= */

/**
 * @route GET /api/payments/search
 * @desc Search payments by various criteria
 * @access Private (Admin only)
 */
router.get(
    '/search',
    authenticateToken,
    authenticateAdmin,
    validateRequest({ query: paginationSchema }),
    getAllPayments
);

/* ================= BULK PAYMENT OPERATIONS ================= */

/**
 * @route POST /api/payments/bulk/initialize
 * @desc Initialize bulk payments for multiple users (freelancers, admins, stakeholders, etc.)
 * @access Private (Admin only)
 */
router.post(
    '/bulk/initialize',
    authenticateToken,
    authenticateAdmin,
    validateBulkPayment,
    initializeBulkPayment
);

/**
 * @route GET /api/payments/bulk/:batchId/status
 * @desc Get status of a bulk payment operation
 * @access Private (Admin only)
 */
router.get(
    '/bulk/:batchId/status',
    authenticateToken,
    authenticateAdmin,
    validateRequest({ params: batchIdSchema }),
    validateRequest({ query: paginationSchema }),
    getBulkPaymentStatus
);

/**
 * @route POST /api/payments/bulk/:batchId/retry
 * @desc Retry failed payments in a bulk operation
 * @access Private (Admin only)
 */
router.post(
    '/bulk/:batchId/retry',
    authenticateToken,
    authenticateAdmin,
    validateRequest({ params: batchIdSchema }),
    validateRetryBulkPayment,
    retryBulkPayment
);

/**
 * @route DELETE /api/payments/bulk/:batchId/cancel
 * @desc Cancel pending payments in a bulk operation
 * @access Private (Admin only)
 */
router.delete(
    '/bulk/:batchId/cancel',
    authenticateToken,
    authenticateAdmin,
    validateRequest({ params: batchIdSchema }),
    validateCancelBulkPayment,
    cancelBulkPayment
);

/* ================= TRANSFER API - PAYSTACK NATIVE BULK TRANSFERS ================= */

/**
 * @route POST /api/payments/recipients/create
 * @desc Create a transfer recipient for bulk transfers
 * @access Private (Admin only)
 */
router.post(
    '/recipients/create',
    authenticateToken,
    authenticateAdmin,
    validateCreateRecipient,
    createTransferRecipient
);

/**
 * @route GET /api/payments/banks
 * @desc Get list of banks for recipient creation
 * @access Private (Authenticated users)
 */
router.get(
    '/banks',
    authenticateToken,
    getBanks
);

/**
 * @route POST /api/payments/transfer/bulk
 * @desc Initialize bulk transfers using Paystack's native bulk transfer API
 * @access Private (Admin only)
 */
router.post(
    '/transfer/bulk',
    authenticateToken,
    authenticateAdmin,
    validateBulkTransfer,
    initializeBulkTransfer
);

/**
     * @route POST /api/payments/transfer/bulk-invoices
     * @desc Initialize bulk transfers with invoice-based payments and USD to NGN conversion
     * @access Private (Admin only)
 */
router.post(
    '/bulk-transfer-with-invoices',
    authenticateToken,
    authenticateAdmin,
    validateBulkTransfer,
    initializeBulkTransferWithInvoices
);

/**
 * @route GET /api/payments/transfer/verify/:reference
 * @desc Verify a transfer using reference
 * @access Private (Admin only)
 */
router.get(
    '/transfer/verify/:reference',
    authenticateToken,
    authenticateAdmin,
    validateTransferReference,
    verifyTransfer
);

/**
 * @route GET /api/payments/debug/user/:userId/bank-details  
 * @desc Check user bank details for transfer readiness
 * @access Private (Admin only)
 */
router.get(
    '/debug/user/:userId/bank-details',
    authenticateToken,
    authenticateAdmin,
    checkUserBankDetails
);

/**
 * @route GET /api/payments/debug/user/:userId/test-recipient
 * @desc Test creating a Paystack recipient for a user
 * @access Private (Admin only)
 */
router.get(
    '/debug/user/:userId/test-recipient',
    authenticateToken,
    authenticateAdmin,
    testRecipientCreation
);

/* ================= HEALTH CHECK ================= */

/**
 * @route GET /api/payments/health
 * @desc Health check for payment service
 * @access Public
 */
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Payment service is running',
        timestamp: new Date().toISOString(),
        service: 'Freelancer Payment Service'
    });
});
    
module.exports = router;