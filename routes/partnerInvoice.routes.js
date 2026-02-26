const express = require("express");
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('../middleware/adminAuth');
const PartnerInvoiceController = require("../controllers/partner-invoice-controller");

const validateRequest = require('../middleware/validate-request.middleware');
const { createInvoiceSchema, updateInvoiceSchema, IdSchema } = require('../validations/partner-invoice-validator');

router.post("/", authenticateToken, authenticateAdmin, validateRequest({ body: createInvoiceSchema }), PartnerInvoiceController.createInvoice);
router.get("/", authenticateToken, authenticateAdmin, PartnerInvoiceController.fetchAllInvoices);
router.get("/pagination", authenticateToken, authenticateAdmin, PartnerInvoiceController.fetchAllInvoicesWithPagination);
router.get("/:id", authenticateToken, authenticateAdmin, validateRequest({ params: IdSchema }), PartnerInvoiceController.fetchInvoiceById);
router.patch("/:id", authenticateToken, authenticateAdmin, validateRequest({ params: IdSchema, body: updateInvoiceSchema }), PartnerInvoiceController.updateInvoice);
router.delete("/:id", authenticateToken, authenticateAdmin, validateRequest({ params: IdSchema }), PartnerInvoiceController.deleteInvoice);

module.exports = router;