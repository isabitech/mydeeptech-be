const mongoose = require('mongoose');
const AnnotationProject = require('../models/annotationProject.model');
const ProjectApplication = require('../models/projectApplication.model');

class AnnotationProjectRepository {
  // Project operations
  async createProject(data) {
    const project = new AnnotationProject(data);
    return await project.save();
  }

  async findProjectById(id) {
    return await AnnotationProject.findById(id);
  }

  async findProjectByIdWithPopulate(id, populates = []) {
    let query = AnnotationProject.findById(id);
    populates.forEach(p => {
      if (typeof p === 'string') {
        query = query.populate(p);
      } else {
        query = query.populate(p.path, p.select);
      }
    });
    return await query.exec();
  }

  async findAllProjects(filter = {}, options = {}) {
    const {
      skip = 0,
      limit = 10,
      sort = { createdAt: -1 },
      populate = [
        { path: 'createdBy', select: 'fullName email' },
        { path: 'assignedAdmins', select: 'fullName email' }
      ],
      select = '',
      lean = true
    } = options;

    let query = AnnotationProject.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(select);

    if (populate) {
      populate.forEach(p => {
        query = query.populate(p);
      });
    }

    return lean ? await query.lean() : await query.exec();
  }

  async countProjects(filter = {}) {
    return await AnnotationProject.countDocuments(filter);
  }

  async aggregateProjects(pipeline) {
    return await AnnotationProject.aggregate(pipeline);
  }

  async updateProject(id, data, options = { new: true }) {
    return await AnnotationProject.findByIdAndUpdate(id, data, options);
  }

  async deleteProject(id) {
    return await AnnotationProject.findByIdAndDelete(id);
  }

  // Application operations
  async createApplication(data) {
    const application = new ProjectApplication(data);
    return await application.save();
  }

  async findApplicationById(id) {
    return await ProjectApplication.findById(id);
  }

  async findApplicationByIdWithPopulate(id, populates = []) {
    let query = ProjectApplication.findById(id);
    populates.forEach(p => {
      if (typeof p === 'string') {
        query = query.populate(p);
      } else {
        query = query.populate(p.path, p.select);
      }
    });
    return await query.exec();
  }

  async findApplications(filter = {}, options = {}) {
    const {
      sort = { appliedAt: -1 },
      populate = [
        { path: 'applicantId', select: 'fullName email' },
        { path: 'reviewedBy', select: 'fullName email' }
      ],
      select = '',
      lean = true,
      skip = 0,
      limit = 0
    } = options;

    let query = ProjectApplication.find(filter).sort(sort).select(select);

    if (skip) query = query.skip(skip);
    if (limit) query = query.limit(limit);

    if (populate) {
      populate.forEach(p => {
        query = query.populate(p);
      });
    }

    return lean ? await query.lean() : await query.exec();
  }

  async findOneApplication(filter = {}, options = {}) {
    const {
      populate = [],
      select = '',
      lean = true
    } = options;

    let query = ProjectApplication.findOne(filter).select(select);

    if (populate) {
      populate.forEach(p => {
        query = query.populate(p);
      });
    }

    return lean ? await query.lean() : await query.exec();
  }

  async countApplications(filter = {}) {
    return await ProjectApplication.countDocuments(filter);
  }

  async aggregateApplications(pipeline) {
    return await ProjectApplication.aggregate(pipeline);
  }

  async updateApplication(id, data, options = { new: true }) {
    return await ProjectApplication.findByIdAndUpdate(id, data, options);
  }

  async updateApplicationsMany(filter, update, options = {}) {
    return await ProjectApplication.updateMany(filter, update, options);
  }

  async deleteApplicationsMany(filter) {
    return await ProjectApplication.deleteMany(filter);
  }

  isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }

  toObjectId(id) {
    return new mongoose.Types.ObjectId(id);
  }
}

module.exports = AnnotationProjectRepository;
