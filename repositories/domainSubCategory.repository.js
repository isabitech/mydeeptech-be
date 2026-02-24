const DomainCategoryModel = require("../models/domain-category-model");
const DomainSubCategoryModel = require("../models/domain-sub-category-model");

class DomainSubCategoryRepository {

  static getAllDomainSubCategories() {
   return DomainSubCategoryModel.find().populate("domain_category", "_id name slug");
  }

  static countDocuments(query = {}) {
    return DomainSubCategoryModel.countDocuments(query);
  }

  static findWithPagination(query = {}, options = {}) {
    const { skip = 0, limit = 10 } = options;
    return DomainSubCategoryModel.find(query)
      .populate("domain_category", "_id name slug")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  static getDomainSubCategoriesByCategory(domainCategoryId) {
    return DomainSubCategoryModel.find({ domain_category: domainCategoryId }).populate("domain_category", "_id name slug");
  }

  static findDomainCategorySubCategoryById(id) {
    return DomainCategoryModel.findById(id).select("domain_category name description");
  } 

  static findById(id) {
    return DomainSubCategoryModel.findById(id).populate("domain_category", "_id name slug");
  }

  static findByNameAndCategory(name, domainCategoryId) {
    return DomainSubCategoryModel.findOne({ name, domain_category: domainCategoryId }).populate("domain_category", "_id name slug");
  }


static async create(payload) {
  const newSubCategory = new DomainSubCategoryModel(payload);
  const saved = await newSubCategory.save();

  await saved.populate({
    path: "domain_category", 
    select: "_id name slug",
  });

  return saved;
}

  static async update(id, payload) {
    const updated = await DomainSubCategoryModel.findByIdAndUpdate(id, payload, { new: true });
    return DomainSubCategoryModel.findById(updated._id).populate("domain_category", "_id name slug");
  }

  static deleteById(id) {
    return DomainSubCategoryModel.findByIdAndDelete(id).populate("domain_category", "_id name slug");
  }

}

module.exports = DomainSubCategoryRepository;