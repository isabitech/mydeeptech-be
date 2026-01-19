import ProjectApplication from '../models/projectApplication.model.js';

class ProjectApplicationRepository {
    async create(data) {
        const app = new ProjectApplication(data);
        return await app.save();
    }

    async findByUserId(userId) {
        return await ProjectApplication.find({ user: userId }).populate('project').exec();
    }

    async findOne(filter = {}) {
        return await ProjectApplication.findOne(filter).populate('project').populate('user').exec();
    }

    async update(id, data) {
        return await ProjectApplication.findByIdAndUpdate(id, data, { new: true }).exec();
    }
}

const projectApplicationRepository = new ProjectApplicationRepository();
export default projectApplicationRepository;
