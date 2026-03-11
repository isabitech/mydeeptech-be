const mongoose = require('mongoose');
const partnersInvoiceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    due_date: { type: Date, required: true },
    duration: { type: String, required: true },
    email: { type: String, required: true },
    description: { type: String },
    currency: {
        type: String,
        required: true,
        enum: ["USD", "EUR", "GBP", "NGN", "KES", "GHS"],
        default: "USD"
    }
}, {
    timestamps: true // Enable automatic timestamps
});
const PartnersInvoice = mongoose.model('PartnersInvoice', partnersInvoiceSchema);
module.exports = PartnersInvoice

