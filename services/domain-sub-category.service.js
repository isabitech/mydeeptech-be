const DomainSubCategoryRepository = require("../repositories/domainSubCategory.repository");
const AppError = require("../utils/app-error");

class DomainSubCategoryService {

static async createDomainSubCategory(payload) {

const { name, domain_category } = payload;

const domainCategory = await DomainSubCategoryRepository.findDomainCategorySubCategoryById(domain_category);

if (!domainCategory) {
    throw new AppError({ message: "Domain category required", statusCode: 404 });
}

const existingSubCategory = await DomainSubCategoryRepository.findByNameAndCategory(
    name,
    domain_category
    );

if (existingSubCategory) {
    throw new AppError({ message: "Domain sub-category with this name already exists in the specified category", statusCode: 400 });
}

const newSubCategory = await DomainSubCategoryRepository.create(payload);

if (!newSubCategory) {
    throw new AppError({ message: "Failed to create domain sub-category", statusCode: 500 });
}

return newSubCategory;
}

static async getAllDomainSubCategories() {
    return await DomainSubCategoryRepository.getAllDomainSubCategories();       
}

static async getDomainSubCategoriesByCategory(domainCategoryId) {

    if(!domainCategoryId) { 
        throw new AppError({ message: "Domain category ID is required for fetching sub-categories", statusCode: 400 });
    }

    const domainSubCategories = await DomainSubCategoryRepository.getDomainSubCategoriesByCategory(domainCategoryId);

    if (!domainSubCategories || domainSubCategories.length === 0) {
        throw new AppError({ message: "No domain sub-categories found for the specified category", statusCode: 404 });
    }

    return domainSubCategories;       
}

static async updateDomainSubCategory(domainSubCategoryId, { name, description }) {

    if(!domainSubCategoryId) {
        throw new AppError({ message: "Domain sub-category ID is required for update", statusCode: 400 });
    }

    const domainSubCategory = await DomainSubCategoryRepository.findById(domainSubCategoryId);

    if (!domainSubCategory) {
        throw new AppError({ message: "Domain sub-category not found", statusCode: 404 });
    }

    domainSubCategory.name = name || domainSubCategory.name;
    domainSubCategory.description = description || domainSubCategory.description;

    const updatedDomainSubCategory = await domainSubCategory.save();

    if (!updatedDomainSubCategory) {
        throw new AppError({ message: "Failed to update domain sub-category", statusCode: 500 });
    }

    return updatedDomainSubCategory;       
}

static async getDomainSubCategoryById(domainSubCategoryId) {

    if(!domainSubCategoryId) {
        throw new AppError({ message: "Domain sub-category ID is required for fetching", statusCode: 400 });
    }

    const domainSubCategory = await DomainSubCategoryRepository.findById(domainSubCategoryId);

    if (!domainSubCategory) {
        throw new AppError({ message: "Domain sub-category not found", statusCode: 404 });
    }

    return domainSubCategory;       
}


static async deleteDomainSubCategory(domainSubCategoryId) { 

    if(!domainSubCategoryId) {
        throw new AppError({ message: "Domain sub-category ID is required for deletion", statusCode: 400 });
    }

    const domainSubCategory = await DomainSubCategoryRepository.findById(domainSubCategoryId);

    if(!domainSubCategory) {
        throw new AppError({ message: "Domain sub-category not found", statusCode: 404 });
    }
    
    const deletedDomainSubCategory = await DomainSubCategoryRepository.deleteById(domainSubCategoryId);

    if (!deletedDomainSubCategory) {
        throw new AppError({ message: "Failed to delete domain sub-category", statusCode: 500 });
    }

    return deletedDomainSubCategory;
}

}

module.exports = DomainSubCategoryService;