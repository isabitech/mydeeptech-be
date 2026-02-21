const SubCategory = require('../models/SubCategory.model.js');
const Domain = require('../models/domain.model.js');

const createSubCategory = async (data) => {
  const baseSlug = generateSlug(data.name);
  data.slug = await generateUniqueSlug(SubCategory, baseSlug);
  const subCategory = await SubCategory.create(data);
  if (!subCategory) {
    throw new Error('SubCategory creation failed');
  }
  return subCategory;
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

const updateSubCategory = async (id, data) => {
  return await SubCategory.findByIdAndUpdate(id, data, { new: true });
};

const deleteSubCategory = async (id) => {
  await Domain.deleteMany({ parent: id, parentModel: 'SubCategory' });
  const subCategory = await SubCategory.findByIdAndDelete(id);
  if (!subCategory) {
    throw new Error('SubCategory deletion failed');
  }
  return subCategory;
};

const fetchByCategory = async (categoryId) => {
  const subCategories = await SubCategory.find({ category: categoryId }).populate('category');
  return subCategories;
};

const fetchAllSubCategories = async () => {
  // Get all subcategories with their category populated
  const subCategories = await SubCategory.find().populate('category');

  // Get all domains for SubCategories in one query
  const subCategoryIds = subCategories.map(sc => sc._id);
  const domains = await Domain.find({ subCategory: { $in: subCategoryIds } });

  // Map domains to their respective subcategories
  const result = subCategories.map(sc => {
    const relatedDomains = domains.filter(d => d.subCategory.toString() === sc._id.toString());
    return {
      ...sc.toObject(),
      domains: relatedDomains
    };
  });

  return result;
};


module.exports = {
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  fetchByCategory,
  fetchAllSubCategories
};
