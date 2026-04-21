const HVNCAccessCodeService = require('../services/hvnc-access-code.service');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');

/**
 * Validate user access code
 * POST /api/codes/validate
 */
const validateCode = async (req, res) => {
  try {
    const { email, code, device_id } = req.body;

    if (!email || !code || !device_id) {
      await HVNCActivityLog.logSecurityEvent('authentication_failed', {
        reason: 'missing_credentials',
        email,
        device_id,
        provided_fields: { email: !!email, code: !!code, device_id: !!device_id }
      }, {
        ip_address: req.body.ip_address || req.ip,
        user_agent: req.headers['user-agent'],
        severity: 'medium'
      });

      return res.status(400).json({
        valid: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, code, and device_id are required'
        }
      });
    }

    const result = await HVNCAccessCodeService.validateCode(req.body, {
      userAgent: req.headers['user-agent'],
      originalIp: req.body.ip_address || req.ip
    });

    res.status(200).json(result);

  } catch (error) {
    if (error.status && error.code) {
      return res.status(error.status).json({
        valid: false,
        error: {
          code: error.code,
          message: error.message,
          attempts_remaining: error.attempts_remaining
        }
      });
    }

    res.status(500).json({
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Code validation failed'
      }
    });
  }
};

/**
 * User requests new access code via email
 * POST /api/codes/request
 */
const requestCode = async (req, res) => {
  try {
    const { email, device_id } = req.body;

    if (!email || !device_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and device_id are required'
        }
      });
    }

    const result = await HVNCAccessCodeService.requestCode(req.body, {
      userAgent: req.headers['user-agent'],
      originalIp: req.ip
    });

    res.status(200).json(result);

  } catch (error) {
    if (error.status && error.code) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'REQUEST_ERROR',
        message: 'Access code request failed'
      }
    });
  }
};

/**
 * Generate access code for admin use
 * POST /api/codes/generate (Admin only)
 */
const generateCode = async (req, res) => {
  try {
    const { email, device_id } = req.body;

    if (!email || !device_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and device_id are required'
        }
      });
    }

    const result = await HVNCAccessCodeService.generateAdminCode(req.body, {
      adminUser: req.admin,
      userAgent: req.headers['user-agent'],
      originalIp: req.ip,
      return_code: req.body.return_code
    });

    res.status(200).json(result);

  } catch (error) {
    if (error.status && error.code) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'GENERATE_ERROR',
        message: 'Access code generation failed'
      }
    });
  }
};

/**
 * List access codes (Admin only)
 * GET /api/codes/list
 */
const listCodes = async (req, res) => {
  try {
    const filters = {
      email: req.query.email,
      device_id: req.query.device_id,
      status: req.query.status || 'active'
    };

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    const result = await HVNCAccessCodeService.listCodes(filters, pagination);

    res.status(200).json({
      success: true,
      ...result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_ERROR',
        message: 'Failed to list access codes'
      }
    });
  }
};

/**
 * Revoke access code (Admin only)
 * POST /api/codes/{code_id}/revoke
 */
const revokeCode = async (req, res) => {
  try {
    const { code_id } = req.params;
    const { reason = 'admin_revoked' } = req.body;

    const result = await HVNCAccessCodeService.revokeCode(code_id, reason, {
      adminUser: req.admin,
      originalIp: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json(result);

  } catch (error) {
    if (error.status && error.code) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'REVOKE_ERROR',
        message: 'Failed to revoke access code'
      }
    });
  }
};

module.exports = {
  validateCode,
  requestCode,
  generateCode,
  listCodes,
  revokeCode
};