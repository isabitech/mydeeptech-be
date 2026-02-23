
const DomainSubCategoryModel = require("../models/domain-sub-category-model");
const DomainCategoryModel = require("../models/domain-category-model");

class DomainCategoryRepository {

  static create(payload) {
    const newCategory = new DomainCategoryModel(payload);
    return newCategory.save();
  }

  static findAll() {
    return DomainCategoryModel.find();
  }

  static getDomainSubCategoriesByCategory(domainCategoryId) {
    return DomainSubCategoryModel.find({ domain_category: domainCategoryId }).populate("domain_category", "name");
  }

  static findById(id) {
    return DomainCategoryModel.findById(id);
  }

  static findByName(name) {
    return DomainCategoryModel.findOne({ name });
  }

  static updateById(id, updateData) {
    return DomainCategoryModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  static deleteById(id) {
    return DomainCategoryModel.findByIdAndDelete(id);
  }

}

module.exports = DomainCategoryRepository;