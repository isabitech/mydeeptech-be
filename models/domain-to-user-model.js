const mongoose = require("mongoose");

const domainToUser = new mongoose.Schema(
    {
        domain_category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "domain_category",
            required: true,
        },
        domain_child: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "domain_child",
            required: true,
            index: true,
        },
        domain_sub_category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "domain_sub_category",
            required: false,
            index: true,
        },
        user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "dtUser", index: true },
        deleted_at: { type: Date, default: null },
    },
    { timestamps: true }
);
domainToUser.index({ domain_child: 1, user: 1 }, { unique: true });

const DomainToUser = mongoose.model("DomainToUser", domainToUser);
module.exports = DomainToUser;