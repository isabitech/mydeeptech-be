const Category = require('../models/category.model.js');
const SubCategory = require('../models/SubCategory.model.js');
const Domain = require('../models/domain.model.js');
const mongoose = require("mongoose");
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
    Domain.deleteMany({ category: id, subCategory: null })
  ]);
  return category;
};

/**
 * TREE FETCH RULE
 * Category
 *  ├─ SubCategory
 *  └─ Domain (direct if no subcategory domains or subcategory domains if exist)
 */
const fetchCategoryTree = async () => {
  const categories = await Category.find().lean();
  const result = [];

  for (const category of categories) {
    // 1. Get subcategories
    const subCategories = await SubCategory.find({
      category: category._id
    }).lean();

    const subCategoryIds = subCategories.map(sub => sub._id);

    // 2. Domains under subcategories
    const subCategoryDomains = await Domain.find({
      subCategory: { $in: subCategoryIds }
    }).lean();

    // 3. Domains directly under category
    const categoryDomains = await Domain.find({
      category: category._id,
      subCategory: null
    }).lean();

    // 4. Merge both
    const domains = [...categoryDomains, ...subCategoryDomains];

    result.push({
      ...category,
      subCategories,
      domains
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
