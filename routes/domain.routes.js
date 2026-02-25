const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('../middleware/adminAuth');

/* ================= CATEGORY ================= */

const categoryController = require('../controllers/domain-category-controller');
const subCategoryController = require('../controllers/domain-sub-category-controller');
const domainController = require('../controllers/domain-child.controller');
const validateRequest = require('../middleware/validate-request.middleware');
const { categorySchema, subCategorySchema, idSchema, domainSchema, updateSchema } = require('../validations/domain-validator');


router.get('/categories/find', categoryController.fetchAllDomainCategories);
router.post('/categories/create', authenticateToken, authenticateAdmin, validateRequest({ body: categorySchema }), categoryController.createDomainCategory);
router.get('/categories/:id/find',  authenticateToken, validateRequest({ params: idSchema }), categoryController.fetchDomainCategoryById);
router.delete('/categories/:id/delete', authenticateToken, authenticateAdmin, validateRequest({ params: idSchema }), categoryController.deleteCategoryById);
router.patch('/categories/:id/update', authenticateToken, authenticateAdmin, validateRequest({ params: idSchema, body: categorySchema }), categoryController.updateDomainCategoryById);

/* ================= SUBCATEGORY ================= */

router.post('/subcategories/create', authenticateToken, authenticateAdmin, validateRequest({ body: subCategorySchema }), subCategoryController.createDomainSubCategory);
router.get('/subcategories/find', subCategoryController.getAllDomainSubCategories);
router.get('/subcategories/:id/find', authenticateToken, validateRequest({ params: idSchema }),  subCategoryController.getDomainSubCategoryById);
router.delete('/subcategories/:id/delete', authenticateToken, authenticateAdmin, validateRequest({ params: idSchema }), subCategoryController.deleteDomainSubCategory);
router.patch('/subcategories/:id/update', authenticateToken, authenticateAdmin, validateRequest({ params: idSchema, body: subCategorySchema }), subCategoryController.updateDomainSubCategory);

/* ================= DOMAIN ================= */

router.post('/create', authenticateToken, authenticateAdmin, validateRequest({ body: domainSchema }), domainController.createDomainChild);
router.get('/find', domainController.fetchAllDomainChildren);
router.get('/all-with-categorization', domainController.getAllDomainsWithCategorization);
router.get('/:id/find', authenticateToken, validateRequest({ params: idSchema }), domainController.fetchDomainChildById);
router.get('/:id/categorization', authenticateToken, validateRequest({ params: idSchema }), domainController.getCategoryAndSubCategoryForADomainChild);
router.patch('/:id/update', authenticateToken, authenticateAdmin, validateRequest({ params: idSchema, body: updateSchema }), domainController.updateDomainChild);
router.delete('/:id/delete', authenticateToken, authenticateAdmin, validateRequest({ params: idSchema }), domainController.deleteDomainChild);       

module.exports = router;