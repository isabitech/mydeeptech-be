const DomainCategoryRepository = require("../repositories/domainCategory.repository");
const AppError = require("../utils/app-error");

class DomainCategoryService {

static async createDomainCategory(payload) {

const { name, description } = payload;

const domainCategoryExist = await DomainCategoryRepository.findByName(name);

if (domainCategoryExist) {
    throw new AppError({ message: "Domain category with this name already exists", statusCode: 404 });
}

const domainPayload = {
    ...(name && { name }),
    ...(description && { description }),    
}

const createdCategory = await DomainCategoryRepository.create(domainPayload);

if (!createdCategory) {
    throw new AppError({ message: "Failed to create domain category", statusCode: 500 });
}

return createdCategory;

}

static async fetchAllDomainCategories(paginationOptions = {}) {

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
    const totalCount = await DomainCategoryRepository.countDocuments(query);

    // Get paginated results
    const categories = await DomainCategoryRepository.findWithPagination(query, { skip, limit });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);

    return {
        categories,
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

static async fetchDomainCategoryById(id) {

    if (!id) {
        throw new AppError({ message: "Domain category ID is required", statusCode: 400 });
    }

    const domainCategory = await DomainCategoryRepository.findById(id);

    if (!domainCategory) {
        throw new AppError({ message: "Domain category not found", statusCode: 404 });
    } 

    return domainCategory;
}

static async deleteDomainCategoryById(id) {

    if (!id) {
        throw new AppError({ message: "Domain category ID is required", statusCode: 400 });
    }

    const deletedCategory = await DomainCategoryRepository.deleteById(id);

    if (!deletedCategory) {
        throw new AppError({ message: "Domain category not found", statusCode: 404 });
    } 
    return deletedCategory;
}

static async updateDomainCategoryById(id, payload) {

    if (!id) {
        throw new AppError({ message: "Domain category ID is required", statusCode: 400 });
    }

    const updatedCategory = await DomainCategoryRepository.updateById(id, payload);

    if (!updatedCategory) {
        throw new AppError({ message: "Domain category not found", statusCode: 404 });
    }
    return updatedCategory;
}

static async deleteCategoryById(id) {

    if (!id) {
        throw new AppError({ message: "Domain category ID is required", statusCode: 400 });
    }

    const deletedCategory = await DomainCategoryRepository.deleteById(id);

    if (!deletedCategory) {
        throw new AppError({ message: "Domain category not found", statusCode: 404 });
    }

    return deletedCategory;
}

}

module.exports = DomainCategoryService;