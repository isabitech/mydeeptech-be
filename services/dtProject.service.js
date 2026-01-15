import projectApplicationRepository from '../repositories/projectApplication.repository.js';
import dtUserRepository from '../repositories/dtUser.repository.js';
import AnnotationProject from '../models/annotationProject.model.js';
import { NotFoundError, ValidationError, AuthenticationError } from '../utils/responseHandler.js';
import ProjectApplication from '../models/projectApplication.model.js';

/**
 * Service managing annotator interactions with projects.
 * Handles project discovery (filtering based on status and eligibility) and the application process.
 */
class DTProjectService {
    /**
     * Retrieves projects available for the user to join or that they've already applied to.
     * Enforces annotator approval status before allowing project visibility.
     */
    async getAvailableProjects(userId, query) {
        const user = await dtUserRepository.findById(userId);
        if (!user) throw new NotFoundError("User not found");

        if (user.annotatorStatus !== 'approved') {
            throw new AuthenticationError("Access denied. Only approved annotators can view projects.");
        }

        const { page = 1, limit = 10, view = 'available', status, category, difficultyLevel, minPayRate, maxPayRate, search } = query;
        const skip = (page - 1) * limit;

        // Filter logic from controller...
        const filter = { status: 'active', isPublic: true };
        if (view === 'available') {
            filter.$or = [{ applicationDeadline: { $gt: new Date() } }, { applicationDeadline: null }];
        }
        if (category) filter.projectCategory = category;
        if (difficultyLevel) filter.difficultyLevel = difficultyLevel;
        if (minPayRate || maxPayRate) {
            filter.payRate = {};
            if (minPayRate) filter.payRate.$gte = parseFloat(minPayRate);
            if (maxPayRate) filter.payRate.$lte = parseFloat(maxPayRate);
        }
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$and = [{ $or: [{ projectName: searchRegex }, { projectDescription: searchRegex }, { tags: { $in: [searchRegex] } }] }];
        }

        // Application mapping and logic...
        // To keep it clean, we'd ideally have methods in projectRepository
        // But for now, we'll keep the logic here as part of the refactor

        const allUserApps = await projectApplicationRepository.find({ applicantId: userId });
        const appliedProjectIds = allUserApps.map(app => app.projectId.toString());

        let finalFilter = { ...filter };
        if (view === 'available') {
            finalFilter._id = { $nin: appliedProjectIds };
        } else if (view === 'applied') {
            if (appliedProjectIds.length === 0) return { projects: [], total: 0 };
            finalFilter._id = { $in: appliedProjectIds };
            if (status) {
                // This is tricky because status is on the application, not the project.
                // We'd need to filter appliedProjectIds first based on application status.
                const filteredApps = allUserApps.filter(app => app.status === status);
                const filteredIds = filteredApps.map(app => app.projectId.toString());
                if (filteredIds.length === 0) return { projects: [], total: 0 };
                finalFilter._id = { $in: filteredIds };
            }
        }

        const projects = await AnnotationProject.find(finalFilter)
            .populate('createdBy', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await AnnotationProject.countDocuments(finalFilter);

        // Enrich projects with user-specific data
        const enrichedProjects = await Promise.all(projects.map(async (project) => {
            const appCount = await ProjectApplication.countDocuments({
                projectId: project._id,
                status: { $in: ['pending', 'approved'] }
            });

            const userApp = allUserApps.find(app => app.projectId.toString() === project._id.toString());

            return {
                ...project,
                currentApplications: appCount,
                availableSlots: project.maxAnnotators ? Math.max(0, project.maxAnnotators - appCount) : null,
                canApply: !userApp && (!project.maxAnnotators || appCount < project.maxAnnotators),
                hasApplied: !!userApp,
                userApplication: userApp || null
            };
        }));

        return { projects: enrichedProjects, total };
    }

    /**
     * Processes a user's application to a specific project.
     * Validates project status, user eligibility, and required documents (resume).
     */
    async applyToProject(userId, projectId, applicationData) {
        const user = await dtUserRepository.findById(userId);
        if (!user || user.annotatorStatus !== 'approved') {
            throw new AuthenticationError("Only approved annotators can apply.");
        }

        if (!user.attachments?.resume_url) {
            throw new ValidationError("Resume is required. Please upload it in your profile.");
        }

        const project = await AnnotationProject.findById(projectId);
        if (!project || project.status !== 'active') {
            throw new ValidationError("Project is not available for applications.");
        }

        const existing = await projectApplicationRepository.findOne({ projectId, applicantId: userId });
        if (existing) throw new ValidationError("You have already applied to this project.");

        const application = await projectApplicationRepository.create({
            projectId,
            applicantId: userId,
            coverLetter: applicationData.coverLetter || "",
            resumeUrl: user.attachments.resume_url,
            proposedRate: applicationData.proposedRate || project.payRate,
            availability: applicationData.availability || "flexible",
            estimatedCompletionTime: applicationData.estimatedCompletionTime || "",
            status: 'pending' // Simplified for now
        });

        await AnnotationProject.findByIdAndUpdate(projectId, { $inc: { totalApplications: 1 } });

        return application;
    }
}

export default new DTProjectService();
