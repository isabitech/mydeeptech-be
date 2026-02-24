const DomainChildModel = require("../models/domain-child-model.js");
const mongoose = require('mongoose');


class DomainCategoryChildRepository {

  static create(payload) {
    const domain = new DomainChildModel(payload);
    const saved = domain.save();
    return saved;
  }

  static findAll() {
    return DomainChildModel.find()
          .populate("domain_category", "_id name slug")
          .populate("domain_sub_category", "_id name slug");
  }

  static countDocuments(query = {}) {
    return DomainChildModel.countDocuments(query);
  }

  static findWithPagination(query = {}, options = {}) {
    const { skip = 0, limit = 10 } = options;
    return DomainChildModel.find(query)
          .populate("domain_category", "_id name slug")
          .populate("domain_sub_category", "_id name slug")
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 });
  }

  static findById(id) {
    return DomainChildModel.findById(id)
          .populate("domain_category", "_id name slug")
          .populate("domain_sub_category", "_id name slug");
  }

  static findByName(name) {
    return DomainChildModel.findOne({ name })
          .populate("domain_category", "_id name slug")
          .populate("domain_sub_category", "_id name slug");
  }

  static updateById(id, updateData) {
    return DomainChildModel.findByIdAndUpdate(id, updateData, { new: true })
          .populate("domain_category", "_id name slug")
          .populate("domain_sub_category", "_id name slug");
  }

  static deleteById(id) {
    return DomainChildModel.findByIdAndDelete(id);
  }
static getAllDomainsWithCategorization(options = {}) {
  const { search = '', skip = 0, limit = 50 } = options;
  
  const pipeline = [
    {
      $lookup: {
        from: "domain_categories",
        localField: "domain_category",
        foreignField: "_id",
        as: "categoryInfo"
      }
    },
    {
      $lookup: {
        from: "domain_sub_categories",
        localField: "domain_sub_category",
        foreignField: "_id",
        as: "subCategoryInfo"
      }
    },
    {
      $addFields: {
        category: { $arrayElemAt: ["$categoryInfo", 0] },
        subCategory: { $arrayElemAt: ["$subCategoryInfo", 0] }
      }
    }
  ];

  // Add search filter if provided
  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { "category.name": { $regex: search, $options: 'i' } },
          { "subCategory.name": { $regex: search, $options: 'i' } }
        ]
      }
    });
  }

  // Group by category + subCategory combo
  pipeline.push(
    {
      $group: {
        _id: {
          categoryId: "$category._id",
          categoryName: "$category.name",
          categorySlug: "$category.slug",
          subCategoryId: { $ifNull: ["$subCategory._id", null] },
          subCategoryName: { $ifNull: ["$subCategory.name", "No Sub-Category"] },
          subCategorySlug: { $ifNull: ["$subCategory.slug", null] }
        },
        domains: {
          $push: {
            _id: "$_id",
            name: "$name",
            slug: "$slug"
          }
        },
        totalDomains: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        category: {
          _id: "$_id.categoryId",
          name: "$_id.categoryName",
          slug: "$_id.categorySlug"
        },
        subCategory: {
          _id: "$_id.subCategoryId",
          name: "$_id.subCategoryName",
          slug: "$_id.subCategorySlug"
        },
        domains: 1,
        totalDomains: 1
      }
    },
    {
      $sort: { "category.name": 1, "subCategory.name": 1 }
    }
  );

  // Create a facet to get both data and count
  const facetPipeline = [
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit }
        ],
        totalCount: [
          { $count: "count" }
        ]
      }
    }
  ];

  return DomainChildModel.aggregate([
    ...pipeline,
    ...facetPipeline
  ]).then(result => {
    const data = result[0]?.data || [];
    const totalCount = result[0]?.totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = Math.floor(skip / limit) + 1;

    return {
      domains: data,
      pagination: {
        currentPage,
        totalPages,
        totalCount,
        limit,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    };
  });
}

  static getCategoryAndSubCategoryForDomain(id) {
    return DomainChildModel.aggregate([
      {
        $match: { 
          _id: new mongoose.Types.ObjectId(id) 
        }
      },
      {
        $lookup: {
          from: "domain_categories",
          localField: "domain_category",
          foreignField: "_id",
          as: "categoryInfo",
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                slug: 1,
                description: 1,
                createdAt: 1,
                updatedAt: 1
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: "domain_sub_categories",
          localField: "domain_sub_category", 
          foreignField: "_id",
          as: "subCategoryInfo",
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                slug: 1,
                description: 1,
                createdAt: 1,
                updatedAt: 1
              }
            }
          ]
        }
      },
      {
        $addFields: {
          category: { $arrayElemAt: ["$categoryInfo", 0] },
          subCategory: { $arrayElemAt: ["$subCategoryInfo", 0] }
        }
      },
      {
        $unset: ["categoryInfo", "subCategoryInfo", "domain_category", "domain_sub_category"]
      }
    ]);
  }

}

module.exports = DomainCategoryChildRepository;