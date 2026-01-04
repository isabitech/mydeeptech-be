import mongoose from 'mongoose';
import SpideyAssessmentConfig from '../models/spideyAssessmentConfig.model.js';
import SpideyAssessmentSubmission from '../models/spideyAssessmentSubmission.model.js';
import AuditLog from '../models/auditLog.model.js';

/**
 * SPIDEY FINAL DECISION & AUDIT ENGINE
 * Enforces NON-NEGOTIABLE final decision rules
 * Comprehensive audit logging for admin review
 */
class SpideyFinalDecisionEngine {
  constructor() {
    // Final decision rules - IMMUTABLE
    this.DECISION_RULES = {
      REQUIRE_ALL_STAGES_PASSED: true,      // ALL stages must pass
      ANY_HARD_FAIL_TERMINATES: true,      // ANY hard fail = immediate termination
      NO_MANUAL_OVERRIDES: true,           // NO manual overrides allowed
      MINIMUM_PASS_SCORE: 80,              // Minimum overall score to pass
      CRITICAL_VIOLATIONS_FAIL: true       // ANY critical violation = fail
    };

    // Audit categories for comprehensive logging
    this.AUDIT_CATEGORIES = {
      STAGE_ENTRY: 'stage_entry',
      STAGE_EXIT: 'stage_exit',
      VALIDATION_FAILURE: 'validation_failure',
      RULE_VIOLATION: 'rule_violation',
      FINAL_OUTCOME: 'final_outcome',
      TIME_TRACKING: 'time_tracking',
      SECURITY_EVENT: 'security_event',
      SYSTEM_ERROR: 'system_error'
    };
  }

  /**
   * Make final assessment decision
   * Applies all non-negotiable rules
   */
  async makeFinalDecision(submissionId) {
    try {
      const submission = await SpideyAssessmentSubmission.findById(submissionId)
        .populate('assessmentId candidateId');

      if (!submission) {
        throw new Error(`Submission not found: ${submissionId}`);
      }

      const decisionResult = {
        submissionId,
        candidateId: submission.candidateId._id,
        assessmentId: submission.assessmentId._id,
        finalDecision: 'PENDING',
        passed: false,
        score: 0,
        decisionReason: [],
        violations: [],
        stageResults: [],
        decisionTimestamp: new Date(),
        reviewRequired: false,
        retakeAllowed: false
      };

      // RULE 1: Check if assessment is complete
      if (submission.status !== 'completed' && submission.status !== 'failed') {
        decisionResult.finalDecision = 'INCOMPLETE';
        decisionResult.decisionReason.push('Assessment not yet completed');

        await this._logFinalDecision(decisionResult, 'INCOMPLETE_ASSESSMENT');
        return decisionResult;
      }

      // RULE 2: Check for hard fail violations (AUTOMATIC FAIL)
      const hardFailCheck = await this._checkHardFailViolations(submission);
      if (hardFailCheck.hasHardFail) {
        decisionResult.finalDecision = 'FAILED';
        decisionResult.passed = false;
        decisionResult.score = 0;
        decisionResult.violations = hardFailCheck.violations;
        decisionResult.decisionReason.push('Hard fail rule violation detected');

        await this._logFinalDecision(decisionResult, 'HARD_FAIL_TERMINATION');
        return decisionResult;
      }

      // RULE 3: Verify all stages completed and passed
      const stageCheck = await this._verifyAllStagesPassed(submission);
      if (!stageCheck.allPassed) {
        decisionResult.finalDecision = 'FAILED';
        decisionResult.passed = false;
        decisionResult.score = stageCheck.averageScore;
        decisionResult.stageResults = stageCheck.stageResults;
        decisionResult.decisionReason.push('One or more stages failed');

        await this._logFinalDecision(decisionResult, 'STAGE_FAILURE');
        return decisionResult;
      }

      // RULE 4: Calculate and verify minimum score
      const scoreCheck = await this._calculateFinalScore(submission);
      if (scoreCheck.finalScore < this.DECISION_RULES.MINIMUM_PASS_SCORE) {
        decisionResult.finalDecision = 'FAILED';
        decisionResult.passed = false;
        decisionResult.score = scoreCheck.finalScore;
        decisionResult.stageResults = scoreCheck.stageBreakdown;
        decisionResult.decisionReason.push(`Score ${scoreCheck.finalScore} below minimum ${this.DECISION_RULES.MINIMUM_PASS_SCORE}`);

        await this._logFinalDecision(decisionResult, 'INSUFFICIENT_SCORE');
        return decisionResult;
      }

      // RULE 5: Check for critical violations
      const criticalCheck = await this._checkCriticalViolations(submission);
      if (criticalCheck.hasCritical) {
        decisionResult.finalDecision = 'FAILED';
        decisionResult.passed = false;
        decisionResult.score = scoreCheck.finalScore;
        decisionResult.violations = criticalCheck.violations;
        decisionResult.decisionReason.push('Critical rule violations detected');

        await this._logFinalDecision(decisionResult, 'CRITICAL_VIOLATIONS');
        return decisionResult;
      }

      // ALL RULES PASSED - ASSESSMENT PASSED
      decisionResult.finalDecision = 'PASSED';
      decisionResult.passed = true;
      decisionResult.score = scoreCheck.finalScore;
      decisionResult.stageResults = scoreCheck.stageBreakdown;
      decisionResult.decisionReason.push('All requirements met');

      // Update submission with final results
      await this._updateSubmissionWithFinalDecision(submission, decisionResult);

      await this._logFinalDecision(decisionResult, 'ASSESSMENT_PASSED');
      return decisionResult;

    } catch (error) {
      await this._logError('FINAL_DECISION_FAILED', {
        submissionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check for hard fail violations
   */
  async _checkHardFailViolations(submission) {
    const result = {
      hasHardFail: false,
      violations: []
    };

    // Check stage history for hard fails
    for (const stageRecord of submission.stageHistory) {
      if (stageRecord.result && stageRecord.result.hardFail) {
        result.hasHardFail = true;
        result.violations.push({
          stage: stageRecord.stage,
          violation: 'HARD_FAIL_DETECTED',
          details: stageRecord.result.violations || [],
          timestamp: stageRecord.completedAt
        });
      }
    }

    // Check global rule violations
    for (const violation of submission.ruleViolations) {
      if (violation.severity === 'critical') {
        result.hasHardFail = true;
        result.violations.push({
          violation: violation.reason,
          details: violation.details,
          timestamp: violation.timestamp
        });
      }
    }

    return result;
  }

  /**
   * Verify all stages completed and passed
   */
  async _verifyAllStagesPassed(submission) {
    const result = {
      allPassed: false,
      stageResults: [],
      averageScore: 0
    };

    const requiredStages = ['stage1', 'stage2', 'stage3', 'stage4'];
    let totalScore = 0;
    let completedStages = 0;

    for (const requiredStage of requiredStages) {
      const stageRecord = submission.stageHistory.find(h => h.stage === requiredStage);

      if (!stageRecord) {
        result.stageResults.push({
          stage: requiredStage,
          completed: false,
          passed: false,
          score: 0,
          reason: 'Stage not completed'
        });
      } else {
        result.stageResults.push({
          stage: requiredStage,
          completed: true,
          passed: stageRecord.passed,
          score: stageRecord.score || 0,
          completedAt: stageRecord.completedAt,
          violations: stageRecord.violations || []
        });

        if (stageRecord.passed) {
          totalScore += stageRecord.score || 0;
          completedStages++;
        }
      }
    }

    result.averageScore = completedStages > 0 ? Math.round(totalScore / completedStages) : 0;
    result.allPassed = result.stageResults.length === requiredStages.length && result.stageResults.every(s => s.passed);

    return result;
  }

  /**
   * Calculate weighted final score
   */
  async _calculateFinalScore(submission) {
    const assessment = submission.assessmentId;
    const scoringWeights = assessment.scoring?.weights || {
      stage1: 0.15,  // 15% - Guideline comprehension
      stage2: 0.30,  // 30% - Task design quality
      stage3: 0.35,  // 35% - Golden solution quality
      stage4: 0.20   // 20% - Integrity check
    };

    const result = {
      finalScore: 0,
      stageBreakdown: [],
      calculationMethod: 'weighted_average'
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const stageRecord of submission.stageHistory) {
      const stageWeight = scoringWeights[stageRecord.stage] || 0;
      const stageScore = stageRecord.score || 0;

      weightedSum += stageScore * stageWeight;
      totalWeight += stageWeight;

      result.stageBreakdown.push({
        stage: stageRecord.stage,
        score: stageScore,
        weight: stageWeight,
        weightedScore: stageScore * stageWeight,
        passed: stageRecord.passed
      });
    }

    result.finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    return result;
  }

  /**
   * Check for critical violations across all stages
   */
  async _checkCriticalViolations(submission) {
    const result = {
      hasCritical: false,
      violations: []
    };

    // Check stage-level critical violations
    for (const stageRecord of submission.stageHistory) {
      if (stageRecord.violations) {
        const criticalViolations = stageRecord.violations.filter(v =>
          v.severity === 'critical'
        );

        if (criticalViolations.length > 0) {
          result.hasCritical = true;
          result.violations.push(...criticalViolations.map(v => ({
            ...v,
            stage: stageRecord.stage,
            timestamp: stageRecord.completedAt
          })));
        }
      }
    }

    // Check global critical violations
    const globalCritical = submission.ruleViolations.filter(v =>
      v.severity === 'critical'
    );

    if (globalCritical.length > 0) {
      result.hasCritical = true;
      result.violations.push(...globalCritical);
    }

    return result;
  }

  /**
   * Update submission with final decision
   */
  async _updateSubmissionWithFinalDecision(submission, decisionResult) {
    if (typeof submission.finalScore === 'object') {
      submission.finalScore.percentage = decisionResult.score;
      submission.finalScore.passed = decisionResult.passed;
    } else {
      submission.finalScore = decisionResult.score;
    }

    submission.status = decisionResult.passed ? 'completed' : 'failed';
    submission.completedAt = decisionResult.decisionTimestamp;

    // Add final decision to audit trail
    submission.addAuditEntry('FINAL_DECISION_MADE', {
      decision: decisionResult.finalDecision,
      passed: decisionResult.passed,
      score: decisionResult.score,
      reason: decisionResult.decisionReason,
      timestamp: decisionResult.decisionTimestamp
    });

    await submission.save();
  }

  /**
   * Generate comprehensive audit report
   */
  async generateAuditReport(submissionId) {
    try {
      const submission = await SpideyAssessmentSubmission.findById(submissionId)
        .populate('assessmentId candidateId');

      const auditLogs = await AuditLog.find({
        $or: [
          { submissionId: submissionId },
          { 'details.submissionId': submissionId }
        ]
      }).sort({ timestamp: 1 });

      const report = {
        submissionId,
        candidateId: submission.candidateId._id,
        candidateEmail: submission.candidateId.email,
        assessmentTitle: submission.assessmentId.title,
        reportGeneratedAt: new Date(),

        // Timeline
        timeline: {
          started: submission.startedAt,
          completed: submission.completedAt,
          totalDuration: submission.getTimeSpentInMinutes(),
          stageTimings: []
        },

        // Stage progression
        stageProgression: [],

        // Violations and rule enforcement
        ruleEnforcement: {
          totalViolations: submission.ruleViolations.length,
          criticalViolations: 0,
          errorViolations: 0,
          warningViolations: 0,
          violationDetails: []
        },

        // Final outcome
        finalOutcome: {
          decision: submission.status,
          passed: submission.status === 'completed',
          finalScore: typeof submission.finalScore === 'object' ? submission.finalScore.percentage : submission.finalScore,
          stageScores: [],
          decisionFactors: []
        },

        // Security and integrity
        securityEvents: [],

        // System interactions
        systemEvents: auditLogs.map(log => ({
          timestamp: log.timestamp,
          action: log.action,
          source: log.source,
          details: log.details
        })),

        // Reproducibility data
        reproducibilityData: {
          assessmentConfigVersion: submission.assessmentId.version || '1.0',
          engineVersion: '1.0.0',
          decisionRuleSet: this.DECISION_RULES,
          auditTrailComplete: true
        }
      };

      // Build stage progression timeline
      for (const stageRecord of submission.stageHistory) {
        report.stageProgression.push({
          stage: stageRecord.stage,
          started: stageRecord.result?.submittedAt || stageRecord.completedAt,
          completed: stageRecord.completedAt,
          duration: stageRecord.result?.timeSpent || 0,
          passed: stageRecord.passed,
          score: stageRecord.score,
          violations: stageRecord.violations || []
        });

        report.finalOutcome.stageScores.push({
          stage: stageRecord.stage,
          score: stageRecord.score || 0,
          passed: stageRecord.passed
        });
      }

      // Analyze rule violations
      for (const violation of submission.ruleViolations) {
        if (violation.severity === 'critical') report.ruleEnforcement.criticalViolations++;
        else if (violation.severity === 'error') report.ruleEnforcement.errorViolations++;
        else if (violation.severity === 'warning') report.ruleEnforcement.warningViolations++;

        report.ruleEnforcement.violationDetails.push({
          reason: violation.reason,
          severity: violation.severity,
          details: violation.details,
          timestamp: violation.timestamp
        });
      }

      // Extract security events
      report.securityEvents = auditLogs
        .filter(log => log.action.includes('SECURITY') || log.action.includes('SUSPICIOUS'))
        .map(log => ({
          timestamp: log.timestamp,
          event: log.action,
          details: log.details
        }));

      // Store audit report
      await this._storeAuditReport(report);

      return report;

    } catch (error) {
      await this._logError('AUDIT_REPORT_GENERATION_FAILED', {
        submissionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate decision reproducibility
   * Ensures all decisions can be recreated from audit logs
   */
  async validateDecisionReproducibility(submissionId) {
    try {
      const submission = await SpideyAssessmentSubmission.findById(submissionId);
      const auditLogs = await AuditLog.find({
        $or: [
          { submissionId: submissionId },
          { 'details.submissionId': submissionId }
        ]
      }).sort({ timestamp: 1 });

      const validation = {
        reproducible: true,
        issues: [],
        auditTrailComplete: true,
        decisionFactorsVerified: true,
        timestamp: new Date()
      };

      // Check audit trail completeness
      const requiredEvents = [
        'ASSESSMENT_STARTED',
        'STAGE_ADVANCED',
        'STAGE_COMPLETED',
        'FINAL_DECISION_MADE'
      ];

      for (const requiredEvent of requiredEvents) {
        const eventExists = auditLogs.some(log => log.action === requiredEvent);
        if (!eventExists) {
          validation.issues.push(`Missing required audit event: ${requiredEvent}`);
          validation.auditTrailComplete = false;
        }
      }

      // Verify stage progression logic
      let expectedStage = 'stage1';
      for (const stageRecord of submission.stageHistory) {
        if (stageRecord.stage !== expectedStage) {
          validation.issues.push(`Stage progression error: expected ${expectedStage}, found ${stageRecord.stage}`);
          validation.reproducible = false;
        }

        if (stageRecord.passed) {
          expectedStage = this._getNextStage(expectedStage);
        } else {
          expectedStage = 'failed';
          break;
        }
      }

      // Verify scoring calculations
      const recalculatedScore = await this._recalculateFinalScore(submission);
      const currentScore = typeof submission.finalScore === 'object' ? submission.finalScore.percentage : submission.finalScore;
      if (Math.abs(recalculatedScore - (currentScore || 0)) > 1) {
        validation.issues.push(`Score calculation mismatch: stored ${currentScore}, recalculated ${recalculatedScore}`);
        validation.decisionFactorsVerified = false;
      }

      validation.reproducible = validation.issues.length === 0;

      // Log validation result
      await this._logValidation(submissionId, validation);

      return validation;

    } catch (error) {
      await this._logError('REPRODUCIBILITY_VALIDATION_FAILED', {
        submissionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Helper methods
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

  async _recalculateFinalScore(submission) {
    const scoreCheck = await this._calculateFinalScore(submission);
    return scoreCheck.finalScore;
  }

  /**
   * Audit and logging methods
   */
  async _logFinalDecision(decisionResult, category) {
    const auditEntry = new AuditLog({
      assessmentId: decisionResult.assessmentId,
      submissionId: decisionResult.submissionId,
      userId: decisionResult.candidateId,
      action: 'FINAL_DECISION_MADE',
      success: true,
      details: {
        category,
        decision: decisionResult.finalDecision,
        passed: decisionResult.passed,
        score: decisionResult.score,
        reason: decisionResult.decisionReason,
        violations: decisionResult.violations,
        timestamp: decisionResult.decisionTimestamp
      },
      source: 'FinalDecisionEngine'
    });
    await auditEntry.save();
  }

  async _logValidation(submissionId, validation) {
    const auditEntry = new AuditLog({
      submissionId: submissionId,
      action: 'AUDIT_GENERATED',
      success: true,
      details: validation,
      source: 'FinalDecisionEngine'
    });
    // Note: AuditLog requires assessmentId and userId
    // We'd need to fetch them if needed, but for now I'll skip if schema is strict
    // Assuming required fields must be present
    const submission = await SpideyAssessmentSubmission.findById(submissionId);
    if (submission) {
      auditEntry.assessmentId = submission.assessmentId;
      auditEntry.userId = submission.candidateId;
      await auditEntry.save();
    }
  }

  async _storeAuditReport(report) {
    const auditEntry = new AuditLog({
      assessmentId: report.assessmentId || (await SpideyAssessmentSubmission.findById(report.submissionId))?.assessmentId,
      submissionId: report.submissionId,
      userId: report.candidateId,
      action: 'AUDIT_GENERATED',
      success: true,
      details: {
        reportId: new mongoose.Types.ObjectId(),
        summary: {
          candidateId: report.candidateId,
          finalDecision: report.finalOutcome.decision,
          totalViolations: report.ruleEnforcement.totalViolations,
          auditTrailComplete: report.reproducibilityData.auditTrailComplete
        },
        fullReport: report
      },
      source: 'FinalDecisionEngine'
    });
    await auditEntry.save();
  }

  async _logError(errorType, details) {
    try {
      const auditEntry = new AuditLog({
        action: `ERROR_${errorType}`,
        success: false,
        errorMessage: details.error,
        details: { ...details, severity: 'ERROR' },
        source: 'FinalDecisionEngine'
      });
      // Try to fill in IDs if available in details
      if (details.submissionId) {
        auditEntry.submissionId = details.submissionId;
        const sub = await SpideyAssessmentSubmission.findById(details.submissionId);
        if (sub) {
          auditEntry.assessmentId = sub.assessmentId;
          auditEntry.userId = sub.candidateId;
        }
      }
      await auditEntry.save();
    } catch (error) {
      console.error('Error logging failed:', error);
    }
  }
}

export default SpideyFinalDecisionEngine;