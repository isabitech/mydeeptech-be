const DomainCategoryRepository = require("../repositories/domainCategory.repository");
const DomainSubCategoryRepository = require("../repositories/domainSubCategory.repository");
const DomainCategoryChildRepository = require("../repositories/domain-category-child.repository");
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

    static async fetchAllDomainCategories() {
        const domainCategories = await DomainCategoryRepository.findAll();
        return domainCategories;
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

    static async getAllDomainsWithCategorization({ page = 1, limit = 50, search = '' } = {}) {
        // Build search query for children
        let childQuery = {};
        if (search) {
            childQuery = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            };
        }
        // Pagination
        const skip = (page - 1) * limit;
        // Fetch all categories
        const categories = await DomainCategoryRepository.findAll();
        // Fetch all subcategories
        const subCategories = await DomainSubCategoryRepository.getAllDomainSubCategories();
        // Fetch paginated domain children
        const totalCount = await DomainCategoryChildRepository.countDocuments(childQuery);
        const domainChildren = await DomainCategoryChildRepository.findWithPagination(childQuery, { skip, limit });

        // Build a map for subcategories by category
        const subCatByCat = {};
        subCategories.forEach(sub => {
            const catId = sub.domain_category._id.toString();
            if (!subCatByCat[catId]) subCatByCat[catId] = [];
            subCatByCat[catId].push({
                _id: sub._id,
                name: sub.name,
                slug: sub.slug,
                description: sub.description,
                children: []
            });
        });

        // Build a map for children by subcategory and by category
        const childrenBySubCat = {};
        const childrenByCat = {};
        domainChildren.forEach(child => {
            if (child.domain_sub_category) {
                const subCatId = child.domain_sub_category._id.toString();
                if (!childrenBySubCat[subCatId]) childrenBySubCat[subCatId] = [];
                childrenBySubCat[subCatId].push({
                    _id: child._id,
                    name: child.name,
                    slug: child.slug,
                    description: child.description,
                    hasSubCategory: true
                });
            } else {
                const catId = child.domain_category._id.toString();
                if (!childrenByCat[catId]) childrenByCat[catId] = [];
                childrenByCat[catId].push({
                    _id: child._id,
                    name: child.name,
                    slug: child.slug,
                    description: child.description,
                    hasSubCategory: false
                });
            }
        });
        // Build the tree
        const tree = categories.map(cat => {
            const catId = cat._id.toString();
            const subCats = (subCatByCat[catId] || []).map(sub => {
                const subCatId = sub._id.toString();
                return {
                    ...sub,
                    SubdomainChild: childrenBySubCat[subCatId] || []
                };
            });
            return {
                _id: cat._id,
                name: cat.name,
                slug: cat.slug,
                description: cat.description,
                subCategories: subCats,
                domainChild: childrenByCat[catId] || [] // children directly under category
            };
        });
        const totalPages = Math.ceil(totalCount / limit);
        const currentPage = Math.floor(skip / limit) + 1;
        return {
            tree,
            pagination: {
                currentPage,
                totalPages,
                totalCount,
                limit,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1
            }
        };
    }
}

module.exports = DomainCategoryService;