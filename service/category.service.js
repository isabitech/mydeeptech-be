const Category = require('../models/category.model.js');
const SubCategory = require('../models/SubCategory.model.js');
const Domain = require('../models/domain.model.js');

const createCategory = async (data) => {
  const category = Category.create(data);
  if (!category) {
    throw new Error('Category creation failed');
  }
  return category;
};

const updateCategory = async (id, data) => {
  const category = Category.findByIdAndUpdate(id, data, { new: true });
  if (!category) {
    throw new Error('Category update failed');
  }
  return category;
};

const deleteCategory = async (id) => {
  const category = Category.findByIdAndDelete(id);
  if (!category) {
    throw new Error('Category deletion failed');
  }
  await Promise.all([
    SubCategory.deleteMany({ category: id }),
    Domain.deleteMany({ parent: id, parentModel: 'Category' })
  ]);
  return category;
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

const findById = async (id) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new Error('Category not found');
  }
  return category;
};

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  fetchCategoryTree,
  findById
};
