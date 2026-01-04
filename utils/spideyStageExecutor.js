import mongoose from 'mongoose';
import SpideyAssessmentConfig from '../models/spideyAssessmentConfig.model.js';
import SpideyAssessmentSubmission from '../models/spideyAssessmentSubmission.model.js';
import AuditLog from '../models/auditLog.model.js';

/**
 * SPIDEY ASSESSMENT STAGE EXECUTION ENGINE
 * Enforces validation rules from JSON configuration
 * Deterministic pass/fail results with hard-fail enforcement
 */
class SpideyStageExecutor {
  constructor() {
    // Stage type handlers - each stage has specific validation logic
    this.STAGE_HANDLERS = {
      quiz: this._handleQuizStage.bind(this),
      structured_submission: this._handleStructuredSubmissionStage.bind(this),
      file_and_rubric_submission: this._handleFileAndRubricStage.bind(this),
      trap_evaluation: this._handleTrapEvaluationStage.bind(this)
    };

    // Stage type mapping
    this.STAGE_TYPES = {
      stage1: 'quiz',
      stage2: 'structured_submission',
      stage3: 'file_and_rubric_submission',
      stage4: 'trap_evaluation'
    };
  }

  /**
   * Execute stage with strict validation
   * Returns deterministic pass/fail result
   */
  async executeStage(submissionId, stage, submissionData) {
    try {
      const submission = await SpideyAssessmentSubmission.findById(submissionId)
        .populate('assessmentId');

      if (!submission) {
        throw new Error(`Submission not found: ${submissionId}`);
      }

      // Get stage configuration from assessment JSON
      const assessmentConfig = submission.assessmentId;
      const stageConfig = assessmentConfig.stages[stage];

      if (!stageConfig || !stageConfig.enabled) {
        throw new Error(`Stage not available: ${stage}`);
      }

      // Determine stage type and get appropriate handler
      const stageType = this.STAGE_TYPES[stage];
      const handler = this.STAGE_HANDLERS[stageType];

      if (!handler) {
        throw new Error(`No handler for stage type: ${stageType}`);
      }

      // Record stage start
      await this._logStageStart(submissionId, stage);

      // Execute stage-specific validation
      const result = await handler(submission, stageConfig, submissionData);

      // Apply hard fail conditions
      const hardFailResult = await this._checkHardFailConditions(
        submission,
        stageConfig,
        submissionData,
        result
      );

      if (hardFailResult.hardFail) {
        result.hardFail = true;
        result.passed = false;
        result.violations = [...(result.violations || []), ...hardFailResult.violations];
      }

      // Record stage completion
      await this._logStageCompletion(submissionId, stage, result);

      return result;

    } catch (error) {
      await this._logError('STAGE_EXECUTION_FAILED', {
        submissionId,
        stage,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * STAGE 1: Quiz Handler
   * Enforces time limits, auto-submit on timeout, critical question logic
   */
  async _handleQuizStage(submission, stageConfig, submissionData) {
    const { responses, timeSpent } = submissionData;
    const result = {
      passed: false,
      score: 0,
      violations: [],
      submissionData,
      timeSpent
    };

    // Time limit enforcement
    if (timeSpent > stageConfig.timeLimit * 60) { // Convert minutes to seconds
      result.violations.push({
        rule: 'TIME_LIMIT_EXCEEDED',
        description: `Exceeded time limit of ${stageConfig.timeLimit} minutes`,
        severity: 'critical'
      });
      result.hardFail = true;
      return result;
    }

    // Validate all questions answered
    const questions = stageConfig.questions;
    if (responses.length !== questions.length) {
      result.violations.push({
        rule: 'INCOMPLETE_RESPONSES',
        description: 'Not all questions answered',
        severity: 'error'
      });
      return result;
    }

    // Score calculation and critical question check
    let totalScore = 0;
    let criticalFailure = false;

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const response = responses[i];

      // Validate response format
      if (response.questionId !== question.questionId) {
        result.violations.push({
          rule: 'RESPONSE_MISMATCH',
          description: `Response ${i} does not match question ${question.questionId}`,
          severity: 'error'
        });
        continue;
      }

      // Score the question
      const isCorrect = this._scoreQuestion(question, response);

      if (isCorrect) {
        totalScore += question.points || 1;
      }

      // Critical question hard fail
      if (question.isCritical && !isCorrect) {
        criticalFailure = true;
        result.violations.push({
          rule: 'CRITICAL_QUESTION_FAILED',
          description: `Failed critical question: ${question.questionId}`,
          severity: 'critical'
        });
      }
    }

    const percentage = Math.round((totalScore / questions.length) * 100);
    result.score = percentage;

    // Apply critical failure hard fail
    if (criticalFailure) {
      result.hardFail = true;
      result.passed = false;
    } else {
      result.passed = percentage >= stageConfig.passingScore;
    }

    return result;
  }

  /**
   * STAGE 2: Structured Submission Handler
   * Validates prompt design with file references and forbidden keywords
   */
  async _handleStructuredSubmissionStage(submission, stageConfig, submissionData) {
    const result = {
      passed: false,
      score: 0,
      violations: [],
      submissionData
    };

    // Validate required fields
    const requiredFields = stageConfig.requiredFields || [];
    for (const field of requiredFields) {
      const value = submissionData[field.fieldId];

      if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        result.violations.push({
          rule: 'MISSING_REQUIRED_FIELD',
          description: `Required field missing: ${field.fieldId}`,
          severity: 'error'
        });
        continue;
      }

      // Field-specific validation
      if (field.minLength && value.length < field.minLength) {
        result.violations.push({
          rule: 'FIELD_TOO_SHORT',
          description: `Field ${field.fieldId} below minimum length of ${field.minLength}`,
          severity: 'error'
        });
      }

      // File reference validation
      if (field.mustReferenceFiles && field.mustReferenceFiles.length > 0) {
        const hasRequiredReferences = field.mustReferenceFiles.every(fileId =>
          value.toLowerCase().includes(fileId.toLowerCase())
        );

        if (!hasRequiredReferences) {
          result.violations.push({
            rule: 'MISSING_FILE_REFERENCE',
            description: `Must reference files: ${field.mustReferenceFiles.join(', ')}`,
            severity: 'error'
          });
        }
      }
    }

    // Forbidden keyword scan
    const forbiddenKeywords = stageConfig.forbiddenKeywords || [];
    const promptText = submissionData.promptText || '';

    for (const keyword of forbiddenKeywords) {
      if (promptText.toLowerCase().includes(keyword.toLowerCase())) {
        result.violations.push({
          rule: 'FORBIDDEN_KEYWORD_DETECTED',
          description: `Forbidden keyword found: ${keyword}`,
          severity: 'critical'
        });
        result.hardFail = true;
      }
    }

    // Calculate score based on validation results
    const totalChecks = requiredFields.length + forbiddenKeywords.length;
    const passedChecks = totalChecks - result.violations.length;
    result.score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
    result.passed = result.score >= (stageConfig.passingScore || 80) && !result.hardFail;

    return result;
  }

  /**
   * STAGE 3: File and Rubric Handler
   * Validates golden solution integrity and rubric quality
   */
  async _handleFileAndRubricStage(submission, stageConfig, submissionData) {
    const result = {
      passed: false,
      score: 0,
      violations: [],
      submissionData
    };

    const requiredSubmissions = stageConfig.requiredSubmissions || {};

    // Validate golden solution file
    if (requiredSubmissions.goldenSolution) {
      const goldenSolution = submissionData.goldenSolution;

      if (!goldenSolution) {
        result.violations.push({
          rule: 'MISSING_GOLDEN_SOLUTION',
          description: 'Golden solution file is required',
          severity: 'critical'
        });
        result.hardFail = true;
      } else {
        // File format validation
        const allowedFormats = requiredSubmissions.goldenSolution.allowedFormats || [];
        const fileFormat = goldenSolution.format || goldenSolution.mimetype;

        if (allowedFormats.length > 0 && !allowedFormats.includes(fileFormat)) {
          result.violations.push({
            rule: 'INVALID_FILE_FORMAT',
            description: `Invalid format. Allowed: ${allowedFormats.join(', ')}`,
            severity: 'error'
          });
        }

        // File size validation
        const minSizeKB = requiredSubmissions.goldenSolution.minFileSizeKB || 0;
        const fileSizeKB = (goldenSolution.size || 0) / 1024;

        if (fileSizeKB < minSizeKB) {
          result.violations.push({
            rule: 'FILE_TOO_SMALL',
            description: `File size ${fileSizeKB}KB below minimum ${minSizeKB}KB`,
            severity: 'error'
          });
        }
      }
    }

    // Validate reasoning explanation
    if (requiredSubmissions.reasoningExplanation) {
      const reasoning = submissionData.reasoningExplanation;
      const minLength = requiredSubmissions.reasoningExplanation.minLength || 0;

      if (!reasoning || reasoning.length < minLength) {
        result.violations.push({
          rule: 'INSUFFICIENT_REASONING',
          description: `Reasoning explanation below minimum ${minLength} characters`,
          severity: 'error'
        });
      }
    }

    // Validate rubrics
    const positiveRubrics = submissionData.positiveRubrics || [];
    const negativeRubrics = submissionData.negativeRubrics || [];

    const minPositive = requiredSubmissions.positiveRubrics?.minItems || 0;
    const minNegative = requiredSubmissions.negativeRubrics?.minItems || 0;

    if (positiveRubrics.length < minPositive) {
      result.violations.push({
        rule: 'INSUFFICIENT_POSITIVE_RUBRICS',
        description: `Need at least ${minPositive} positive rubrics`,
        severity: 'error'
      });
    }

    if (negativeRubrics.length < minNegative) {
      result.violations.push({
        rule: 'INSUFFICIENT_NEGATIVE_RUBRICS',
        description: `Need at least ${minNegative} negative rubrics`,
        severity: 'error'
      });
    }

    // Score calculation
    const totalChecks = 5; // Golden solution, reasoning, positive/negative rubrics, format
    const violations = result.violations.filter(v => v.severity !== 'critical').length;
    const passedChecks = totalChecks - violations;

    result.score = Math.round((passedChecks / totalChecks) * 100);
    result.passed = result.score >= (stageConfig.passingScore || 80) && !result.hardFail;

    return result;
  }

  /**
   * STAGE 4: Trap Evaluation Handler
   * Detects blind compliance vs. proper violation flagging
   */
  async _handleTrapEvaluationStage(submission, stageConfig, submissionData) {
    const result = {
      passed: false,
      score: 0,
      violations: [],
      submissionData
    };

    const expectedBehavior = stageConfig.expectedBehavior || {};
    const response = submissionData.response || '';

    // Check if violation was flagged
    const mustFlagViolation = expectedBehavior.mustFlagViolation || false;
    const violationFlagged = this._detectViolationFlag(response);

    if (mustFlagViolation && !violationFlagged) {
      result.violations.push({
        rule: 'FAILED_TO_FLAG_VIOLATION',
        description: 'Did not identify the integrity violation in the prompt',
        severity: 'critical'
      });
      result.hardFail = true;
    }

    // Check if alternative was proposed
    const mustProposeAlternative = expectedBehavior.mustProposeAlternative || false;
    const alternativeProposed = this._detectAlternativeProposal(response);

    if (mustProposeAlternative && !alternativeProposed) {
      result.violations.push({
        rule: 'NO_ALTERNATIVE_PROPOSED',
        description: 'Did not propose compliant alternative',
        severity: 'critical'
      });
      result.hardFail = true;
    }

    // Check for blind compliance (automatic failure)
    const blindCompliance = this._detectBlindCompliance(response, stageConfig.trapPrompt);

    if (blindCompliance) {
      result.violations.push({
        rule: 'BLIND_COMPLIANCE',
        description: 'Attempted to complete forbidden task without flagging violation',
        severity: 'critical'
      });
      result.hardFail = true;
    }

    // Integrity trap scoring - binary pass/fail
    if (result.hardFail) {
      result.score = 0;
      result.passed = false;
    } else {
      result.score = 100;
      result.passed = true;
    }

    return result;
  }

  /**
   * Check hard fail conditions from assessment configuration
   */
  async _checkHardFailConditions(submission, stageConfig, submissionData, result) {
    const hardFailResult = {
      hardFail: false,
      violations: []
    };

    const hardFailConditions = stageConfig.hardFailConditions || [];

    for (const condition of hardFailConditions) {
      const violationDetected = await this._evaluateHardFailCondition(
        condition,
        submissionData,
        result
      );

      if (violationDetected) {
        hardFailResult.hardFail = true;
        hardFailResult.violations.push({
          rule: condition.rule,
          description: condition.description,
          severity: 'critical'
        });
      }
    }

    return hardFailResult;
  }

  /**
   * Question scoring logic
   */
  _scoreQuestion(question, response) {
    switch (question.questionType) {
      case 'multiple_choice':
        return response.userAnswer === question.correctAnswer;

      case 'true_false':
        return response.userAnswer === question.correctAnswer;

      case 'text_input':
        // Check for required keywords
        const requiredKeywords = question.requiredKeywords || [];
        const userAnswer = (response.userAnswer || '').toLowerCase();

        return requiredKeywords.every(keyword =>
          userAnswer.includes(keyword.toLowerCase())
        );

      default:
        return false;
    }
  }

  /**
   * Helper methods for Stage 4 integrity detection
   */
  _detectViolationFlag(response) {
    const flagIndicators = [
      'violation', 'against policy', 'inappropriate', 'cannot', 'refuse',
      'not allowed', 'prohibited', 'forbidden', 'unethical', 'improper'
    ];

    const lowerResponse = response.toLowerCase();
    return flagIndicators.some(indicator => lowerResponse.includes(indicator));
  }

  _detectAlternativeProposal(response) {
    const alternativeIndicators = [
      'instead', 'alternative', 'suggest', 'propose', 'different approach',
      'better way', 'compliant', 'acceptable'
    ];

    const lowerResponse = response.toLowerCase();
    return alternativeIndicators.some(indicator => lowerResponse.includes(indicator));
  }

  _detectBlindCompliance(response, trapPrompt) {
    // Check if response attempts to fulfill the forbidden request
    const forbiddenActions = this._extractForbiddenActions(trapPrompt);
    const lowerResponse = response.toLowerCase();

    return forbiddenActions.some(action =>
      lowerResponse.includes(action.toLowerCase()) &&
      !this._detectViolationFlag(response)
    );
  }

  _extractForbiddenActions(trapPrompt) {
    // Extract key forbidden actions from trap prompt
    // This is simplified - real implementation would use NLP
    const forbiddenPatterns = [
      'personal information', 'private data', 'confidential',
      'harmful content', 'inappropriate'
    ];

    return forbiddenPatterns.filter(pattern =>
      trapPrompt.toLowerCase().includes(pattern)
    );
  }

  /**
   * Audit and logging methods
   */
  async _logStageStart(submissionId, stage) {
    const auditEntry = new AuditLog({
      entityType: 'SpideyStageExecution',
      entityId: submissionId,
      action: 'STAGE_STARTED',
      details: { stage, timestamp: new Date() },
      source: 'StageExecutor'
    });
    await auditEntry.save();
  }

  async _logStageCompletion(submissionId, stage, result) {
    const auditEntry = new AuditLog({
      entityType: 'SpideyStageExecution',
      entityId: submissionId,
      action: 'STAGE_COMPLETED',
      details: {
        stage,
        passed: result.passed,
        score: result.score,
        hardFail: result.hardFail,
        violations: result.violations,
        timestamp: new Date()
      },
      source: 'StageExecutor'
    });
    await auditEntry.save();
  }

  async _logError(errorType, details) {
    try {
      const auditEntry = new AuditLog({
        entityType: 'SpideyStageExecution',
        action: `ERROR_${errorType}`,
        details: { ...details, severity: 'ERROR' },
        source: 'StageExecutor'
      });
      await auditEntry.save();
    } catch (error) {
      console.error('Error logging failed:', error);
    }
  }

  /**
   * Evaluate specific hard fail condition
   */
  async _evaluateHardFailCondition(condition, submissionData, result) {
    switch (condition.type) {
      case 'forbidden_keyword':
        return this._checkForbiddenKeyword(condition.keywords, submissionData);

      case 'missing_requirement':
        return this._checkMissingRequirement(condition.requirement, submissionData);

      case 'invalid_format':
        return this._checkInvalidFormat(condition.allowedFormats, submissionData);

      case 'size_violation':
        return this._checkSizeViolation(condition.limits, submissionData);

      default:
        return false;
    }
  }

  _checkForbiddenKeyword(keywords, submissionData) {
    const text = JSON.stringify(submissionData).toLowerCase();
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
  }

  _checkMissingRequirement(requirement, submissionData) {
    return !submissionData[requirement.field] ||
      submissionData[requirement.field].length < (requirement.minLength || 1);
  }

  _checkInvalidFormat(allowedFormats, submissionData) {
    const files = submissionData.files || [];
    return files.some(file => !allowedFormats.includes(file.format));
  }

  _checkSizeViolation(limits, submissionData) {
    const files = submissionData.files || [];
    return files.some(file =>
      file.size > (limits.maxSizeKB * 1024) ||
      file.size < (limits.minSizeKB * 1024)
    );
  }
}

export default SpideyStageExecutor;