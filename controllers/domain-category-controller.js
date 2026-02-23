const DomainCategoryService = require("../services/domain-category.service");
const ResponseClass = require("../utils/response-handler");

const createDomainCategory = async (req, res, next) => {

  const { name, description } = req.body;

  const payload = {
    ...(name && { name }),
    ...(description && { description }),
  };
    try {
    const newCategory = await DomainCategoryService.createDomainCategory(payload);
    return ResponseClass.Success(res, { message: "Domain category created successfully", data: { category: newCategory }});
  } catch (err) {
    next(err);
  }
};

const fetchAllDomainCategories = async (req, res, next) => {
  try {
    const categories = await DomainCategoryService.fetchAllDomainCategories();
    return ResponseClass.Success(res, { message: "Domain categories retrieved successfully", data: { categories } });
  } catch (err) {
    next(err);
  }
};

const fetchDomainCategoryById = async (req, res, next) => {
  try {
    const category = await DomainCategoryService.fetchDomainCategoryById(req.params.id);
    return ResponseClass.Success(res, { message: "Domain category retrieved successfully", data: { category } });
  } catch (err) {
    next(err);
  }
};

const deleteDomainCategoryById = async (req, res, next) => {
  try {
    await DomainCategoryService.deleteCategoryById(req.params.id);
    return ResponseClass.Success(res, { message: "Category and related data deleted" });
  } catch (err) {
    next(err);
  }
};

const updateDomainCategoryById = async (req, res, next) => {
  try {
  
    const { name, description } = req.body;

    const payload = {
      ...(name && { name }),
      ...(description && { description }),
    };

  const domainCategory = await DomainCategoryService.updateDomainCategoryById(
    req.params.id,
    payload
  );

  return ResponseClass.Success(res, { message: "Domain category updated successfully", data: { domainCategory } });

  } catch (err) {
    next(err);
  }
};

const deleteCategoryById = async (req, res, next) => {
  try {
    await DomainCategoryService.deleteCategoryById(req.params.id);
    return ResponseClass.Success(res, { message: "Category and related data deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  deleteDomainCategoryById,
  updateDomainCategoryById,
  deleteCategoryById,
  createDomainCategory,
  fetchAllDomainCategories,
  fetchDomainCategoryById,
}