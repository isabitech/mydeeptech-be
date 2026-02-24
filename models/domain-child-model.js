const mongoose = require("mongoose");
const slugify = require("slugify");

const domainChildSchema = new mongoose.Schema(
  {
    domain_category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "domain_category",
      required: true,
    },
    domain_sub_category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "domain_sub_category",
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    description: { type: String },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);


  domainChildSchema.pre('validate', function (next) {
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
 * Remove domainChildSchema references from users
 */
// domainChildSchema.pre("findOneAndDelete", async function (next) {

//   const domainChildId = this.getQuery()._id;

//   await mongoose.model("User").updateMany(
//     {},
//     {
//       $pull: {
//         selections: { domain: domainChildId },
//       },
//     }
//   );

//   next();
// });


const DomainChildModel = mongoose.model("domain_child", domainChildSchema);
module.exports = DomainChildModel;