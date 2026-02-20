const mongoose = require('mongoose');
const categoryService = require('../service/category.service.js');

const create = async (req, res) => {
  const { name} = req.body;
  const data = await categoryService.createCategory({name});
  res.status(201).json({
    success: true,
    message: 'Category created',
    error: null,
    data,
  });
};

const update = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Category ID',
      error: 'CastError',
      data: null
    });
  }
  const { name } = req.body;
  const data = await categoryService.updateCategory(req.params.id, {name});
  res.json({
    success: true,
    message: 'Category updated',
    error: null,
    data,
  });
};

const remove = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Category ID',
      error: 'CastError',
      data: null
    });
  }
  await categoryService.deleteCategory(req.params.id);
  res.json({
    success: true,
    message: 'Category deleted',
    error: null,
  });
};

const fetchTree = async (req, res) => {
  const data = await categoryService.fetchCategoryTree();
  res.json({
    success: true,
    message: 'Category tree fetched',
    data,
    error: null,
  });
};

const fetchById = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Category ID',
      error: 'CastError',
      data: null
    });
  }
  const data = await categoryService.findById(req.params.id);
  res.json({
    success: true,
    message: 'Category fetched',
    data,
    error: null,
  });
};

module.exports = {
  create,
  update,
  remove,
  fetchTree,
  fetchById
};
