const subCategoryService = require('../services/subcategory.service.js');

const create = async (req, res) => {
    const data = await subCategoryService.createSubCategory(req.body);
    res.status(201).json(data);
};

const update = async (req, res) => {
    const data = await subCategoryService.updateSubCategory(req.params.id, req.body);
    res.json(data);
};

const remove = async (req, res) => {
    await subCategoryService.deleteSubCategory(req.params.id);
    res.json({ message: 'SubCategory deleted' });
};

const fetchByCategory = async (req, res) => {
    const data = await subCategoryService.fetchByCategory(req.params.categoryId);
    res.json(data);
};

module.exports = {
    create,
    update,
    remove,
    fetchByCategory
};
