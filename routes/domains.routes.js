const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/category.controller');
const subCategoryController = require('../controllers/subcategory.controller');
const domainController = require('../controllers/domain.controller');

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

/* ----------------- CATEGORY ----------------- */

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Create a category
 *     tags: [Category]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *     responses:
 *       201:
 *         description: Category created
 */
router.post('/categories', categoryController.create);

/**
 * @swagger
 * /categories/{id}:
 *   put:
 *     summary: Update a category
 *     tags: [Category]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *     responses:
 *       200:
 *         description: Category updated
 */
router.put('/categories/:id', categoryController.update);

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Category]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category deleted
 */
router.delete('/categories/:id', categoryController.remove);

/**
 * @swagger
 * /categories/tree:
 *   get:
 *     summary: Get category tree with subcategories and domains
 *     tags: [Category]
 *     responses:
 *       200:
 *         description: Category tree
 */
router.get('/categories/tree', categoryController.fetchTree);

/* ----------------- SUBCATEGORY ----------------- */

/**
 * @swagger
 * /subcategories:
 *   post:
 *     summary: Create a subcategory
 *     tags: [SubCategory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               category: { type: string }
 *     responses:
 *       201:
 *         description: Subcategory created
 */
router.post('/subcategories', subCategoryController.create);

/**
 * @swagger
 * /subcategories/{id}:
 *   put:
 *     summary: Update a subcategory
 *     tags: [SubCategory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               category: { type: string }
 *     responses:
 *       200:
 *         description: Subcategory updated
 */
router.put('/subcategories/:id', subCategoryController.update);

/**
 * @swagger
 * /subcategories/{id}:
 *   delete:
 *     summary: Delete a subcategory
 *     tags: [SubCategory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Subcategory deleted
 */
router.delete('/subcategories/:id', subCategoryController.remove);

/**
 * @swagger
 * /subcategories/by-category/{categoryId}:
 *   get:
 *     summary: Get subcategories by category ID
 *     tags: [SubCategory]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of subcategories
 */
router.get('/subcategories/by-category/:categoryId', subCategoryController.fetchByCategory);

/* ----------------- DOMAIN ----------------- */

/**
 * @swagger
 * /domains:
 *   post:
 *     summary: Create a domain
 *     tags: [Domain]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               parent: { type: string }
 *               parentModel: { type: string, enum: [Category, SubCategory] }
 *     responses:
 *       201:
 *         description: Domain created
 */
router.post('/domains', domainController.create);

/**
 * @swagger
 * /domains/{id}:
 *   put:
 *     summary: Update a domain
 *     tags: [Domain]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *     responses:
 *       200:
 *         description: Domain updated
 */
router.put('/domains/:id', domainController.update);

/**
 * @swagger
 * /domains/{id}:
 *   delete:
 *     summary: Delete a domain
 *     tags: [Domain]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Domain deleted
 */
router.delete('/domains/:id', domainController.remove);

/**
 * @swagger
 * /domains/by-parent:
 *   get:
 *     summary: Get domains by parentId and parentModel
 *     tags: [Domain]
 *     parameters:
 *       - in: query
 *         name: parentId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: parentModel
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Category, SubCategory]
 *     responses:
 *       200:
 *         description: List of domains
 */
router.get('/domains/by-parent', domainController.fetchByParent);

module.exports = router;
