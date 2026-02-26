// Import all controller modules
const {
  initializeFreelancerPayment,
  verifyPayment,
  getPaymentDetails,
  getPaymentByReference,
  cancelPayment
} = require('./basic-payments.controller');

const {
  getFreelancerPayments,
  getProjectPayments,
  getAllPayments,
  getPaymentStats,
  getPendingPayments,
  getFailedPayments,
  getSuccessfulPayments
} = require('./payment-queries.controller');

const {
  initializeBulkPayment,
  getBulkPaymentStatus,
  retryBulkPayment,
  cancelBulkPayment
} = require('./bulk-payments.controller');

const {
  initializeBulkTransfer,
  createTransferRecipient,
  getBanks,
  verifyTransfer,
  checkUserBankDetails,
  testRecipientCreation
} = require('./transfers.controller');

const {
  initializeBulkTransferWithInvoices
} = require('./invoice-transfers.controller');

const {
  handleWebhook
} = require('./webhooks.controller');

// Export all controllers for use in routes
module.exports = {
  // Basic payment operations
  initializeFreelancerPayment,
  verifyPayment,
  getPaymentDetails,
  getPaymentByReference,
  cancelPayment,
  
  // Payment queries and statistics
  getFreelancerPayments,
  getProjectPayments,
  getAllPayments,
  getPaymentStats,
  getPendingPayments,
  getFailedPayments,
  getSuccessfulPayments,
  
  // Bulk payment collection (generates checkout URLs)
  initializeBulkPayment,
  getBulkPaymentStatus,
  retryBulkPayment,
  cancelBulkPayment,
  
  // Bank transfers (sends money directly to bank accounts)
  initializeBulkTransfer,
  createTransferRecipient,
  getBanks,
  verifyTransfer,
  checkUserBankDetails,
  testRecipientCreation,
  initializeBulkTransferWithInvoices,
  
  // Webhook handling
  handleWebhook
};