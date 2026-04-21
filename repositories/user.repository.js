// Layer: Repository
const DTUser = require('../models/dtUser.model');

class UserRepository {
  findByEmail(email) {
    return DTUser.findOne({ email });
  }

  findByRole(role) {
    return DTUser.find({ role });
  }

  create(payload) {
    const user = new DTUser(payload);
    return user.save();
  }

  findByIdWithoutPassword(userId) {
    return DTUser.findById(userId).select('-password');
  }

  findManyWithoutPassword(filter = {}) {
    return DTUser.find(filter).select('-password');
  }

  aggregate(pipeline = []) {
    return DTUser.aggregate(pipeline);
  }
}

module.exports = UserRepository;
