const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/category.controller.js');
const subCategoryController = require('../controllers/subcategory.controller.js');
const domainController = require('../controllers/domain.controller.js');
const { authenticateAdmin } = require('../middleware/adminAuth.js');
const { authenticateToken } = require('../middleware/auth.js');
const { validateRequest } = require('../middleware/validation.middleware.js');
const {
  categorySchema,
  subCategorySchema,
  domainSchema,
  updateSchema
} = require('../validations/domain.validation.js');

/**
 * @swagger
 * tags:
 *   - name: Category
 *     description: Category management
 *   - name: SubCategory
 *     description: SubCategory management
 *   - name: Domain
 *     description: Domain management
 */

/* ================= CATEGORY ================= */

/**
 * @swagger
 * paths:
 *   /categories:
 *     post:
 *       summary: Create a category
 *       tags: [Category]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 slug:
 *                   type: string
 *       responses:
 *         201:
 *           description: Category created
 */
router.post('/categories', authenticateAdmin, validateRequest(categorySchema), categoryController.create);

/**
 * @swagger
 * paths:
 *   /categories/{id}:
 *     put:
 *       summary: Update a category
 *       tags: [Category]
 *       parameters:
 *         - in: path
 *           name: id
 *           required: true
 *           schema:
 *             type: string
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 slug:
 *                   type: string
 *       responses:
 *         200:
 *           description: Category updated
 */
router.put('/categories/:id', authenticateAdmin, validateRequest(updateSchema), categoryController.update);

/**
 * @swagger
 * paths:
 *   /categories/{id}:
 *     delete:
 *       summary: Delete a category
 *       tags: [Category]
 *       parameters:
 *         - in: path
 *           name: id
 *           required: true
 *           schema:
 *             type: string
 *       responses:
 *         200:
 *           description: Category deleted
 */
router.delete('/categories/:id', authenticateAdmin, categoryController.remove);

/**
 * @swagger
 * paths:
 *   /categories/tree:
 *     get:
 *       summary: Get category tree with subcategories and domains
 *       tags: [Category]
 *       responses:
 *         200:
 *           description: Category tree
 */
router.get('/categories/tree', authenticateToken, categoryController.fetchTree);

/**
 * @swagger
 * paths:
 *   /categories/{id}:
 *     get:
 *       summary: Get a category by ID
 *       tags: [Category]
 *       parameters:
 *         - in: path
 *           name: id
 *           required: true
 *           schema:
 *             type: string
 *       responses:
 *         200:
 *           description: Category fetched
 */
router.get('/categories/:id', authenticateToken, categoryController.fetchById);
/* ================= SUBCATEGORY ================= */

/**
 * @swagger
 * paths:
 *   /subcategories:
 *     post:
 *       summary: Create a subcategory
 *       tags: [SubCategory]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 slug:
 *                   type: string
 *                 category:
 *                   type: string
 *       responses:
 *         201:
 *           description: Subcategory created
 */
router.post('/subcategories', authenticateAdmin, validateRequest(subCategorySchema), subCategoryController.create);

/**
 * @swagger
 * paths:
 *   /subcategories/{id}:
 *     put:
 *       summary: Update a subcategory
 *       tags: [SubCategory]
 *       parameters:
 *         - in: path
 *           name: id
 *           required: true
 *           schema:
 *             type: string
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 slug:
 *                   type: string
 *                 category:
 *                   type: string
 *       responses:
 *         200:
 *           description: Subcategory updated
 */
router.put('/subcategories/:id', authenticateAdmin, validateRequest(updateSchema), subCategoryController.update);

/**
 * @swagger
 * paths:
 *   /subcategories:
 *     get:
 *       summary: Get all subcategories
 *       tags: [SubCategory]
 *       responses:
 *         200:
 *           description: List of subcategories
 */
router.get('/subcategories', authenticateToken, subCategoryController.fetchAllSubCategories);



/**
 * @swagger
 * paths:
 *   /subcategories/{id}:
 *     delete:
 *       summary: Delete a subcategory
 *       tags: [SubCategory]
 *       parameters:
 *         - in: path
 *           name: id
 *           required: true
 *           schema:
 *             type: string
 *       responses:
 *         200:
 *           description: Subcategory deleted
 */
router.delete('/subcategories/:id', authenticateAdmin, subCategoryController.remove);

/**
 * @swagger
 * paths:
 *   /subcategories/by-category/{categoryId}:
 *     get:
 *       summary: Get subcategories by category ID
 *       tags: [SubCategory]
 *       parameters:
 *         - in: path
 *           name: categoryId
 *           required: true
 *           schema:
 *             type: string
 *       responses:
 *         200:
 *           description: List of subcategories
 */
router.get(
  '/subcategories/by-category/:categoryId',
  authenticateToken,
  subCategoryController.fetchByCategory
);

/* ================= DOMAIN ================= */

/**
 * @swagger
 * paths:
 *   /domains:
 *     post:
 *       summary: Create a domain
 *       tags: [Domain]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 slug:
 *                   type: string
 *                 parent:
 *                   type: string
 *                 parentModel:
 *                   type: string
 *                   enum: [Category, SubCategory]
 *       responses:
 *         201:
 *           description: Domain created
 */
router.post('/domains', authenticateAdmin, validateRequest(domainSchema), domainController.create);

/**
 * @swagger
 * paths:
 *   /domains/{id}:
 *     put:
 *       summary: Update a domain
 *       tags: [Domain]
 *       parameters:
 *         - in: path
 *           name: id
 *           required: true
 *           schema:
 *             type: string
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 slug:
 *                   type: string
 *       responses:
 *         200:
 *           description: Domain updated
 */
router.put('/domains/:id', authenticateAdmin, validateRequest(updateSchema), domainController.update);

/**
 * @swagger
 * paths:
 *   /domains/{id}:
 *     delete:
 *       summary: Delete a domain
 *       tags: [Domain]
 *       parameters:
 *         - in: path
 *           name: id
 *           required: true
 *           schema:
 *             type: string
 *       responses:
 *         200:
 *           description: Domain deleted
 */
router.delete('/domains/:id', authenticateAdmin, domainController.remove);

/**
 * @swagger
 * paths:
 *   /domains/by-parent:
 *     get:
 *       summary: Get domains by parentId and parentModel
 *       tags: [Domain]
 *       parameters:
 *         - in: query
 *           name: parentId
 *           required: true
 *           schema:
 *             type: string
 *         - in: query
 *           name: parentModel
 *           required: true
 *           schema:
 *             type: string
 *             enum: [Category, SubCategory]
 *       responses:
 *         200:
 *           description: List of domains
 */
router.get('/domains/by-parent', authenticateToken, domainController.fetchByParent);

/**
 * @swagger
 * paths:
 *   /domains:
 *     get:
 *       summary: Get all domains
 *       tags: [Domain]
 *       responses:
 *         200:
 *           description: List of domains
 */
router.get('/domains', authenticateToken, domainController.findAll);

module.exports = router;
