const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * SPIDEY FILE & CONTENT ENFORCEMENT LAYER
 * Server-side validation ONLY - never trust frontend
 * Blocks forbidden formats globally and enforces content requirements
 */
class SpideyFileEnforcer {
  constructor() {
    // Globally forbidden formats - IMMUTABLE
    this.FORBIDDEN_FORMATS = [
      '.xlsx', '.xls', '.xlsm', '.xlsb',  // Excel formats
      '.exe', '.bat', '.cmd', '.scr',     // Executables
      '.zip', '.rar', '.7z',              // Archives (unless specifically allowed)
      '.js', '.ts', '.py',                // Code files (unless specifically allowed)
      '.html', '.htm',                    // HTML files
      '.php', '.asp', '.jsp'              // Server-side scripts
    ];

    // Content type validation patterns
    this.CONTENT_VALIDATORS = {
      pdf: this._validatePdfContent.bind(this),
      csv: this._validateCsvContent.bind(this),
      txt: this._validateTextContent.bind(this),
      json: this._validateJsonContent.bind(this),
      image: this._validateImageContent.bind(this)
    };

    // File size limits (in bytes)
    this.DEFAULT_LIMITS = {
      maxSize: 50 * 1024 * 1024,    // 50MB
      minSize: 1 * 1024,            // 1KB
      maxFiles: 10
    };

    this.AuditLog = require('../models/auditLog.model');
  }

  /**
   * Validate uploaded files - MAIN ENFORCEMENT POINT
   * All files must pass this check before processing
   */
  async validateFiles(files, requirements = {}, submissionId = null) {
    try {
      const validationResult = {
        valid: true,
        violations: [],
        processedFiles: [],
        totalSize: 0
      };

      // Validate file count
      if (files.length > (requirements.maxFiles || this.DEFAULT_LIMITS.maxFiles)) {
        validationResult.violations.push({
          rule: 'TOO_MANY_FILES',
          description: `Maximum ${requirements.maxFiles || this.DEFAULT_LIMITS.maxFiles} files allowed`,
          severity: 'error'
        });
      }

      // Process each file
      for (const file of files) {
        const fileResult = await this._validateSingleFile(file, requirements);
        
        if (fileResult.violations.length > 0) {
          validationResult.violations.push(...fileResult.violations);
        }

        if (fileResult.valid) {
          validationResult.processedFiles.push(fileResult.fileData);
          validationResult.totalSize += fileResult.fileData.size;
        }
      }

      // Check total size
      const maxTotalSize = requirements.maxTotalSizeMB ? 
        requirements.maxTotalSizeMB * 1024 * 1024 : 
        this.DEFAULT_LIMITS.maxSize;

      if (validationResult.totalSize > maxTotalSize) {
        validationResult.violations.push({
          rule: 'TOTAL_SIZE_EXCEEDED',
          description: `Total size ${Math.round(validationResult.totalSize / (1024*1024))}MB exceeds limit`,
          severity: 'error'
        });
      }

      validationResult.valid = validationResult.violations.length === 0;

      // Log enforcement action
      if (submissionId) {
        await this._logEnforcement(submissionId, 'FILE_VALIDATION', {
          fileCount: files.length,
          totalSize: validationResult.totalSize,
          violations: validationResult.violations,
          valid: validationResult.valid
        });
      }

      return validationResult;

    } catch (error) {
      await this._logError('FILE_VALIDATION_FAILED', { 
        error: error.message, 
        submissionId 
      });
      throw error;
    }
  }

  /**
   * Validate single file - comprehensive checks
   */
  async _validateSingleFile(file, requirements) {
    const result = {
      valid: true,
      violations: [],
      fileData: null
    };

    try {
      // Extract file info
      const fileExtension = path.extname(file.originalname || file.name).toLowerCase();
      const fileName = file.originalname || file.name;
      const fileSize = file.size;
      const mimeType = file.mimetype;

      // 1. FORBIDDEN FORMAT CHECK - GLOBAL ENFORCEMENT
      if (this._isForbiddenFormat(fileExtension, fileName)) {
        result.violations.push({
          rule: 'FORBIDDEN_FORMAT',
          description: `File format ${fileExtension} is globally forbidden`,
          severity: 'critical'
        });
        result.valid = false;
        return result;
      }

      // 2. ALLOWED FORMAT CHECK
      if (requirements.allowedFormats && requirements.allowedFormats.length > 0) {
        const isAllowed = requirements.allowedFormats.some(format => 
          fileExtension === format.toLowerCase() ||
          mimeType === format ||
          fileName.toLowerCase().endsWith(format.toLowerCase())
        );

        if (!isAllowed) {
          result.violations.push({
            rule: 'FORMAT_NOT_ALLOWED',
            description: `Format ${fileExtension} not in allowed list: ${requirements.allowedFormats.join(', ')}`,
            severity: 'error'
          });
        }
      }

      // 3. FILE SIZE VALIDATION
      const minSize = requirements.minFileSizeKB ? requirements.minFileSizeKB * 1024 : this.DEFAULT_LIMITS.minSize;
      const maxSize = requirements.maxFileSizeKB ? requirements.maxFileSizeKB * 1024 : this.DEFAULT_LIMITS.maxSize;

      if (fileSize < minSize) {
        result.violations.push({
          rule: 'FILE_TOO_SMALL',
          description: `File size ${Math.round(fileSize/1024)}KB below minimum ${Math.round(minSize/1024)}KB`,
          severity: 'error'
        });
      }

      if (fileSize > maxSize) {
        result.violations.push({
          rule: 'FILE_TOO_LARGE',
          description: `File size ${Math.round(fileSize/(1024*1024))}MB exceeds maximum ${Math.round(maxSize/(1024*1024))}MB`,
          severity: 'error'
        });
      }

      // 4. CONTENT VALIDATION
      const contentValidation = await this._validateFileContent(file, requirements);
      if (contentValidation.violations.length > 0) {
        result.violations.push(...contentValidation.violations);
      }

      // 5. SECURITY SCAN
      const securityValidation = await this._performSecurityScan(file);
      if (securityValidation.violations.length > 0) {
        result.violations.push(...securityValidation.violations);
      }

      // Set validity
      result.valid = result.violations.filter(v => v.severity === 'critical' || v.severity === 'error').length === 0;

      // Build file data if valid
      if (result.valid) {
        result.fileData = {
          originalName: fileName,
          size: fileSize,
          format: fileExtension,
          mimeType: mimeType,
          hash: crypto.createHash('sha256').update(file.buffer || '').digest('hex'),
          uploadedAt: new Date(),
          contentValidation: contentValidation.metadata || {}
        };
      }

      return result;

    } catch (error) {
      result.violations.push({
        rule: 'FILE_PROCESSING_ERROR',
        description: `Error processing file: ${error.message}`,
        severity: 'critical'
      });
      result.valid = false;
      return result;
    }
  }

  /**
   * Check if format is globally forbidden
   */
  _isForbiddenFormat(extension, fileName) {
    // Extension check
    if (this.FORBIDDEN_FORMATS.includes(extension)) {
      return true;
    }

    // Double extension check (e.g., .tar.gz, .doc.exe)
    const parts = fileName.split('.');
    if (parts.length > 2) {
      const lastTwo = '.' + parts.slice(-2).join('.');
      if (this.FORBIDDEN_FORMATS.includes(lastTwo)) {
        return true;
      }
    }

    // Suspicious naming patterns
    const suspiciousPatterns = [
      /\.exe\./i, /\.scr\./i, /\.bat\./i, /\.cmd\./i,
      /script/i, /payload/i, /malware/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(fileName));
  }

  /**
   * Validate file content based on type
   */
  async _validateFileContent(file, requirements) {
    const result = {
      violations: [],
      metadata: {}
    };

    try {
      const extension = path.extname(file.originalname || file.name).toLowerCase();
      
      // Determine content type and validator
      let contentType = null;
      if (['.pdf'].includes(extension)) contentType = 'pdf';
      else if (['.csv'].includes(extension)) contentType = 'csv';
      else if (['.txt', '.md'].includes(extension)) contentType = 'txt';
      else if (['.json'].includes(extension)) contentType = 'json';
      else if (['.png', '.jpg', '.jpeg', '.gif'].includes(extension)) contentType = 'image';

      // Apply content-specific validation
      if (contentType && this.CONTENT_VALIDATORS[contentType]) {
        const contentResult = await this.CONTENT_VALIDATORS[contentType](file, requirements);
        result.violations.push(...contentResult.violations);
        result.metadata = { ...result.metadata, ...contentResult.metadata };
      }

      return result;

    } catch (error) {
      result.violations.push({
        rule: 'CONTENT_VALIDATION_ERROR',
        description: `Content validation failed: ${error.message}`,
        severity: 'error'
      });
      return result;
    }
  }

  /**
   * PDF content validation
   */
  async _validatePdfContent(file, requirements) {
    const result = { violations: [], metadata: {} };

    try {
      // Basic PDF header check
      const buffer = file.buffer;
      if (!buffer || buffer.length < 4) {
        result.violations.push({
          rule: 'INVALID_PDF_HEADER',
          description: 'File does not have valid PDF header',
          severity: 'error'
        });
        return result;
      }

      const header = buffer.slice(0, 4).toString();
      if (header !== '%PDF') {
        result.violations.push({
          rule: 'INVALID_PDF_HEADER',
          description: 'File does not start with PDF signature',
          severity: 'error'
        });
        return result;
      }

      // Estimate page count (simplified)
      const contentStr = buffer.toString('binary');
      const pageMatches = contentStr.match(/\/Type\s*\/Page[^s]/g);
      const estimatedPages = pageMatches ? pageMatches.length : 1;

      result.metadata.estimatedPages = estimatedPages;

      // Check minimum pages requirement
      if (requirements.minPdfPages && estimatedPages < requirements.minPdfPages) {
        result.violations.push({
          rule: 'INSUFFICIENT_PDF_PAGES',
          description: `PDF has ${estimatedPages} pages, minimum ${requirements.minPdfPages} required`,
          severity: 'error'
        });
      }

      return result;

    } catch (error) {
      result.violations.push({
        rule: 'PDF_ANALYSIS_FAILED',
        description: `PDF analysis failed: ${error.message}`,
        severity: 'error'
      });
      return result;
    }
  }

  /**
   * CSV content validation
   */
  async _validateCsvContent(file, requirements) {
    const result = { violations: [], metadata: {} };

    try {
      const content = file.buffer.toString('utf8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      
      result.metadata.rowCount = lines.length;
      result.metadata.estimatedColumns = lines[0] ? lines[0].split(',').length : 0;

      // Check minimum rows requirement
      if (requirements.minFileRowCount && lines.length < requirements.minFileRowCount) {
        result.violations.push({
          rule: 'INSUFFICIENT_CSV_ROWS',
          description: `CSV has ${lines.length} rows, minimum ${requirements.minFileRowCount} required`,
          severity: 'error'
        });
      }

      // Basic CSV format validation
      if (lines.length > 0) {
        const expectedColumns = lines[0].split(',').length;
        const inconsistentRows = lines.filter((line, index) => {
          if (index === 0) return false;
          return line.split(',').length !== expectedColumns;
        });

        if (inconsistentRows.length > 0) {
          result.violations.push({
            rule: 'INCONSISTENT_CSV_FORMAT',
            description: `${inconsistentRows.length} rows have inconsistent column count`,
            severity: 'warning'
          });
        }
      }

      return result;

    } catch (error) {
      result.violations.push({
        rule: 'CSV_ANALYSIS_FAILED',
        description: `CSV analysis failed: ${error.message}`,
        severity: 'error'
      });
      return result;
    }
  }

  /**
   * Text content validation
   */
  async _validateTextContent(file, requirements) {
    const result = { violations: [], metadata: {} };

    try {
      const content = file.buffer.toString('utf8');
      
      result.metadata.characterCount = content.length;
      result.metadata.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      result.metadata.lineCount = content.split('\n').length;

      // Check minimum length requirements
      if (requirements.minCharacters && content.length < requirements.minCharacters) {
        result.violations.push({
          rule: 'INSUFFICIENT_TEXT_LENGTH',
          description: `Text has ${content.length} characters, minimum ${requirements.minCharacters} required`,
          severity: 'error'
        });
      }

      if (requirements.minWords && result.metadata.wordCount < requirements.minWords) {
        result.violations.push({
          rule: 'INSUFFICIENT_WORD_COUNT',
          description: `Text has ${result.metadata.wordCount} words, minimum ${requirements.minWords} required`,
          severity: 'error'
        });
      }

      return result;

    } catch (error) {
      result.violations.push({
        rule: 'TEXT_ANALYSIS_FAILED',
        description: `Text analysis failed: ${error.message}`,
        severity: 'error'
      });
      return result;
    }
  }

  /**
   * JSON content validation
   */
  async _validateJsonContent(file, requirements) {
    const result = { violations: [], metadata: {} };

    try {
      const content = file.buffer.toString('utf8');
      
      // Parse JSON to validate format
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        result.violations.push({
          rule: 'INVALID_JSON_FORMAT',
          description: `Invalid JSON format: ${parseError.message}`,
          severity: 'error'
        });
        return result;
      }

      result.metadata.jsonKeys = Object.keys(parsed);
      result.metadata.jsonStructure = typeof parsed;

      // Check required JSON structure
      if (requirements.requiredJsonKeys) {
        const missingKeys = requirements.requiredJsonKeys.filter(key => 
          !parsed.hasOwnProperty(key)
        );

        if (missingKeys.length > 0) {
          result.violations.push({
            rule: 'MISSING_JSON_KEYS',
            description: `Missing required JSON keys: ${missingKeys.join(', ')}`,
            severity: 'error'
          });
        }
      }

      return result;

    } catch (error) {
      result.violations.push({
        rule: 'JSON_ANALYSIS_FAILED',
        description: `JSON analysis failed: ${error.message}`,
        severity: 'error'
      });
      return result;
    }
  }

  /**
   * Image content validation
   */
  async _validateImageContent(file, requirements) {
    const result = { violations: [], metadata: {} };

    try {
      // Basic image header validation
      const buffer = file.buffer;
      
      // PNG signature check
      if (file.originalname.endsWith('.png')) {
        const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        if (!buffer.slice(0, 8).equals(pngSignature)) {
          result.violations.push({
            rule: 'INVALID_PNG_SIGNATURE',
            description: 'File does not have valid PNG signature',
            severity: 'error'
          });
        }
      }

      // JPEG signature check
      if (file.originalname.match(/\.(jpg|jpeg)$/i)) {
        if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
          result.violations.push({
            rule: 'INVALID_JPEG_SIGNATURE',
            description: 'File does not have valid JPEG signature',
            severity: 'error'
          });
        }
      }

      result.metadata.fileType = 'image';

      return result;

    } catch (error) {
      result.violations.push({
        rule: 'IMAGE_ANALYSIS_FAILED',
        description: `Image analysis failed: ${error.message}`,
        severity: 'error'
      });
      return result;
    }
  }

  /**
   * Security scan for malicious content
   */
  async _performSecurityScan(file) {
    const result = { violations: [] };

    try {
      const fileName = file.originalname || file.name;
      const content = file.buffer ? file.buffer.toString('binary') : '';

      // Scan for suspicious patterns
      const suspiciousPatterns = [
        /javascript:/i,
        /<script/i,
        /eval\(/i,
        /exec\(/i,
        /system\(/i,
        /shell_exec/i,
        /base64_decode/i,
        /%3Cscript/i
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content) || pattern.test(fileName)) {
          result.violations.push({
            rule: 'SUSPICIOUS_CONTENT_DETECTED',
            description: `Potentially malicious pattern detected`,
            severity: 'critical'
          });
          break;
        }
      }

      // Check for embedded executables
      const executableSignatures = [
        'MZ', // PE executable
        '\x7fELF', // ELF executable
        '\xca\xfe\xba\xbe' // Mach-O executable
      ];

      for (const signature of executableSignatures) {
        if (content.includes(signature)) {
          result.violations.push({
            rule: 'EXECUTABLE_CONTENT_DETECTED',
            description: 'File contains executable code signatures',
            severity: 'critical'
          });
          break;
        }
      }

      return result;

    } catch (error) {
      result.violations.push({
        rule: 'SECURITY_SCAN_FAILED',
        description: `Security scan failed: ${error.message}`,
        severity: 'warning'
      });
      return result;
    }
  }

  /**
   * Check file dependencies
   */
  async validateFileDependencies(files, requirements) {
    const result = {
      valid: true,
      violations: [],
      dependencyMap: new Map()
    };

    try {
      // Check for required file dependencies
      if (requirements.requiredFileDependencies) {
        for (const dependency of requirements.requiredFileDependencies) {
          const dependentFile = files.find(f => 
            f.originalname.includes(dependency.sourceFile)
          );
          
          if (dependentFile) {
            const requiredFiles = dependency.requiredFiles || [];
            const missingFiles = requiredFiles.filter(reqFile => 
              !files.some(f => f.originalname.includes(reqFile))
            );

            if (missingFiles.length > 0) {
              result.violations.push({
                rule: 'MISSING_FILE_DEPENDENCIES',
                description: `File ${dependency.sourceFile} requires: ${missingFiles.join(', ')}`,
                severity: 'error'
              });
            }
          }
        }
      }

      result.valid = result.violations.length === 0;
      return result;

    } catch (error) {
      result.violations.push({
        rule: 'DEPENDENCY_CHECK_FAILED',
        description: `Dependency validation failed: ${error.message}`,
        severity: 'error'
      });
      result.valid = false;
      return result;
    }
  }

  /**
   * Audit logging
   */
  async _logEnforcement(submissionId, action, details) {
    try {
      const auditEntry = new this.AuditLog({
        entityType: 'SpideyFileEnforcement',
        entityId: submissionId,
        action,
        details,
        source: 'FileEnforcer'
      });
      await auditEntry.save();
    } catch (error) {
      console.error('Enforcement logging failed:', error);
    }
  }

  async _logError(errorType, details) {
    try {
      const auditEntry = new this.AuditLog({
        entityType: 'SpideyFileEnforcement',
        action: `ERROR_${errorType}`,
        details: { ...details, severity: 'ERROR' },
        source: 'FileEnforcer'
      });
      await auditEntry.save();
    } catch (error) {
      console.error('Error logging failed:', error);
    }
  }
}

module.exports = SpideyFileEnforcer;