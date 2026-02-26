const mongoose = require('mongoose');
const domainService = require('../services/domain.service.js');
const categoryService = require('../services/category.service.js');
const subCategoryService = require('../services/subcategory.service.js');

const create = async (req, res) => {
  const { name, parent, parentModel } = req.body;
  const data = await domainService.createDomain({ name, parent, parentModel });
  res.status(201).json({
    success: true,
    message: 'Domain created',
    error: null,
    data
  });
};

const update = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Domain ID',
      error: 'CastError',
      data: null
    });
  }
  const { name, parent, parentModel } = req.body;
  const updateData = {
    ...(name && { name }),
    ...(parent && { parent }),
    ...(parentModel && { parentModel })
  };
  const data = await domainService.updateDomain(req.params.id, updateData);
  res.status(200).json({ success: true, message: 'Domain updated', error: null, data });
};

const remove = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Domain ID',
      error: 'CastError'
    });
  }
  await domainService.deleteDomain(req.params.id);
  res.status(200).json({ success: true, message: 'Domain deleted', error: null, data: null });
};

const fetchByParent = async (req, res) => {
  const { parentId, parentModel } = req.query;
  if (!mongoose.isValidObjectId(parentId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Parent ID',
      error: 'CastError'
    });
  }
  const data = await domainService.fetchByParent(parentId, parentModel);
  res.status(200).json({ success: true, message: 'Domain fetched', error: null, data });
};

const findAll = async (req, res) => {
  const data = await domainService.findAll();
  res.status(200).json({ success: true, message: 'Domains fetched', error: null, data });
};


const CreateALL = async (req, res) => {
  try {
    const { name, categoryname, subcategory } = req.body;

    if (!categoryname || !categoryname.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
        error: 'ValidationError',
        data: null
      });
    }

    // 1️⃣ Find or create category
    let categoryData = await categoryService.findByName(categoryname.trim());

    if (!categoryData) {
      categoryData = await categoryService.createCategory({
        name: categoryname.trim()
      });
    }

    let subCategoryData = null;
    let domainData = null;

    // 2️⃣ Create subcategory if provided
    if (subcategory && subcategory.trim()) {
      subCategoryData = await subCategoryService.createSubCategory({
        name: subcategory.trim(),
        category: categoryData._id
      });
    }

    // 3️⃣ Create domain if provided
    if (name && name.trim()) {
      domainData = await domainService.createDomain({
        name: name.trim(),
        parent: subCategoryData ? subCategoryData._id : categoryData._id,
        parentModel: subCategoryData ? 'SubCategory' : 'Category'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Creation successful',
      error: null,
      data: {
        category: categoryData,
        subCategory: subCategoryData,
        domain: domainData
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
      data: null
    });
  }
};

module.exports = {
  create,
  update,
  remove,
  fetchByParent,
  findAll,
  CreateALL
};