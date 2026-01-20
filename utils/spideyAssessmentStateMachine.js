const mongoose = require('mongoose');

/**
 * SPIDEY ASSESSMENT STATE MACHINE
 * Strict stage transition enforcement with database authority
 * Non-negotiable rule enforcement - no bypasses allowed
 */
class SpideyAssessmentStateMachine {
  constructor() {
    this.SpideyAssessmentConfig = require('../models/spideyAssessmentConfig.model');
    this.SpideyAssessmentSubmission = require('../models/spideyAssessmentSubmission.model');
    this.AuditLog = require('../models/auditLog.model');
    
    // Valid stage transitions - IMMUTABLE
    this.VALID_TRANSITIONS = {
      null: ['stage1'],
      'stage1': ['stage2'],
      'stage2': ['stage3'],  
      'stage3': ['stage4'],
      'stage4': ['completed'],
      'failed': [], // Terminal state
      'completed': [] // Terminal state
    };

    // Stage types for validation
    this.STAGE_TYPES = {
      stage1: 'quiz',
      stage2: 'structured_submission',
      stage3: 'file_and_rubric_submission', 
      stage4: 'trap_evaluation'
    };
  }

  /**
   * Load assessment configuration from database
   * Backend is the ONLY authority on assessment rules
   */
  async loadAssessment(assessmentId) {
    try {
      const assessment = await this.SpideyAssessmentConfig.findById(assessmentId)
        .populate('projectId');
      
      if (!assessment) {
        throw new Error(`Assessment not found: ${assessmentId}`);
      }

      if (!assessment.isActive) {
        throw new Error(`Assessment is not active: ${assessmentId}`);
      }

      return assessment;
    } catch (error) {
      await this._logError('ASSESSMENT_LOAD_FAILED', { assessmentId, error: error.message });
      throw error;
    }
  }

  /**
   * Initialize or load candidate progress
   * Persists state in database with timestamps
   */
  async initializeCandidateProgress(assessmentId, candidateId) {
    try {
      let submission = await this.SpideyAssessmentSubmission.findOne({
        assessmentId,
        candidateId,
        status: { $in: ['in_progress', 'submitted'] }
      });

      if (!submission) {
        // Create new submission with strict initial state
        submission = new this.SpideyAssessmentSubmission({
          assessmentId,
          candidateId,
          currentStage: null, // Must start from null - no shortcuts
          status: 'in_progress',
          stageHistory: [],
          startedAt: new Date(),
          lastActivityAt: new Date(),
          ruleViolations: [],
          auditTrail: []
        });

        await submission.save();
        
        await this._logAudit('ASSESSMENT_STARTED', {
          assessmentId,
          candidateId,
          submissionId: submission._id,
          timestamp: new Date()
        });
      }

      return submission;
    } catch (error) {
      await this._logError('CANDIDATE_INIT_FAILED', { assessmentId, candidateId, error: error.message });
      throw error;
    }
  }

  /**
   * Validate stage transition - STRICT ENFORCEMENT
   * Invalid transitions result in immediate failure
   */
  async validateStageTransition(submissionId, fromStage, toStage) {
    try {
      const submission = await this.SpideyAssessmentSubmission.findById(submissionId);
      
      if (!submission) {
        throw new Error(`Submission not found: ${submissionId}`);
      }

      // Check if already in terminal state
      if (submission.status === 'failed' || submission.status === 'completed') {
        throw new Error(`Assessment already in terminal state: ${submission.status}`);
      }

      // Validate transition against state machine
      const validNextStages = this.VALID_TRANSITIONS[fromStage] || [];
      
      if (!validNextStages.includes(toStage)) {
        // IMMEDIATE FAILURE for invalid transitions
        await this._terminateAssessment(submissionId, 'INVALID_STAGE_TRANSITION', {
          fromStage,
          toStage,
          validTransitions: validNextStages
        });
        throw new Error(`Invalid stage transition: ${fromStage} -> ${toStage}`);
      }

      return true;
    } catch (error) {
      await this._logError('STAGE_TRANSITION_FAILED', { 
        submissionId, 
        fromStage, 
        toStage, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Advance candidate to next stage - SERVER AUTHORITY ONLY
   * Updates progress with strict validation
   */
  async advanceToStage(submissionId, nextStage, stageResult = null) {
    try {
      const submission = await this.SpideyAssessmentSubmission.findById(submissionId);
      const currentStage = submission.currentStage;

      // Validate transition first
      await this.validateStageTransition(submissionId, currentStage, nextStage);

      // Record stage completion if result provided
      if (stageResult && currentStage) {
        submission.stageHistory.push({
          stage: currentStage,
          result: stageResult,
          completedAt: new Date(),
          passed: stageResult.passed,
          score: stageResult.score,
          violations: stageResult.violations || []
        });

        // Check for hard failures
        if (stageResult.hardFail) {
          await this._terminateAssessment(submissionId, 'HARD_FAIL_VIOLATION', {
            stage: currentStage,
            violations: stageResult.violations
          });
          return null;
        }

        // Check if stage failed
        if (!stageResult.passed) {
          await this._terminateAssessment(submissionId, 'STAGE_FAILED', {
            stage: currentStage,
            score: stageResult.score,
            requiredScore: stageResult.requiredScore
          });
          return null;
        }
      }

      // Advance to next stage
      submission.currentStage = nextStage;
      submission.lastActivityAt = new Date();
      
      // Mark as completed if final stage
      if (nextStage === 'completed') {
        submission.status = 'completed';
        submission.completedAt = new Date();
      }

      await submission.save();

      await this._logAudit('STAGE_ADVANCED', {
        submissionId,
        fromStage: currentStage,
        toStage: nextStage,
        timestamp: new Date()
      });

      return submission;
    } catch (error) {
      await this._logError('STAGE_ADVANCE_FAILED', { 
        submissionId, 
        nextStage, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get current assessment state
   * Returns immutable state object
   */
  async getAssessmentState(submissionId) {
    try {
      const submission = await this.SpideyAssessmentSubmission.findById(submissionId)
        .populate('assessmentId');

      if (!submission) {
        throw new Error(`Submission not found: ${submissionId}`);
      }

      return {
        submissionId: submission._id,
        assessmentId: submission.assessmentId._id,
        assessmentTitle: submission.assessmentId.title,
        candidateId: submission.candidateId,
        currentStage: submission.currentStage,
        status: submission.status,
        startedAt: submission.startedAt,
        lastActivityAt: submission.lastActivityAt,
        completedAt: submission.completedAt,
        stageHistory: submission.stageHistory,
        availableTransitions: this.VALID_TRANSITIONS[submission.currentStage] || [],
        isTerminal: ['failed', 'completed'].includes(submission.status),
        ruleViolations: submission.ruleViolations
      };
    } catch (error) {
      await this._logError('STATE_RETRIEVAL_FAILED', { submissionId, error: error.message });
      throw error;
    }
  }

  /**
   * Terminate assessment with failure
   * PRIVATE - Terminal state enforcement
   */
  async _terminateAssessment(submissionId, reason, details = {}) {
    try {
      const submission = await this.SpideyAssessmentSubmission.findById(submissionId);
      
      submission.status = 'failed';
      submission.currentStage = 'failed';
      submission.completedAt = new Date();
      submission.failureReason = reason;
      
      // Record violation
      submission.ruleViolations.push({
        reason,
        details,
        timestamp: new Date()
      });

      await submission.save();

      await this._logAudit('ASSESSMENT_TERMINATED', {
        submissionId,
        reason,
        details,
        timestamp: new Date()
      });

      return submission;
    } catch (error) {
      await this._logError('TERMINATION_FAILED', { submissionId, reason, error: error.message });
      throw error;
    }
  }

  /**
   * Audit logging for compliance
   * All state changes must be logged
   */
  async _logAudit(action, details) {
    try {
      const auditEntry = new this.AuditLog({
        entityType: 'SpideyAssessment',
        action,
        details,
        timestamp: new Date(),
        source: 'StateMachine'
      });
      await auditEntry.save();
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Don't throw - audit failures shouldn't break assessment
    }
  }

  /**
   * Error logging for debugging
   */
  async _logError(errorType, details) {
    try {
      await this._logAudit(`ERROR_${errorType}`, {
        ...details,
        severity: 'ERROR'
      });
    } catch (error) {
      console.error('Error logging failed:', error);
    }
  }
}

module.exports = SpideyAssessmentStateMachine;