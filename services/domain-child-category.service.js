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
    throw new  AppError({ message: "Failed to create domain child", statusCode: 500 });
}

return createdChild;

}

static async fetchAllDomainChildren() {
    const domainChildren = await DomainCategoryChildRepository.findAll();
    return domainChildren;
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

}

module.exports = DomainChildService;