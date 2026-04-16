
const DomainSubCategoryModel = require("../models/domain-sub-category-model");
const DomainCategoryModel = require("../models/domain-category-model");

class DomainCategoryRepository {

  static async create(payload) {
    const newCategory = new DomainCategoryModel(payload);
    return await newCategory.save();
  }

  static async findAll() {
    return await DomainCategoryModel.find();
  }

  static countDocuments(query = {}) {
    return DomainCategoryModel.countDocuments(query);
  }

  static findWithPagination(query = {}, options = {}) {
    const { skip = 0, limit = 10 } = options;
    return DomainCategoryModel.find(query).skip(skip).limit(limit).sort({ createdAt: -1 });
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

  static findBySlug(slug) {
    return DomainCategoryModel.findOne({ slug });
  }

  static async updateById(id, updateData) {
    return await DomainCategoryModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  static async deleteById(id) {
    return await DomainCategoryModel.findOneAndDelete({ _id: id });
  }

}

module.exports = DomainCategoryRepository;