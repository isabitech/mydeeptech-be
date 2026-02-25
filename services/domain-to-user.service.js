const DomainToUserRepository = require("../repositories/domain-to-user.repository");
const AppError = require("../utils/app-error");
const DomainCategoryRepository = require("../repositories/domainCategory.repository");
const DomainSubCategoryRepository = require("../repositories/domainSubCategory.repository");
const DomainCategoryChildRepository = require("../repositories/domain-category-child.repository");
class DomainToUserService {

    static async createDomainToUser(payload) {
        const { user, domain_child } = payload;
        const domainChildExist = await DomainCategoryChildRepository.findById(domain_child);
        if (!domainChildExist) {
            throw new AppError({ message: "Domain child not found", statusCode: 404 });
        }
        if (domainChildExist.domain_category.toString() !== domain_category) {
            throw new AppError({ message: "Domain child does not belong to the specified domain category", statusCode: 400 });
        }
        const subCategoryExist = await DomainSubCategoryRepository.getDomainSubCategoriesByCategory(domain_category);
        if (!subCategoryExist || !subCategoryExist.includes(domain_sub_category)) {
            throw new AppError({ message: "Domain sub category does not belong to the specified domain category", statusCode: 400 });
        }
        const domain_category= domainChildExist.domain_category;
        const domain_sub_category = domainChildExist.domain_sub_category;
        const domainToUserPayload = {
            ...(user && { user }),
            ...(domain_category && { domain_category }),
            ...(domain_sub_category && { domain_sub_category }),
            ...(domain_child && { domain_child })
        };
        const createdDomainToUser = await DomainToUserRepository.create(domainToUserPayload);
        if (!createdDomainToUser) {
            throw new AppError({ message: "Failed to create domain to user mapping", statusCode: 500 });
        }
        return createdDomainToUser;
    }
    static async fetchAllDomainToUser() {
        const domainToUser = await DomainToUserRepository.findAll();
        return domainToUser;
    }
    static async removeDomainfromUser(id) {
        if (!id) {
            throw new AppError({ message: "Domain to user ID is required", statusCode: 400 });
        }
        const deletedDomainToUser = await DomainToUserRepository.deleteById(id);
        if (!deletedDomainToUser) {
            throw new AppError({ message: "Failed to remove domain from user", statusCode: 500 });
        }
        return deletedDomainToUser;
    }
}