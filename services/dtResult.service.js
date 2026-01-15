import dtUserRepository from '../repositories/dtUser.repository.js';
import { ValidationError, NotFoundError } from '../utils/responseHandler.js';
import { generateOptimizedUrl, generateThumbnail } from '../config/cloudinary.js';

/**
 * Service for handling result submissions and document uploads for DTUsers.
 * Manages file processing through Cloudinary and updates user profile statuses.
 */
class DTResultService {
    /**
     * Submits a result file for a project. 
     * Optimizes images via Cloudinary and updates the user's annotator status if applicable.
     */
    async submitResult(userId, projectId, notes, file) {
        if (!file) throw new ValidationError('Result file is required');

        const user = await dtUserRepository.findById(userId);
        if (!user) throw new NotFoundError('User not found');

        const uploadResult = file;
        let optimizedUrl = uploadResult.path;
        let thumbnailUrl = null;

        if (uploadResult.mimetype && uploadResult.mimetype.startsWith('image/')) {
            optimizedUrl = generateOptimizedUrl(uploadResult.filename, {
                width: 1200, height: 800, crop: 'limit', quality: 'auto'
            });
            thumbnailUrl = generateThumbnail(uploadResult.filename, 300);
        }

        const resultSubmission = {
            originalResultLink: '',
            cloudinaryResultData: {
                publicId: uploadResult.filename,
                url: uploadResult.path,
                optimizedUrl,
                thumbnailUrl,
                originalName: uploadResult.originalname,
                size: uploadResult.size,
                format: uploadResult.format || uploadResult.filename.split('.').pop()
            },
            submissionDate: new Date(),
            projectId: projectId || null,
            status: 'stored',
            notes: notes || '',
            uploadMethod: 'direct_upload'
        };

        if (!user.resultSubmissions) user.resultSubmissions = [];
        user.resultSubmissions.push(resultSubmission);
        user.resultLink = uploadResult.path;

        if (user.annotatorStatus === "pending" || user.annotatorStatus === "verified") {
            user.annotatorStatus = "submitted";
        }

        await user.save();
        return {
            submission: user.resultSubmissions[user.resultSubmissions.length - 1],
            totalSubmissions: user.resultSubmissions.length,
            annotatorStatus: user.annotatorStatus
        };
    }

    async uploadIdDocument(userId, file) {
        if (!file) throw new ValidationError('ID document is required');
        const user = await dtUserRepository.findById(userId);
        if (!user) throw new NotFoundError('User not found');

        user.attachments.id_document_url = file.path;
        await user.save();
        return { id_document_url: user.attachments.id_document_url };
    }

    async uploadResume(userId, file) {
        if (!file) throw new ValidationError('Resume is required');
        const user = await dtUserRepository.findById(userId);
        if (!user) throw new NotFoundError('User not found');

        user.attachments.resume_url = file.path;
        await user.save();
        return { resume_url: user.attachments.resume_url };
    }

    async getUserResultSubmissions(userId, query = {}) {
        const { page = 1, limit = 10, status } = query;
        const user = await dtUserRepository.findWithPopulate({ _id: userId }, ['resultSubmissions.projectId']);
        if (!user || user.length === 0) throw new NotFoundError('User not found');

        const userData = user[0];
        let submissions = userData.resultSubmissions || [];

        if (status) {
            submissions = submissions.filter(s => s.status === status);
        }

        submissions.sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));

        const startIndex = (page - 1) * limit;
        const paginated = submissions.slice(startIndex, startIndex + parseInt(limit));

        return {
            submissions: paginated,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(submissions.length / limit),
                totalSubmissions: submissions.length
            }
        };
    }
}

export default new DTResultService();
