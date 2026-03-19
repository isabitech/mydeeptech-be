const resourceService = require("../services/resource.service");

class ResourceController {
  // POST /resources
  async createResource(req, res, next) {
    try {
      const { title, link, description, icon, parent, sortOrder, isPublished } =
        req.body;

      const data = {
        title,
        link,
        description,
        icon,
        parent,
        sortOrder,
        isPublished,
      };
      const resource = await resourceService.createResource(data);
      return res.status(201).json({
        success: true,
        message: "Resource created successfully",
        data: resource,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /resources
  async getAllResources(req, res, next) {
    try {
      // Admins can pass ?all=true to see unpublished resources too
      const showUnpublished = req.query.all === "true";
      const sortBy = req.query.sortBy === "custom" ? "custom" : "latest";
      const hierarchy = req.query.hierarchy === "true";
      const resources = hierarchy
        ? await resourceService.getAllResourcesHierarchy(
            showUnpublished,
            sortBy,
          )
        : await resourceService.getAllResources(showUnpublished, sortBy);
      return res.status(200).json({
        success: true,
        message: "Resources fetched successfully",
        count: resources.length,
        data: resources,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /resources/me/allowed
  async getMyAllowedResources(req, res, next) {
    try {
      const resources = await resourceService.getResourcesForUserHierarchy(
        req.user?.userId,
        false,
        "custom",
      );
      return res.status(200).json({
        success: true,
        message: "Sidebar resources fetched successfully",
        count: resources.length,
        data: resources,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /resources/search?q=keyword
  async searchResources(req, res, next) {
    try {
      const { q } = req.query;
      const resources = await resourceService.searchResources(q);
      return res.status(200).json({
        success: true,
        message: "Search results fetched successfully",
        count: resources.length,
        data: resources,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /resources/:id
  async getResourceById(req, res, next) {
    try {
      const resource = await resourceService.getResourceById(req.params.id);
      return res.status(200).json({
        success: true,
        message: "Resource fetched successfully",
        data: resource,
      });
    } catch (error) {
      next(error);
    }
  }

  // PUT /resources/:id
  async updateResource(req, res, next) {
    try {
      const resource = await resourceService.updateResource(
        req.params.id,
        req.body,
      );
      return res.status(200).json({
        success: true,
        message: "Resource updated successfully",
        data: resource,
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /resources/:id/toggle-publish
  async togglePublish(req, res, next) {
    try {
      const resource = await resourceService.togglePublish(req.params.id);
      return res.status(200).json({
        success: true,
        message: `Resource ${resource.isPublished ? "published" : "unpublished"} successfully`,
        data: resource,
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /resources/:id
  async deleteResource(req, res, next) {
    try {
      await resourceService.deleteResource(req.params.id);
      return res.status(200).json({
        success: true,
        message: "Resource deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ResourceController();
