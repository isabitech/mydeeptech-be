const DomainToUser = require("../models/domain-to-user-model");


class DomainTOUserRepository {

    static create(payload) {
        const domain = new DomainToUser(payload);
        const saved = domain.save();
        return saved;
    }

    static findAll() {
        return DomainToUser.find()
            .populate("domain_category", "_id name slug")
            .populate("domain_sub_category", "_id name slug")
            .populate("domain_child", "_id name slug");
    }

    static findById(id) {
        return DomainToUser.findById(id)
            .populate("domain_category", "_id name slug")
            .populate("domain_sub_category", "_id name slug")
            .populate("domain_child", "_id name slug");
    }

    static findByName(name) {
        return DomainToUser.findOne({ name })
            .populate("domain_category", "_id name slug")
            .populate("domain_sub_category", "_id name slug")
            .populate("domain_child", "_id name slug");
    }

    static updateById(id, updateData) {
        return DomainToUser.findByIdAndUpdate(id, updateData, { new: true })
            .populate("domain_category", "_id name slug")
            .populate("domain_sub_category", "_id name slug")
            .populate("domain_child", "_id name slug");
    }

    static deleteById(id) {
        return DomainToUser.findByIdAndDelete(id);
    }

}

module.exports = DomainCategoryChildRepository;