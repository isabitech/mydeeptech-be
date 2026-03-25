const mongoose = require("mongoose");
const { ACTIONS } = require("../config/resources");

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
      required: true,
    },
    resources: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "Resource",
      default: null, // null means it applies to all records of that resource
    },
    action: {
      type: String,
      trim: true,
      lowercase: true,
      enum: Object.values(ACTIONS),
      required: true,
    },
  },
  { timestamps: true },
);

permissionSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await mongoose
      .model("Role")
      .updateMany(
        { permissions: doc._id },
        { $pull: { permissions: doc._id } },
      );
    console.log(`🧹 Removed permission ${doc._id} from all roles`);
  }
});

module.exports = mongoose.model("Permission", permissionSchema);
