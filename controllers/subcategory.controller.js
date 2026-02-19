const mongoose = require('mongoose');
const subCategoryService = require('../services/subcategory.service.js');

const create = async (req, res) => {
    const data = await subCategoryService.createSubCategory(req.body);
    res.status(201).json({
        success: true,
        message: 'SubCategory created',
        error: null,
        data
    });
};

const update = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid SubCategory ID',
            error: 'CastError',
            data: null
        });
    }
    const data = await subCategoryService.updateSubCategory(req.params.id, req.body);
    res.status(200).json({
        success: true,
        message: 'SubCategory updated',
        error: null,
        data
    });
};

const remove = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid SubCategory ID',
            error: 'CastError'
        });
    }
    await subCategoryService.deleteSubCategory(req.params.id);
    res.status(200).json({ success: true, message: 'SubCategory deleted', error: null, data: null });
};

const fetchByCategory = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.categoryId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid Category ID',
            error: 'CastError'
        });
    }
    const data = await subCategoryService.fetchByCategory(req.params.categoryId);
    res.status(200).json({ success: true, message: 'SubCategory fetched', error: null, data });
};

const fetchAllSubCategories = async (req, res) => {
    const data = await subCategoryService.fetchAllSubCategories();
    res.status(200).json({ success: true, message: 'SubCategory fetched', error: null, data });
};

module.exports = {
    create,
    update,
    remove,
    fetchByCategory,
    fetchAllSubCategories
};