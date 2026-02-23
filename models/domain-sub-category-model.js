const mongoose = require("mongoose");
const slugify = require("slugify");
const DomainChildModel = require("./domain-child-model");

const domainSubCategorySchema = new mongoose.Schema(
  {
   domain_category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "domain_category",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, lowercase: true },
    description: { type: String },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

  domainSubCategorySchema.pre('validate', function (next) {
    if (this.isModified('name')) {
      this.slug = slugify(this.name, {
        lower: true,
        trim: true,
        strict: true,
        replacement: "_",
      });
    }
    next();
  });

/**
 * Cascade delete sub-children
 */
domainSubCategorySchema.pre("findOneAndDelete", async function (next) {

  const subCategoryId = this.getQuery()._id;

  await DomainChildModel.deleteMany({ domain_sub_category: subCategoryId });

  next();
});


const DomainSubCategoryModel = mongoose.model("domain_sub_category", domainSubCategorySchema);
module.exports = DomainSubCategoryModel;