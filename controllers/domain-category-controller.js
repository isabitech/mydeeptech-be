const DomainCategoryService = require("../services/domain-category.service");
const ResponseClass = require("../utils/response-handler");


const fetchCategoryTree = async (req, res) => {
    const tree = await DomainCategoryService.getAllDomainsWithCategorization();
    return ResponseClass.Success(res, {
      message: "Category tree fetched successfully",
      data:  tree
    });
};

const createDomainCategory = async (req, res) => {

  const { name, description } = req.body;

  const payload = {
    ...(name && { name }),
    ...(description && { description }),
  };
  const newCategory = await DomainCategoryService.createDomainCategory(payload);
  return ResponseClass.Success(res, { message: "Domain category created successfully", data: { category: newCategory } });
};

const fetchAllDomainCategories = async (req, res) => {
    const { page = 1, limit = 10, search = '' } = req.query;
    const paginationOptions = {
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.trim()
    };

    const categories = await DomainCategoryService.fetchAllDomainCategories(paginationOptions);
    return ResponseClass.Success(res, { 
      message: "Domain categories retrieved successfully", 
      data: { categories } 
    });
};

const fetchDomainCategoryById = async (req, res) => {
    const category = await DomainCategoryService.fetchDomainCategoryById(req.params.id);
    return ResponseClass.Success(res, { message: "Domain category retrieved successfully", data: { category } });
};

const deleteDomainCategoryById = async (req, res) => {
    await DomainCategoryService.deleteCategoryById(req.params.id);
    return ResponseClass.Success(res, { message: "Category and related data deleted" });
};

const updateDomainCategoryById = async (req, res) => {

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
};

const deleteCategoryById = async (req, res) => {
    await DomainCategoryService.deleteCategoryById(req.params.id);
    return ResponseClass.Success(res, { message: "Category and related data deleted" });
};

module.exports = {
  deleteDomainCategoryById,
  updateDomainCategoryById,
  deleteCategoryById,
  createDomainCategory,
  fetchAllDomainCategories,
  fetchDomainCategoryById,
  fetchCategoryTree,
}