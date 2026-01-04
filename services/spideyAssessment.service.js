import SpideyAssessmentEngine from '../utils/spideyAssessmentEngine.js';
import SpideyFinalDecisionEngine from '../utils/spideyFinalDecisionEngine.js';
import SpideyAssessmentConfig from '../models/spideyAssessmentConfig.model.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

class SpideyAssessmentService {
    constructor() {
        this.assessmentEngine = new SpideyAssessmentEngine();
        this.finalDecisionEngine = new SpideyFinalDecisionEngine();
    }

    /**
     * Start new Spidey Assessment
     */
    async startAssessment(assessmentId, candidateId, sessionData) {
        return await this.assessmentEngine.startAssessment(
            assessmentId,
            candidateId,
            sessionData
        );
    }

    /**
     * Submit stage response
     */
    async submitStage(submissionId, stage, submissionData, files = []) {
        return await this.assessmentEngine.submitStage(
            submissionId,
            stage,
            submissionData,
            files
        );
    }

    /**
     * Get assessment status
     */
    async getAssessmentStatus(submissionId) {
        return await this.assessmentEngine.getAssessmentStatus(submissionId);
    }

    /**
     * Get final decision
     */
    async getFinalDecision(submissionId) {
        return await this.finalDecisionEngine.makeFinalDecision(submissionId);
    }

    /**
     * Get audit report
     */
    async getAuditReport(submissionId) {
        return await this.finalDecisionEngine.generateAuditReport(submissionId);
    }

    /**
     * Get assessment analytics
     */
    async getAssessmentAnalytics(assessmentId) {
        return await this.assessmentEngine.getAssessmentAnalytics(assessmentId);
    }

    /**
     * Get assessment configuration
     */
    async getAssessmentConfig(assessmentId) {
        const config = await SpideyAssessmentConfig.findById(assessmentId)
            .populate('projectId', 'projectName projectDescription');

        if (!config) {
            throw new NotFoundError('Assessment configuration not found');
        }

        if (!config.isActive) {
            throw new ValidationError('Assessment is not active');
        }

        // Return sanitized config for frontend
        return {
            assessmentId: config._id,
            title: config.title,
            description: config.description,
            projectName: config.projectId.projectName,
            stages: {
                stage1: {
                    name: config.stages.stage1.name,
                    timeLimit: config.stages.stage1.timeLimit,
                    questionCount: config.stages.stage1.questions?.length || 0
                },
                stage2: {
                    name: config.stages.stage2.name,
                    timeLimit: config.stages.stage2.timeLimit,
                    hasFileUpload: true
                },
                stage3: {
                    name: config.stages.stage3.name,
                    timeLimit: config.stages.stage3.timeLimit,
                    hasFileUpload: true
                },
                stage4: {
                    name: config.stages.stage4.name,
                    timeLimit: config.stages.stage4.timeLimit,
                    hasFileUpload: false
                }
            },
            totalStages: 4,
            expectedDifficulty: 'expert',
            estimatedDuration: '4+ hours'
        };
    }
}

export default new SpideyAssessmentService();
