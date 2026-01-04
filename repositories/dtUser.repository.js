import DTUser from '../models/dtUser.model.js';

class DTUserRepository {
    async findByEmail(email) {
        return await DTUser.findOne({ email }).exec();
    }

    async findById(id) {
        return await DTUser.findById(id).exec();
    }

    async create(userData) {
        const user = new DTUser(userData);
        return await user.save();
    }

    async update(id, updateData) {
        return await DTUser.findByIdAndUpdate(id, updateData, { new: true }).exec();
    }

    async delete(id) {
        return await DTUser.findByIdAndDelete(id).exec();
    }

    async find(filter = {}) {
        return await DTUser.find(filter).exec();
    }

    async findWithPopulate(filter = {}, populatePaths = []) {
        let query = DTUser.find(filter);
        populatePaths.forEach(path => {
            query = query.populate(path);
        });
        return await query.exec();
    }

    async count(filter = {}) {
        return await DTUser.countDocuments(filter).exec();
    }

    async findOne(filter) {
        return await DTUser.findOne(filter).exec();
    }
}

const dtUserRepository = new DTUserRepository();
export default dtUserRepository;
