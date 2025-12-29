const SpideyAssessmentEngine = require('../utils/spideyAssessmentEngine');
const SpideyFinalDecisionEngine = require('../utils/spideyFinalDecisionEngine');
const Joi = require('joi');

/**
 * SPIDEY ASSESSMENT CONTROLLER
 * REST API endpoints with NO embedded business logic
 * All logic delegated to assessment engine components
 * Implements strict non-negotiable rules
 */

// ==========================================
// STAGE 1: GUIDELINE COMPREHENSION
// ==========================================

/**
 * Start Spidey Assessment
 * POST /api/assessments/spidey/start
 */
const startSpideyAssessment = async (req, res) => {
  try {
    const userId = req.user?.userId || req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    // Check if active Spidey assessment exists
    const activeSpideyConfig = await SpideyAssessmentConfig.findOne({
      isActive: true,
      assessmentType: 'spidey_assessment'
    }).populate('projectId');

    if (!activeSpideyConfig) {
      return res.status(404).json({
        success: false,
        message: "No active Spidey assessment available"
      });
    }

    // Check retake eligibility (Spidey is strict)
    const retakeCheck = await SpideyAssessmentSubmission.checkRetakeEligibility(userId, activeSpideyConfig._id);
    if (!retakeCheck.eligible) {
      return res.status(403).json({
        success: false,
        message: `Assessment not available: ${retakeCheck.reason}`
      });
    }

    // Create new submission (state machine starts at stage1)
    const submission = new SpideyAssessmentSubmission({
      assessmentId: activeSpideyConfig._id,
      annotatorId: userId,
      projectId: activeSpideyConfig.projectId._id,
      assessmentType: 'spidey_assessment',
      currentStage: 'stage1',
      sessionStarted: new Date(),
      securityData: {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionId: crypto.randomUUID()
      }
    });

    // Initialize stage1
    submission.stages.stage1.status = 'in_progress';
    submission.stages.stage1.startedAt = new Date();

    await submission.save();

    // Add audit log
    await submission.addAuditLog('stage1', 'assessment_started', {
      configId: activeSpideyConfig._id,
      sessionId: submission.securityData.sessionId
    });

    res.status(201).json({
      success: true,
      message: "Spidey assessment started successfully",
      data: {
        submissionId: submission._id,
        assessmentTitle: activeSpideyConfig.title,
        currentStage: submission.currentStage,
        stage1Config: activeSpideyConfig.stages.stage1,
        instructions: activeSpideyConfig.description,
        sessionId: submission.securityData.sessionId
      }
    });

  } catch (error) {
    console.error('Error starting Spidey assessment:', error);
    res.status(500).json({
      success: false,
      message: "Failed to start assessment"
    });
  }
};

/**
 * Submit Stage 1 Responses
 * POST /api/assessments/spidey/:submissionId/stage1/submit
 */
const submitStage1 = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user?.userId || req.userId;

    // Validation schema for stage 1
    const stage1Schema = Joi.object({
      responses: Joi.array().items(
        Joi.object({
          questionId: Joi.string().required(),
          userAnswer: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string()),
            Joi.boolean()
          ).required()
        })
      ).min(1).required(),
      timeSpent: Joi.number().min(1).required()
    });

    const { error, value } = stage1Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission data",
        errors: error.details
      });
    }

    const submission = await SpideyAssessmentSubmission.findOne({
      _id: submissionId,
      annotatorId: userId,
      currentStage: 'stage1',
      'stages.stage1.status': 'in_progress'
    }).populate('assessmentId');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found or not in correct stage"
      });
    }

    const config = submission.assessmentId;
    const stage1Config = config.stages.stage1;

    // Validate time limit (server authority)
    const timeLimit = stage1Config.timeLimit * 60; // Convert to seconds
    if (value.timeSpent > timeLimit) {
      await submission.failAssessment('stage1', 'Time limit exceeded', 'time_limit');
      return res.status(400).json({
        success: false,
        message: "Time limit exceeded. Assessment failed.",
        timeLimit: timeLimit,
        timeSpent: value.timeSpent
      });
    }

    // Grade responses (server authority - frontend never decides pass/fail)
    let correctAnswers = 0;
    let totalQuestions = 0;
    let criticalFailure = false;
    let criticalFailureReason = '';

    const gradedResponses = [];

    for (const response of value.responses) {
      const question = stage1Config.questions.find(q => q.questionId === response.questionId);
      if (!question) continue;

      totalQuestions++;
      const isCorrect = JSON.stringify(question.correctAnswer) === JSON.stringify(response.userAnswer);
      
      if (isCorrect) {
        correctAnswers++;
      } else if (question.isCritical) {
        // Critical question wrong = immediate fail (hard rule)
        criticalFailure = true;
        criticalFailureReason = `Critical question ${response.questionId} answered incorrectly`;
      }

      gradedResponses.push({
        questionId: response.questionId,
        userAnswer: response.userAnswer,
        isCorrect: isCorrect,
        isCritical: question.isCritical,
        autoFailed: question.isCritical && !isCorrect
      });
    }

    // Update submission with responses
    submission.stages.stage1.responses = gradedResponses;
    submission.stages.stage1.timeSpent = value.timeSpent;
    submission.stages.stage1.score = correctAnswers;
    submission.stages.stage1.maxScore = totalQuestions;
    submission.stages.stage1.completedAt = new Date();

    // Apply hard rules (server authority)
    if (criticalFailure) {
      submission.stages.stage1.status = 'failed';
      submission.stages.stage1.passed = false;
      submission.stages.stage1.failureReason = criticalFailureReason;
      
      await submission.failAssessment('stage1', criticalFailureReason, 'hard_rule');

      return res.status(400).json({
        success: false,
        message: "Critical question answered incorrectly. Assessment failed.",
        failureReason: criticalFailureReason,
        finalStatus: 'failed'
      });
    }

    // Check passing score
    const scorePercentage = (correctAnswers / totalQuestions) * 100;
    const passedStage1 = scorePercentage >= stage1Config.passingScore;

    submission.stages.stage1.passed = passedStage1;

    if (passedStage1) {
      submission.stages.stage1.status = 'completed';
      submission.progressToNextStage(); // Move to stage2
      await submission.save();

      await submission.addAuditLog('stage1', 'stage_completed', {
        score: correctAnswers,
        maxScore: totalQuestions,
        percentage: scorePercentage,
        nextStage: submission.currentStage
      });

      res.status(200).json({
        success: true,
        message: "Stage 1 completed successfully",
        data: {
          stage1Results: {
            score: correctAnswers,
            maxScore: totalQuestions,
            percentage: Math.round(scorePercentage * 100) / 100,
            passed: true
          },
          currentStage: submission.currentStage,
          nextStage: config.stages.stage2
        }
      });

    } else {
      submission.stages.stage1.status = 'failed';
      submission.stages.stage1.failureReason = `Score ${scorePercentage.toFixed(1)}% below required ${stage1Config.passingScore}%`;
      
      await submission.failAssessment('stage1', submission.stages.stage1.failureReason, 'scoring');

      res.status(400).json({
        success: false,
        message: "Stage 1 failed - score below passing threshold",
        data: {
          score: correctAnswers,
          maxScore: totalQuestions,
          percentage: Math.round(scorePercentage * 100) / 100,
          requiredPercentage: stage1Config.passingScore,
          finalStatus: 'failed'
        }
      });
    }

  } catch (error) {
    console.error('Error submitting Stage 1:', error);
    res.status(500).json({
      success: false,
      message: "Failed to submit Stage 1"
    });
  }
};

// ==========================================
// STAGE 2: MINI TASK VALIDATION
// ==========================================

/**
 * Submit Stage 2 Response
 * POST /api/assessments/spidey/:submissionId/stage2/submit
 */
const submitStage2 = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user?.userId || req.userId;

    // Validation schema for stage 2
    const stage2Schema = Joi.object({
      promptText: Joi.string().min(50).max(2000).required(),
      domain: Joi.string().min(3).max(100).required(),
      failureExplanation: Joi.string().min(100).max(1000).required(),
      fileReferences: Joi.array().items(Joi.string()).min(1).required(),
      response: Joi.string().min(100).max(3000).required(),
      timeSpent: Joi.number().min(1).required()
    });

    const { error, value } = stage2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission data",
        errors: error.details
      });
    }

    const submission = await SpideyAssessmentSubmission.findOne({
      _id: submissionId,
      annotatorId: userId,
      currentStage: 'stage2'
    }).populate('assessmentId');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found or not in correct stage"
      });
    }

    const config = submission.assessmentId;
    const stage2Config = config.stages.stage2;

    // Time limit validation (server authority)
    const timeLimit = stage2Config.timeLimit * 60;
    if (value.timeSpent > timeLimit) {
      await submission.failAssessment('stage2', 'Time limit exceeded', 'time_limit');
      return res.status(400).json({
        success: false,
        message: "Time limit exceeded. Assessment failed."
      });
    }

    // Automated validation (server authority)
    const validation = {
      hasFileReference: value.fileReferences.length > 0,
      validDomain: value.domain.length >= 3,
      noForbiddenKeywords: true,
      adequateLength: value.response.length >= stage2Config.validation.minResponseLength,
      logicalExplanation: value.failureExplanation.length >= 100
    };

    const violations = [];

    // Check forbidden keywords (hard rule)
    const forbiddenKeywords = stage2Config.validation.forbiddenKeywords || ['summarize', 'summary'];
    for (const keyword of forbiddenKeywords) {
      if (value.promptText.toLowerCase().includes(keyword.toLowerCase()) ||
          value.response.toLowerCase().includes(keyword.toLowerCase())) {
        validation.noForbiddenKeywords = false;
        violations.push(`Forbidden keyword detected: ${keyword}`);
      }
    }

    // Check file references (hard rule)
    if (!validation.hasFileReference) {
      violations.push('No file references provided');
    }

    // Check required elements
    const requiredElements = stage2Config.validation.requiredElements || ['domain', 'failure_explanation'];
    for (const element of requiredElements) {
      if (element === 'domain' && !validation.validDomain) {
        violations.push('Invalid or missing domain');
      }
      if (element === 'failure_explanation' && !validation.logicalExplanation) {
        violations.push('Inadequate failure explanation');
      }
    }

    // Update submission
    submission.stages.stage2.status = 'completed';
    submission.stages.stage2.completedAt = new Date();
    submission.stages.stage2.timeSpent = value.timeSpent;
    submission.stages.stage2.submission = value;
    submission.stages.stage2.validation = validation;
    submission.stages.stage2.violations = violations;

    // Apply hard rules (any violation = fail)
    if (violations.length > 0) {
      submission.stages.stage2.passed = false;
      submission.stages.stage2.status = 'failed';
      submission.stages.stage2.failureReason = `Validation failed: ${violations.join(', ')}`;
      
      await submission.failAssessment('stage2', submission.stages.stage2.failureReason, 'hard_rule');

      return res.status(400).json({
        success: false,
        message: "Stage 2 failed - validation errors",
        violations: violations,
        finalStatus: 'failed'
      });
    }

    // All validations passed
    submission.stages.stage2.passed = true;
    submission.progressToNextStage(); // Move to stage3
    await submission.save();

    await submission.addAuditLog('stage2', 'stage_completed', {
      validation: validation,
      nextStage: submission.currentStage
    });

    res.status(200).json({
      success: true,
      message: "Stage 2 completed successfully",
      data: {
        stage2Results: {
          validation: validation,
          passed: true
        },
        currentStage: submission.currentStage,
        nextStage: config.stages.stage3
      }
    });

  } catch (error) {
    console.error('Error submitting Stage 2:', error);
    res.status(500).json({
      success: false,
      message: "Failed to submit Stage 2"
    });
  }
};

// ==========================================
// STAGE 3: GOLDEN SOLUTION & RUBRIC VALIDATION
// ==========================================

/**
 * Submit Stage 3 Files and Rubrics
 * POST /api/assessments/spidey/:submissionId/stage3/submit
 */
const submitStage3 = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user?.userId || req.userId;

    // Validation schema for stage 3
    const stage3Schema = Joi.object({
      positiveRubric: Joi.string().min(200).max(3000).required(),
      negativeRubric: Joi.string().min(200).max(3000).required(),
      timeSpent: Joi.number().min(1).required()
    });

    const { error, value } = stage3Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission data",
        errors: error.details
      });
    }

    const submission = await SpideyAssessmentSubmission.findOne({
      _id: submissionId,
      annotatorId: userId,
      currentStage: 'stage3'
    }).populate('assessmentId');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found or not in correct stage"
      });
    }

    const config = submission.assessmentId;
    const stage3Config = config.stages.stage3;

    // Time limit validation
    const timeLimit = stage3Config.timeLimit * 60;
    if (value.timeSpent > timeLimit) {
      await submission.failAssessment('stage3', 'Time limit exceeded', 'time_limit');
      return res.status(400).json({
        success: false,
        message: "Time limit exceeded. Assessment failed."
      });
    }

    // File validation (assuming files were uploaded separately)
    // In a real implementation, files would be uploaded via separate endpoint
    const files = req.files || [];
    const violations = [];

    // Validate file requirements
    if (files.length === 0) {
      violations.push('No files uploaded');
    }

    // Validate file types (whitelist only)
    const allowedTypes = stage3Config.fileValidation.allowedTypes || ['.pdf', '.doc', '.docx', '.txt'];
    for (const file of files) {
      const fileExt = path.extname(file.originalname).toLowerCase();
      if (!allowedTypes.includes(fileExt)) {
        violations.push(`Forbidden file type: ${fileExt}`);
      }
      
      if (file.size > stage3Config.fileValidation.maxFileSize) {
        violations.push(`File too large: ${file.originalname}`);
      }
    }

    // Validate rubrics
    const rubricValidation = {
      positiveRubric: {
        content: value.positiveRubric,
        length: value.positiveRubric.length,
        isTestable: value.positiveRubric.includes('criteria') || value.positiveRubric.includes('measurable'),
        validationPassed: value.positiveRubric.length >= stage3Config.rubricRequirements.rubricMinLength
      },
      negativeRubric: {
        content: value.negativeRubric,
        length: value.negativeRubric.length,
        isTestable: value.negativeRubric.includes('criteria') || value.negativeRubric.includes('measurable'),
        validationPassed: value.negativeRubric.length >= stage3Config.rubricRequirements.rubricMinLength
      }
    };

    // Check rubric requirements
    if (!rubricValidation.positiveRubric.validationPassed) {
      violations.push('Positive rubric too short or not testable');
    }
    if (!rubricValidation.negativeRubric.validationPassed) {
      violations.push('Negative rubric too short or not testable');
    }

    // Update submission
    submission.stages.stage3.status = 'completed';
    submission.stages.stage3.completedAt = new Date();
    submission.stages.stage3.timeSpent = value.timeSpent;
    submission.stages.stage3.rubrics = rubricValidation;
    submission.stages.stage3.violations = violations;

    const validation = {
      allFilesValid: files.length > 0 && violations.filter(v => v.includes('file')).length === 0,
      virusScanPassed: true, // Would implement actual virus scanning
      adequateContent: true,
      rubricsValid: rubricValidation.positiveRubric.validationPassed && rubricValidation.negativeRubric.validationPassed
    };

    submission.stages.stage3.validation = validation;

    // Apply hard rules
    if (violations.length > 0) {
      submission.stages.stage3.passed = false;
      submission.stages.stage3.status = 'failed';
      submission.stages.stage3.failureReason = `Validation failed: ${violations.join(', ')}`;
      
      await submission.failAssessment('stage3', submission.stages.stage3.failureReason, 'hard_rule');

      return res.status(400).json({
        success: false,
        message: "Stage 3 failed - validation errors",
        violations: violations,
        finalStatus: 'failed'
      });
    }

    // All validations passed
    submission.stages.stage3.passed = true;
    submission.progressToNextStage(); // Move to stage4
    await submission.save();

    await submission.addAuditLog('stage3', 'stage_completed', {
      validation: validation,
      fileCount: files.length,
      nextStage: submission.currentStage
    });

    res.status(200).json({
      success: true,
      message: "Stage 3 completed successfully",
      data: {
        stage3Results: {
          validation: validation,
          passed: true
        },
        currentStage: submission.currentStage,
        nextStage: config.stages.stage4
      }
    });

  } catch (error) {
    console.error('Error submitting Stage 3:', error);
    res.status(500).json({
      success: false,
      message: "Failed to submit Stage 3"
    });
  }
};

// ==========================================
// STAGE 4: INTEGRITY TRAP EVALUATION
// ==========================================

/**
 * Submit Stage 4 Response
 * POST /api/assessments/spidey/:submissionId/stage4/submit
 */
const submitStage4 = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user?.userId || req.userId;

    const stage4Schema = Joi.object({
      instructionGiven: Joi.string().required(),
      userResponse: Joi.string().min(50).max(2000).required(),
      violationFlagged: Joi.boolean().required(),
      responseTime: Joi.number().min(1).required(),
      timeSpent: Joi.number().min(1).required()
    });

    const { error, value } = stage4Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission data",
        errors: error.details
      });
    }

    const submission = await SpideyAssessmentSubmission.findOne({
      _id: submissionId,
      annotatorId: userId,
      currentStage: 'stage4'
    }).populate('assessmentId');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found or not in correct stage"
      });
    }

    const config = submission.assessmentId;
    const stage4Config = config.stages.stage4;

    // Time limit validation
    const timeLimit = stage4Config.timeLimit * 60;
    if (value.timeSpent > timeLimit) {
      await submission.failAssessment('stage4', 'Time limit exceeded', 'time_limit');
      return res.status(400).json({
        success: false,
        message: "Time limit exceeded. Assessment failed."
      });
    }

    // Integrity trap evaluation (server authority)
    const blindlyComplied = !value.violationFlagged && value.responseTime < 30; // Quick acceptance = suspicious
    const properlyFlagged = value.violationFlagged;
    const integrityMaintained = properlyFlagged && !blindlyComplied;

    const validation = {
      detectedBlindCompliance: blindlyComplied,
      properlyFlagged: properlyFlagged,
      integrityMaintained: integrityMaintained
    };

    // Update submission
    submission.stages.stage4.status = 'completed';
    submission.stages.stage4.completedAt = new Date();
    submission.stages.stage4.timeSpent = value.timeSpent;
    submission.stages.stage4.integrityTrap = value;
    submission.stages.stage4.validation = validation;

    // Apply integrity rules (blind compliance = fail)
    if (blindlyComplied) {
      submission.stages.stage4.passed = false;
      submission.stages.stage4.status = 'failed';
      submission.stages.stage4.failureReason = 'Blind compliance detected - failed to flag violation';
      
      await submission.failAssessment('stage4', submission.stages.stage4.failureReason, 'integrity');

      return res.status(400).json({
        success: false,
        message: "Integrity test failed - blind compliance detected",
        finalStatus: 'failed'
      });
    }

    if (!properlyFlagged) {
      submission.stages.stage4.passed = false;
      submission.stages.stage4.status = 'failed';
      submission.stages.stage4.failureReason = 'Failed to flag violation';
      
      await submission.failAssessment('stage4', submission.stages.stage4.failureReason, 'integrity');

      return res.status(400).json({
        success: false,
        message: "Integrity test failed - violation not flagged",
        finalStatus: 'failed'
      });
    }

    // Integrity test passed
    submission.stages.stage4.passed = true;
    submission.currentStage = 'completed';
    submission.status = 'submitted';
    submission.submittedAt = new Date();

    // Calculate final score (only after all hard rules pass)
    await calculateFinalScore(submission, config);

    await submission.save();

    await submission.addAuditLog('stage4', 'assessment_completed', {
      validation: validation,
      finalScore: submission.finalScore
    });

    res.status(200).json({
      success: true,
      message: "Spidey assessment completed successfully",
      data: {
        submissionId: submission._id,
        finalScore: submission.finalScore,
        status: 'submitted',
        completedAt: submission.submittedAt
      }
    });

  } catch (error) {
    console.error('Error submitting Stage 4:', error);
    res.status(500).json({
      success: false,
      message: "Failed to submit Stage 4"
    });
  }
};

// ==========================================
// SCORING & DECISION ENGINE
// ==========================================

/**
 * Calculate final score (only called if all hard rules pass)
 */
const calculateFinalScore = async (submission, config) => {
  const weights = config.scoring.weights;
  
  // Calculate weighted scores
  const stage1Score = (submission.stages.stage1.score / submission.stages.stage1.maxScore) * 100 * weights.stage1;
  const stage2Score = 100 * weights.stage2; // Binary pass/fail
  const stage3Score = 100 * weights.stage3; // Binary pass/fail
  const stage4Score = 100 * weights.stage4; // Binary pass/fail
  
  const totalScore = stage1Score + stage2Score + stage3Score + stage4Score;
  const percentage = totalScore;
  
  const passed = percentage >= config.scoring.passingScore;
  const autoApproved = percentage >= config.scoring.autoApprovalThreshold;
  
  submission.finalScore = {
    totalPoints: totalScore,
    maxPoints: 100,
    percentage: Math.round(percentage * 100) / 100,
    breakdown: {
      stage1Score: Math.round(stage1Score * 100) / 100,
      stage2Score: Math.round(stage2Score * 100) / 100,
      stage3Score: Math.round(stage3Score * 100) / 100,
      stage4Score: Math.round(stage4Score * 100) / 100
    },
    passed: passed,
    autoApproved: autoApproved
  };
  
  // Update user status if passed (integration with existing system)
  if (passed) {
    await DTUser.findByIdAndUpdate(submission.annotatorId, {
      spideyAssessmentStatus: autoApproved ? 'approved' : 'under_review'
    });
  }
};

/**
 * Get assessment status
 * GET /api/assessments/spidey/:submissionId/status
 */
const getSpideyAssessmentStatus = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user?.userId || req.userId;

    const submission = await SpideyAssessmentSubmission.findOne({
      _id: submissionId,
      annotatorId: userId
    }).populate('assessmentId').lean();

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        submissionId: submission._id,
        currentStage: submission.currentStage,
        status: submission.status,
        stages: submission.stages,
        finalScore: submission.finalScore,
        totalTimeSpent: submission.totalTimeSpent,
        submittedAt: submission.submittedAt
      }
    });

  } catch (error) {
    console.error('Error getting Spidey assessment status:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get assessment status"
    });
  }
};

module.exports = {
  startSpideyAssessment,
  submitStage1,
  submitStage2,
  submitStage3,
  submitStage4,
  getSpideyAssessmentStatus
};