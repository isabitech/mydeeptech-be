const HVNCAccessCode = require('../models/hvnc-access-code.model');

class HVNCAccessCodeRepository {
    static async findByCode(code) {
        return await HVNCAccessCode.findOne({ code });
    }

    static async findById(id) {
        return await HVNCAccessCode.findById(id);
    }

    static async findAll(filter = {}) {
        return await HVNCAccessCode.find(filter).sort({ createdAt: -1 });
    }

    static async findPaginated(filter = {}, skip = 0, limit = 50) {
        return await HVNCAccessCode.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    }

    static async countDocuments(filter = {}) {
        return await HVNCAccessCode.countDocuments(filter);
    }

    static async create(codeData) {
        const accessCode = new HVNCAccessCode(codeData);
        return await accessCode.save();
    }

    static async update(id, updateData) {
        return await HVNCAccessCode.findByIdAndUpdate(id, updateData, { new: true });
    }

    static async delete(id) {
        return await HVNCAccessCode.findByIdAndDelete(id);
    }
}

module.exports = HVNCAccessCodeRepository;
