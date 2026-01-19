import AnnotationProject from '../models/annotationProject.model.js';

class AnnotationProjectRepository {
    async create(data) {
        const project = new AnnotationProject(data);
        return await project.save();
    }

    async findById(id) {
        return await AnnotationProject.findById(id).exec();
    }

    async findOne(filter = {}) {
        return await AnnotationProject.findOne(filter).exec();
    }

    async find(filter = {}) {
        return await AnnotationProject.find(filter).exec();
    }

    async update(id, data) {
        return await AnnotationProject.findByIdAndUpdate(id, data, { new: true }).exec();
    }

    async delete(id) {
        return await AnnotationProject.findByIdAndDelete(id).exec();
    }

    async countDocuments(filter = {}) {
        return await AnnotationProject.countDocuments(filter).exec();
    }
}

const annotationProjectRepository = new AnnotationProjectRepository();
export default annotationProjectRepository;
