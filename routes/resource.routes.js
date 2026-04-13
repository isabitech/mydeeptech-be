const express = require("express");
const router = express.Router();
const resourceController = require("../controllers/resource.controller");
const {
  validateCreateResource,
  validateUpdateResource,
  validateResourceId,
  validateGetAllResourcesQuery,
  validateSearchResourceQuery,
} = require("../validations/resource.validation");

const { authenticateToken } = require("../middleware/auth");
const { authenticateAdmin } = require("../middleware/adminAuth");

// Combined middleware to support both user and admin authentication
const authenticateUserOrAdmin = (req, res, next) => {
  // Try admin authentication first
  authenticateAdmin(req, res, (adminErr) => {
    if (!adminErr) {
      // Admin auth succeeded, set req.user from req.admin for consistency
      req.user = req.admin;
      return next();
    }
    
    // Admin auth failed, try regular user authentication
    authenticateToken(req, res, (userErr) => {
      if (!userErr) {
        // User auth succeeded
        return next();
      }
      
      // Both failed, return the user auth error (more descriptive)
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid user or admin token.',
        code: 'AUTH_REQUIRED'
      });
    });
  });
};

// Create a new resource
router.post(
  "/",
  authenticateToken,
  authenticateAdmin,
  validateCreateResource,
  resourceController.createResource,
);
// Get all resources (with optional ?all=true to include unpublished)
router.get(
  "/",
  authenticateToken,
  authenticateAdmin,
  validateGetAllResourcesQuery,
  resourceController.getAllResources,
);

// Get sidebar resources as allowed for authenticated user
router.get(
  "/me/allowed",
  authenticateUserOrAdmin,
  resourceController.getMyAllowedResources,
);

// Search published resources
router.get(
  "/search",
  authenticateToken,
  validateSearchResourceQuery,
  resourceController.searchResources,
);

// Get a single resource by id
router.get(
  "/:id",
  authenticateToken,
  validateResourceId,
  resourceController.getResourceById,
);

// Update a resource
router.put(
  "/:id",
  authenticateToken,
  authenticateAdmin,
  validateResourceId,
  validateUpdateResource,
  resourceController.updateResource,
);

// Toggle publish state
router.patch(
  "/:id/toggle-publish",
  authenticateToken,
  authenticateAdmin,
  validateResourceId,
  resourceController.togglePublish,
);

// Delete a resource
router.delete(
  "/:id",
  authenticateToken,
  authenticateAdmin,
  validateResourceId,
  resourceController.deleteResource,
);

module.exports = router;
