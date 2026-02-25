const mongoose = require("mongoose");
const slugify = require("slugify");
const DomainSubCategoryModel = require("./domain-sub-category-model");
const DomainChildModel = require("./domain-child-model");
const DomainToUser = require("./domain-to-user-model");


const DomainCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

DomainCategorySchema.pre("validate", function (next) {
  if (this.isModified("name")) {
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
 * Cascade delete subcategories & sub-children
 */
DomainCategorySchema.pre("findOneAndDelete", async function (next) {
  const categoryId = this.getQuery()._id;

  await DomainSubCategoryModel.deleteMany({ domain_category: categoryId });
  await DomainChildModel.deleteMany({ domain_category: categoryId });
  await DomainToUser.deleteMany({ domain_category: categoryId });

  next();
});

const DomainCategoryModel = mongoose.model('domain_category', DomainCategorySchema);

module.exports = DomainCategoryModel;