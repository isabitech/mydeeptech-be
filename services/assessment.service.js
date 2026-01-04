import Assessment from '../models/assessment.model.js';
import AssessmentQuestion from '../models/assessmentQuestion.model.js';
import DTUser from '../models/dtUser.model.js';
import MultimediaAssessmentConfig from '../models/multimediaAssessmentConfig.model.js';
import * as notificationService from '../utils/notificationService.js';
import { sendAnnotatorApprovalEmail, sendAnnotatorRejectionEmail } from '../utils/annotatorMailer.js';
import { NotFoundError, ValidationError, UnauthorizedError } from '../utils/responseHandler.js';
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
}

export default new AssessmentService();
