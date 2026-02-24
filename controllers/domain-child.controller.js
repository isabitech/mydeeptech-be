const DomainChildService = require("../services/domain-child-category.service");
const ResponseClass = require("../utils/response-handler");

const createDomainChild = async (req, res, next) => {

  const { name, description, domain_sub_category, domain_category } = req.body;

  const payload = {
    ...(name && { name }),  
    ...(description && { description }),
    ...(domain_sub_category && { domain_sub_category }),
    ...(domain_category && { domain_category }),
   }

  try {
    const domain = await DomainChildService.createDomain(payload);
    return ResponseClass.Success(res, { message: "Domain sub-category created successfully", data: { domain } });
  } catch (error) {
    next(error);
  }
};

const fetchAllDomainChildren = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const paginationOptions = {
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.trim()
    };
    
    const result = await DomainChildService.fetchAllDomainChildren(paginationOptions);
    return ResponseClass.Success(res, { 
      message: "Domains fetched successfully", 
      data: result 
    });
  } catch (error) {
    next(error);
  }
};

const fetchDomainChildById = async (req, res, next) => {
  try {
    const domainChild = await DomainChildService.fetchDomainChildById(req.params.id);
    return ResponseClass.Success(res, { message: "Domain sub-category fetched successfully", data: { domainChild } });
  } catch (error) {
    next(error);
  }
};

const updateDomainChild = async (req, res, next) => {
  const { name, description, domain_sub_category, domain_category } = req.body;

  try {

  const payload = {
    ...(name && { name }),
    ...(description && { description }),
    ...(domain_sub_category && { domain_sub_category }),
    ...(domain_category && { domain_category }),
   }

  const domainChild = await DomainChildService.updateDomainChildById(
    req.params.id,
    payload
  );

   return ResponseClass.Success(res, { message: "Domain sub-category updated successfully", data: { domainChild } });
  } catch (error) {
    next(error);
  }

};

 const deleteDomainChild = async (req, res, next) => {
  try {
    await DomainChildService.deleteDomainChildById(req.params.id);
    return ResponseClass.Success(res, { message: "Domain deleted" });
  } catch (error) {
    next(error);
  }
};

const getCategoryAndSubCategoryForADomainChild = async (req, res, next) => {
  try {
    const { id } = req.params;
    const domainWithCategorization = await DomainChildService.getCategoryAndSubCategoryForADomainChild(id);
    return ResponseClass.Success(res, { 
      message: "Domain categorization fetched successfully", 
      data: { domainWithCategorization } 
    });
  } catch (error) {
    next(error);
  }
};

const getAllDomainsWithCategorization = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const paginationOptions = {
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.trim()
    };
    
    const result = await DomainChildService.getAllDomainsWithCategorization(paginationOptions);
    return ResponseClass.Success(res, { 
      message: "All domains with categorization fetched successfully", 
      data: result 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDomainChild,
  updateDomainChild,
  deleteDomainChild,
  getCategoryAndSubCategoryForADomainChild, 
  getAllDomainsWithCategorization,
  fetchAllDomainChildren,
  fetchDomainChildById,

};