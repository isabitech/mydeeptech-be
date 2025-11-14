const Assessment = require('../models/assessment.model');
const AssessmentQuestion = require('../models/assessmentQuestion.model');
const DTUser = require('../models/dtUser.model');
const NotificationService = require('../utils/notificationService');
const Joi = require('joi');
const mongoose = require('mongoose');

// Validation schema for submitting assessment (updated for section-based structure)
const submitAssessmentSchema = Joi.object({
  assessmentType: Joi.string().valid('annotator_qualification', 'skill_assessment', 'project_specific').default('annotator_qualification'),
  startedAt: Joi.date().required(),
  completedAt: Joi.date().min(Joi.ref('startedAt')).required(),
  answers: Joi.array().items(
    Joi.object({
      questionId: Joi.number().required(),
      section: Joi.string().valid('Comprehension', 'Vocabulary', 'Grammar', 'Writing').required(),
      userAnswer: Joi.string().required(),
      question: Joi.string().required(),
      options: Joi.array().items(Joi.string())
    })
  ).min(20).max(20).required(), // Exactly 20 questions (5 per section)
  passingScore: Joi.number().min(0).max(100).default(60)
});

// Validation schema for getting assessments
const getAssessmentsSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(50).default(10),
  assessmentType: Joi.string().valid('annotator_qualification', 'skill_assessment', 'project_specific').optional(),
  passed: Joi.boolean().optional(),
  userId: Joi.string().optional() // For admin use
});

/**
 * Submit assessment and update user status automatically
 * POST /api/assessments/submit
 */
const submitAssessment = async (req, res) => {
  try {
    const userId = req.user?.userId || req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    // Validate request body
    const { error, value } = submitAssessmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map(detail => detail.message)
      });
    }

    const { 
      assessmentType, 
      startedAt, 
      completedAt, 
      answers,
      passingScore 
    } = value;

    console.log(`📝 User ${userId} submitting ${assessmentType} assessment with ${answers.length} questions`);

    // Get user's current status
    const user = await DTUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if user can retake assessment (24-hour cooldown)
    const canRetake = await Assessment.canUserRetake(userId, assessmentType, 24);
    if (!canRetake) {
      return res.status(400).json({
        success: false,
        message: "You must wait 24 hours before retaking the assessment"
      });
    }

    // Store status before assessment
    const statusBeforeAssessment = {
      annotatorStatus: user.annotatorStatus,
      microTaskerStatus: user.microTaskerStatus
    };

    // Check for previous attempts
    const previousAttempts = await Assessment.find({
      userId: userId,
      assessmentType: assessmentType
    }).select('createdAt scorePercentage passed').sort({ createdAt: -1 });

    const attemptNumber = previousAttempts.length + 1;

    // Get correct answers from database and calculate score
    let correctAnswers = 0;
    const totalQuestions = answers.length;
    const processedQuestions = [];

    // Validate answers against database
    for (const userAnswer of answers) {
      // Get the correct answer from database
      const dbQuestion = await AssessmentQuestion.findOne({ 
        id: userAnswer.questionId,
        isActive: true 
      });

      if (!dbQuestion) {
        return res.status(400).json({
          success: false,
          message: `Question with ID ${userAnswer.questionId} not found`
        });
      }

      // Validate the section matches
      if (dbQuestion.section !== userAnswer.section) {
        return res.status(400).json({
          success: false,
          message: `Section mismatch for question ${userAnswer.questionId}`
        });
      }

      // Check if answer is correct (case-insensitive comparison)
      const userAnswerNormalized = userAnswer.userAnswer.trim().toLowerCase();
      const correctAnswerNormalized = dbQuestion.answer.trim().toLowerCase();
      const isCorrect = userAnswerNormalized === correctAnswerNormalized;

      if (isCorrect) {
        correctAnswers += dbQuestion.points;
      }

      // Store processed question data
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

    // Calculate score percentage
    const scorePercentage = Math.round((correctAnswers / totalQuestions) * 100);
    const passed = scorePercentage >= passingScore;

    console.log(`📊 Assessment Results: ${correctAnswers}/${totalQuestions} correct (${scorePercentage}%) - ${passed ? 'PASSED' : 'FAILED'}`);

    // Calculate section-wise performance
    const sectionPerformance = {};
    const sections = ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'];
    
    sections.forEach(section => {
      const sectionQuestions = processedQuestions.filter(q => q.section === section);
      const sectionCorrect = sectionQuestions.filter(q => q.isCorrect).length;
      const sectionTotal = sectionQuestions.length;
      const sectionScore = sectionTotal > 0 ? Math.round((sectionCorrect / sectionTotal) * 100) : 0;
      
      sectionPerformance[section] = {
        correct: sectionCorrect,
        total: sectionTotal,
        percentage: sectionScore
      };
    });

    // Determine new user status based on assessment result
    let newAnnotatorStatus = user.annotatorStatus;
    let newMicroTaskerStatus = user.microTaskerStatus;

    if (assessmentType === 'annotator_qualification') {
      if (passed) {
        // Passed assessment - approve as annotator
        newAnnotatorStatus = 'approved';
        // Keep micro tasker status as is or approve if pending
        if (user.microTaskerStatus === 'pending') {
          newMicroTaskerStatus = 'approved';
        }
      } else {
        // Failed assessment - reject as annotator, approve as micro tasker
        newAnnotatorStatus = 'rejected';
        newMicroTaskerStatus = 'approved';
      }
    }

    // Calculate time spent in minutes
    const startTime = new Date(startedAt);
    const endTime = new Date(completedAt);
    const timeSpentMinutes = Math.round((endTime - startTime) / (1000 * 60)); // Convert milliseconds to minutes

    // Create assessment record
    const assessmentData = {
      userId: userId,
      assessmentType,
      totalQuestions,
      correctAnswers,
      scorePercentage,
      passed,
      passingScore,
      startedAt: new Date(startedAt),
      completedAt: new Date(completedAt),
      timeSpentMinutes: timeSpentMinutes,
      questions: processedQuestions,
      statusBeforeAssessment,
      statusAfterAssessment: {
        annotatorStatus: newAnnotatorStatus,
        microTaskerStatus: newMicroTaskerStatus
      },
      category: 'section_based_assessment',
      difficulty: 'intermediate',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      attemptNumber,
      isRetake: attemptNumber > 1,
      previousAttempts: previousAttempts.map(attempt => ({
        attemptDate: attempt.createdAt,
        scorePercentage: attempt.scorePercentage,
        passed: attempt.passed
      }))
    };

    const assessment = new Assessment(assessmentData);
    await assessment.save();

    // Update user status
    const statusChanged = 
      user.annotatorStatus !== newAnnotatorStatus || 
      user.microTaskerStatus !== newMicroTaskerStatus;

    if (statusChanged) {
      user.annotatorStatus = newAnnotatorStatus;
      user.microTaskerStatus = newMicroTaskerStatus;
      await user.save();

      console.log(`✅ User status updated: annotator: ${user.annotatorStatus}, microTasker: ${user.microTaskerStatus}`);

      // Create notification for status change
      try {
        if (passed && newAnnotatorStatus === 'approved') {
          await NotificationService.createNotification({
            recipientId: userId,
            recipientType: 'user',
            title: '🎉 Assessment Passed - Annotator Approved!',
            message: `Congratulations! You scored ${scorePercentage}% on your assessment and are now an approved annotator. You can start applying to annotation projects.`,
            type: 'account_update',
            priority: 'high',
            actionUrl: '/projects/browse',
            actionText: 'Browse Projects',
            relatedData: {
              assessmentId: assessment._id,
              score: scorePercentage,
              sectionPerformance
            }
          });
        } else if (!passed && newAnnotatorStatus === 'rejected' && newMicroTaskerStatus === 'approved') {
          await NotificationService.createNotification({
            recipientId: userId,
            recipientType: 'user',
            title: '📋 Assessment Complete - Micro Tasker Approved',
            message: `You scored ${scorePercentage}% on your assessment. While you didn't qualify as an annotator, you're now approved as a micro tasker and can access survey opportunities.`,
            type: 'account_update',
            priority: 'medium',
            actionUrl: '/surveys/browse',
            actionText: 'Browse Surveys',
            relatedData: {
              assessmentId: assessment._id,
              score: scorePercentage,
              sectionPerformance
            }
          });
        }
      } catch (notificationError) {
        console.error('⚠️ Failed to create status change notification:', notificationError);
      }

      // Send appropriate email notification based on the existing email logic
      try {
        if (passed && newAnnotatorStatus === 'approved') {
          const { sendAnnotatorApprovalEmail } = require('../utils/annotatorMailer');
          await sendAnnotatorApprovalEmail(user.email, user.fullName);
        } else if (!passed && newMicroTaskerStatus === 'approved') {
          const { sendAnnotatorRejectionEmail } = require('../utils/annotatorMailer');
          await sendAnnotatorRejectionEmail(user.email, user.fullName);
        }
        console.log(`✅ Email notification sent to user: ${user.email}`);
      } catch (emailError) {
        console.error('⚠️ Failed to send email notification:', emailError);
      }
    }

    // Prepare response
    const response = {
      success: true,
      message: `Assessment completed successfully. You ${passed ? 'PASSED' : 'FAILED'} with ${scorePercentage}%`,
      data: {
        assessmentId: assessment._id,
        results: {
          totalQuestions,
          correctAnswers,
          scorePercentage,
          passed,
          grade: assessment.getGrade(),
          timeSpent: assessment.timeSpentFormatted,
          sectionPerformance
        },
        statusChanges: {
          statusChanged,
          before: statusBeforeAssessment,
          after: {
            annotatorStatus: newAnnotatorStatus,
            microTaskerStatus: newMicroTaskerStatus
          }
        },
        attemptInfo: {
          attemptNumber,
          isRetake: attemptNumber > 1,
          previousBestScore: previousAttempts.length > 0 ? Math.max(...previousAttempts.map(a => a.scorePercentage)) : null
        }
      }
    };

    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Error submitting assessment:', error);
    res.status(500).json({
      success: false,
      message: "Failed to submit assessment",
      error: error.message
    });
  }
};

/**
 * Get user's assessment history
 * GET /api/assessments/history
 */
const getUserAssessmentHistory = async (req, res) => {
  try {
    const userId = req.user?.userId || req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    // Validate query parameters
    const { error, value } = getAssessmentsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map(detail => detail.message)
      });
    }

    const { page, limit, assessmentType, passed } = value;

    // Build filter
    const filter = { userId };
    if (assessmentType) filter.assessmentType = assessmentType;
    if (passed !== undefined) filter.passed = passed;

    // Get assessments with pagination
    const assessments = await Assessment.find(filter)
      .select('-questions.correctAnswer -ipAddress -userAgent') // Hide sensitive data
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const totalCount = await Assessment.countDocuments(filter);

    // Get summary statistics
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

    res.status(200).json({
      success: true,
      message: "Assessment history retrieved successfully",
      data: {
        assessments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        },
        statistics: stats
      }
    });

  } catch (error) {
    console.error('❌ Error fetching assessment history:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assessment history",
      error: error.message
    });
  }
};

/**
 * Check if user can retake assessment
 * GET /api/assessments/retake-eligibility
 */
const checkRetakeEligibility = async (req, res) => {
  try {
    const userId = req.user?.userId || req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { assessmentType = 'annotator_qualification' } = req.query;

    const canRetake = await Assessment.canUserRetake(userId, assessmentType, 24);
    const latestAttempt = await Assessment.getUserLatestAttempt(userId, assessmentType);
    const bestScore = await Assessment.getUserBestScore(userId, assessmentType);

    let nextRetakeTime = null;
    if (!canRetake && latestAttempt) {
      nextRetakeTime = new Date(latestAttempt.createdAt.getTime() + 24 * 60 * 60 * 1000);
    }

    res.status(200).json({
      success: true,
      data: {
        canRetake,
        assessmentType,
        nextRetakeTime,
        latestAttempt: latestAttempt ? {
          date: latestAttempt.createdAt,
          score: latestAttempt.scorePercentage,
          passed: latestAttempt.passed,
          attemptNumber: latestAttempt.attemptNumber
        } : null,
        bestScore: bestScore ? {
          date: bestScore.createdAt,
          score: bestScore.scorePercentage,
          passed: bestScore.passed
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Error checking retake eligibility:', error);
    res.status(500).json({
      success: false,
      message: "Failed to check retake eligibility",
      error: error.message
    });
  }
};

/**
 * Admin: Get all assessments with filtering
 * GET /admin/assessments
 */
const getAdminAssessments = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required"
      });
    }

    // Validate query parameters
    const { error, value } = getAssessmentsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map(detail => detail.message)
      });
    }

    const { page, limit, assessmentType, passed, userId } = value;

    // Build filter
    const filter = {};
    if (assessmentType) filter.assessmentType = assessmentType;
    if (passed !== undefined) filter.passed = passed;
    if (userId) filter.userId = userId;

    // Get assessments with user details
    const assessments = await Assessment.find(filter)
      .populate('userId', 'fullName email annotatorStatus microTaskerStatus')
      .select('-questions.correctAnswer -ipAddress -userAgent') // Hide sensitive data
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const totalCount = await Assessment.countDocuments(filter);

    // Get overall statistics
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

    res.status(200).json({
      success: true,
      message: "Admin assessments retrieved successfully",
      data: {
        assessments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        },
        statistics: overallStats[0] || {
          totalAssessments: 0,
          passedAssessments: 0,
          averageScore: 0,
          uniqueUserCount: 0,
          passRate: 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching admin assessments:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assessments",
      error: error.message
    });
  }
};

/**
 * Get randomized assessment questions (5 per section = 20 total)
 * GET /api/assessments/questions
 */
const getAssessmentQuestions = async (req, res) => {
  try {
    const userId = req.user?.userId || req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { questionsPerSection = 5 } = req.query;
    const sections = ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'];
    
    console.log(`📝 Getting ${questionsPerSection} questions per section for user ${userId}`);

    // Get random questions from each section
    const allQuestions = [];
    
    for (const section of sections) {
      const sectionQuestions = await AssessmentQuestion.aggregate([
        { $match: { section: section, isActive: true } },
        { $sample: { size: parseInt(questionsPerSection) } },
        { 
          $project: { 
            id: 1,
            section: 1,
            question: 1,
            options: 1,
            points: 1,
            _id: 0
          }
        }
      ]);

      // Randomize options order for each question
      const randomizedQuestions = sectionQuestions.map(q => ({
        ...q,
        options: [...q.options].sort(() => Math.random() - 0.5) // Randomize option order
      }));

      allQuestions.push(...randomizedQuestions);
    }

    // Shuffle the final question order so sections are mixed
    const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);

    console.log(`📝 Sent ${shuffledQuestions.length} questions across ${sections.length} sections`);

    res.status(200).json({
      success: true,
      message: "Assessment questions retrieved successfully",
      data: {
        questions: shuffledQuestions,
        assessmentInfo: {
          totalQuestions: shuffledQuestions.length,
          questionsPerSection: parseInt(questionsPerSection),
          sections: sections,
          passingScore: 60,
          timeLimit: 30, // 30 minutes
          assessmentType: 'annotator_qualification',
          instructions: "This assessment contains questions from 4 sections: Comprehension, Vocabulary, Grammar, and Writing. You have 30 minutes to complete all 20 questions. A passing score is 60%."
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching assessment questions:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assessment questions",
      error: error.message
    });
  }
};

/**
 * Get assessment statistics by section
 * GET /api/assessments/section-stats
 */
const getSectionStatistics = async (req, res) => {
  try {
    const { isAdmin = false } = req.query;
    
    if (isAdmin && !req.admin) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required"
      });
    }

    // Get question counts by section
    const questionStats = await AssessmentQuestion.getQuestionCountBySection();
    
    // Get assessment performance by section
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
      {
        $addFields: {
          successRate: { $multiply: [{ $divide: ['$correctAnswers', '$totalAnswered'] }, 100] }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      message: "Section statistics retrieved successfully",
      data: {
        questionStats: questionStats[0] || { sections: [], totalQuestions: 0 },
        performanceStats
      }
    });

  } catch (error) {
    console.error('❌ Error fetching section statistics:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch section statistics",
      error: error.message
    });
  }
};

module.exports = {
  getAssessmentQuestions,
  submitAssessment,
  getUserAssessmentHistory,
  checkRetakeEligibility,
  getAdminAssessments,
  getSectionStatistics
};