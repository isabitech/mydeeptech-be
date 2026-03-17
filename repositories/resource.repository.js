const Resource = require("../models/resource.model");

// Named constants for cleaner code and less magic
const MAX_SORT_ORDER = 999999; // Used as ceiling in range queries instead of Number.MAX_SAFE_INTEGER

class ResourceRepository {
  normalizeResourceKey(value = "") {
    return String(value).trim().toLowerCase().replace(/-/g, "_");
  }

  buildSort(sortBy = "latest") {
    if (sortBy === "custom") {
      return { sortOrder: 1, createdAt: -1 };
    }
    return { createdAt: -1 };
  }

  // ─── CREATE ───────────────────────────────────────────────
  async create(data, session = null) {
    const resource = new Resource(data);
    return await resource.save({ session });
  }

  // ─── READ ─────────────────────────────────────────────────
  async findAll(filter = {}, sortBy = "latest") {
    return await Resource.find(filter)
      .populate("parent", "title link sortOrder")
      .sort(this.buildSort(sortBy))
      .lean();
  }

  async findById(id) {
    return await Resource.findById(id).populate(
      "parent",
      "title link sortOrder",
    );
  }

  async findByParent(parentId = null) {
    const filter = parentId ? { parent: parentId } : { parent: null };
    return await Resource.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
  }

  async findAllowedByResourceKeys(
    resourceKeys = [],
    showUnpublished = false,
    sortBy = "custom",
  ) {
    const normalizedKeys = [
      ...new Set(resourceKeys.map((key) => this.normalizeResourceKey(key))),
    ].filter(Boolean);

    if (normalizedKeys.length === 0) {
      return [];
    }

    // Dual-match logic: match both resourceKey and icon as fallback.
    // This allows permission grants on either "dashboard" (resourceKey) or "dashboard-icon" (icon field).
    // Icon variants (dash vs underscore) are included to handle UI naming conventions.
    // Trade-off: if an icon name collides with an unrelated resourceKey, it gets included.
    // Considered acceptable because: (1) icon names are typically visual/suffixed (e.g., "chart_icon"),
    // (2) permissions are granted by admin explicitly, and (3) false positives only grant access, not deny.
    const iconCandidates = [
      ...new Set(
        normalizedKeys.flatMap((key) => [key, key.replace(/_/g, "-")]),
      ),
    ];

    const filter = {
      ...(showUnpublished ? {} : { isPublished: true }),
      $or: [
        { resourceKey: { $in: normalizedKeys } },
        { icon: { $in: iconCandidates } },
      ],
    };

    return await Resource.find(filter)
      .populate("parent", "title link sortOrder")
      .sort(this.buildSort(sortBy))
      .lean();
  }

  async shiftSortOrderFrom(
    parentId = null,
    fromOrder = 1,
    increment = 1,
    session = null,
  ) {
    const filter = parentId
      ? { parent: parentId, sortOrder: { $gte: fromOrder } }
      : { parent: null, sortOrder: { $gte: fromOrder } };

    return await Resource.updateMany(
      filter,
      {
        $inc: { sortOrder: increment },
      },
      { session },
    );
  }

  async shiftSortOrderRange(
    parentId = null,
    minOrder = 1,
    maxOrder = MAX_SORT_ORDER,
    increment = 1,
    excludeId = null,
    session = null,
  ) {
    const baseFilter = parentId ? { parent: parentId } : { parent: null };
    const filter = {
      ...baseFilter,
      sortOrder: { $gte: minOrder, $lte: maxOrder },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    };

    return await Resource.updateMany(
      filter,
      {
        $inc: { sortOrder: increment },
      },
      { session },
    );
  }

  async search(query) {
    return await Resource.find({
      isPublished: true,
      $or: [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { link: { $regex: query, $options: "i" } },
        { icon: { $regex: query, $options: "i" } },
      ],
    })
      .populate("parent", "title link sortOrder")
      .sort(this.buildSort("latest"))
      .lean();
  }

  // ─── UPDATE ───────────────────────────────────────────────
  async update(id, data, session = null) {
    return await Resource.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, session },
    );
  }

  // ─── DELETE ───────────────────────────────────────────────
  async delete(id, session = null) {
    return await Resource.findByIdAndDelete(id, { session });
  }

  async reparentChildren(oldParentId, newParentId = null, session = null) {
    return await Resource.updateMany(
      { parent: oldParentId },
      { $set: { parent: newParentId || null } },
      { session },
    );
  }

  async normalizeSortOrder(parentId = null, session = null) {
    const siblings = await this.findByParent(parentId);
    const operations = [];

    siblings.forEach((resource, index) => {
      const expectedOrder = index + 1;
      if ((resource.sortOrder || 0) !== expectedOrder) {
        operations.push({
          updateOne: {
            filter: { _id: resource._id },
            update: { $set: { sortOrder: expectedOrder } },
          },
        });
      }
    });

    if (operations.length > 0) {
      await Resource.bulkWrite(operations, { session });
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────
  async startSession() {
    const mongoose = require("mongoose");
    return await mongoose.startSession();
  }

  async exists(id) {
    const resource = await Resource.findById(id);
    return !!resource;
  }
}

module.exports = new ResourceRepository();
