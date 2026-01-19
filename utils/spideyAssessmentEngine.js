import SpideyAssessmentStateMachine from './spideyAssessmentStateMachine.js';
import SpideyStageExecutor from './spideyStageExecutor.js';
import SpideyFileEnforcer from './spideyFileEnforcer.js';
import SpideyAssessmentConfig from '../models/spideyAssessmentConfig.model.js';
import SpideyAssessmentSubmission from '../models/spideyAssessmentSubmission.model.js';
import AuditLog from '../models/auditLog.model.js';
import mongoose from 'mongoose';

/**
 * SPIDEY ASSESSMENT ENGINE
 * Main orchestrator for the high-discipline assessment system
 * Enforces strict rules, server authority, and deterministic outcomes
 */
class SpideyAssessmentEngine {
  constructor() {
    this.stateMachine = new SpideyAssessmentStateMachine();
    this.stageExecutor = new SpideyStageExecutor();
    this.fileEnforcer = new SpideyFileEnforcer();

    // Stage progression timeouts (in seconds)
    this.STAGE_TIMEOUTS = {
      stage1: 12 * 60,    // 12 minutes
      stage2: 90 * 60,    // 90 minutes
      stage3: 120 * 60,   // 120 minutes
      stage4: 30 * 60     // 30 minutes
    };
  }

  /**
   * Start assessment for candidate
   * Initialize state machine and create submission
   */
  async startAssessment(assessmentId, candidateId, sessionData = {}) {
    try {
      // Load assessment configuration
      const assessment = await this.stateMachine.loadAssessment(assessmentId);

      // Initialize candidate progress
      const submission = await this.stateMachine.initializeCandidateProgress(
        assessmentId,
        candidateId
      );

      // Record session metadata
      if (sessionData.ipAddress) submission.securityData.ipAddress = sessionData.ipAddress;
      if (sessionData.userAgent) submission.securityData.userAgent = sessionData.userAgent;
      if (sessionData.sessionId) submission.securityData.sessionId = sessionData.sessionId;

      await submission.save();

      // Advance to Stage 1 (from null)
      await this.stateMachine.advanceToStage(submission._id, 'stage1');

      await this._logAction('ASSESSMENT_STARTED', {
        assessmentId,
        candidateId,
        submissionId: submission._id,
        assessment: assessment.title
      });

      return {
        success: true,
        submissionId: submission._id,
        currentStage: 'stage1',
        assessmentTitle: assessment.title,
        timeLimit: this.STAGE_TIMEOUTS.stage1,
        message: 'Assessment started successfully'
      };

    } catch (error) {
      await this._logError('ASSESSMENT_START_FAILED', {
        assessmentId,
        candidateId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Submit stage response
   * Validates, scores, and progresses or fails
   */
  async submitStage(submissionId, stage, submissionData, files = []) {
    try {
      // Get current assessment state
      const state = await this.stateMachine.getAssessmentState(submissionId);

      if (state.isTerminal) {
        throw new Error(`Assessment is in terminal state: ${state.status}`);
      }

      if (state.currentStage !== stage) {
        throw new Error(`Cannot submit ${stage}, current stage is ${state.currentStage}`);
      }

      // Load assessment configuration
      const assessment = await this.stateMachine.loadAssessment(state.assessmentId);
      const stageConfig = assessment.stages[stage];

      // Validate files if required
      if (files.length > 0) {
        const fileValidation = await this.fileEnforcer.validateFiles(
          files,
          stageConfig.fileRequirements || {},
          submissionId
        );

        if (!fileValidation.valid) {
          // File validation failure = immediate termination
          return await this._terminateForViolations(
            submissionId,
            stage,
            fileValidation.violations
          );
        }

        // Add validated files to submission data
        submissionData.validatedFiles = fileValidation.processedFiles;
      }

      // Execute stage-specific validation
      const stageResult = await this.stageExecutor.executeStage(
        submissionId,
        stage,
        submissionData
      );

      // Check for hard failures
      if (stageResult.hardFail) {
        return await this._terminateForViolations(
          submissionId,
          stage,
          stageResult.violations
        );
      }

      // Handle stage completion based on result
      if (stageResult.passed) {
        return await this._handleStagePass(submissionId, stage, stageResult);
      } else {
        return await this._handleStageFail(submissionId, stage, stageResult);
      }

    } catch (error) {
      await this._logError('STAGE_SUBMISSION_FAILED', {
        submissionId,
        stage,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle successful stage completion
   */
  async _handleStagePass(submissionId, stage, stageResult) {
    try {
      // Determine next stage
      const nextStage = this._getNextStage(stage);

      if (nextStage === 'completed') {
        // Assessment completed successfully
        await this.stateMachine.advanceToStage(submissionId, 'completed', stageResult);

        const finalScore = await this._calculateFinalScore(submissionId);

        await this._logAction('ASSESSMENT_COMPLETED', {
          submissionId,
          stage,
          finalScore,
          outcome: 'PASSED'
        });

        return {
          success: true,
          stage,
          passed: true,
          completed: true,
          score: stageResult.score,
          finalScore,
          message: 'Assessment completed successfully'
        };
      } else {
        // Progress to next stage
        await this.stateMachine.advanceToStage(submissionId, nextStage, stageResult);

        await this._logAction('STAGE_COMPLETED', {
          submissionId,
          stage,
          nextStage,
          score: stageResult.score,
          outcome: 'PASSED'
        });

        return {
          success: true,
          stage,
          passed: true,
          completed: false,
          score: stageResult.score,
          nextStage,
          timeLimit: this.STAGE_TIMEOUTS[nextStage],
          message: `Stage ${stage} passed. Advanced to ${nextStage}`
        };
      }

    } catch (error) {
      await this._logError('STAGE_PASS_HANDLING_FAILED', {
        submissionId,
        stage,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle stage failure
   */
  async _handleStageFail(submissionId, stage, stageResult) {
    try {
      // Advance to failed state
      await this.stateMachine.advanceToStage(submissionId, 'failed', stageResult);

      await this._logAction('STAGE_FAILED', {
        submissionId,
        stage,
        score: stageResult.score,
        violations: stageResult.violations,
        outcome: 'FAILED'
      });

      return {
        success: false,
        stage,
        passed: false,
        completed: true,
        score: stageResult.score,
        violations: stageResult.violations,
        message: `Assessment failed at stage ${stage}`
      };

    } catch (error) {
      await this._logError('STAGE_FAIL_HANDLING_FAILED', {
        submissionId,
        stage,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Terminate assessment for rule violations
   */
  async _terminateForViolations(submissionId, stage, violations) {
    try {
      const criticalViolations = violations.filter(v => v.severity === 'critical');

      const stageResult = {
        passed: false,
        hardFail: true,
        score: 0,
        violations,
        terminationReason: criticalViolations.length > 0 ? 'CRITICAL_VIOLATION' : 'RULE_VIOLATION'
      };

      await this.stateMachine.advanceToStage(submissionId, 'failed', stageResult);

      await this._logAction('ASSESSMENT_TERMINATED', {
        submissionId,
        stage,
        violations,
        terminationReason: stageResult.terminationReason,
        outcome: 'TERMINATED'
      });

      return {
        success: false,
        stage,
        passed: false,
        completed: true,
        terminated: true,
        score: 0,
        violations,
        message: 'Assessment terminated due to rule violations'
      };

    } catch (error) {
      await this._logError('TERMINATION_HANDLING_FAILED', {
        submissionId,
        stage,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get assessment status and current state
   */
  async getAssessmentStatus(submissionId) {
    try {
      const state = await this.stateMachine.getAssessmentState(submissionId);
      const submission = await SpideyAssessmentSubmission.findById(submissionId);

      return {
        success: true,
        submissionId,
        assessmentId: state.assessmentId,
        assessmentTitle: state.assessmentTitle,
        candidateId: state.candidateId,
        currentStage: state.currentStage,
        status: state.status,
        isComplete: state.isTerminal,
        startedAt: state.startedAt,
        lastActivityAt: state.lastActivityAt,
        completedAt: state.completedAt,
        timeSpent: submission?.getTimeSpentInMinutes() || 0,
        stageHistory: state.stageHistory,
        ruleViolations: state.ruleViolations,
        finalScore: submission?.finalScore,
        availableActions: this._getAvailableActions(state)
      };

    } catch (error) {
      await this._logError('STATUS_RETRIEVAL_FAILED', {
        submissionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate final assessment score
   */
  async _calculateFinalScore(submissionId) {
    try {
      const submission = await SpideyAssessmentSubmission.findById(submissionId)
        .populate('assessmentId');

      const assessment = submission.assessmentId;
      const scoringWeights = assessment.scoring?.weights || {
        stage1: 0.20,
        stage2: 0.30,
        stage3: 0.30,
        stage4: 0.20
      };

      let totalScore = 0;
      let totalWeight = 0;

      // Calculate weighted score from stage history
      for (const stageRecord of submission.stageHistory) {
        const stageWeight = scoringWeights[stageRecord.stage] || 0;
        totalScore += (stageRecord.score || 0) * stageWeight;
        totalWeight += stageWeight;
      }

      const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

      // Update submission with final score
      // Note: submission.finalScore is an object in the schema, we might need to adapt this
      if (typeof submission.finalScore === 'object') {
        submission.finalScore.percentage = finalScore;
        submission.finalScore.passed = finalScore >= (assessment.scoring?.passingScore || 85);
      } else {
        submission.finalScore = finalScore;
      }

      await submission.save();

      return finalScore;

    } catch (error) {
      await this._logError('FINAL_SCORE_CALCULATION_FAILED', {
        submissionId,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Get next stage in progression
   */
  _getNextStage(currentStage) {
    const progression = {
      'stage1': 'stage2',
      'stage2': 'stage3',
      'stage3': 'stage4',
      'stage4': 'completed'
    };

    return progression[currentStage] || 'completed';
  }

  /**
   * Get available actions based on current state
   */
  _getAvailableActions(state) {
    if (state.isTerminal) {
      return ['view_results'];
    }

    const actions = ['submit_stage', 'get_status'];

    if (state.currentStage && this.STAGE_TIMEOUTS[state.currentStage]) {
      actions.push('check_time_remaining');
    }

    return actions;
  }

  /**
   * Check for time violations and auto-expire
   */
  async checkTimeViolations(submissionId) {
    try {
      const submission = await SpideyAssessmentSubmission.findById(submissionId);

      if (submission.isExpired()) {
        const stageResult = {
          passed: false,
          hardFail: true,
          score: 0,
          violations: [{
            rule: 'TIME_EXPIRED',
            description: 'Assessment time limit exceeded',
            severity: 'critical'
          }],
          terminationReason: 'TIME_EXPIRED'
        };

        await this.stateMachine.advanceToStage(submissionId, 'failed', stageResult);

        await this._logAction('ASSESSMENT_EXPIRED', {
          submissionId,
          expirationTime: submission.expiresAt,
          outcome: 'EXPIRED'
        });

        return {
          expired: true,
          message: 'Assessment has expired'
        };
      }

      return {
        expired: false,
        timeRemaining: Math.max(0, submission.expiresAt.getTime() - Date.now()),
        message: 'Assessment is still active'
      };

    } catch (error) {
      await this._logError('TIME_CHECK_FAILED', {
        submissionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get assessment analytics for admin review
   */
  async getAssessmentAnalytics(assessmentId) {
    try {
      const submissions = await SpideyAssessmentSubmission.find({
        assessmentId
      }).populate('candidateId assessmentId');

      const analytics = {
        totalSubmissions: submissions.length,
        completed: submissions.filter(s => s.status === 'completed').length,
        failed: submissions.filter(s => s.status === 'failed').length,
        inProgress: submissions.filter(s => s.status === 'in_progress').length,
        expired: submissions.filter(s => s.status === 'expired').length,

        passRate: 0,
        averageFinalScore: 0,
        averageTimeSpent: 0,

        stageFailures: {
          stage1: 0,
          stage2: 0,
          stage3: 0,
          stage4: 0
        },

        commonViolations: new Map(),

        passRateByStage: {
          stage1: 0,
          stage2: 0,
          stage3: 0,
          stage4: 0
        }
      };

      // Calculate pass rate
      const completedSubmissions = submissions.filter(s =>
        ['completed', 'failed'].includes(s.status)
      );

      if (completedSubmissions.length > 0) {
        analytics.passRate = (analytics.completed / completedSubmissions.length) * 100;
      }

      // Calculate averages
      const passedSubmissions = submissions.filter(s => s.status === 'completed');

      if (passedSubmissions.length > 0) {
        analytics.averageFinalScore = passedSubmissions.reduce((sum, s) =>
          sum + (s.finalScore?.percentage || 0), 0
        ) / passedSubmissions.length;

        analytics.averageTimeSpent = passedSubmissions.reduce((sum, s) =>
          sum + s.getTimeSpentInMinutes(), 0
        ) / passedSubmissions.length;
      }

      // Analyze stage failures and violations
      for (const submission of submissions) {
        // Count stage failures
        for (const stageRecord of submission.stageHistory) {
          if (!stageRecord.passed) {
            analytics.stageFailures[stageRecord.stage]++;
          }
        }

        // Count violations
        for (const violation of submission.ruleViolations) {
          const count = analytics.commonViolations.get(violation.reason) || 0;
          analytics.commonViolations.set(violation.reason, count + 1);
        }
      }

      // Calculate pass rates by stage
      for (const stage of Object.keys(analytics.passRateByStage)) {
        const stageAttempts = submissions.filter(s =>
          s.stageHistory.some(h => h.stage === stage)
        ).length;

        const stagePasses = submissions.filter(s =>
          s.stageHistory.some(h => h.stage === stage && h.passed)
        ).length;

        if (stageAttempts > 0) {
          analytics.passRateByStage[stage] = (stagePasses / stageAttempts) * 100;
        }
      }

      // Convert violations map to object
      analytics.commonViolations = Object.fromEntries(analytics.commonViolations);

      return analytics;

    } catch (error) {
      await this._logError('ANALYTICS_GENERATION_FAILED', {
        assessmentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Audit logging
   */
  async _logAction(action, details) {
    try {
      const auditEntry = new AuditLog({
        entityType: 'SpideyAssessmentEngine',
        action,
        details,
        success: true,
        source: 'AssessmentEngine'
      });
      await auditEntry.save();
    } catch (error) {
      console.error('Action logging failed:', error);
    }
  }

  async _logError(errorType, details) {
    try {
      const auditEntry = new AuditLog({
        entityType: 'SpideyAssessmentEngine',
        action: `ERROR_${errorType}`,
        details: { ...details, severity: 'ERROR' },
        success: false,
        errorMessage: details.error,
        source: 'AssessmentEngine'
      });
      await auditEntry.save();
    } catch (error) {
      console.error('Error logging failed:', error);
    }
  }
}

export default SpideyAssessmentEngine;