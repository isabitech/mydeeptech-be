const mongoose = require("mongoose");
const DTUser = require("../models/dtUser.model");

class DtUserRepository {
  findUnverifiedUsers() {
    return DTUser.find({ isEmailVerified: false })
      .select("fullName email isEmailVerified _id")
      .sort({ createdAt: -1 });
  }

findByEmail(email) {
  return DTUser.findOne({ email })
    .populate({
      path: "userDomains",
      match: { deleted_at: null },
      populate: {
        path: "domain_child",
        select: "name",
      },
    })
    .exec();
}

  findById(id) {
    return DTUser.findById(id);
  }

  createUser(payload) {
    const user = new DTUser(payload);
    return user.save();
  }

  saveUser(user) {
    return user.save();
  }

  findByIdAndUpdate(id, update, options = { new: true, runValidators: true }) {
    return DTUser.findByIdAndUpdate(id, update, options);
  }

  countDocuments(filter = {}) {
    return DTUser.countDocuments(filter);
  }

  find(filter = {}) {
    return DTUser.find(filter);
  }

  findByIdSelect(id, projection) {
    return DTUser.findById(id).select(projection);
  }

  findWithLean(filter = {}, projection = "") {
    return DTUser.findOne(filter).select(projection).lean();
  }

  isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }

  aggregate(pipeline = []) {
    return DTUser.aggregate(pipeline);
  }
}

module.exports = DtUserRepository;
