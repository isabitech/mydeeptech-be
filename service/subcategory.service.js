const SubCategory = require('../models/SubCategory.model.js');
const Domain = require('../models/domain.model.js');

const createSubCategory = async (data) => {
  return SubCategory.create(data);
};

const updateSubCategory = async (id, data) => {
  return SubCategory.findByIdAndUpdate(id, data, { new: true });
};

const deleteSubCategory = async (id) => {
  await Domain.deleteMany({ parent: id, parentModel: 'SubCategory' });
  return SubCategory.findByIdAndDelete(id);
};

const fetchByCategory = async (categoryId) => {
  return SubCategory.find({ category: categoryId });
};

module.exports = {
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  fetchByCategory
};
