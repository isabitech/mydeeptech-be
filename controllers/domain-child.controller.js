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
    const domain = await DomainChildService.fetchAllDomainChildren();
    return ResponseClass.Success(res, { message: "Domain sub-category fetched successfully", data: { domain } });
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



module.exports = {
  createDomainChild,
  updateDomainChild,
  deleteDomainChild,
  fetchAllDomainChildren,
  fetchDomainChildById,

};