const mongoose = require('mongoose');
const Domain = require('../models/domain.model.js');
const Category = require('../models/category.model.js');
const SubCategory = require('../models/SubCategory.model.js');

/**
 * CREATE DOMAIN
 */
const createDomain = async (data) => {
  if (!data?.name) {
    throw new Error('Domain name is required');
  }

  if (!mongoose.isValidObjectId(data.parent)) {
    throw new Error('Invalid parent id');
  }

  if (!['Category', 'SubCategory'].includes(data.parentModel)) {
    throw new Error('Invalid parentModel value');
  }

  const newData = { ...data };

  // If parent is Category
  if (data.parentModel === 'Category') {
    const category = await Category.findById(data.parent).lean();
    if (!category) {
      throw new Error('Category not found');
    }

    newData.category = data.parent;

    const firstSub = await SubCategory
      .findOne({ category: data.parent })
      .select('_id')
      .lean();

    newData.subCategory = firstSub ? firstSub._id : null;
  }

  // If parent is SubCategory
  if (data.parentModel === 'SubCategory') {
    const subCategory = await SubCategory
      .findById(data.parent);

    if (!subCategory) {
      throw new Error('SubCategory not found');
    }

    newData.subCategory = data.parent;
    newData.category = subCategory.category;
  }

  // Generate unique slug
  const baseSlug = generateSlug(newData.name);
  newData.slug = await generateUniqueSlug(Domain, baseSlug);

  // Remove temporary fields properly
  delete newData.parent;
  delete newData.parentModel;

  const domain = await Domain.create(newData);

  return domain;
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
 * UPDATE DOMAIN
 */
const updateDomain = async (id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error('Invalid domain id');
  }

  return await Domain.findByIdAndUpdate(
    id,
    data,
    { new: true, runValidators: true }
  );
};


/**
 * DELETE DOMAIN
 */
const deleteDomain = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error('Invalid domain id');
  }

  return await Domain.findByIdAndDelete(id);
};


/**
 * FETCH BY PARENT
 */
const fetchByParent = async (parentId, parentModel) => {
  if (!mongoose.isValidObjectId(parentId)) {
    throw new Error('Invalid parent id');
  }

  if (parentModel === 'Category') {
    return await Domain
      .find({ category: parentId })
      .populate('category')
      .populate('subCategory');
  }

  if (parentModel === 'SubCategory') {
    return await Domain
      .find({ subCategory: parentId })
      .populate('category')
      .populate('subCategory');
  }

  throw new Error('Invalid parentModel value');
};


/**
 * FIND ALL
 */
const findAll = async () => {
  return await Domain
    .find()
    .populate('category')
    .populate('subCategory');
};


module.exports = {
  createDomain,
  updateDomain,
  deleteDomain,
  fetchByParent,
  findAll
};