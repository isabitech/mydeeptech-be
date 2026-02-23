const DomainChildModel = require("../models/domain-child-model.js");


class DomainCategoryChildRepository {

  static create(payload) {
    const domain = new DomainChildModel(payload);
    const saved = domain.save();
    return saved;
  }

  static findAll() {
    return DomainChildModel.find()
          .populate("domain_category", "_id name slug")
          .populate("domain_sub_category", "_id name slug");
  }

  static findById(id) {
    return DomainChildModel.findById(id)
          .populate("domain_category", "_id name slug")
          .populate("domain_sub_category", "_id name slug");
  }

  static findByName(name) {
    return DomainChildModel.findOne({ name })
          .populate("domain_category", "_id name slug")
          .populate("domain_sub_category", "_id name slug");
  }

  static updateById(id, updateData) {
    return DomainChildModel.findByIdAndUpdate(id, updateData, { new: true })
          .populate("domain_category", "_id name slug")
          .populate("domain_sub_category", "_id name slug");
  }

  static deleteById(id) {
    return DomainChildModel.findByIdAndDelete(id);
  }

}

module.exports = DomainCategoryChildRepository;