const AiInterviewAsset = require("../models/aiInterviewAsset.model");

class AiInterviewAssetRepository {
  create(payload) {
    const asset = new AiInterviewAsset(payload);
    return asset.save();
  }

  findById(id) {
    return AiInterviewAsset.findById(id);
  }

  findOne(filter = {}) {
    return AiInterviewAsset.findOne(filter);
  }

  findLatestByUserAndUrl(userId, fileUrl) {
    return AiInterviewAsset.findOne({ userId, fileUrl }).sort({ updatedAt: -1 });
  }

  save(asset) {
    return asset.save();
  }
}

module.exports = new AiInterviewAssetRepository();
