const Category = require('../models/category.model.js');
const SubCategory = require('../models/SubCategory.model.js');
const Domain = require('../models/domain.model.js');

const createCategory = async (data) => {
  return Category.create(data);
};

const updateCategory = async (id, data) => {
  return Category.findByIdAndUpdate(id, data, { new: true });
};

const deleteCategory = async (id) => {
  await SubCategory.deleteMany({ category: id });
  await Domain.deleteMany({ parent: id, parentModel: 'Category' });
  return Category.findByIdAndDelete(id);
};

/**
 * TREE FETCH RULE
 * Category
 *  ├─ SubCategory
 *  │   ├─ Domain (if exists)
 *  └─ Domain (direct if no subcategory domain)
 */
const fetchCategoryTree = async () => {
  const categories = await Category.find().lean();

  const result = [];

  for (const category of categories) {
    const subCategories = await SubCategory.find({ category: category._id }).lean();

    for (const sub of subCategories) {
      sub.domains = await Domain.find({
        parent: sub._id,
        parentModel: 'SubCategory'
      }).lean();
    }

    const directDomains = await Domain.find({
      parent: category._id,
      parentModel: 'Category'
    }).lean();

    result.push({
      ...category,
      subCategories,
      domains: directDomains
    });
  }

  return result;
};

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  fetchCategoryTree
};
