const Domain = require('../models/domain.model.js');

const createDomain = async (data) => {
  return Domain.create(data);
};

const updateDomain = async (id, data) => {
  return Domain.findByIdAndUpdate(id, data, { new: true });
};

const deleteDomain = async (id) => {
  return Domain.findByIdAndDelete(id);
};

/**
 * RULE:
 * - If parentModel = Category → fetch category domains
 * - If parentModel = SubCategory → fetch subcategory domains
 */
const fetchByParent = async (parentId, parentModel) => {
  return Domain.find({
    parent: parentId,
    parentModel
  });
};

module.exports = {
  createDomain,
  updateDomain,
  deleteDomain,
  fetchByParent
};
