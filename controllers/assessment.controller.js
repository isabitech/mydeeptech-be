const Assessment = require('../models/assessment.model');
const AssessmentQuestion = require('../models/assessmentQuestion.model');
const DTUser = require('../models/dtUser.model');
const NotificationService = require('../utils/notificationService');
const Joi = require('joi');
const mongoose = require('mongoose');

// Validation schema for submitting assessment (updated for section-based structure)
const submitAssessmentSchema = Joi.object({
  assessmentType: Joi.string().valid('annotator_qualification', 'skill_assessment', 'project_specific').default('annotator_qualification'),
  // Optional explicit language hint from client
  language: Joi.string().valid('en', 'akan').optional(),
  startedAt: Joi.date().required(),
  completedAt: Joi.date().min(Joi.ref('startedAt')).required(),
  answers: Joi.array().items(
    Joi.object({
      questionId: Joi.number().required(),
      section: Joi.string().valid('Comprehension', 'Vocabulary', 'Grammar', 'Writing', 'Translation', 'Reading').required(),
      userAnswer: Joi.string().required(),
      question: Joi.string().required(),
      options: Joi.array().items(Joi.string())
    })
  ).min(20).max(50).required(), // 20 questions for English, up to 50 for Akan
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
      language: languageHint,
      startedAt, 
      completedAt, 
      answers,
      passingScore 
    } = value;

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

    // Detect language early from answers for filtering previous attempts
    // Prefer explicit language hint if provided by client
    let detectedLanguage = languageHint || null;
    const hasComprehension = answers.some(a => a.section === 'Comprehension');
    const hasTranslation = answers.some(a => a.section === 'Translation');
    const hasReading = answers.some(a => a.section === 'Reading');

    if (!detectedLanguage) {
      if (hasTranslation || hasReading) {
        detectedLanguage = 'akan';
      } else if (hasComprehension) {
        detectedLanguage = 'en';
      } else {
        // Fallback heuristic: lower ID ranges (≤ 50) are typically Akan
        const anyLikelyAkanId = answers.some(a => Number(a.questionId) <= 50);
        detectedLanguage = anyLikelyAkanId ? 'akan' : 'en';
      }
    }

    // Check for previous attempts with language filtering
    const previousAttemptsFilter = {
      userId: userId,
      assessmentType: assessmentType
    };
    
    // Add language filter if detected
    if (detectedLanguage) {
      previousAttemptsFilter.language = detectedLanguage;
    } else {
      // For legacy assessments without language field
      previousAttemptsFilter.$or = [
        { language: { $exists: false } },
        { language: null }
      ];
    }
    
    const previousAttempts = await Assessment.find(previousAttemptsFilter)
      .select('createdAt scorePercentage passed').sort({ createdAt: -1 });

    const attemptNumber = previousAttempts.length + 1;

    // Get correct answers from database and calculate score
    let correctAnswers = 0;
    const totalQuestions = answers.length;
    const processedQuestions = [];

    // Validate answers against database
    for (const userAnswer of answers) {
      // Use detected language to lookup the correct question, preferring exact id+section match
      const isAkan = detectedLanguage === 'akan';

      // First try: id + section + language (or English/no-language)
      const primaryQuery = {
        id: userAnswer.questionId,
        section: userAnswer.section,
        isActive: true,
        ...(isAkan ? { language: 'akan' } : {})
      };
      if (!isAkan) {
        primaryQuery.$or = [
          { language: { $exists: false } },
          { language: null },
          { language: 'en' }
        ];
      }
      let dbQuestion = await AssessmentQuestion.findOne(primaryQuery);

      // Second try: id + language only
      if (!dbQuestion) {
        const languageQuery = {
          id: userAnswer.questionId,
          isActive: true,
          ...(isAkan ? { language: 'akan' } : {})
        };
        if (!isAkan) {
          languageQuery.$or = [
            { language: { $exists: false } },
            { language: null },
            { language: 'en' }
          ];
        }
        dbQuestion = await AssessmentQuestion.findOne(languageQuery);
      }

      // Final fallback: id only
      if (!dbQuestion) {
        dbQuestion = await AssessmentQuestion.findOne({ 
          id: userAnswer.questionId,
          isActive: true 
        });
      }

      if (!dbQuestion) {
        return res.status(400).json({
          success: false,
          message: `Question with ID ${userAnswer.questionId} not found`
        });
      }

      console.log(`🔍 Validating Q${userAnswer.questionId}: expected '${dbQuestion.section}', got '${userAnswer.section}'`);

      // If section differs, trust DB and override instead of failing
      if (dbQuestion.section !== userAnswer.section) {
        console.warn(`Section mismatch for Q${userAnswer.questionId}. Overriding '${userAnswer.section}' -> '${dbQuestion.section}'.`);
        userAnswer.section = dbQuestion.section;
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
      language: detectedLanguage, // Use the already detected language
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

    const { questionsPerSection = 5, language = 'en' } = req.query;
    
    // Define sections based on language
    let sections;
    let actualQuestionsPerSection;
    
    if (language === 'akan') {
      sections = ['Grammar', 'Vocabulary', 'Translation', 'Writing', 'Reading'];
      // For Akan, ensure exactly 5 questions per section for total of 25
      actualQuestionsPerSection = 5;
    } else {
      sections = ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'];
      actualQuestionsPerSection = parseInt(questionsPerSection);
    }
    
    console.log(`🌐 Fetching ${language} assessment questions, ${actualQuestionsPerSection} per section, total expected: ${sections.length * actualQuestionsPerSection}`);
    
    // Get random questions from each section
    const allQuestions = [];
    
    for (const section of sections) {
      // Build query - prioritize language matching for Akan
      let matchQuery = { section: section, isActive: true };
      
      if (language === 'akan') {
        // For Akan, specifically filter by language
        matchQuery.language = 'akan';
      } else {
        // For English, look for questions without language field or language: 'en'
        matchQuery.$or = [
          { language: { $exists: false } },
          { language: 'en' },
          { language: { $eq: null } }
        ];
      }

      const sectionQuestions = await AssessmentQuestion.aggregate([
        { $match: matchQuery },
        { $sample: { size: actualQuestionsPerSection } },
        { 
          $project: { 
            id: 1,
            section: 1,
            question: 1,
            options: 1,
            points: 1,
            language: 1,
            _id: 0
          }
        }
      ]);

      console.log(`📝 Found ${sectionQuestions.length} questions for section: ${section} (${language})`);

      // Randomize options order for each question
      const randomizedQuestions = sectionQuestions.map(q => ({
        ...q,
        options: [...q.options].sort(() => Math.random() - 0.5) // Randomize option order
      }));

      allQuestions.push(...randomizedQuestions);
    }

    // Shuffle the final question order so sections are mixed
    const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);

    // Create language-specific response data
    const totalQuestions = shuffledQuestions.length;
    const timeLimit = language === 'akan' ? 35 : 30; // 35 min for Akan, 30 for English
    const sectionList = language === 'akan' 
      ? 'Grammar, Vocabulary, Translation, Writing, and Reading'
      : 'Comprehension, Vocabulary, Grammar, and Writing';
    
    const instructions = language === 'akan'
      ? `This assessment contains questions from 5 sections: ${sectionList}. You have ${timeLimit} minutes to complete all ${totalQuestions} questions. A passing score is 60%.`
      : `This assessment contains questions from 4 sections: ${sectionList}. You have ${timeLimit} minutes to complete all ${totalQuestions} questions. A passing score is 60%.`;

    console.log(`✅ Returning ${totalQuestions} ${language} questions across ${sections.length} sections`);

    res.status(200).json({
      success: true,
      message: `Assessment questions retrieved successfully (${language})`,
      data: {
        questions: shuffledQuestions,
        assessmentInfo: {
          totalQuestions,
          questionsPerSection: actualQuestionsPerSection,
          sections: sections,
          language: language,
          passingScore: 60,
          timeLimit: timeLimit,
          assessmentType: 'annotator_qualification',
          instructions
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

/**
 * Get all available assessments for users to choose from
 * GET /api/assessments/available
 */
const getAllAssessments = async (req, res) => {
  try {
    const userId = req.user?.userId || req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    console.log(`📋 Getting all available assessments for user: ${userId}`);

    const assessments = [];

    // 1. English Proficiency Assessment (always available)
    const englishAssessment = {
      id: 'english-proficiency',
      type: 'english_proficiency',
      title: 'English Proficiency Assessment',
      description: 'Comprehensive assessment covering grammar, vocabulary, comprehension, and writing skills',
      category: 'language',
      difficulty: 'intermediate',
      estimatedDuration: 30, // minutes
      totalQuestions: 20,
      sections: [
        { name: 'Comprehension', questions: 5 },
        { name: 'Vocabulary', questions: 5 },
        { name: 'Grammar', questions: 5 },
        { name: 'Writing', questions: 5 }
      ],
      passingScore: 60,
      maxAttempts: null, // Unlimited with 24h cooldown
      cooldownHours: 24,
      isActive: true,
      requirements: [
        'Basic English language skills',
        'Stable internet connection',
        'Quiet environment for 30 minutes'
      ],
      instructions: 'This assessment evaluates your English language proficiency across four key areas. You have 30 minutes to complete 20 questions with a minimum score of 60% required to pass.',
      benefits: [
        'Qualify as an Annotator',
        'Access to text-based projects',
        'Higher project application priority'
      ]
    };

    // Check user's latest English assessment attempt
    const latestEnglishAttempt = await Assessment.findOne({
      userId: userId,
      assessmentType: 'annotator_qualification',
      $or: [
        { language: 'en' },
        { language: { $exists: false } },
        { language: null }
      ]
    }).sort({ createdAt: -1 });

    englishAssessment.userStatus = {
      hasAttempted: !!latestEnglishAttempt,
      latestScore: latestEnglishAttempt?.scorePercentage || null,
      passed: latestEnglishAttempt?.passed || false,
      lastAttemptDate: latestEnglishAttempt?.createdAt || null,
      canRetake: true, // Will be validated on attempt
      nextRetakeAvailable: null
    };

    // Add lastAttempt object for frontend compatibility
    if (latestEnglishAttempt) {
      englishAssessment.lastAttempt = {
        id: latestEnglishAttempt._id.toString(),
        score: latestEnglishAttempt.scorePercentage,
        completedAt: latestEnglishAttempt.createdAt,
        status: latestEnglishAttempt.passed ? 'passed' : 'failed',
        canRetake: true
      };
    }

    if (latestEnglishAttempt) {
      const cooldownEnd = new Date(latestEnglishAttempt.createdAt.getTime() + 24 * 60 * 60 * 1000);
      const canRetakeNow = new Date() >= cooldownEnd;
      englishAssessment.userStatus.canRetake = canRetakeNow;
      englishAssessment.userStatus.nextRetakeAvailable = cooldownEnd;
      
      // Update lastAttempt canRetake status
      if (englishAssessment.lastAttempt) {
        englishAssessment.lastAttempt.canRetake = canRetakeNow;
      }
    }

    assessments.push(englishAssessment);

    // 2. Akan (Twi) Proficiency Assessment
    const akanAssessment = {
      id: 'akan-proficiency',
      type: 'akan_proficiency',
      title: 'Akan (Twi) Proficiency Assessment',
      description: 'Comprehensive assessment covering Akan grammar, vocabulary, translation, writing, and reading skills',
      category: 'language',
      difficulty: 'intermediate',
      estimatedDuration: 35, // minutes
      totalQuestions: 25,
      sections: [
        { name: 'Grammar', questions: 8 },
        { name: 'Vocabulary', questions: 7 },
        { name: 'Translation', questions: 5 },
        { name: 'Writing', questions: 3 },
        { name: 'Reading', questions: 2 }
      ],
      passingScore: 60,
      maxAttempts: null, // Unlimited with 24h cooldown
      cooldownHours: 24,
      isActive: true,
      requirements: [
        'Basic Akan (Twi) language skills',
        'Stable internet connection',
        'Quiet environment for 35 minutes'
      ],
      instructions: 'This assessment evaluates your Akan (Twi) language proficiency across five key areas: Grammar, Vocabulary, Translation, Writing, and Reading. You have 35 minutes to complete 50 questions with a minimum score of 60% required to pass.',
      benefits: [
        'Qualify as Akan Language Annotator',
        'Access to Akan language projects',
        'Specialized language project priority'
      ]
    };

    // Check user's latest Akan assessment attempt
    const latestAkanAttempt = await Assessment.findOne({
      userId: userId,
      assessmentType: 'annotator_qualification',
      language: 'akan'
    }).sort({ createdAt: -1 });

    akanAssessment.userStatus = {
      hasAttempted: !!latestAkanAttempt,
      latestScore: latestAkanAttempt?.scorePercentage || null,
      passed: latestAkanAttempt?.passed || false,
      lastAttemptDate: latestAkanAttempt?.createdAt || null,
      canRetake: true, // Will be validated on attempt
      nextRetakeAvailable: null
    };

    // Add lastAttempt object for frontend compatibility
    if (latestAkanAttempt) {
      akanAssessment.lastAttempt = {
        id: latestAkanAttempt._id.toString(),
        score: latestAkanAttempt.scorePercentage,
        completedAt: latestAkanAttempt.createdAt,
        status: latestAkanAttempt.passed ? 'passed' : 'failed',
        canRetake: true
      };
    }

    if (latestAkanAttempt) {
      const cooldownEnd = new Date(latestAkanAttempt.createdAt.getTime() + 24 * 60 * 60 * 1000);
      const canRetakeNow = new Date() >= cooldownEnd;
      akanAssessment.userStatus.canRetake = canRetakeNow;
      akanAssessment.userStatus.nextRetakeAvailable = cooldownEnd;
      
      // Update lastAttempt canRetake status
      if (akanAssessment.lastAttempt) {
        akanAssessment.lastAttempt.canRetake = canRetakeNow;
      }
    }

    // assessments.push(akanAssessment);

    // 3. Multimedia Assessments (project-specific)
    try {
      const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
      
      const multimediaAssessments = await MultimediaAssessmentConfig.find({ 
        isActive: true 
      })
      .populate('projectId', 'projectName projectCategory projectDescription')
      .select('title description requirements scoring videoReels projectId createdAt');

      for (const config of multimediaAssessments) {
        const multimediaAssessment = {
          id: config._id.toString(),
          type: 'multimedia_assessment',
          title: config.title,
          description: config.description,
          category: 'multimedia',
          difficulty: 'advanced',
          estimatedDuration: config.requirements?.timeLimit || 60,
          totalTasks: config.requirements?.tasksPerAssessment || 5,
          passingScore: config.scoring?.passingScore || 70,
          maxAttempts: config.requirements?.retakePolicy?.maxAttempts || 3,
          cooldownHours: config.requirements?.retakePolicy?.cooldownHours || 24,
          isActive: true,
          projectInfo: {
            id: config.projectId?._id,
            name: config.projectId?.projectName,
            category: config.projectId?.projectCategory,
            description: config.projectId?.projectDescription
          },
          requirements: [
            'Video annotation experience',
            'Strong attention to detail',
            'Reliable internet connection',
            'Modern web browser with video support'
          ],
          instructions: config.instructions || 'Complete multimedia annotation tasks to demonstrate your skills in video analysis and content categorization.',
          benefits: [
            'Access to multimedia projects',
            'Higher compensation rates',
            'Advanced project opportunities'
          ],
          videoReels: {
            totalAvailable: config.videoReels?.totalAvailable || 0,
            categories: Object.keys(config.videoReels?.reelsPerNiche || {})
              .filter(key => config.videoReels.reelsPerNiche[key] > 0)
          }
        };

        // Check user's multimedia assessment status
        const DTUser = require('../models/dtUser.model');
        const user = await DTUser.findById(userId).select('multimediaAssessmentStatus multimediaAssessmentAttempts multimediaAssessmentLastAttempt multimediaAssessmentLastFailedAt');
        
        multimediaAssessment.userStatus = {
          hasAttempted: (user?.multimediaAssessmentAttempts || 0) > 0,
          status: user?.multimediaAssessmentStatus || 'not_started',
          attempts: user?.multimediaAssessmentAttempts || 0,
          lastAttemptDate: user?.multimediaAssessmentLastAttempt || null,
          canRetake: true, // Will be validated on attempt
          nextRetakeAvailable: null
        };

        // Check cooldown for multimedia assessment
        if (user?.multimediaAssessmentLastFailedAt) {
          const cooldownEnd = new Date(user.multimediaAssessmentLastFailedAt.getTime() + (multimediaAssessment.cooldownHours * 60 * 60 * 1000));
          multimediaAssessment.userStatus.canRetake = new Date() >= cooldownEnd;
          multimediaAssessment.userStatus.nextRetakeAvailable = cooldownEnd;
        }

        // assessments.push(multimediaAssessment);
      }
    } catch (multimediaError) {
      console.error('⚠️ Error fetching multimedia assessments:', multimediaError);
      // Continue without multimedia assessments - don't break the entire response
    }

    // 3. Spidey High-Discipline Assessment (integrates with existing system)
    try {
      const SpideyAssessmentConfig = require('../models/spideyAssessmentConfig.model');
      
      const spideyConfigs = await SpideyAssessmentConfig.find({
        isActive: true,
        assessmentType: 'spidey_assessment'
      }).populate('projectId', 'title description projectType');

      for (const config of spideyConfigs) {
        const spideyAssessment = {
          id: config._id.toString(),
          type: 'spidey_assessment',
          title: config.title,
          description: config.description,
          category: 'quality_enforcement',
          difficulty: 'expert',
          estimatedDuration: 165, // Sum of all stage time limits
          totalStages: 4,
          stageLimits: {
            stage1: config.stages.stage1.timeLimit,
            stage2: config.stages.stage2.timeLimit,
            stage3: config.stages.stage3.timeLimit,
            stage4: config.stages.stage4.timeLimit
          },
          passingScore: config.scoring.passingScore,
          maxAttempts: config.retakePolicy.maxAttempts,
          cooldownDays: config.retakePolicy.cooldownDays,
          isActive: true,
          projectInfo: {
            id: config.projectId?._id,
            name: config.projectId?.title || 'Prompt Instantiation Project',
            type: config.projectId?.projectType || 'assessment'
          },
          requirements: [
            '⚠️ HIGH-DISCIPLINE ASSESSMENT',
            'Passing score: 85% minimum',
            'Zero tolerance for rule violations',
            'Server authority - no frontend scoring',
            'One attempt only - no retakes',
            'Mandatory QA review for all submissions'
          ],
          instructions: 'This is a quality enforcement engine designed to protect partner accounts. Any rule violation results in immediate failure. The assessment uses a 4-stage state machine with hard rules and integrity testing.',
          benefits: [
            'Access to highest-tier projects',
            'Premium compensation rates',
            'Quality assurance reviewer privileges',
            'Partner account protection certification'
          ],
          stages: [
            { 
              name: 'Guideline Comprehension', 
              timeLimit: config.stages.stage1.timeLimit,
              description: 'Quiz with auto-fail on critical mistakes'
            },
            { 
              name: 'Mini Task Validation', 
              timeLimit: config.stages.stage2.timeLimit,
              description: 'Automated validation with forbidden keyword detection'
            },
            { 
              name: 'Golden Solution & Rubric', 
              timeLimit: config.stages.stage3.timeLimit,
              description: 'File validation and rubric quality assessment'
            },
            { 
              name: 'Integrity Trap', 
              timeLimit: config.stages.stage4.timeLimit,
              description: 'Blind compliance detection and violation flagging'
            }
          ],
          warnings: [
            '🚫 Forbidden keywords = immediate fail',
            '🚫 Missing file references = immediate fail',
            '🚫 Blind compliance = immediate fail',
            '🚫 Rule violations = immediate fail',
            '⚡ Server has final authority on all decisions'
          ]
        };

        // Check user's Spidey assessment status
        const DTUser = require('../models/dtUser.model');
        const user = await DTUser.findById(userId).select('spideyAssessmentStatus');
        
        // Check for existing submissions
        const SpideyAssessmentSubmission = require('../models/spideyAssessmentSubmission.model');
        const latestSubmission = await SpideyAssessmentSubmission.findOne({
          annotatorId: userId,
          assessmentId: config._id
        }).sort({ createdAt: -1 });

        spideyAssessment.userStatus = {
          hasAttempted: !!latestSubmission,
          status: user?.spideyAssessmentStatus || 'not_started',
          currentStage: latestSubmission?.currentStage || null,
          lastAttemptDate: latestSubmission?.createdAt || null,
          finalScore: latestSubmission?.finalScore || null,
          canRetake: false, // Spidey allows no retakes by default
          nextRetakeAvailable: null,
          submissionStatus: latestSubmission?.status || null
        };

        // Override retake based on strict policy (Spidey typically allows no retakes)
        if (latestSubmission && (latestSubmission.status === 'failed' || latestSubmission.status === 'rejected')) {
          spideyAssessment.userStatus.canRetake = false;
          spideyAssessment.userStatus.nextRetakeAvailable = 'No retakes allowed for Spidey assessment';
        }

        // assessments.push(spideyAssessment);
      }
    } catch (spideyError) {
      console.error('⚠️ Error fetching Spidey assessments:', spideyError);
      // Continue without Spidey assessments - don't break the entire response
    }

    // Sort assessments by type and difficulty
    assessments.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'english_proficiency' ? -1 : 1; // English first
      }
      return a.difficulty.localeCompare(b.difficulty);
    });

    res.status(200).json({
      success: true,
      message: `Found ${assessments.length} available assessments`,
      data: {
        assessments,
        summary: {
          totalAssessments: assessments.length,
          englishProficiency: assessments.filter(a => a.type === 'english_proficiency').length,
          multimediaAssessments: assessments.filter(a => a.type === 'multimedia_assessment').length,
          spideyAssessments: assessments.filter(a => a.type === 'spidey_assessment').length,
          userCanTake: assessments.filter(a => a.userStatus.canRetake).length
        },
        instructions: {
          english: 'Start with the English Proficiency Assessment to qualify as an annotator',
          multimedia: 'Complete multimedia assessments to access specialized video annotation projects',
          spidey: '⚠️ Spidey is a high-discipline assessment with zero tolerance for violations - ONE ATTEMPT ONLY',
          general: 'Each assessment has specific requirements and cooldown periods between attempts'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching available assessments:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available assessments",
      error: error.message
    });
  }
};

/**
 * Start an assessment by ID (English or Multimedia)
 * POST /api/assessments/start/:assessmentId
 */
const startAssessmentById = async (req, res) => {
  try {
    const userId = req.user?.userId || req.userId;
    const { assessmentId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    // Handle English Proficiency Assessment
    if (assessmentId === 'english-proficiency') {
      // Check retake eligibility
      const latestAttempt = await Assessment.findOne({
        userId: userId,
        assessmentType: 'annotator_qualification',
        $or: [
          { language: 'en' },
          { language: { $exists: false } },
          { language: null }
        ]
      }).sort({ createdAt: -1 });

      if (latestAttempt) {
        const cooldownEnd = new Date(latestAttempt.createdAt.getTime() + 24 * 60 * 60 * 1000);
        if (new Date() < cooldownEnd) {
          return res.status(400).json({
            success: false,
            message: "Assessment cooldown active. Please wait before retaking.",
            data: {
              nextRetakeAvailable: cooldownEnd,
              hoursRemaining: Math.ceil((cooldownEnd - new Date()) / (60 * 60 * 1000))
            }
          });
        }
      }

      // Get English assessment questions
      return getAssessmentQuestions(req, res);
    }

    // Handle Akan Proficiency Assessment
    if (assessmentId === 'akan-proficiency') {
      // Check retake eligibility for Akan assessment
      const latestAkanAttempt = await Assessment.findOne({
        userId: userId,
        assessmentType: 'annotator_qualification',
        language: 'akan'
      }).sort({ createdAt: -1 });

      if (latestAkanAttempt) {
        const cooldownEnd = new Date(latestAkanAttempt.createdAt.getTime() + 24 * 60 * 60 * 1000);
        if (new Date() < cooldownEnd) {
          return res.status(400).json({
            success: false,
            message: "Assessment cooldown active. Please wait before retaking.",
            data: {
              nextRetakeAvailable: cooldownEnd,
              hoursRemaining: Math.ceil((cooldownEnd - new Date()) / (60 * 60 * 1000))
            }
          });
        }
      }

      // Get Akan assessment questions
      req.query.language = 'akan';
      req.query.questionsPerSection = 5; // 25 total questions / 5 sections = 5 per section
      return getAssessmentQuestions(req, res);
    }

    // Handle Multimedia Assessment
    try {
      const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
      const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId);
      
      if (!assessmentConfig || !assessmentConfig.isActive) {
        return res.status(404).json({
          success: false,
          message: "Assessment not found or not available"
        });
      }

      // Check user eligibility for multimedia assessment
      const DTUser = require('../models/dtUser.model');
      const user = await DTUser.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Check cooldown
      if (user.multimediaAssessmentLastFailedAt) {
        const cooldownEnd = new Date(user.multimediaAssessmentLastFailedAt.getTime() + (assessmentConfig.requirements.retakePolicy.cooldownHours * 60 * 60 * 1000));
        if (new Date() < cooldownEnd) {
          return res.status(400).json({
            success: false,
            message: "Assessment cooldown active. Please wait before retaking.",
            data: {
              nextRetakeAvailable: cooldownEnd,
              hoursRemaining: Math.ceil((cooldownEnd - new Date()) / (60 * 60 * 1000))
            }
          });
        }
      }

      // Check attempt limits - DISABLED to allow unlimited retakes
      // const attemptCount = user.multimediaAssessmentAttempts || 0;
      // if (attemptCount >= assessmentConfig.requirements.retakePolicy.maxAttempts) {
      //   return res.status(400).json({
      //     success: false,
      //     message: `Maximum attempts (${assessmentConfig.requirements.retakePolicy.maxAttempts}) reached for this assessment`
      //   });
      // }

      // Use existing multimedia assessment session controller
      const { startAssessmentSession } = require('./multimediaAssessmentSession.controller');
      req.body = { assessmentId: assessmentId };
      return startAssessmentSession(req, res);

    } catch (multimediaError) {
      console.error('❌ Error starting multimedia assessment:', multimediaError);
      return res.status(500).json({
        success: false,
        message: "Failed to start multimedia assessment",
        error: multimediaError.message
      });
    }

  } catch (error) {
    console.error('❌ Error starting assessment:', error);
    res.status(500).json({
      success: false,
      message: "Failed to start assessment",
      error: error.message
    });
  }
};

/**
 * Get assessment submissions by assessment ID
 * GET /api/assessments/:assessmentId/submissions
 * Supports both English proficiency and multimedia assessments
 */
const getAssessmentSubmissions = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { page = 1, limit = 10, status, userId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Validate user has permission (admin or the user themselves for their submissions)
    const requestingUserId = req.user?.userId || req.userId;
    const isAdmin = req.admin;
    
    if (!isAdmin && userId && userId !== requestingUserId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own submissions unless you are an admin."
      });
    }

    let submissions = [];
    let totalCount = 0;
    let assessmentInfo = {};

    // Handle English Proficiency Assessment
    if (assessmentId === 'english-proficiency') {
      // Build filter for English proficiency
      const filter = { assessmentType: 'annotator_qualification' };
      if (status !== undefined) {
        filter.passed = status === 'passed' ? true : status === 'failed' ? false : { $exists: true };
      }
      if (userId) filter.userId = userId;
      if (!isAdmin && !userId) filter.userId = requestingUserId; // Non-admin users see only their own

      // Get English proficiency submissions
      const assessments = await Assessment.find(filter)
        .populate('userId', 'fullName email annotatorStatus microTaskerStatus qaStatus')
        .select('-questions.correctAnswer -ipAddress -userAgent') // Hide sensitive data
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
      // Handle Multimedia Assessment
      try {
        const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');
        const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');

        // Verify the assessment exists
        const assessmentConfig = await MultimediaAssessmentConfig.findById(assessmentId);
        if (!assessmentConfig) {
          return res.status(404).json({
            success: false,
            message: "Multimedia assessment not found"
          });
        }

        // Build filter for multimedia submissions
        const filter = { assessmentId };
        if (status) filter.status = status;
        if (userId) filter.annotatorId = userId;
        if (!isAdmin && !userId) filter.annotatorId = requestingUserId; // Non-admin users see only their own

        // Get multimedia submissions
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

      } catch (multimediaError) {
        console.error('❌ Error fetching multimedia submissions:', multimediaError);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch multimedia assessment submissions",
          error: multimediaError.message
        });
      }
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

    // Remove helper field
    delete statistics.processedCount;

    res.status(200).json({
      success: true,
      message: `Assessment submissions retrieved successfully`,
      data: {
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
        filters: {
          assessmentId,
          status: status || 'all',
          userId: userId || (isAdmin ? 'all' : 'own'),
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching assessment submissions:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assessment submissions",
      error: error.message
    });
  }
};

/**
 * Admin: Get all assessment types with aggregate statistics
 * GET /admin/assessments/overview
 */
const getAdminAssessmentsOverview = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required"
      });
    }

    const assessments = [];

    // 1. English Proficiency Assessment Statistics
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

      // Calculate completion rate
      const completionRate = englishData.totalSubmissions > 0 
        ? (englishData.approvedSubmissions / englishData.totalSubmissions * 100) 
        : 0;

      assessments.push({
        id: 'english_proficiency',
        title: 'English Proficiency Assessment',
        description: 'Evaluate English language skills including grammar, vocabulary, and comprehension.',
        type: 'english_proficiency',
        totalSubmissions: englishData.totalSubmissions,
        pendingReview: 0, // English assessments are auto-graded
        approvedSubmissions: englishData.approvedSubmissions,
        rejectedSubmissions: englishData.rejectedSubmissions,
        averageScore: Math.round(englishData.averageScore * 10) / 10 || 0,
        passingScore: 60, // Default passing score for English assessments
        completionRate: Math.round(completionRate * 10) / 10,
        averageCompletionTime: englishData.averageCompletionTime * 1000 || 1800000, // Convert to milliseconds, default 30 min
        createdAt: englishData.firstSubmissionAt || new Date('2023-12-01T08:00:00Z'),
        isActive: true,
        lastSubmissionAt: englishData.lastSubmissionAt || null
      });
    } catch (englishError) {
      console.error('Error fetching English assessment stats:', englishError);
      // Add default English assessment entry
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

    // 2. Multimedia Assessment Statistics
    try {
      const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
      const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');

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

        const completionRate = submissionData.totalSubmissions > 0 
          ? ((submissionData.passed + submissionData.failed) / submissionData.totalSubmissions * 100) 
          : 0;

        // assessments.push({
        //   id: config._id.toString(),
        //   title: config.title,
        //   description: config.description,
        //   type: 'multimedia',
        //   totalSubmissions: submissionData.totalSubmissions,
        //   pendingReview: submissionData.pendingReview + submissionData.inProgress,
        //   approvedSubmissions: submissionData.passed,
        //   rejectedSubmissions: submissionData.failed,
        //   averageScore: Math.round((submissionData.averageScore || 0) * 10) / 10,
        //   passingScore: config.scoring?.passingScore || 70,
        //   completionRate: Math.round(completionRate * 10) / 10,
        //   averageCompletionTime: (submissionData.averageCompletionTime * 1000) || (config.requirements?.timeLimit * 60 * 1000) || 3600000,
        //   createdAt: config.createdAt,
        //   isActive: config.isActive,
        //   lastSubmissionAt: submissionData.lastSubmissionAt,
        //   projectInfo: config.projectId ? {
        //     id: config.projectId._id,
        //     name: config.projectId.projectName,
        //     category: config.projectId.projectCategory
        //   } : null
        // });
      }
    } catch (multimediaError) {
      console.error('Error fetching multimedia assessment stats:', multimediaError);
    }

    // 3. General/Other Assessment Types (placeholder for future expansion)
    // You can add more assessment types here as needed

    // Sort assessments by type priority and last submission
    assessments.sort((a, b) => {
      // Priority: english_proficiency first, then multimedia, then others
      const typePriority = { 'english_proficiency': 0, 'multimedia': 1, 'general': 2 };
      const aPriority = typePriority[a.type] || 3;
      const bPriority = typePriority[b.type] || 3;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Sort by last submission date (most recent first)
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

    // Calculate final averages
    overallStats.averageCompletionRate = overallStats.activeAssessments > 0 
      ? Math.round((overallStats.averageCompletionRate / overallStats.activeAssessments) * 10) / 10 
      : 0;

    res.status(200).json({
      success: true,
      message: "Assessment overview retrieved successfully",
      data: {
        assessments,
        statistics: overallStats
      }
    });

  } catch (error) {
    console.error('❌ Error fetching admin assessments overview:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assessments overview",
      error: error.message
    });
  }
};

/**
 * User: Get assessment overview for authenticated user
 * GET /api/assessments/overview
 */
const getUserAssessmentsOverview = async (req, res) => {
  try {
    const userId = req.user?.userId || req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const assessments = [];

    // 1. English Proficiency Assessment - User's perspective
    try {
      // Get user's English assessment attempts
      const userEnglishAttempts = await Assessment.find({
        userId,
        assessmentType: 'annotator_qualification'
      }).sort({ createdAt: -1 });

      const latestAttempt = userEnglishAttempts[0];
      const bestAttempt = userEnglishAttempts.reduce((best, current) => 
        !best || current.scorePercentage > best.scorePercentage ? current : best, null
      );
      const passedAttempts = userEnglishAttempts.filter(a => a.passed);

      // Check retake eligibility (24-hour cooldown)
      const canRetake = !latestAttempt || 
        (new Date() - new Date(latestAttempt.createdAt)) >= 24 * 60 * 60 * 1000;

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
        userStatus: passedAttempts.length > 0 ? 'completed' : 
                   userEnglishAttempts.length > 0 ? 'attempted' : 'not_started',
        
        // Include last attempt data if available
        ...(latestAttempt && {
          lastAttempt: {
            score: latestAttempt.scorePercentage / 10, // Convert percentage to 10-point scale
            completedAt: latestAttempt.createdAt,
            status: latestAttempt.passed ? 'passed' : 'failed'
          }
        }),
        
        // Additional metadata for internal use
        _internal: {
          userProgress: {
            hasAttempted: userEnglishAttempts.length > 0,
            totalAttempts: userEnglishAttempts.length,
            isPassed: passedAttempts.length > 0,
            canRetake: canRetake,
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
    } catch (englishError) {
      console.error('Error fetching user English assessment data:', englishError);
      // Add default entry
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

    // 2. Multimedia Assessments - User's perspective
    try {
      const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');
      const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');
      const DTUser = require('../models/dtUser.model');

      // Get active multimedia assessments
      const multimediaConfigs = await MultimediaAssessmentConfig.find({ isActive: true })
        .populate('projectId', 'projectName projectCategory')
        .sort({ createdAt: -1 });

      for (const config of multimediaConfigs) {
        // Get user's attempts for this assessment
        const userAttempts = await MultimediaAssessmentSubmission.find({
          annotatorId: userId,
          assessmentId: config._id
        }).sort({ createdAt: -1 });

        const latestAttempt = userAttempts[0];
        const passedAttempts = userAttempts.filter(a => a.status === 'passed');
        
        // Check cooldown for retakes
        const cooldownHours = config.cooldownHours || 24;
        const canRetake = !latestAttempt || 
          (latestAttempt.status !== 'in_progress' && 
           (new Date() - new Date(latestAttempt.createdAt)) >= cooldownHours * 60 * 60 * 1000);

        // Check if user meets prerequisites (usually passed English assessment)
        const hasEnglishQualification = await Assessment.findOne({
          userId,
          assessmentType: 'annotator_qualification',
          passed: true
        });

        // assessments.push({
        //   id: config._id.toString(),
        //   title: config.title,
        //   description: config.description,
        //   type: 'multimedia',
        //   numberOfTasks: config.requirements?.tasksPerAssessment || 5,
        //   estimatedDuration: config.requirements?.timeLimit || 60,
        //   timeLimit: config.requirements?.timeLimit || 60,
        //   passingScore: (config.scoring?.passingScore || 70) / 10, // Convert to 10-point scale
        //   difficulty: 'Intermediate',
        //   isActive: config.isActive,
        //   userStatus: passedAttempts.length > 0 ? 'completed' :
        //              latestAttempt?.status === 'in_progress' ? 'in_progress' :
        //              userAttempts.length > 0 ? 'attempted' : 'not_started',
          
        //   // Include last attempt data if available
        //   ...(latestAttempt && latestAttempt.status !== 'in_progress' && {
        //     lastAttempt: {
        //       score: latestAttempt.finalScore || 0,
        //       completedAt: latestAttempt.createdAt,
        //       status: latestAttempt.status === 'passed' ? 'passed' : 'failed'
        //     }
        //   }),
          
        //   // Additional metadata for internal use
        //   _internal: {
        //     userProgress: {
        //       hasAttempted: userAttempts.length > 0,
        //       totalAttempts: userAttempts.length,
        //       isPassed: passedAttempts.length > 0,
        //       canRetake: canRetake, // Unlimited retakes enabled
        //       nextRetakeAvailable: canRetake ? null : 
        //         new Date(new Date(latestAttempt?.createdAt).getTime() + cooldownHours * 60 * 60 * 1000),
              
        //       currentSession: latestAttempt?.status === 'in_progress' ? {
        //         sessionId: latestAttempt._id,
        //         completionPercentage: latestAttempt.completionPercentage || 0,
        //         timeSpent: latestAttempt.totalTimeSpent || 0,
        //         lastActivity: latestAttempt.lastAutoSave || latestAttempt.createdAt
        //       } : null
        //     },
            
        //     project: config.projectId ? {
        //       id: config.projectId._id,
        //       name: config.projectId.projectName,
        //       category: config.projectId.projectCategory
        //     } : null,
            
        //     requirements: {
        //       maxAttempts: config.maxAttempts || 3,
        //       cooldownHours: config.cooldownHours || 24,
        //       prerequisites: hasEnglishQualification ? [] : ['English Proficiency Assessment']
        //     },
            
        //     benefits: [
        //       'Access to specialized video annotation projects',
        //       'Higher pay rates for multimedia tasks',
        //       'Priority access to premium projects'
        //     ]
        //   }
        // });
      }
    } catch (multimediaError) {
      console.error('Error fetching user multimedia assessment data:', multimediaError);
    }

    // 3. Add General Assessment (placeholder for future expansion)
    // This matches the frontend expectation for a general assessment type
    // assessments.push({
    //   id: 'general_1',
    //   title: 'General Annotation Skills',
    //   description: 'Basic assessment covering general annotation guidelines and best practices.',
    //   type: 'general',
    //   numberOfTasks: 8,
    //   estimatedDuration: 25,
    //   timeLimit: 35,
    //   passingScore: 6.5,
    //   difficulty: 'Beginner',
    //   isActive: true,
    //   userStatus: 'not_started',
      
    //   _internal: {
    //     userProgress: {
    //       hasAttempted: false,
    //       totalAttempts: 0,
    //       isPassed: false,
    //       canRetake: true,
    //       status: 'not_started'
    //     },
    //     requirements: {
    //       prerequisites: []
    //     },
    //     benefits: [
    //       'Basic annotation qualification',
    //       'Foundation for advanced assessments',
    //       'General project access'
    //     ]
    //   }
    // });

    // Sort assessments by priority (qualification first, then by user progress)
    assessments.sort((a, b) => {
      // Priority 1: English proficiency first
      if (a.type !== b.type) {
        return a.type === 'english_proficiency' ? -1 : 1;
      }
      
      // Priority 2: Not started assessments first within same type
      if (a.userStatus !== b.userStatus) {
        const statusPriority = { 'not_started': 0, 'in_progress': 1, 'attempted': 2, 'completed': 3 };
        return (statusPriority[a.userStatus] || 4) - (statusPriority[b.userStatus] || 4);
      }
      
      // Priority 3: Most recent activity
      const aDate = new Date(a.lastAttempt?.completedAt || a._internal?.createdAt || Date.now());
      const bDate = new Date(b.lastAttempt?.completedAt || b._internal?.createdAt || Date.now());
      return bDate.getTime() - aDate.getTime();
    });

    // Calculate user statistics based on frontend format
    const userStats = {
      totalAssessments: assessments.length,
      completedAssessments: assessments.filter(a => a.userStatus === 'completed').length,
      inProgressAssessments: assessments.filter(a => a.userStatus === 'in_progress').length,
      notStartedAssessments: assessments.filter(a => a.userStatus === 'not_started').length,
      
      qualificationLevel: {
        hasEnglishQualification: assessments.find(a => a.id === 'english_proficiency')?.userStatus === 'completed' || false,
        multimediaQualifications: assessments.filter(a => 
          a.type === 'multimedia' && a.userStatus === 'completed'
        ).length,
        
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

    res.status(200).json({
      success: true,
      message: "User assessment overview retrieved successfully",
      data: {
        assessments,
        userStatistics: userStats,
        recommendations: {
          nextAction: userStats.qualificationLevel.hasEnglishQualification ? 
            'Consider taking multimedia assessments to access specialized projects' :
            'Start with the English Proficiency Assessment to qualify as an annotator',
          
          suggestedAssessment: assessments.find(a => 
            a.userStatus === 'not_started' && 
            (!a._internal?.requirements?.prerequisites || a._internal.requirements.prerequisites.length === 0)
          )?.id || null
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user assessments overview:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user assessments overview",
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
  getSectionStatistics,
  getAllAssessments,
  startAssessmentById,
  getAssessmentSubmissions,
  getAdminAssessmentsOverview,
  getUserAssessmentsOverview
};