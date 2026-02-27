const DomainSubCategoryService = require("../services/domain-sub-category.service");
const ResponseClass = require("../utils/response-handler");

const createDomainSubCategory = async (req, res) => {

  const { name, domain_category, description } = req.body;

  const payload = {
    ...(name && { name }),
    ...(domain_category && { domain_category }),
    ...(description && { description }),
  };

    const newDomainSubCategory = await DomainSubCategoryService.createDomainSubCategory(payload);
    return ResponseClass.Success(res, { message: "Domain sub-category created successfully", data: { domainSubCategory: newDomainSubCategory } });

};


const getAllDomainSubCategories = async (req, res) => {
    const { page = 1, limit = 10, search = '' } = req.query;
    const paginationOptions = {
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.trim()
    };
    const result = await DomainSubCategoryService.getAllDomainSubCategories(paginationOptions);
    return ResponseClass.Success(res, { 
      message: "Domain sub-categories fetched successfully", 
      data: result 
    });
};


const getDomainSubCategoriesByCategory = async (req, res) => {
  const { id: categoryId} = req.params;
  const domainSubCategories = await DomainSubCategoryService.getDomainSubCategoriesByCategory(categoryId);
  return ResponseClass.Success(res, { message: "Domain sub-categories fetched successfully", data: { domainSubCategories } });
};  



const updateDomainSubCategory = async (req, res) => {

  const { name, description } = req.body;
   const { id: domainSubCategoryId} = req.params;

  const payload = {
    ...(name && { name }),
    ...(description && { description }),  
  };
  const updatedDomainSubCategory = await DomainSubCategoryService.updateDomainSubCategory(domainSubCategoryId, payload);
  return ResponseClass.Success(res, { message: "Domain sub-category updated successfully", data: { domainSubCategory: updatedDomainSubCategory } });
};


const getDomainSubCategoryById = async (req, res) => {
  const { id: domainSubCategoryId} = req.params;
  const domainSubCategory = await DomainSubCategoryService.getDomainSubCategoryById(domainSubCategoryId);
  return ResponseClass.Success(res, { message: "Domain sub-category fetched successfully", data: { domainSubCategory } });
};


const deleteDomainSubCategory = async (req, res) => {
  const { id: domainSubCategoryId } = req.params;
  const domainSubCategory = await DomainSubCategoryService.deleteDomainSubCategory(domainSubCategoryId);
  return ResponseClass.Success(res, { message: "Domain sub-category and related sub-children deleted", data: { domainSubCategory } });
};



module.exports = {
  deleteDomainSubCategory,
  createDomainSubCategory,
  getDomainSubCategoriesByCategory,
  updateDomainSubCategory,
  getDomainSubCategoryById,
  getAllDomainSubCategories,
};