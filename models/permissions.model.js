const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      // Format: resource:action
      // e.g. 'projects:view', 'payment:approve', 'invoice:view_own'
    },
    description: {
      type: String,
      default: "",
    },
    resource: {
      type: String,
      trim: true,
      lowercase: true,
      enum: [
        "overview",
        "annotators",
        "assessments",
        "projects",
        "applications",
        "payment",
        "invoice",
        "notifications",
        "support_chat",
        "user_roles",
        "employees",
        "settings",
        "roles",
        "permissions",
      ],
      required: true,
    },
    action: {
      type: String,
      trim: true,
      lowercase: true,
      enum: [
        "view",       // read access
        "view_own",   // read only own records (individual partners)
        "create",     // create new records
        "edit",       // update existing records
        "delete",     // remove records
        "approve",    // approve/reject records
        "manage",     // full CRUD — supersets all above
      ],
      required: true,
    },
  },
  { timestamps: true }
);

permissionSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await mongoose.model("Role").updateMany(
      { permissions: doc._id },
      { $pull: { permissions: doc._id } }
    );
    console.log(`🧹 Removed permission ${doc._id} from all roles`);
  }
});

module.exports = mongoose.model("Permission", permissionSchema);
