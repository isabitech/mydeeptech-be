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

    const categoryData = await categoryService.createCategory({ name: categoryname });
    if (!categoryData) {
      return res.status(400).json({
        success: false,
        message: 'Category creation failed',
        error: 'CategoryCreationFailed',
        data: null
      });
    }

    let subCategoryData = null;
    let domainData = null;

    if (subcategory != null) {
      subCategoryData = await subCategoryService.createSubCategory({ name: subcategory, category: categoryData._id });
      if (!subCategoryData) {
        return res.status(400).json({
          success: false,
          message: 'SubCategory creation failed',
          error: 'SubCategoryCreationFailed',
          data: null
        });
      }

      domainData = await domainService.createDomain({ name, parent: subCategoryData._id, parentModel: 'SubCategory' });
    } else {
      domainData = await domainService.createDomain({ name, parent: categoryData._id, parentModel: 'Category' });
    }

    res.status(201).json({
      success: true,
      message: 'Domain, Category and SubCategory created',
      error: null,
      data: { domain: domainData, category: categoryData, subCategory: subCategoryData }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
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