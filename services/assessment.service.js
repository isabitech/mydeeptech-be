import Assessment from '../models/assessment.model.js';
import AssessmentQuestion from '../models/assessmentQuestion.model.js';
import DTUser from '../models/dtUser.model.js';
import MultimediaAssessmentConfig from '../models/multimediaAssessmentConfig.model.js';
import * as notificationService from '../utils/notificationService.js';
import { sendAnnotatorApprovalEmail, sendAnnotatorRejectionEmail } from '../utils/annotatorMailer.js';
import { NotFoundError, ValidationError } from '../utils/responseHandler.js';
import mongoose from 'mongoose';

class AssessmentService {
    async submitAssessment(userId, data, ip, userAgent) {
        const { assessmentType, startedAt, completedAt, answers, passingScore } = data;

        const user = await DTUser.findById(userId);
        if (!user) throw new NotFoundError('User not found');

        const canRetake = await Assessment.canUserRetake(userId, assessmentType, 24);
        if (!canRetake) throw new ValidationError('You must wait 24 hours before retaking the assessment');

        const previousAttempts = await Assessment.find({ userId, assessmentType })
            .select('createdAt scorePercentage passed')
            .sort({ createdAt: -1 });

        const attemptNumber = previousAttempts.length + 1;
        let correctAnswers = 0;
        const totalQuestions = answers.length;
        const processedQuestions = [];

        for (const userAnswer of answers) {
            const dbQuestion = await AssessmentQuestion.findOne({ id: userAnswer.questionId, isActive: true });
            if (!dbQuestion) throw new ValidationError(`Question with ID ${userAnswer.questionId} not found`);
            if (dbQuestion.section !== userAnswer.section) throw new ValidationError(`Section mismatch for question ${userAnswer.questionId}`);

            const isCorrect = userAnswer.userAnswer.trim().toLowerCase() === dbQuestion.answer.trim().toLowerCase();
            if (isCorrect) correctAnswers += dbQuestion.points;

            processedQuestions.push({
                questionId: userAnswer.questionId.toString(),
                questionText: dbQuestion.question,
                questionType: 'multiple_choice',
                section: dbQuestion.section,
                options: dbQuestion.options.map(opt => ({
                    optionId: Math.random().toString(36).substr(2, 9),
                    optionText: opt,
                    isCorrect: opt === dbQuestion.answer
                })),
                correctAnswer: dbQuestion.answer,
                userAnswer: userAnswer.userAnswer,
                isCorrect,
                pointsAwarded: isCorrect ? dbQuestion.points : 0,
                maxPoints: dbQuestion.points
            });
        }

        const scorePercentage = Math.round((correctAnswers / totalQuestions) * 100);
        const passed = scorePercentage >= passingScore;

        const sectionPerformance = {};
        ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'].forEach(section => {
            const sectionQuestions = processedQuestions.filter(q => q.section === section);
            const sectionCorrect = sectionQuestions.filter(q => q.isCorrect).length;
            const sectionTotal = sectionQuestions.length;
            sectionPerformance[section] = {
                correct: sectionCorrect,
                total: sectionTotal,
                percentage: sectionTotal > 0 ? Math.round((sectionCorrect / sectionTotal) * 100) : 0
            };
        });

        const statusBeforeAssessment = { annotatorStatus: user.annotatorStatus, microTaskerStatus: user.microTaskerStatus };
        let newAnnotatorStatus = user.annotatorStatus;
        let newMicroTaskerStatus = user.microTaskerStatus;

        if (assessmentType === 'annotator_qualification') {
            if (passed) {
                newAnnotatorStatus = 'approved';
                if (user.microTaskerStatus === 'pending') newMicroTaskerStatus = 'approved';
            } else {
                newAnnotatorStatus = 'rejected';
                newMicroTaskerStatus = 'approved';
            }
        }

        const timeSpentMinutes = Math.round((new Date(completedAt) - new Date(startedAt)) / (1000 * 60));

        const assessment = new Assessment({
            userId, assessmentType, totalQuestions, correctAnswers, scorePercentage,
            passed, passingScore, startedAt: new Date(startedAt), completedAt: new Date(completedAt),
            timeSpentMinutes, questions: processedQuestions, statusBeforeAssessment,
            statusAfterAssessment: { annotatorStatus: newAnnotatorStatus, microTaskerStatus: newMicroTaskerStatus },
            category: 'section_based_assessment', ipAddress: ip, userAgent, attemptNumber,
            isRetake: attemptNumber > 1,
            previousAttempts: previousAttempts.map(a => ({
                attemptDate: a.createdAt, scorePercentage: a.scorePercentage, passed: a.passed
            }))
        });

        await assessment.save();

        if (user.annotatorStatus !== newAnnotatorStatus || user.microTaskerStatus !== newMicroTaskerStatus) {
            user.annotatorStatus = newAnnotatorStatus;
            user.microTaskerStatus = newMicroTaskerStatus;
            await user.save();

            try {
                if (passed && newAnnotatorStatus === 'approved') {
                    await notificationService.createNotification({
                        recipientId: userId, recipientType: 'user', title: '🎉 Assessment Passed - Annotator Approved!',
                        message: `Congratulations! You scored ${scorePercentage}% on your assessment and are now an approved annotator.`,
                        type: 'account_update', priority: 'high', actionUrl: '/projects/browse', actionText: 'Browse Projects',
                        relatedData: { assessmentId: assessment._id, score: scorePercentage, sectionPerformance }
                    });
                    await sendAnnotatorApprovalEmail(user.email, user.fullName);
                } else if (!passed && newAnnotatorStatus === 'rejected') {
                    await notificationService.createNotification({
                        recipientId: userId, recipientType: 'user', title: '📋 Assessment Complete - Micro Tasker Approved',
                        message: `You scored ${scorePercentage}%. You're now approved as a micro tasker.`,
                        type: 'account_update', priority: 'medium', actionUrl: '/surveys/browse', actionText: 'Browse Surveys',
                        relatedData: { assessmentId: assessment._id, score: scorePercentage, sectionPerformance }
                    });
                    await sendAnnotatorRejectionEmail(user.email, user.fullName);
                }
            } catch (err) {
                console.error('Notification/Email Error:', err);
            }
        }

        return {
            assessmentId: assessment._id,
            results: { totalQuestions, correctAnswers, scorePercentage, passed, grade: assessment.getGrade(), timeSpent: assessment.timeSpentFormatted, sectionPerformance },
            statusChanges: { statusChanged: true, before: statusBeforeAssessment, after: { annotatorStatus: newAnnotatorStatus, microTaskerStatus: newMicroTaskerStatus } },
            attemptInfo: { attemptNumber, isRetake: attemptNumber > 1 }
        };
    }

    async getHistory(userId, query) {
        const { page = 1, limit = 10, assessmentType, passed } = query;
        const filter = { userId };
        if (assessmentType) filter.assessmentType = assessmentType;
        if (passed !== undefined) filter.passed = passed;

        const assessments = await Assessment.find(filter)
            .select('-questions.correctAnswer -ipAddress -userAgent')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const totalCount = await Assessment.countDocuments(filter);
        const stats = await Assessment.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: '$assessmentType',
                    totalAttempts: { $sum: 1 },
                    passedAttempts: { $sum: { $cond: ['$passed', 1, 0] } },
                    averageScore: { $avg: '$scorePercentage' },
                    bestScore: { $max: '$scorePercentage' },
                    lastAttempt: { $max: '$createdAt' }
                }
            }
        ]);

        return { assessments, pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalCount }, statistics: stats };
    }

    async getRetakeEligibility(userId, assessmentType = 'annotator_qualification') {
        const canRetake = await Assessment.canUserRetake(userId, assessmentType, 24);
        const latestAttempt = await Assessment.getUserLatestAttempt(userId, assessmentType);
        const bestScore = await Assessment.getUserBestScore(userId, assessmentType);

        let nextRetakeTime = null;
        if (!canRetake && latestAttempt) {
            nextRetakeTime = new Date(latestAttempt.createdAt.getTime() + 24 * 60 * 60 * 1000);
        }

        return { canRetake, assessmentType, nextRetakeTime, latestAttempt, bestScore };
    }

    async getAdminAssessments(query) {
        const { page = 1, limit = 10, assessmentType, passed, userId } = query;
        const filter = {};
        if (assessmentType) filter.assessmentType = assessmentType;
        if (passed !== undefined) filter.passed = passed;
        if (userId) filter.userId = userId;

        const assessments = await Assessment.find(filter)
            .populate('userId', 'fullName email annotatorStatus microTaskerStatus')
            .select('-questions.correctAnswer -ipAddress -userAgent')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const totalCount = await Assessment.countDocuments(filter);
        const overallStats = await Assessment.aggregate([
            {
                $group: {
                    _id: null,
                    totalAssessments: { $sum: 1 },
                    passedAssessments: { $sum: { $cond: ['$passed', 1, 0] } },
                    averageScore: { $avg: '$scorePercentage' },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            {
                $addFields: {
                    uniqueUserCount: { $size: '$uniqueUsers' },
                    passRate: { $multiply: [{ $divide: ['$passedAssessments', '$totalAssessments'] }, 100] }
                }
            }
        ]);

        return { assessments, pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalCount }, statistics: overallStats[0] };
    }

    async getQuestions(questionsPerSection = 5) {
        const sections = ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'];
        const allQuestions = [];

        for (const section of sections) {
            const sectionQuestions = await AssessmentQuestion.aggregate([
                { $match: { section, isActive: true } },
                { $sample: { size: parseInt(questionsPerSection) } },
                { $project: { id: 1, section: 1, question: 1, options: 1, points: 1, _id: 0 } }
            ]);

            const randomized = sectionQuestions.map(q => ({
                ...q, options: [...q.options].sort(() => Math.random() - 0.5)
            }));
            allQuestions.push(...randomized);
        }

        return allQuestions.sort(() => Math.random() - 0.5);
    }

    async getSectionStats() {
        const questionStats = await AssessmentQuestion.getQuestionCountBySection();
        const performanceStats = await Assessment.aggregate([
            { $unwind: '$questions' },
            {
                $group: {
                    _id: '$questions.section',
                    totalAnswered: { $sum: 1 },
                    correctAnswers: { $sum: { $cond: ['$questions.isCorrect', 1, 0] } },
                    averageScore: { $avg: { $cond: ['$questions.isCorrect', 100, 0] } }
                }
            },
            { $addFields: { successRate: { $multiply: [{ $divide: ['$correctAnswers', '$totalAnswered'] }, 100] } } }
        ]);

        return { questionStats: questionStats[0], performanceStats };
    }

    async getAvailableAssessments(userId) {
        const englishAssessment = {
            id: 'english-proficiency', type: 'annotator_qualification', title: 'English Proficiency Assessment',
            description: 'Comprehensive assessment covering grammar, vocabulary, comprehension, and writing skills',
            category: 'language', difficulty: 'intermediate', estimatedDuration: 30, totalQuestions: 20,
            sections: [{ name: 'Comprehension', questions: 5 }, { name: 'Vocabulary', questions: 5 }, { name: 'Grammar', questions: 5 }, { name: 'Writing', questions: 5 }],
            passingScore: 60, cooldownHours: 24, isActive: true
        };

        const latestAttempt = await Assessment.findOne({ userId, assessmentType: 'annotator_qualification' }).sort({ createdAt: -1 });

        englishAssessment.userStatus = {
            hasAttempted: !!latestAttempt, latestScore: latestAttempt?.scorePercentage || null,
            passed: latestAttempt?.passed || false, lastAttemptDate: latestAttempt?.createdAt || null,
            canRetake: !latestAttempt || new Date() >= new Date(latestAttempt.createdAt.getTime() + 24 * 60 * 60 * 1000)
        };

        const multimediaAssessments = await MultimediaAssessmentConfig.find({ isActive: true })
            .populate('projectId', 'projectName projectCategory projectDescription')
            .select('title description requirements scoring projectId createdAt');

        return { languageAssessments: [englishAssessment], multimediaAssessments };
    }
    async getAssessmentSubmissions(params) {
        const { assessmentId, page = 1, limit = 10, status, userId, sortBy = 'createdAt', sortOrder = 'desc', isAdmin = false, requestingUserId } = params;
        let submissions = [];
        let totalCount = 0;
        let assessmentInfo = {};

        if (assessmentId === 'english-proficiency') {
            const filter = { assessmentType: 'annotator_qualification' };
            if (status !== undefined) {
                filter.passed = status === 'passed' ? true : status === 'failed' ? false : { $exists: true };
            }
            if (userId) filter.userId = userId;
            if (!isAdmin && !userId) filter.userId = requestingUserId;

            const assessments = await Assessment.find(filter)
                .populate('userId', 'fullName email annotatorStatus microTaskerStatus qaStatus')
                .select('-questions.correctAnswer -ipAddress -userAgent')
                .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));

            totalCount = await Assessment.countDocuments(filter);

            submissions = assessments.map(assessment => ({
                id: assessment._id,
                type: 'english_proficiency',
                user: {
                    id: assessment.userId._id,
                    fullName: assessment.userId.fullName,
                    email: assessment.userId.email,
                    annotatorStatus: assessment.userId.annotatorStatus,
                    microTaskerStatus: assessment.userId.microTaskerStatus,
                    qaStatus: assessment.userId.qaStatus
                },
                submission: {
                    scorePercentage: assessment.scorePercentage,
                    correctAnswers: assessment.correctAnswers,
                    totalQuestions: assessment.totalQuestions,
                    passed: assessment.passed,
                    passingScore: assessment.passingScore,
                    timeSpent: assessment.timeSpent,
                    formattedTimeSpent: assessment.formattedTimeSpent,
                    attemptNumber: assessment.attemptNumber,
                    isRetake: assessment.attemptNumber > 1,
                    submittedAt: assessment.createdAt,
                    categories: assessment.categories || ['Comprehension', 'Vocabulary', 'Grammar', 'Writing']
                },
                sectionPerformance: assessment.questions?.reduce((acc, q) => {
                    if (!acc[q.section]) acc[q.section] = { correct: 0, total: 0 };
                    acc[q.section].total++;
                    if (q.isCorrect) acc[q.section].correct++;
                    return acc;
                }, {}) || {}
            }));

            assessmentInfo = {
                id: 'english-proficiency',
                type: 'english_proficiency',
                title: 'English Proficiency Assessment',
                description: 'Annotator qualification assessment covering comprehension, vocabulary, grammar, and writing',
                passingScore: 60,
                totalQuestions: 20,
                sections: ['Comprehension', 'Vocabulary', 'Grammar', 'Writing']
            };
        } else {
            const MultimediaAssessmentSubmission = (await import('../models/multimediaAssessmentSubmission.model.js')).default;
            const MultimediaAssessmentConfig = (await import('../models/multimediaAssessmentConfig.model.js')).default;
            const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId);
            if (!assessmentConfig) throw new NotFoundError('Multimedia assessment not found');
            const filter = { assessmentId };
            if (status) filter.status = status;
            if (userId) filter.annotatorId = userId;
            if (!isAdmin && !userId) filter.annotatorId = requestingUserId;

            const multimediaSubmissions = await MultimediaAssessmentSubmission.find(filter)
                .populate('annotatorId', 'fullName email annotatorStatus microTaskerStatus qaStatus')
                .populate('projectId', 'projectName projectCategory')
                .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));

            totalCount = await MultimediaAssessmentSubmission.countDocuments(filter);

            submissions = multimediaSubmissions.map(submission => ({
                id: submission._id,
                type: 'multimedia_assessment',
                user: {
                    id: submission.annotatorId._id,
                    fullName: submission.annotatorId.fullName,
                    email: submission.annotatorId.email,
                    annotatorStatus: submission.annotatorId.annotatorStatus,
                    microTaskerStatus: submission.annotatorId.microTaskerStatus,
                    qaStatus: submission.annotatorId.qaStatus
                },
                submission: {
                    status: submission.status,
                    scorePercentage: submission.finalScore || 0,
                    completionPercentage: submission.completionPercentage,
                    totalTimeSpent: submission.totalTimeSpent,
                    formattedTimeSpent: submission.formattedTimeSpent,
                    attemptNumber: submission.attemptNumber,
                    tasksCompleted: submission.tasks?.filter(task => task.isCompleted).length || 0,
                    totalTasks: submission.tasks?.length || 0,
                    submittedAt: submission.submittedAt || submission.createdAt,
                    startedAt: submission.createdAt,
                    autoSaveCount: submission.autoSaveCount,
                    lastAutoSave: submission.lastAutoSave
                },
                project: submission.projectId ? {
                    id: submission.projectId._id,
                    name: submission.projectId.projectName,
                    category: submission.projectId.projectCategory
                } : null,
                taskDetails: submission.tasks?.map(task => ({
                    taskNumber: task.taskNumber,
                    isCompleted: task.isCompleted,
                    timeSpent: task.timeSpent,
                    submittedAt: task.submittedAt,
                    conversationLength: task.conversation?.turns?.length || 0
                })) || []
            }));

            assessmentInfo = {
                id: assessmentConfig._id,
                type: 'multimedia_assessment',
                title: assessmentConfig.title,
                description: assessmentConfig.description,
                requirements: assessmentConfig.requirements,
                scoring: assessmentConfig.scoring,
                maxAttempts: assessmentConfig.maxAttempts,
                cooldownHours: assessmentConfig.cooldownHours,
                isActive: assessmentConfig.isActive
            };
        }

        // Calculate statistics
        const statistics = {
            total: totalCount,
            currentPage: submissions.length,
            ...submissions.reduce((acc, sub) => {
                if (sub.type === 'english_proficiency') {
                    acc.passed = (acc.passed || 0) + (sub.submission.passed ? 1 : 0);
                    acc.failed = (acc.failed || 0) + (!sub.submission.passed ? 1 : 0);
                    acc.averageScore = ((acc.averageScore || 0) * (acc.processedCount || 0) + sub.submission.scorePercentage) / ((acc.processedCount || 0) + 1);
                } else {
                    acc[sub.submission.status] = (acc[sub.submission.status] || 0) + 1;
                    if (sub.submission.scorePercentage > 0) {
                        acc.averageScore = ((acc.averageScore || 0) * (acc.processedCount || 0) + sub.submission.scorePercentage) / ((acc.processedCount || 0) + 1);
                    }
                }
                acc.processedCount = (acc.processedCount || 0) + 1;
                return acc;
            }, {}),
        };
        delete statistics.processedCount;

        return {
            assessment: assessmentInfo,
            submissions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalCount,
                hasNext: parseInt(page) * parseInt(limit) < totalCount,
                hasPrev: parseInt(page) > 1,
                limit: parseInt(limit)
            },
            statistics,
            filters: { assessmentId, status: status || 'all', userId: userId || (isAdmin ? 'all' : 'own'), sortBy, sortOrder }
        };
    }

    async getAdminAssessmentsOverview(admin) {
        // Only admin can call this
        if (!admin) throw new ValidationError('Admin authentication required');
        const assessments = [];
        // English Proficiency Assessment Statistics
        try {
            const englishStats = await Assessment.aggregate([
                { $match: { assessmentType: 'annotator_qualification' } },
                {
                    $group: {
                        _id: null,
                        totalSubmissions: { $sum: 1 },
                        approvedSubmissions: { $sum: { $cond: ['$passed', 1, 0] } },
                        rejectedSubmissions: { $sum: { $cond: [{ $not: '$passed' }, 1, 0] } },
                        averageScore: { $avg: '$scorePercentage' },
                        averageCompletionTime: { $avg: '$timeSpent' },
                        lastSubmissionAt: { $max: '$createdAt' },
                        firstSubmissionAt: { $min: '$createdAt' }
                    }
                }
            ]);
            const englishData = englishStats[0] || {
                totalSubmissions: 0,
                approvedSubmissions: 0,
                rejectedSubmissions: 0,
                averageScore: 0,
                averageCompletionTime: 0,
                lastSubmissionAt: null,
                firstSubmissionAt: null
            };
            const completionRate = englishData.totalSubmissions > 0 ? (englishData.approvedSubmissions / englishData.totalSubmissions * 100) : 0;
            assessments.push({
                id: 'english_proficiency',
                title: 'English Proficiency Assessment',
                description: 'Evaluate English language skills including grammar, vocabulary, and comprehension.',
                type: 'english_proficiency',
                totalSubmissions: englishData.totalSubmissions,
                pendingReview: 0,
                approvedSubmissions: englishData.approvedSubmissions,
                rejectedSubmissions: englishData.rejectedSubmissions,
                averageScore: Math.round(englishData.averageScore * 10) / 10 || 0,
                passingScore: 60,
                completionRate: Math.round(completionRate * 10) / 10,
                averageCompletionTime: englishData.averageCompletionTime * 1000 || 1800000,
                createdAt: englishData.firstSubmissionAt || new Date('2023-12-01T08:00:00Z'),
                isActive: true,
                lastSubmissionAt: englishData.lastSubmissionAt || null
            });
        } catch (englishError) {
            console.error('Error fetching English proficiency stats:', englishError);
            assessments.push({
                id: 'english_proficiency',
                title: 'English Proficiency Assessment',
                description: 'Evaluate English language skills including grammar, vocabulary, and comprehension.',
                type: 'english_proficiency',
                totalSubmissions: 0,
                pendingReview: 0,
                approvedSubmissions: 0,
                rejectedSubmissions: 0,
                averageScore: 0,
                passingScore: 60,
                completionRate: 0,
                averageCompletionTime: 1800000,
                createdAt: new Date('2023-12-01T08:00:00Z'),
                isActive: true,
                lastSubmissionAt: null
            });
        }
        // Multimedia Assessment Statistics
        try {
            const MultimediaAssessmentConfig = (await import('../models/multimediaAssessmentConfig.model.js')).default;
            const MultimediaAssessmentSubmission = (await import('../models/multimediaAssessmentSubmission.model.js')).default;
            const multimediaConfigs = await MultimediaAssessmentConfig.find({})
                .populate('projectId', 'projectName projectCategory')
                .sort({ createdAt: -1 });
            for (const config of multimediaConfigs) {
                const submissionStats = await MultimediaAssessmentSubmission.aggregate([
                    { $match: { assessmentId: config._id } },
                    {
                        $group: {
                            _id: null,
                            totalSubmissions: { $sum: 1 },
                            pendingReview: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
                            inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
                            passed: { $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] } },
                            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                            averageScore: { $avg: '$finalScore' },
                            averageCompletionTime: { $avg: '$totalTimeSpent' },
                            lastSubmissionAt: { $max: '$createdAt' }
                        }
                    }
                ]);
                const submissionData = submissionStats[0] || {
                    totalSubmissions: 0,
                    pendingReview: 0,
                    inProgress: 0,
                    passed: 0,
                    failed: 0,
                    averageScore: 0,
                    averageCompletionTime: 0,
                    lastSubmissionAt: null
                };
                const completionRate = submissionData.totalSubmissions > 0 ? ((submissionData.passed + submissionData.failed) / submissionData.totalSubmissions * 100) : 0;
                assessments.push({
                    id: config._id.toString(),
                    title: config.title,
                    description: config.description,
                    type: 'multimedia',
                    totalSubmissions: submissionData.totalSubmissions,
                    pendingReview: submissionData.pendingReview + submissionData.inProgress,
                    approvedSubmissions: submissionData.passed,
                    rejectedSubmissions: submissionData.failed,
                    averageScore: Math.round((submissionData.averageScore || 0) * 10) / 10,
                    passingScore: config.scoring?.passingScore || 70,
                    completionRate: Math.round(completionRate * 10) / 10,
                    averageCompletionTime: (submissionData.averageCompletionTime * 1000) || (config.requirements?.timeLimit * 60 * 1000) || 3600000,
                    createdAt: config.createdAt,
                    isActive: config.isActive,
                    lastSubmissionAt: submissionData.lastSubmissionAt,
                    projectInfo: config.projectId ? {
                        id: config.projectId._id,
                        name: config.projectId.projectName,
                        category: config.projectId.projectCategory
                    } : null
                });
            }
        } catch (multimediaError) {
            console.error('Error fetching multimedia assessment stats:', multimediaError);
        }
        // Sort assessments by type priority and last submission
        assessments.sort((a, b) => {
            const typePriority = { 'english_proficiency': 0, 'multimedia': 1, 'general': 2 };
            const aPriority = typePriority[a.type] || 3;
            const bPriority = typePriority[b.type] || 3;
            if (aPriority !== bPriority) return aPriority - bPriority;
            const aDate = new Date(a.lastSubmissionAt || a.createdAt);
            const bDate = new Date(b.lastSubmissionAt || b.createdAt);
            return bDate.getTime() - aDate.getTime();
        });
        // Calculate overall statistics
        const overallStats = assessments.reduce((acc, assessment) => {
            acc.totalAssessments += 1;
            acc.totalSubmissions += assessment.totalSubmissions;
            acc.totalPendingReview += assessment.pendingReview;
            acc.totalApproved += assessment.approvedSubmissions;
            acc.totalRejected += assessment.rejectedSubmissions;
            if (assessment.totalSubmissions > 0) {
                acc.activeAssessments += 1;
                acc.averageCompletionRate += assessment.completionRate;
            }
            return acc;
        }, {
            totalAssessments: 0,
            activeAssessments: 0,
            totalSubmissions: 0,
            totalPendingReview: 0,
            totalApproved: 0,
            totalRejected: 0,
            averageCompletionRate: 0
        });
        overallStats.averageCompletionRate = overallStats.activeAssessments > 0 ? Math.round((overallStats.averageCompletionRate / overallStats.activeAssessments) * 10) / 10 : 0;
        return { assessments, statistics: overallStats };
    }

    async getUserAssessmentsOverview(userId) {
        if (!userId) throw new ValidationError('User authentication required');
        const assessments = [];
        // English Proficiency Assessment - User's perspective
        try {
            const userEnglishAttempts = await Assessment.find({ userId, assessmentType: 'annotator_qualification' }).sort({ createdAt: -1 });
            const latestAttempt = userEnglishAttempts[0];
            const bestAttempt = userEnglishAttempts.reduce((best, current) => !best || current.scorePercentage > best.scorePercentage ? current : best, null);
            const passedAttempts = userEnglishAttempts.filter(a => a.passed);
            const canRetake = !latestAttempt || (new Date() - new Date(latestAttempt.createdAt)) >= 24 * 60 * 60 * 1000;
            assessments.push({
                id: 'english_proficiency',
                title: 'English Proficiency Assessment',
                description: 'Evaluate your English language skills including grammar, vocabulary, and comprehension.',
                type: 'english_proficiency',
                numberOfTasks: 20,
                estimatedDuration: 30,
                timeLimit: 30,
                passingScore: 6.0,
                difficulty: 'Beginner',
                isActive: true,
                userStatus: passedAttempts.length > 0 ? 'completed' : userEnglishAttempts.length > 0 ? 'attempted' : 'not_started',
                ...(latestAttempt && {
                    lastAttempt: {
                        score: latestAttempt.scorePercentage / 10,
                        completedAt: latestAttempt.createdAt,
                        status: latestAttempt.passed ? 'passed' : 'failed'
                    }
                }),
                _internal: {
                    userProgress: {
                        hasAttempted: userEnglishAttempts.length > 0,
                        totalAttempts: userEnglishAttempts.length,
                        isPassed: passedAttempts.length > 0,
                        canRetake,
                        nextRetakeAvailable: canRetake ? null : new Date(new Date(latestAttempt.createdAt).getTime() + 24 * 60 * 60 * 1000),
                        latestScore: latestAttempt?.scorePercentage || null,
                        bestScore: bestAttempt?.scorePercentage || null
                    },
                    benefits: [
                        'Qualify for annotation projects',
                        'Access to English content tasks',
                        'Higher priority in project assignments'
                    ]
                }
            });
        } catch {
            assessments.push({
                id: 'english_proficiency',
                title: 'English Proficiency Assessment',
                description: 'Evaluate your English language skills including grammar, vocabulary, and comprehension.',
                type: 'english_proficiency',
                numberOfTasks: 20,
                estimatedDuration: 30,
                timeLimit: 30,
                passingScore: 6.0,
                difficulty: 'Beginner',
                isActive: true,
                userStatus: 'not_started',
                _internal: {
                    userProgress: {
                        hasAttempted: false,
                        totalAttempts: 0,
                        isPassed: false,
                        canRetake: true,
                        status: 'not_started'
                    }
                }
            });
        }
        // Multimedia Assessments - User's perspective
        try {
            const MultimediaAssessmentConfig = (await import('../models/multimediaAssessmentConfig.model.js')).default;
            const MultimediaAssessmentSubmission = (await import('../models/multimediaAssessmentSubmission.model.js')).default;
            const multimediaConfigs = await MultimediaAssessmentConfig.find({ isActive: true })
                .populate('projectId', 'projectName projectCategory')
                .sort({ createdAt: -1 });
            for (const config of multimediaConfigs) {
                const userAttempts = await MultimediaAssessmentSubmission.find({ annotatorId: userId, assessmentId: config._id }).sort({ createdAt: -1 });
                const latestAttempt = userAttempts[0];
                const passedAttempts = userAttempts.filter(a => a.status === 'passed');
                const cooldownHours = config.cooldownHours || 24;
                const canRetake = !latestAttempt || (latestAttempt.status !== 'in_progress' && (new Date() - new Date(latestAttempt.createdAt)) >= cooldownHours * 60 * 60 * 1000);
                const hasEnglishQualification = await Assessment.findOne({ userId, assessmentType: 'annotator_qualification', passed: true });
                assessments.push({
                    id: config._id.toString(),
                    title: config.title,
                    description: config.description,
                    type: 'multimedia',
                    numberOfTasks: config.requirements?.tasksPerAssessment || 5,
                    estimatedDuration: config.requirements?.timeLimit || 60,
                    timeLimit: config.requirements?.timeLimit || 60,
                    passingScore: (config.scoring?.passingScore || 70) / 10,
                    difficulty: 'Intermediate',
                    isActive: config.isActive,
                    userStatus: passedAttempts.length > 0 ? 'completed' : latestAttempt?.status === 'in_progress' ? 'in_progress' : userAttempts.length > 0 ? 'attempted' : 'not_started',
                    ...(latestAttempt && latestAttempt.status !== 'in_progress' && {
                        lastAttempt: {
                            score: latestAttempt.finalScore || 0,
                            completedAt: latestAttempt.createdAt,
                            status: latestAttempt.status === 'passed' ? 'passed' : 'failed'
                        }
                    }),
                    _internal: {
                        userProgress: {
                            hasAttempted: userAttempts.length > 0,
                            totalAttempts: userAttempts.length,
                            isPassed: passedAttempts.length > 0,
                            canRetake,
                            nextRetakeAvailable: canRetake ? null : new Date(new Date(latestAttempt?.createdAt).getTime() + cooldownHours * 60 * 60 * 1000),
                            currentSession: latestAttempt?.status === 'in_progress' ? {
                                sessionId: latestAttempt._id,
                                completionPercentage: latestAttempt.completionPercentage || 0,
                                timeSpent: latestAttempt.totalTimeSpent || 0,
                                lastActivity: latestAttempt.lastAutoSave || latestAttempt.createdAt
                            } : null
                        },
                        project: config.projectId ? {
                            id: config.projectId._id,
                            name: config.projectId.projectName,
                            category: config.projectId.projectCategory
                        } : null,
                        requirements: {
                            maxAttempts: config.maxAttempts || 3,
                            cooldownHours: config.cooldownHours || 24,
                            prerequisites: hasEnglishQualification ? [] : ['English Proficiency Assessment']
                        },
                        benefits: [
                            'Access to specialized video annotation projects',
                            'Higher pay rates for multimedia tasks',
                            'Priority access to premium projects'
                        ]
                    }
                });
            }
        } catch (multimediaError) {
            console.error('Error fetching multimedia assessment stats:', multimediaError);
        }
        // General Assessment (placeholder)
        assessments.push({
            id: 'general_1',
            title: 'General Annotation Skills',
            description: 'Basic assessment covering general annotation guidelines and best practices.',
            type: 'general',
            numberOfTasks: 8,
            estimatedDuration: 25,
            timeLimit: 35,
            passingScore: 6.5,
            difficulty: 'Beginner',
            isActive: true,
            userStatus: 'not_started',
            _internal: {
                userProgress: {
                    hasAttempted: false,
                    totalAttempts: 0,
                    isPassed: false,
                    canRetake: true,
                    status: 'not_started'
                },
                requirements: { prerequisites: [] },
                benefits: [
                    'Basic annotation qualification',
                    'Foundation for advanced assessments',
                    'General project access'
                ]
            }
        });
        // Sort assessments by priority
        assessments.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'english_proficiency' ? -1 : 1;
            if (a.userStatus !== b.userStatus) {
                const statusPriority = { 'not_started': 0, 'in_progress': 1, 'attempted': 2, 'completed': 3 };
                return (statusPriority[a.userStatus] || 4) - (statusPriority[b.userStatus] || 4);
            }
            const aDate = new Date(a.lastAttempt?.completedAt || a._internal?.createdAt || Date.now());
            const bDate = new Date(b.lastAttempt?.completedAt || b._internal?.createdAt || Date.now());
            return bDate.getTime() - aDate.getTime();
        });
        // Calculate user statistics
        const userStats = {
            totalAssessments: assessments.length,
            completedAssessments: assessments.filter(a => a.userStatus === 'completed').length,
            inProgressAssessments: assessments.filter(a => a.userStatus === 'in_progress').length,
            notStartedAssessments: assessments.filter(a => a.userStatus === 'not_started').length,
            qualificationLevel: {
                hasEnglishQualification: assessments.find(a => a.id === 'english_proficiency')?.userStatus === 'completed' || false,
                multimediaQualifications: assessments.filter(a => a.type === 'multimedia' && a.userStatus === 'completed').length,
                overallLevel: (() => {
                    const englishCompleted = assessments.find(a => a.id === 'english_proficiency')?.userStatus === 'completed';
                    const multimediaCompleted = assessments.filter(a => a.type === 'multimedia' && a.userStatus === 'completed').length;
                    if (!englishCompleted) return 'beginner';
                    if (multimediaCompleted === 0) return 'intermediate';
                    if (multimediaCompleted < 2) return 'advanced';
                    return 'expert';
                })()
            }
        };
        return {
            assessments,
            userStatistics: userStats,
            recommendations: {
                nextAction: userStats.qualificationLevel.hasEnglishQualification ? 'Consider taking multimedia assessments to access specialized projects' : 'Start with the English Proficiency Assessment to qualify as an annotator',
                suggestedAssessment: assessments.find(a => a.userStatus === 'not_started' && (!a._internal?.requirements?.prerequisites || a._internal.requirements.prerequisites.length === 0))?.id || null
            }
        };
    }

    async startAssessmentById(userId, assessmentId) {
        if (!userId) throw new ValidationError('User authentication required');
        if (assessmentId === 'english-proficiency') {
            const latestAttempt = await Assessment.findOne({ userId, assessmentType: 'annotator_qualification' }).sort({ createdAt: -1 });
            if (latestAttempt) {
                const cooldownEnd = new Date(latestAttempt.createdAt.getTime() + 24 * 60 * 60 * 1000);
                if (new Date() < cooldownEnd) {
                    return { cooldownActive: true, nextRetakeAvailable: cooldownEnd, hoursRemaining: Math.ceil((cooldownEnd - new Date()) / (60 * 60 * 1000)) };
                }
            }
            return { questions: await this.getQuestions(5) };
        }
        // Multimedia Assessment
        const MultimediaAssessmentConfig = (await import('../models/multimediaAssessmentConfig.model.js')).default;
        const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId);
        if (!assessmentConfig || !assessmentConfig.isActive) throw new NotFoundError('Assessment not found or not available');
        const user = await DTUser.findById(userId);
        if (!user) throw new NotFoundError('User not found');
        if (user.multimediaAssessmentLastFailedAt) {
            const cooldownEnd = new Date(user.multimediaAssessmentLastFailedAt.getTime() + (assessmentConfig.requirements.retakePolicy.cooldownHours * 60 * 60 * 1000));
            if (new Date() < cooldownEnd) {
                return { cooldownActive: true, nextRetakeAvailable: cooldownEnd, hoursRemaining: Math.ceil((cooldownEnd - new Date()) / (60 * 60 * 1000)) };
            }
        }
        // Unlimited retakes enabled
        return { startSession: true, assessmentId };
    }
}

export default new AssessmentService();
