const DomainCategoryChildRepository = require("../repositories/domain-category-child.repository");
const AppError = require("../utils/app-error");

class DomainChildService {

    static async createDomain(payload) {

        const { name, description, domain_sub_category, domain_category } = payload;

        const domainCategoryChildExist = await DomainCategoryChildRepository.findByName(name);

        if (domainCategoryChildExist) {
            throw new AppError({ message: "Domain child with this name already exists", statusCode: 400 });
        }

        const childPayload = {
            ...(name && { name }),
            ...(description && { description }),
            ...(domain_sub_category && { domain_sub_category }),
            ...(domain_category && { domain_category }),
        }

        const createdChild = await DomainCategoryChildRepository.create(childPayload);

        if (!createdChild) {
            throw new AppError({ message: "Failed to create domain child", statusCode: 500 });
        }

        return createdChild;

    }

    static async fetchAllDomainChildren(paginationOptions = {}) {
        const { page = 1, limit = 10, search = '' } = paginationOptions;

        // Build search query
        let query = {};
        if (search) {
            query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Calculate skip value
        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const totalCount = await DomainCategoryChildRepository.countDocuments(query);

        // Get paginated results
        const domain = await DomainCategoryChildRepository.findWithPagination(query, { skip, limit });

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / limit);

        return {
            domain,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        };
    }

    static async fetchDomainChildById(id) {

        if (!id) {
            throw new AppError({ message: "Domain child ID is required", statusCode: 400 });
        }

        const domainChild = await DomainCategoryChildRepository.findById(id);

        if (!domainChild) {
            throw new AppError({ message: "Domain child not found", statusCode: 404 });
        }

        return domainChild;
    }

    static async deleteDomainChildById(id) {

        if (!id) {
            throw new AppError({ message: "Domain child ID is required", statusCode: 400 });
        }

        const deletedChild = await DomainCategoryChildRepository.deleteById(id);

        if (!deletedChild) {
            throw new AppError({ message: "Domain child not found", statusCode: 404 });
        }

        return deletedChild;
    }

    static async updateDomainChildById(id, payload) {

        if (!id) {
            throw new AppError({ message: "Domain child ID is required", statusCode: 400 });
        }

        const updatedChild = await DomainCategoryChildRepository.updateById(id, payload);

        if (!updatedChild) {
            throw new AppError({ message: "Domain child not found", statusCode: 404 });
        }

        return updatedChild;
    }

    static async deleteDomainChildById(id) {

        if (!id) {
            throw new AppError({ message: "Domain child ID is required", statusCode: 400 });
        }

        const deletedChild = await DomainCategoryChildRepository.deleteById(id);

        if (!deletedChild) {
            throw new AppError({ message: "Domain child not found", statusCode: 404 });
        }

        return deletedChild;
    }

    static async getCategoryAndSubCategoryForADomainChild(id) {

        if (!id) {
            throw new AppError({ message: "Domain child ID is required", statusCode: 400 });
        }

        const domainWithCategorization = await DomainCategoryChildRepository.getCategoryAndSubCategoryForDomain(id);

        if (!domainWithCategorization || domainWithCategorization.length === 0) {
            throw new AppError({ message: "Domain child not found", statusCode: 404 });
        }

        return domainWithCategorization[0]; // Return first item since aggregation returns array
    }

    static async getAllDomainsWithCategorization(paginationOptions = {}) {
        const { page = 1, limit = 50, search = '' } = paginationOptions;

        // Calculate skip value
        const skip = (page - 1) * limit;

        const result = await DomainCategoryChildRepository.getAllDomainsWithCategorization({
            search,
            skip,
            limit
        });

        return result;
    }

}

module.exports = DomainChildService;