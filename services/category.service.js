const Category = require('../models/category.model.js');
const SubCategory = require('../models/SubCategory.model.js');
const Domain = require('../models/domain.model.js');


const createCategory = async (data) => {
  const baseSlug = generateSlug(data.name);
  data.slug = await generateUniqueSlug(Category, baseSlug);

  const category = await Category.create(data);
  if (!category) {
    throw new Error('Category creation failed');
  }
  return category;
};

const updateCategory = async (id, data) => {
  const category = await Category.findByIdAndUpdate(id, data, { new: true });
  if (!category) {
    throw new Error('Category update failed');
  }
  return category;
};

const deleteCategory = async (id) => {
  const category = await Category.findByIdAndDelete(id);
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
 * UNIQUE SLUG GENERATOR
 */
async function generateUniqueSlug(Model, baseSlug) {
  let slug = baseSlug;
  let counter = 1;

  while (await Model.exists({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}


/**
 * SLUG GENERATOR
 */
function generateSlug(text) {
  return text
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

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
