const categoryService = require('../services/category.service.js');

const create = async (req, res) => {
  const data = await categoryService.createCategory(req.body);
  res.status(201).json(data);
};

const update = async (req, res) => {
  const data = await categoryService.updateCategory(req.params.id, req.body);
  res.json(data);
};

const remove = async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  res.json({ message: 'Category deleted' });
};

const fetchTree = async (req, res) => {
  const data = await categoryService.fetchCategoryTree();
  res.json(data);
};

module.exports = {
  create,
  update,
  remove,
  fetchTree
};
