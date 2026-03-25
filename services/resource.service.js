const resourceRepository = require("../repositories/resource.repository");
const DTUser = require("../models/dtUser.model");

// Named constants for permission and sort logic
const ALL_RESOURCES_WILDCARD = "*"; // Super-admin permission grant that allows all resources
const SIDEBAR_ALLOWED_ACTIONS = new Set(["manage", "view", "view_own"]);
const MAX_SORT_ORDER = 999999; // Ceiling for sort order range queries

class ResourceService {
  isSafeSidebarLink(link) {
    const value = String(link || "")
      .trim()
      .toLowerCase();
    if (!value) return false;
    if (value.startsWith("javascript:")) return false;
    return true;
  }

  resolveResourceKey(resource) {
    if (resource?.icon) {
      return String(resource.icon).trim().toLowerCase().replace(/-/g, "_");
    }

    if (resource?.link) {
      const link = String(resource.link).trim().toLowerCase();
      const cleaned = link.replace(/\/+$/, "");
      const lastSegment = cleaned.split("/").filter(Boolean).pop() || "";
      return lastSegment.replace(/-/g, "_");
    }

    return "";
  }

  async getAllowedResourceKeysForUser(userId) {
    if (!userId) {
      return new Set();
    }

    const user = await DTUser.findById(userId)
      .select("role_permission")
      .populate({
        path: "role_permission",
        select: "name isActive permissions",
        populate: {
          path: "permissions",
          select: "resource action",
        },
      })
      .lean();
    // console.log(user.role_permission.permissions);

    if (!user || !user.role_permission) {
      return new Set();
    }

    const role = user.role_permission;
    if (role.isActive === false) {
      return new Set();
    }

    if (role.name === "super_admin") {
      return new Set([ALL_RESOURCES_WILDCARD]);
    }

    const allowedResources = new Set();
    for (const permission of role.permissions || []) {
      if (
        SIDEBAR_ALLOWED_ACTIONS.has(permission?.action) &&
        permission?.resource
      ) {
        allowedResources.add(String(permission.resource).trim().toLowerCase());
      }
    }

    return allowedResources;
  }

  filterResourcesByAllowedKeys(resources, allowedKeys) {
    if (!allowedKeys || allowedKeys.size === 0) {
      return [];
    }

    if (allowedKeys.has("*")) {
      return resources;
    }

    return resources.filter((resource) => {
      const resourceKey = this.resolveResourceKey(resource);
      return resourceKey && allowedKeys.has(resourceKey);
    });
  }

  sortTreeNodes(nodes, sortBy = "latest") {
    if (sortBy === "custom") {
      nodes.sort((a, b) => {
        if ((a.sortOrder || 0) !== (b.sortOrder || 0)) {
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        }
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    } else {
      nodes.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    for (const node of nodes) {
      if (Array.isArray(node.children) && node.children.length > 0) {
        this.sortTreeNodes(node.children, sortBy);
      }
    }
  }

  buildHierarchy(resources, sortBy = "latest") {
    const nodes = resources.map((resource) => {
      const plain = resource.toObject ? resource.toObject() : { ...resource };
      return { ...plain, children: [] };
    });

    const byId = new Map(nodes.map((node) => [String(node._id), node]));
    const roots = [];

    for (const node of nodes) {
      const parentId = node.parent
        ? String(node.parent._id || node.parent)
        : null;
      const parentNode = parentId ? byId.get(parentId) : null;

      if (parentNode) {
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    }

    this.sortTreeNodes(roots, sortBy);
    return roots;
  }

  // ─── CREATE ───────────────────────────────────────────────
  async createResource(data) {
    // Transaction wrapper: for consistency, though create has lower risk than update/delete.
    // Protects against scenarios where auto-shift of siblings fails after permission grant.
    const session = await resourceRepository.startSession();
    try {
      session.startTransaction();

      const { title, link, description, icon, parent, sortOrder, isPublished } =
        data;

      if (!title || !link) {
        throw new Error("Title and link are required");
      }

      if (!this.isSafeSidebarLink(link)) {
        throw new Error("Link is invalid or unsafe");
      }

      const normalizedParent = parent || null;

      if (normalizedParent) {
        const parentResource =
          await resourceRepository.findById(normalizedParent);
        if (!parentResource) {
          throw new Error("Parent resource not found");
        }
      }

      const siblings = await resourceRepository.findByParent(normalizedParent);
      const requestedSortOrder = Number(sortOrder);
      const hasExplicitSortOrder =
        Number.isFinite(requestedSortOrder) && requestedSortOrder > 0;

      const finalSortOrder = hasExplicitSortOrder
        ? Math.min(Math.max(1, requestedSortOrder), siblings.length + 1)
        : siblings.length + 1;

      if (hasExplicitSortOrder) {
        await resourceRepository.shiftSortOrderFrom(
          normalizedParent,
          finalSortOrder,
          1,
          session,
        );
      }

      const created = await resourceRepository.create(
        {
          title,
          link,
          description,
          icon,
          resourceKey: this.resolveResourceKey({ icon, link }),
          parent: normalizedParent,
          sortOrder: finalSortOrder,
          isPublished,
        },
        session,
      );

      await session.commitTransaction();

      // Automatically generate all permissions for the new resource once it is successfully created
      try {
        const { ACTIONS } = require("../config/resources");
        const PermissionService = require("./permission.service");
        
        const generatedPermissions = Object.values(ACTIONS).map(actionKey => ({
          name: `${created.resourceKey}:${actionKey}`,
          description: `Can ${actionKey} ${created.title}`,
          resource: created.resourceKey,
          action: actionKey
        }));
        
        await PermissionService.createManyPermissions(generatedPermissions);
      } catch (permissionError) {
        // Silently catch permission seeding errors so the primary resource creation doesn't crash the user's request.
        console.warn(`[Warning] Failed to auto-generate some permissions for resource ${created.resourceKey}:`, permissionError.message);
      }

      return created;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  // ─── READ ─────────────────────────────────────────────────
  async getAllResources(showUnpublished = false, sortBy = "latest") {
    const filter = showUnpublished ? {} : { isPublished: true };
    return await resourceRepository.findAll(filter, sortBy);
  }

  async getAllResourcesHierarchy(showUnpublished = false, sortBy = "latest") {
    const resources = await this.getAllResources(showUnpublished, sortBy);
    return this.buildHierarchy(resources, sortBy);
  }

  async getResourceById(id) {
    const resource = await resourceRepository.findById(id);
    if (!resource) throw new Error("Resource not found");
    return resource;
  }

  async searchResources(query) {
    if (!query || query.trim() === "") {
      throw new Error("Search query is required");
    }
    return await resourceRepository.search(query.trim());
  }

  async getResourcesForUser(
    userId,
    showUnpublished = false,
    sortBy = "latest",
  ) {
    const allowedKeys = await this.getAllowedResourceKeysForUser(userId);
    if (allowedKeys.has(ALL_RESOURCES_WILDCARD)) {
      return await this.getAllResources(showUnpublished, sortBy);
    }
    return await resourceRepository.findAllowedByResourceKeys(
      [...allowedKeys],
      showUnpublished,
      sortBy,
    );
  }

  async getResourcesForUserHierarchy(
    userId,
    showUnpublished = false,
    sortBy = "latest",
  ) {
    const allowedKeys = await this.getAllowedResourceKeysForUser(userId);

    if (allowedKeys.has(ALL_RESOURCES_WILDCARD)) {
      return await this.getAllResourcesHierarchy(showUnpublished, sortBy);
    }

    const normalizedKeys = new Set(
      [...allowedKeys]
        .map((key) => String(key).trim().toLowerCase().replace(/-/g, "_"))
        .filter(Boolean)
    );
    const iconCandidates = new Set();
    const titleCandidates = new Set();
    for (const key of normalizedKeys) {
      iconCandidates.add(key);
      iconCandidates.add(key.replace(/_/g, "-"));
      titleCandidates.add(key.replace(/_/g, ""));
    }

    const allResources = await this.getAllResources(showUnpublished, sortBy);
    const roots = this.buildHierarchy(allResources, sortBy);

    const filterTree = (nodes, isAncestorAllowed) => {
      const result = [];
      for (const node of nodes) {
        const rKey = node.resourceKey ? String(node.resourceKey).toLowerCase() : "";
        const icon = node.icon ? String(node.icon).toLowerCase() : "";
        const titleKey = node.title ? String(node.title).toLowerCase().replace(/\s+/g, '_') : "";
        const rawTitleKey = node.title ? String(node.title).toLowerCase().replace(/\s+/g, '') : "";

        const isSelfAllowed =
          normalizedKeys.has(rKey) ||
          iconCandidates.has(icon) ||
          normalizedKeys.has(titleKey) ||
          titleCandidates.has(rawTitleKey);

        const isAllowedSoFar = isAncestorAllowed || isSelfAllowed;
        const filteredChildren = filterTree(node.children || [], isAllowedSoFar);

        if (isAllowedSoFar || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: filteredChildren,
          });
        }
      }
      return result;
    };

    return filterTree(roots, false);
  }

  // ─── UPDATE ───────────────────────────────────────────────
  async updateResource(id, data) {
    // Transaction wrapper: ensures atomicity of parent changes, sort shifts, and update.
    // If any step fails (shift, update, normalize), the entire operation rolls back.
    // This prevents orphaned resources or gaps in sort order that could corrupt the hierarchy.
    const session = await resourceRepository.startSession();
    try {
      session.startTransaction();

      const currentResource = await resourceRepository.findById(id);
      if (!currentResource) throw new Error("Resource not found");

      const payload = {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.link !== undefined ? { link: data.link } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.parent !== undefined ? { parent: data.parent || null } : {}),
        ...(data.sortOrder !== undefined
          ? {
            sortOrder: Number.isFinite(Number(data.sortOrder))
              ? Number(data.sortOrder)
              : 0,
          }
          : {}),
        ...(data.isPublished !== undefined
          ? { isPublished: data.isPublished }
          : {}),
      };

      const currentParent = currentResource.parent
        ? String(currentResource.parent._id || currentResource.parent)
        : null;
      const requestedParent =
        data.parent !== undefined ? data.parent || null : currentParent;
      const normalizedParent = requestedParent ? String(requestedParent) : null;
      const parentChanged = normalizedParent !== currentParent;

      const requestedSortOrder = Number(data.sortOrder);
      const hasExplicitSortOrder =
        data.sortOrder !== undefined &&
        Number.isFinite(requestedSortOrder) &&
        requestedSortOrder > 0;

      const targetSiblings =
        await resourceRepository.findByParent(normalizedParent);
      const targetSiblingsWithoutCurrent = targetSiblings.filter(
        (item) => String(item._id) !== String(id),
      );

      let finalSortOrder = Number(currentResource.sortOrder) || 1;
      if (parentChanged) {
        finalSortOrder = hasExplicitSortOrder
          ? Math.min(
            Math.max(1, requestedSortOrder),
            targetSiblingsWithoutCurrent.length + 1,
          )
          : targetSiblingsWithoutCurrent.length + 1;
      } else if (hasExplicitSortOrder) {
        finalSortOrder = Math.min(
          Math.max(1, requestedSortOrder),
          targetSiblingsWithoutCurrent.length + 1,
        );
      }

      if (payload.link !== undefined && !this.isSafeSidebarLink(payload.link)) {
        throw new Error("Link is invalid or unsafe");
      }

      if (payload.icon !== undefined || payload.link !== undefined) {
        const nextIcon =
          payload.icon !== undefined ? payload.icon : currentResource?.icon;
        const nextLink =
          payload.link !== undefined ? payload.link : currentResource?.link;
        payload.resourceKey = this.resolveResourceKey({
          icon: nextIcon,
          link: nextLink,
        });
      }

      if (data.parent !== undefined) {
        if (normalizedParent && normalizedParent === String(id)) {
          throw new Error("Resource cannot be its own parent");
        }

        if (normalizedParent) {
          const parentResource =
            await resourceRepository.findById(normalizedParent);
          if (!parentResource) {
            throw new Error("Parent resource not found");
          }
        }
      }

      if (parentChanged) {
        // Close gap in old parent.
        await resourceRepository.shiftSortOrderRange(
          currentParent,
          (Number(currentResource.sortOrder) || 1) + 1,
          MAX_SORT_ORDER,
          -1,
          null,
          session,
        );

        // Open position in new parent.
        await resourceRepository.shiftSortOrderRange(
          normalizedParent,
          finalSortOrder,
          MAX_SORT_ORDER,
          1,
          null,
          session,
        );

        payload.parent = normalizedParent;
        payload.sortOrder = finalSortOrder;
      } else if (hasExplicitSortOrder) {
        const currentSortOrder = Number(currentResource.sortOrder) || 1;
        if (finalSortOrder < currentSortOrder) {
          await resourceRepository.shiftSortOrderRange(
            currentParent,
            finalSortOrder,
            currentSortOrder - 1,
            1,
            id,
            session,
          );
        } else if (finalSortOrder > currentSortOrder) {
          await resourceRepository.shiftSortOrderRange(
            currentParent,
            currentSortOrder + 1,
            finalSortOrder,
            -1,
            id,
            session,
          );
        }

        payload.sortOrder = finalSortOrder;
      }

      const updated = await resourceRepository.update(id, payload, session);

      if (!updated) {
        throw new Error("Resource update failed");
      }

      // Safety net: keep contiguous ordering in touched parent groups.
      await resourceRepository.normalizeSortOrder(currentParent, session);
      if (parentChanged) {
        await resourceRepository.normalizeSortOrder(normalizedParent, session);
      }

      await session.commitTransaction();
      return updated;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async togglePublish(id) {
    const resource = await resourceRepository.findById(id);
    if (!resource) throw new Error("Resource not found");

    return await resourceRepository.update(id, {
      isPublished: !resource.isPublished,
    });
  }

  // ─── DELETE ───────────────────────────────────────────────
  async deleteResource(id) {
    // Transaction wrapper: ensures atomicity of reparenting and deletion.
    // If reparentChildren succeeds but delete fails, children are not orphaned with incorrect parent.
    const session = await resourceRepository.startSession();
    try {
      session.startTransaction();

      const resource = await resourceRepository.findById(id);
      if (!resource) throw new Error("Resource not found");

      const parentId = resource.parent
        ? String(resource.parent._id || resource.parent)
        : null;

      // Move children one level up, then delete and compact ordering.
      await resourceRepository.reparentChildren(id, parentId, session);
      await resourceRepository.delete(id, session);
      await resourceRepository.normalizeSortOrder(parentId, session);

      await session.commitTransaction();
      return { deleted: true, id };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}

module.exports = new ResourceService();
