/**
 * Nigerian Banks to Paystack Bank Code Mapping
 * Maps bank names to their corresponding Paystack bank codes for bulk transfer CSV generation
 */

export const NIGERIAN_BANKS_MAPPING = [
  { name: "Access Bank", label: "Access Bank", bankCode: "access-bank" },
  { name: "Fidelity Bank", label: "Fidelity Bank", bankCode: "fidelity-bank" },
  { name: "First Bank of Nigeria", label: "First Bank of Nigeria", bankCode: "first-bank-of-nigeria" },
  { name: "Guaranty Trust Bank", label: "Guaranty Trust Bank (GTBank)", bankCode: "guaranty-trust-bank" },
  { name: "United Bank for Africa", label: "United Bank for Africa (UBA)", bankCode: "united-bank-for-africa" },
  { name: "Zenith Bank", label: "Zenith Bank", bankCode: "zenith-bank" },
  { name: "Ecobank Nigeria", label: "Ecobank Nigeria", bankCode: "ecobank-nigeria" },
  { name: "Union Bank of Nigeria", label: "Union Bank of Nigeria", bankCode: "union-bank-of-nigeria" },
  { name: "Stanbic IBTC Bank", label: "Stanbic IBTC Bank", bankCode: "stanbic-ibtc-bank" },
  { name: "Sterling Bank", label: "Sterling Bank", bankCode: "sterling-bank" },
  { name: "Wema Bank", label: "Wema Bank", bankCode: "wema-bank" },
  { name: "Polaris Bank", label: "Polaris Bank", bankCode: "polaris-bank" },
  { name: "Kuda Bank", label: "Kuda Bank", bankCode: "kuda-bank" },
  { name: "VFD Microfinance Bank", label: "VFD Microfinance Bank", bankCode: "vfd" },
  { name: "Opay", label: "Opay", bankCode: "paycom" },
  { name: "PalmPay", label: "PalmPay", bankCode: "palmpay" },
  { name: "Moniepoint", label: "Moniepoint", bankCode: "moniepoint-mfb-ng" }
];

/**
 * Creates a map for quick bank code lookups by bank name (case-insensitive)
 */
const bankNameToCodeMap = new Map();
NIGERIAN_BANKS_MAPPING.forEach(bank => {
  // Add multiple lookup variations for flexibility
  bankNameToCodeMap.set(bank.name.toLowerCase(), bank.bankCode);
  bankNameToCodeMap.set(bank.label.toLowerCase(), bank.bankCode);

  // Add shorter versions without common suffixes
  const shortName = bank.name.replace(/\s+(Bank|Limited|Ltd|Plc|Nigeria)$/i, '').toLowerCase();
  if (shortName !== bank.name.toLowerCase()) {
    bankNameToCodeMap.set(shortName, bank.bankCode);
  }
});

/**
 * Gets Paystack bank code for a given bank name
 * @param {string} bankName - Bank name to lookup
 * @returns {string|null} Paystack bank code or null if not found
 */
export const getBankCode = (bankName) => {
  if (!bankName || typeof bankName !== 'string') {
    return null;
  }

  const normalizedName = bankName.toLowerCase().trim();
  return bankNameToCodeMap.get(normalizedName) || null;
};

/**
 * Validates if a bank name is supported for Paystack transfers
 * @param {string} bankName - Bank name to validate
 * @returns {boolean} True if bank is supported
 */
export const isSupportedBank = (bankName) => {
  return getBankCode(bankName) !== null;
};

/**
 * Gets list of all supported banks for frontend display
 * @returns {Array} Array of supported banks with names, labels, and codes
 */
export const getSupportedBanks = () => {
  return NIGERIAN_BANKS_MAPPING.map(bank => ({
    name: bank.name,
    label: bank.label,
    bankCode: bank.bankCode
  }));
};

/**
 * Finds the best bank match for a given name (fuzzy matching)
 * @param {string} bankName - Bank name to match
 * @returns {object|null} Best matching bank or null
 */
export const findBestBankMatch = (bankName) => {
  if (!bankName || typeof bankName !== 'string') {
    return null;
  }

  const searchTerm = bankName.toLowerCase().trim();

  // First try exact match
  const exactMatch = getBankCode(searchTerm);
  if (exactMatch) {
    return NIGERIAN_BANKS_MAPPING.find(bank => bank.bankCode === exactMatch);
  }

  // Try partial matching
  const partialMatches = NIGERIAN_BANKS_MAPPING.filter(bank => {
    const bankNameLower = bank.name.toLowerCase();
    const labelLower = bank.label.toLowerCase();
    return bankNameLower.includes(searchTerm) ||
      labelLower.includes(searchTerm) ||
      searchTerm.includes(bankNameLower.split(' ')[0]) ||
      searchTerm.includes(labelLower.split(' ')[0]);
  });

  return partialMatches.length > 0 ? partialMatches[0] : null;
};

/**
 * Validates DTUser payment info for Paystack compatibility
 * @param {object} paymentInfo - DTUser payment_info object
 * @returns {object} Validation result with isValid flag and error message
 */
export const validatePaymentInfo = (paymentInfo) => {
  const result = {
    isValid: true,
    errors: [],
    bankCode: null
  };

  if (!paymentInfo) {
    result.isValid = false;
    result.errors.push('Payment info is required');
    return result;
  }

  // Check required fields
  if (!paymentInfo.account_name?.trim()) {
    result.isValid = false;
    result.errors.push('Account name is required');
  }

  if (!paymentInfo.account_number?.trim()) {
    result.isValid = false;
    result.errors.push('Account number is required');
  }

  if (!paymentInfo.bank_name?.trim()) {
    result.isValid = false;
    result.errors.push('Bank name is required');
  }

  // Validate bank code
  if (paymentInfo.bank_name) {
    const bankCode = getBankCode(paymentInfo.bank_name);
    if (!bankCode) {
      result.isValid = false;
      result.errors.push(`Unsupported bank: ${paymentInfo.bank_name}`);
    } else {
      result.bankCode = bankCode;
    }
  }

  return result;
};

export default {
  NIGERIAN_BANKS_MAPPING,
  getBankCode,
  isSupportedBank,
  getSupportedBanks,
  findBestBankMatch,
  validatePaymentInfo
};