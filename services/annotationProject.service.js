import annotationProjectRepository from '../repositories/annotationProject.repository.js';
import { NotFoundError, ValidationError, } from '../utils/responseHandler.js';
import {
    sendProjectDeletionOTP,
    sendProjectDeletionConfirmation,
    sendProjectApprovalNotification,
    sendProjectRejectionNotification,
    sendApplicantRemovalNotification,
    sendProjectAnnotatorRemovedNotification
} from '../utils/projectMailer.js';
import * as notificationService from '../utils/notificationService.js';
import ProjectApplication from '../models/projectApplication.model.js';
import AnnotationProject from '../models/annotationProject.model.js';
import MultimediaAssessmentConfig from '../models/multimediaAssessmentConfig.model.js';

class AnnotationProjectService {
    async exportApprovedAnnotatorsCSV(projectId) {
        const project = await AnnotationProject.findById(projectId);
        if (!project) throw new NotFoundError("Project not found");

        const approvedApplications = await ProjectApplication.find({
            projectId,
            status: 'approved'
        }).populate({
            path: 'applicantId',
            select: 'fullName email phone personal_info'
        }).sort({ reviewedAt: -1 });

        if (approvedApplications.length === 0) {
            throw new NotFoundError("No approved annotators found for this project");
        }

        const csvHeaders = ['Full Name', 'Country', 'Email'];
        const csvRows = [csvHeaders.join(',')];

        approvedApplications.forEach(app => {
            const applicant = app.applicantId;
            const personalInfo = applicant.personal_info || {};
            const row = [
                `"${applicant.fullName || 'N/A'}"`,
                `"${personalInfo.country || 'N/A'}"`,
                `"${applicant.email || 'N/A'}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const timestamp = new Date().toISOString().split('T')[0];
        const sanitizedProjectName = project.projectName
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase();
        const filename = `${sanitizedProjectName}_approved_annotators_${timestamp}.csv`;

        return { filename, csvContent };
    }
    async createProject(data, admin) {
        const adminId = admin?.userId || admin?.userDoc?._id;
        if (!adminId) {
            throw new ValidationError("Admin identification required to create project");
        }

        const projectData = {
            ...data,
            createdBy: adminId,
            assignedAdmins: [adminId]
        };

        const project = await annotationProjectRepository.create(projectData);

        // Populate creator information
        const populatedProject = await AnnotationProject.findById(project._id)
            .populate('createdBy', 'fullName email')
            .populate('assignedAdmins', 'fullName email')
            .exec();

        return populatedProject;
    }

    async getAllProjects(query) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;
        const { status, category, search } = query;

        const filter = {};
        if (status) filter.status = status;
        if (category) filter.projectCategory = category;
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { projectName: searchRegex },
                { projectDescription: searchRegex },
                { tags: { $in: [searchRegex] } }
            ];
        }

        const projects = await AnnotationProject.find(filter)
            .populate('createdBy', 'fullName email')
            .populate('assignedAdmins', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalProjects = await annotationProjectRepository.countDocuments(filter);

        const [statusSummary, categorySummary] = await Promise.all([
            AnnotationProject.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            AnnotationProject.aggregate([{ $group: { _id: '$projectCategory', count: { $sum: 1 } } }])
        ]);

        return {
            projects,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalProjects / limit),
                totalProjects,
                limit
            },
            summary: {
                totalProjects,
                statusBreakdown: statusSummary.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
                categoryBreakdown: categorySummary.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {})
            }
        };
    }

    async getProjectDetails(projectId) {
        const project = await AnnotationProject.findById(projectId)
            .populate('createdBy', 'fullName email phone')
            .populate('assignedAdmins', 'fullName email phone')
            .exec();

        if (!project) {
            throw new NotFoundError("Annotation project not found");
        }

        const applicationStats = await ProjectApplication.aggregate([
            { $match: { projectId: project._id } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const recentApplications = await ProjectApplication.find({ projectId: project._id })
            .populate('applicantId', 'fullName email annotatorStatus')
            .sort({ appliedAt: -1 })
            .limit(5);

        const [approvedAnnotators, rejectedAnnotators, pendingAnnotators] = await Promise.all([
            this._getAnnotatorsByStatus(project._id, 'approved'),
            this._getAnnotatorsByStatus(project._id, 'rejected'),
            this._getAnnotatorsByStatus(project._id, 'pending')
        ]);

        const annotatorStats = {
            total: approvedAnnotators.length + rejectedAnnotators.length + pendingAnnotators.length,
            approved: approvedAnnotators.length,
            rejected: rejectedAnnotators.length,
            pending: pendingAnnotators.length,
            approvalRate: (approvedAnnotators.length + rejectedAnnotators.length) > 0 ?
                Math.round((approvedAnnotators.length / (approvedAnnotators.length + rejectedAnnotators.length)) * 100) : 0
        };

        const recentReviewActivity = await ProjectApplication.find({
            projectId: project._id,
            status: { $in: ['approved', 'rejected'] },
            reviewedAt: { $exists: true }
        })
            .populate('applicantId', 'fullName email')
            .populate('reviewedBy', 'fullName email')
            .sort({ reviewedAt: -1 })
            .limit(10)
            .select('status reviewedAt reviewedBy applicantId reviewNotes rejectionReason');

        return {
            project,
            applicationStats: applicationStats.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
            annotatorStats,
            recentApplications,
            annotators: {
                approved: this._formatAnnotatorData(approvedAnnotators),
                rejected: this._formatAnnotatorData(rejectedAnnotators),
                pending: this._formatAnnotatorData(pendingAnnotators)
            },
            recentReviewActivity
        };
    }

    async _getAnnotatorsByStatus(projectId, status) {
        return await ProjectApplication.find({ projectId, status })
            .populate({
                path: 'applicantId',
                select: 'fullName email phone annotatorStatus microTaskerStatus personal_info professional_background payment_info attachments profilePicture createdAt'
            })
            .populate('reviewedBy', 'fullName email')
            .sort(status === 'pending' ? { appliedAt: -1 } : { reviewedAt: -1 });
    }

    _formatAnnotatorData(applications) {
        return applications.map(app => ({
            applicationId: app._id,
            applicationStatus: app.status,
            appliedAt: app.appliedAt,
            reviewedAt: app.reviewedAt,
            reviewedBy: app.reviewedBy,
            reviewNotes: app.reviewNotes,
            rejectionReason: app.rejectionReason,
            coverLetter: app.coverLetter,
            workStartedAt: app.workStartedAt,
            annotator: {
                id: app.applicantId?._id,
                fullName: app.applicantId?.fullName,
                email: app.applicantId?.email,
                phone: app.applicantId?.phone,
                annotatorStatus: app.applicantId?.annotatorStatus,
                microTaskerStatus: app.applicantId?.microTaskerStatus,
                profilePicture: app.applicantId?.profilePicture?.url || null,
                joinedDate: app.applicantId?.createdAt,
                personalInfo: {
                    country: app.applicantId?.personal_info?.country || null,
                    timeZone: app.applicantId?.personal_info?.time_zone || null,
                    availableHours: app.applicantId?.personal_info?.available_hours_per_week || null,
                    languages: app.applicantId?.personal_info?.languages || []
                },
                professionalBackground: {
                    educationField: app.applicantId?.professional_background?.education_field || null,
                    yearsOfExperience: app.applicantId?.professional_background?.years_of_experience || null,
                    previousProjects: app.applicantId?.professional_background?.previous_annotation_projects || [],
                    skills: app.applicantId?.professional_background?.skills || []
                },
                paymentInfo: {
                    hasPaymentInfo: !!(app.applicantId?.payment_info?.account_name && app.applicantId?.payment_info?.account_number),
                    accountName: app.applicantId?.payment_info?.account_name || null,
                    bankName: app.applicantId?.payment_info?.bank_name || null
                },
                attachments: {
                    hasResume: !!(app.applicantId?.attachments?.resume_url),
                    hasIdDocument: !!(app.applicantId?.attachments?.id_document_url),
                    resumeUrl: app.applicantId?.attachments?.resume_url || null,
                    idDocumentUrl: app.applicantId?.attachments?.id_document_url || null
                }
            }
        }));
    }

    async updateProject(projectId, data) {
        const project = await AnnotationProject.findByIdAndUpdate(
            projectId,
            { ...data, updatedAt: new Date() },
            { new: true }
        ).populate('createdBy', 'fullName email')
            .populate('assignedAdmins', 'fullName email');

        if (!project) {
            throw new NotFoundError("Annotation project not found");
        }

        return project;
    }

    async deleteProject(projectId, admin) {
        const project = await annotationProjectRepository.findById(projectId);
        if (!project) {
            throw new NotFoundError("Annotation project not found");
        }

        const activeApplications = await ProjectApplication.countDocuments({
            projectId: projectId,
            status: { $in: ['pending', 'approved'] }
        });

        if (activeApplications > 0) {
            throw new ValidationError(`Cannot delete project with ${activeApplications} active applications. Please resolve all applications first or use force delete with OTP verification.`, {
                activeApplications,
                requiresOTP: true,
                projectName: project.projectName,
                projectId
            });
        }

        await annotationProjectRepository.delete(projectId);
        await ProjectApplication.deleteMany({ projectId });

        return true;
    }

    async requestDeletionOTP(projectId, admin, reason) {
        const project = await annotationProjectRepository.findById(projectId);
        if (!project) {
            throw new NotFoundError("Annotation project not found");
        }

        const activeApplications = await ProjectApplication.countDocuments({
            projectId: projectId,
            status: { $in: ['pending', 'approved'] }
        });

        const allApplicationsCount = await ProjectApplication.countDocuments({ projectId });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

        project.deletionOTP = {
            code: otp,
            expiresAt: otpExpiry,
            requestedBy: admin.userId,
            requestedAt: new Date(),
            verified: false
        };

        await project.save();

        const projectsOfficerEmail = 'projects@mydeeptech.ng';
        const deletionData = {
            projectName: project.projectName,
            projectId,
            projectCategory: project.projectCategory,
            requestedBy: admin.fullName || admin.email,
            requestedByEmail: admin.email,
            activeApplications,
            totalApplications: allApplicationsCount,
            otp,
            expiryTime: otpExpiry.toLocaleString(),
            reason: reason || 'Administrative deletion'
        };

        await sendProjectDeletionOTP(projectsOfficerEmail, deletionData);

        return {
            projectName: project.projectName,
            projectId,
            activeApplications,
            totalApplications: allApplicationsCount,
            otpSentTo: projectsOfficerEmail,
            expiresAt: otpExpiry,
            requestedBy: admin.email,
            otpExpiryMinutes: 15
        };
    }

    async verifyOTPAndDelete(projectId, admin, otp, confirmationMessage) {
        if (!otp) {
            throw new ValidationError("OTP code is required");
        }

        const project = await AnnotationProject.findById(projectId);
        if (!project) {
            throw new NotFoundError("Annotation project not found");
        }

        if (!project.deletionOTP || !project.deletionOTP.code) {
            throw new ValidationError("No deletion OTP found. Please request a new OTP first.");
        }

        if (new Date() > project.deletionOTP.expiresAt) {
            project.deletionOTP = undefined;
            await project.save();
            throw new ValidationError("OTP has expired. Please request a new OTP.");
        }

        if (project.deletionOTP.code !== otp.toString()) {
            throw new ValidationError("Invalid OTP code. Please check and try again.");
        }

        if (project.deletionOTP.verified) {
            throw new ValidationError("OTP has already been used. Please request a new OTP.");
        }

        const activeApplications = await ProjectApplication.countDocuments({
            projectId: projectId,
            status: { $in: ['pending', 'approved'] }
        });

        const allApplications = await ProjectApplication.find({ projectId })
            .populate('applicantId', 'fullName email')
            .select('status applicantId appliedAt');

        project.deletionOTP.verified = true;
        project.deletionOTP.verifiedAt = new Date();
        project.deletionOTP.verifiedBy = admin.userId;
        await project.save();

        await annotationProjectRepository.delete(projectId);
        await ProjectApplication.deleteMany({ projectId });

        const confirmationData = {
            projectName: project.projectName,
            projectId,
            deletedBy: admin.fullName || admin.email,
            deletedByEmail: admin.email,
            deletedAt: new Date(),
            applicationsDeleted: allApplications.length,
            activeApplicationsDeleted: activeApplications,
            confirmationMessage: confirmationMessage || 'Project deleted with all applications',
            deletedApplications: allApplications.map(app => ({
                applicantName: app.applicantId?.fullName || 'Unknown',
                applicantEmail: app.applicantId?.email || 'Unknown',
                status: app.status,
                appliedAt: app.appliedAt
            }))
        };

        try {
            await sendProjectDeletionConfirmation('projects@mydeeptech.ng', confirmationData);
        } catch (e) {
            console.warn(`⚠️ Failed to send deletion confirmation:`, e.message);
        }

        return {
            deletedProject: { id: projectId, name: project.projectName, category: project.projectCategory },
            deletedApplications: {
                total: allApplications.length,
                active: activeApplications,
                applications: allApplications.map(app => ({
                    applicantName: app.applicantId?.fullName || 'Unknown',
                    status: app.status,
                    appliedAt: app.appliedAt
                }))
            }
        };
    }

    async getProjectApplications(query) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;
        const { status, projectId } = query;

        const filter = {};
        if (status) filter.status = status;
        if (projectId) filter.projectId = projectId;

        const applications = await ProjectApplication.find(filter)
            .populate({
                path: 'projectId',
                select: 'projectName projectCategory payRate status createdBy',
                populate: { path: 'createdBy', select: 'fullName email' }
            })
            .populate('applicantId', 'fullName email phone annotatorStatus')
            .populate('reviewedBy', 'fullName email')
            .sort({ appliedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalApplications = await ProjectApplication.countDocuments(filter);
        const statusSummary = await ProjectApplication.aggregate([
            { $match: filter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        return {
            applications,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalApplications / limit),
                totalApplications,
                limit
            },
            summary: {
                totalApplications,
                statusBreakdown: statusSummary.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {})
            }
        };
    }

    async approveApplication(applicationId, admin, body) {
        const { reviewNotes } = body;

        const application = await ProjectApplication.findById(applicationId)
            .populate({
                path: 'projectId',
                select: 'projectName projectCategory payRate approvedAnnotators maxAnnotators projectGuidelineLink projectGuidelineVideo projectCommunityLink projectTrackerLink'
            })
            .populate('applicantId', 'fullName email');

        if (!application) throw new NotFoundError("Application not found");
        if (application.status !== 'pending') throw new ValidationError(`Application is already ${application.status}`);

        const project = application.projectId;
        if (project.maxAnnotators && project.approvedAnnotators >= project.maxAnnotators) {
            throw new ValidationError("Project has reached maximum number of annotators");
        }

        application.status = 'approved';
        application.reviewedBy = admin.userId;
        application.reviewedAt = new Date();
        application.reviewNotes = reviewNotes || '';
        application.workStartedAt = new Date();

        await application.save();
        await AnnotationProject.findByIdAndUpdate(project._id, { $inc: { approvedAnnotators: 1 } });

        try {
            const projectData = {
                projectName: project.projectName,
                projectCategory: project.projectCategory,
                payRate: project.payRate,
                adminName: admin.fullName,
                reviewNotes: reviewNotes || '',
                projectGuidelineLink: project.projectGuidelineLink,
                projectGuidelineVideo: project.projectGuidelineVideo,
                projectCommunityLink: project.projectCommunityLink,
                projectTrackerLink: project.projectTrackerLink
            };

            await sendProjectApprovalNotification(application.applicantId.email, application.applicantId.fullName, projectData);
        } catch (e) {
            console.error(`⚠️ Failed to send approval notification:`, e.message);
        }

        try {
            await notificationService.createApplicationStatusNotification(
                application.applicantId._id,
                'approved',
                project,
                application
            );
        } catch (e) {
            console.error(`⚠️ Failed to create in-app notification:`, e.message);
        }

        return application;
    }

    async rejectApplication(applicationId, admin, body) {
        const { rejectionReason, reviewNotes } = body;

        const application = await ProjectApplication.findById(applicationId)
            .populate('projectId', 'projectName projectCategory')
            .populate('applicantId', 'fullName email');

        if (!application) throw new NotFoundError("Application not found");
        if (application.status !== 'pending') throw new ValidationError(`Application is already ${application.status}`);

        application.status = 'rejected';
        application.reviewedBy = admin.userId;
        application.reviewedAt = new Date();
        application.rejectionReason = rejectionReason || 'other';
        application.reviewNotes = reviewNotes || '';

        await application.save();

        try {
            const projectData = {
                projectName: application.projectId.projectName,
                projectCategory: application.projectId.projectCategory,
                adminName: admin.fullName,
                rejectionReason: rejectionReason || 'other',
                reviewNotes: reviewNotes || ''
            };

            await sendProjectRejectionNotification(application.applicantId.email, application.applicantId.fullName, projectData);
        } catch (e) {
            console.error(`⚠️ Failed to send rejection notification:`, e.message);
        }

        try {
            await notificationService.createApplicationStatusNotification(
                application.applicantId._id,
                'rejected',
                application.projectId,
                application
            );
        } catch (e) {
            console.error(`⚠️ Failed to create in-app notification:`, e.message);
        }

        return application;
    }

    async rejectApplicationsBulk(applicationIds, admin, body) {
        const { rejectionReason = 'other', reviewNotes = '' } = body;

        if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
            throw new ValidationError('No application IDs provided');
        }

        // 1️⃣ Fetch pending applications (needed for notifications)
        const applications = await ProjectApplication.find({
            _id: { $in: applicationIds },
            status: 'pending'
        })
            .populate('projectId', 'projectName projectCategory')
            .populate('applicantId', 'fullName email');

        if (!applications.length) {
            throw new NotFoundError('No pending applications found with the provided IDs');
        }

        // 2️⃣ BULK UPDATE (single DB operation)
        await ProjectApplication.updateMany(
            { _id: { $in: applications.map(app => app._id) } },
            {
                $set: {
                    status: 'rejected',
                    reviewedBy: admin.userId,
                    reviewedAt: new Date(),
                    rejectionReason,
                    reviewNotes
                }
            }
        );

        // 3️⃣ Send notifications & emails (non-blocking, fault-tolerant)
        const notificationResults = await Promise.allSettled(
            applications.map(async (application) => {
                try {
                    await sendProjectRejectionNotification(
                        application.applicantId.email,
                        application.applicantId.fullName,
                        {
                            projectName: application.projectId.projectName,
                            projectCategory: application.projectId.projectCategory,
                            adminName: admin.fullName,
                            rejectionReason,
                            reviewNotes
                        }
                    );

                    await notificationService.createApplicationStatusNotification(
                        application.applicantId._id,
                        'rejected',
                        application.projectId,
                        application
                    );

                    return { id: application._id, status: 'success' };
                } catch (error) {
                    console.error(
                        `⚠️ Notification failed for application ${application._id}:`,
                        error.message
                    );
                    return {
                        id: application._id,
                        status: 'notification_failed',
                        message: error.message
                    };
                }
            })
        );

        // 4️⃣ Build response
        const successCount = notificationResults.filter(
            r => r.status === 'fulfilled' && r.value.status === 'success'
        ).length;

        return {
            total: applicationIds.length,
            processed: applications.length,
            rejected: applications.length,
            notificationSuccess: successCount,
            notificationFailed: applications.length - successCount
        };
    }

    async removeApprovedApplicant(applicationId, admin, body) {
        const { removalReason, removalNotes } = body;

        const application = await ProjectApplication.findById(applicationId)
            .populate('projectId', 'projectName projectCategory approvedAnnotators')
            .populate('applicantId', 'fullName email');

        if (!application) throw new NotFoundError("Application not found");
        if (application.status !== 'approved') throw new ValidationError("Only approved applicants can be removed");

        const originalData = { ...application.toObject() };

        application.status = 'removed';
        application.removedAt = new Date();
        application.removedBy = admin.userId;
        application.removalReason = removalReason || 'admin_decision';
        application.removalNotes = removalNotes || '';
        application.workEndedAt = new Date();

        await application.save();
        await AnnotationProject.findByIdAndUpdate(application.projectId._id, { $inc: { approvedAnnotators: -1 } });

        try {
            await sendApplicantRemovalNotification(application.applicantId.email, application.applicantId.fullName, {
                projectName: application.projectId.projectName,
                projectId: application.projectId._id,
                removalReason: application.removalReason,
                removedBy: admin.email,
                removedAt: application.removedAt,
                workStartedAt: originalData.workStartedAt,
                totalWorkDays: Math.ceil((application.removedAt - originalData.workStartedAt) / (1000 * 60 * 60 * 24))
            });
        } catch (e) { console.error('❌ Failed to send removal email:', e); }

        try {
            await sendProjectAnnotatorRemovedNotification(admin.email, admin.fullName, {
                applicantName: application.applicantId.fullName,
                applicantEmail: application.applicantId.email,
                projectName: application.projectId.projectName,
                projectCategory: application.projectId.projectCategory,
                removalReason: application.removalReason,
                removalNotes: application.removalNotes,
                removedBy: admin.fullName,
                workStartedAt: originalData.workStartedAt,
                totalWorkDays: Math.ceil((application.removedAt - originalData.workStartedAt) / (1000 * 60 * 60 * 24))
            });
        } catch (e) { console.error('❌ Failed to send admin removal email:', e); }

        return application;
    }

    async getRemovableApplicants(projectId) {
        const project = await AnnotationProject.findById(projectId);
        if (!project) throw new NotFoundError("Project not found");

        const approvedApplications = await ProjectApplication.find({ projectId, status: 'approved' })
            .populate('applicantId', 'fullName email phone')
            .sort({ reviewedAt: -1 });

        return {
            project: { id: project._id, name: project.projectName },
            removableApplicants: approvedApplications.map(app => ({
                applicationId: app._id,
                applicant: { id: app.applicantId._id, name: app.applicantId.fullName, email: app.applicantId.email },
                workDuration: app.workStartedAt ? Date.now() - app.workStartedAt.getTime() : 0
            }))
        };
    }
    async getApprovedApplicants(projectId) {
        const project = await AnnotationProject.findById(projectId);
        if (!project) throw new NotFoundError("Project not found");
        const approvedApplications = await ProjectApplication.find({ projectId, status: 'approved' })
            .populate('applicantId', 'fullName email phone')
            .sort({ reviewedAt: -1 });

        return approvedApplications;
    }
    async attachAssessment(projectId, admin, body) {
        const { assessmentId, isRequired = true, assessmentInstructions = '' } = body;

        const project = await AnnotationProject.findById(projectId);
        if (!project) throw new NotFoundError("Project not found");

        const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId);
        if (!assessmentConfig) throw new NotFoundError("Assessment configuration not found");

        project.assessment = {
            isRequired,
            assessmentId,
            assessmentInstructions,
            attachedAt: new Date(),
            attachedBy: admin.userId
        };

        await project.save();
        return project.populate('assessment.assessmentId', 'title description numberOfTasks estimatedDuration');
    }

    async removeAssessment(projectId) {
        const project = await AnnotationProject.findById(projectId);
        if (!project) throw new NotFoundError("Project not found");

        project.assessment = { isRequired: false, assessmentId: null, assessmentInstructions: '', attachedAt: null, attachedBy: null };
        await project.save();
        return project;
    }

    async getAvailableAssessments() {
        const assessments = await MultimediaAssessmentConfig.find({ isActive: true })
            .populate('projectId', 'projectName')
            .sort({ createdAt: -1 })
            .lean();

        return assessments.map(a => ({
            id: a._id,
            title: a.title,
            description: a.description,
            numberOfTasks: a.numberOfTasks,
            estimatedDuration: a.estimatedDuration,
            usageCount: a.statistics?.totalSubmissions || 0
        }));
    }
}

const annotationProjectService = new AnnotationProjectService();
export default annotationProjectService;
