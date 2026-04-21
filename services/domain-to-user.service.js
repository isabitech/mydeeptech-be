const DomainToUserRepository = require("../repositories/domain-to-user.repository");
const AppError = require("../utils/app-error");
const DomainCategoryRepository = require("../repositories/domainCategory.repository");
const DomainSubCategoryRepository = require("../repositories/domainSubCategory.repository");
const DomainCategoryChildRepository = require("../repositories/domain-category-child.repository");
class DomainToUserService {

    static async assignMultipleDomainsToUser(userId, domainIds) {
        if (!domainIds || !Array.isArray(domainIds)) {
            throw new AppError({ message: "domainIds must be an array", statusCode: 400 });
        }
        if (!userId) {
            throw new AppError({ message: "User ID is required", statusCode: 400 });
        }

        // Remove duplicates from the input array
        const uniqueDomainIds = [...new Set(domainIds)];
        
        // Get all existing domain assignments for this user in one query
        const existingAssignments = await DomainToUserRepository.findByUserId(userId);
        const existingDomainIds = new Set(existingAssignments.map(assignment => assignment.domain_child.toString()));
        
        // Filter out domains that are already assigned
        const newDomainIds = uniqueDomainIds.filter(domainId => !existingDomainIds.has(domainId.toString()));
        
        const createdMappings = [];
        
        // Add existing assignments to response
        createdMappings.push(...existingAssignments.filter(assignment => 
            uniqueDomainIds.includes(assignment.domain_child.toString())
        ));
        
        // Create new assignments only for domains not already assigned
        for (const domain_child of newDomainIds) {
            try {
                const mapping = await this.createDomainToUser({ userId, domain_child });
                createdMappings.push(mapping);
            } catch (error) {
                // If duplicate key error occurs, fetch the existing record instead
                if (error.code === 11000) {
                    console.log(`Domain ${domain_child} already assigned to user ${userId}, fetching existing record`);
                    const existing = await DomainToUserRepository.findByUserAndDomainChild(userId, domain_child);
                    if (existing) {
                        createdMappings.push(existing);
                    }
                } else {
                    throw error;
                }
            }
        }
        
        return createdMappings;
    }

    static async createDomainToUser(payload) {
        const { user, userId, domain_child } = payload;
        const assignUser = user || userId;
        const domainChildExist = await DomainCategoryChildRepository.findById(domain_child);
        if (!domainChildExist) {
            throw new AppError({ message: "Domain child not found", statusCode: 404 });
        }
        const domain_category = domainChildExist.domain_category;
        const domain_sub_category = domainChildExist.domain_sub_category;
        const domainToUserPayload = {
            ...(assignUser && { user: assignUser }),
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
    static async fetchDomainToUserById(userId) {
        if (!userId) {
            throw new AppError({ message: "User ID is required", statusCode: 400 });
        }
        const domainToUser = await DomainToUserRepository.findByUserId(userId);
        return domainToUser;
    }
}

module.exports = DomainToUserService;