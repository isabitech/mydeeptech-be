const DomainSubCategoryService = require("../services/Domain-sub-category.service");
const ResponseClass = require("../utils/response-handler");

const createDomainSubCategory = async (req, res, next) => {

  const { name, domain_category, description } = req.body;

  const payload = {
    ...(name && { name }),
    ...(domain_category && { domain_category }),
    ...(description && { description }),
  };

  try {
    const newDomainSubCategory = await DomainSubCategoryService.createDomainSubCategory(payload);
    return ResponseClass.Success(res, { message: "Domain sub-category created successfully", data: { domainSubCategory: newDomainSubCategory } });
  } catch (err) {
    next(err);
  }

};


const getAllDomainSubCategories = async (req, res, next) => {

  try {
    const domainSubCategories = await DomainSubCategoryService.getAllDomainSubCategories();
    return ResponseClass.Success(res, { message: "Domain sub-categories fetched successfully", data: { domainSubCategories } });
  } catch (err) {
      next(err);
    }
};


const getDomainSubCategoriesByCategory = async (req, res, next) => {
  
  const { id: categoryId} = req.params;

  try {
    const domainSubCategories = await DomainSubCategoryService.getDomainSubCategoriesByCategory(categoryId);
    return ResponseClass.Success(res, { message: "Domain sub-categories fetched successfully", data: { domainSubCategories } });
  } catch (err) {
    next(err);
  }
};  



const updateDomainSubCategory = async (req, res, next) => {

  const { name, description } = req.body;
   const { id: domainSubCategoryId} = req.params;

  const payload = {
    ...(name && { name }),
    ...(description && { description }),  
  };

  try {
    const updatedDomainSubCategory = await DomainSubCategoryService.updateDomainSubCategory(domainSubCategoryId, payload);
    return ResponseClass.Success(res, { message: "Domain sub-category updated successfully", data: { domainSubCategory: updatedDomainSubCategory } });
  } catch (err) {
    next(err);
  }
};


const getDomainSubCategoryById = async (req, res, next) => {

  const { id: domainSubCategoryId} = req.params;

  try {
    const domainSubCategory = await DomainSubCategoryService.getDomainSubCategoryById(domainSubCategoryId);
    return ResponseClass.Success(res, { message: "Domain sub-category fetched successfully", data: { domainSubCategory } });
  } catch (err) {
    next(err);
  }
};


const deleteDomainSubCategory = async (req, res, next) => {

  const { id: domainSubCategoryId } = req.params;

  try {
    const domainSubCategory = await DomainSubCategoryService.deleteDomainSubCategory(domainSubCategoryId);
    return ResponseClass.Success(res, { message: "Domain sub-category and related sub-children deleted", data: { domainSubCategory } });
  } catch (err) {
    next(err);
  }
};



module.exports = {
  deleteDomainSubCategory,
  createDomainSubCategory,
  getDomainSubCategoriesByCategory,
  updateDomainSubCategory,
  getDomainSubCategoryById,
  getAllDomainSubCategories,
};