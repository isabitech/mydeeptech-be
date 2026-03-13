const AccessCode = require('../models/accessCode.model');
const mongoose = require('mongoose');

class AccessCodeRepository {
    constructor() {}

    /**
     * Get access codes with filtering, sorting, and pagination
     */
    static async getAccessCodes(payloads) {
        const { 
            limit = 10, 
            skip = 0, 
            search, 
            status, 
            type,
            generatedBy,
            assignedUser,
            resourceType,
            isValid,
            expiringDays,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = payloads;

        // Build filter query
        const filterQuery = {};
        
        if (search) {
            filterQuery.$or = [
                { code: { $regex: search, $options: 'i' } },
                { 'assignedTo.name': { $regex: search, $options: 'i' } },
                { 'assignedTo.email': { $regex: search, $options: 'i' } },
                { 'metadata.purpose': { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status) {
            filterQuery.status = status;
        }
        
        if (type) {
            filterQuery.type = type;
        }
        
        if (generatedBy) {
            filterQuery.generatedBy = generatedBy;
        }
        
        if (assignedUser) {
            filterQuery['assignedTo.user'] = assignedUser;
        }
        
        if (resourceType) {
            filterQuery['permissions.resource'] = resourceType;
        }
        
        // Filter for valid codes
        if (isValid === true) {
            const now = new Date();
            filterQuery.$and = [
                { status: 'active' },
                { 'validity.startDate': { $lte: now } },
                { 'validity.endDate': { $gte: now } },
                {
                    $or: [
                        { 'validity.maxUsages': null },
                        { $expr: { $lt: ['$validity.usageCount', '$validity.maxUsages'] } }
                    ]
                }
            ];
        }
        
        // Filter for codes expiring soon
        if (expiringDays) {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + expiringDays);
            filterQuery['validity.endDate'] = { 
                $gte: new Date(),
                $lte: futureDate 
            };
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const [totalCodes, codes] = await Promise.all([
            AccessCode.countDocuments(filterQuery),
            AccessCode.find(filterQuery)
                .populate('generatedBy', 'firstname lastname email')
                .populate('assignedTo.user', 'firstname lastname email')
                .populate('approval.approvedBy', 'firstname lastname email')
                .populate('revocation.revokedBy', 'firstname lastname email')
                .populate('permissions.resourceId')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        return {
            codes,
            pagination: {
                total: totalCodes,
                page: Math.floor(skip / limit) + 1,
                pages: Math.ceil(totalCodes / limit),
                limit,
                hasNext: (skip + limit) < totalCodes,
                hasPrev: skip > 0
            }
        };
    }

    /**
     * Get access code by code string
     */
    static async getAccessCodeByCode(code) {
        const accessCode = await AccessCode.findOne({ code })
            .populate('generatedBy', 'firstname lastname email')
            .populate('assignedTo.user', 'firstname lastname email')
            .populate('approval.approvedBy', 'firstname lastname email')
            .populate('revocation.revokedBy', 'firstname lastname email')
            .populate('permissions.resourceId')
            .lean();

        if (!accessCode) {
            throw new Error('Access code not found');
        }

        return accessCode;
    }

    /**
     * Get access code by ID
     */
    static async getAccessCodeById(codeId) {
        if (!mongoose.isValidObjectId(codeId)) {
            throw new Error('Invalid access code ID format');
        }

        const accessCode = await AccessCode.findById(codeId)
            .populate('generatedBy', 'firstname lastname email role')
            .populate('assignedTo.user', 'firstname lastname email role')
            .populate('approval.approvedBy', 'firstname lastname email')
            .populate('revocation.revokedBy', 'firstname lastname email')
            .populate('permissions.resourceId')
            .populate('usage.usedBy.user', 'firstname lastname email')
            .lean();

        if (!accessCode) {
            throw new Error('Access code not found');
        }

        return accessCode;
    }

    /**
     * Generate new access code
     */
    static async generateAccessCode(codeData) {
        const accessCode = new AccessCode(codeData);
        await accessCode.save();
        
        return await this.getAccessCodeById(accessCode._id);
    }

    /**
     * Validate access code
     */
    static async validateAccessCode(code, validationContext = {}) {
        const { userId, ipAddress, userAgent, deviceInfo } = validationContext;
        
        const accessCode = await AccessCode.findOne({ code });
        
        if (!accessCode) {
            return {
                valid: false,
                reason: 'Invalid access code',
                code: 404
            };
        }

        // Check basic validity
        const now = new Date();
        const timeOfDay = now.toTimeString().substr(0, 5); // HH:MM format
        const dayOfWeek = now.getDay();

        const validationResult = accessCode.canUse(userId, ipAddress, timeOfDay, dayOfWeek);
        
        if (!validationResult.valid) {
            // Log failed validation attempt
            await this.recordUsage(accessCode._id, {
                usedBy: { 
                    user: userId,
                    ipAddress,
                    userAgent,
                    deviceInfo
                },
                action: 'validation_failed',
                resource: 'access_code',
                success: false,
                notes: validationResult.reason
            });
            
            return {
                valid: false,
                reason: validationResult.reason,
                code: 403
            };
        }

        return {
            valid: true,
            accessCode: await this.getAccessCodeById(accessCode._id)
        };
    }

    /**
     * Record access code usage
     */
    static async recordUsage(codeId, usageData) {
        if (!mongoose.isValidObjectId(codeId)) {
            throw new Error('Invalid access code ID format');
        }

        const accessCode = await AccessCode.findById(codeId);
        if (!accessCode) {
            throw new Error('Access code not found');
        }

        await accessCode.recordUsage(usageData);
        return await this.getAccessCodeById(codeId);
    }

    /**
     * Revoke access code
     */
    static async revokeAccessCode(code, revokedBy, reason, isEmergency = false) {
        const accessCode = await AccessCode.findOne({ code });
        if (!accessCode) {
            throw new Error('Access code not found');
        }

        await accessCode.revoke(revokedBy, reason, isEmergency);
        return await this.getAccessCodeById(accessCode._id);
    }

    /**
     * Update access code
     */
    static async updateAccessCode(codeId, updateData) {
        if (!mongoose.isValidObjectId(codeId)) {
            throw new Error('Invalid access code ID format');
        }

        const accessCode = await AccessCode.findByIdAndUpdate(
            codeId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!accessCode) {
            throw new Error('Access code not found or update failed');
        }

        return await this.getAccessCodeById(codeId);
    }

    /**
     * Get usage history for access code
     */
    static async getUsageHistory(code, limit = 50) {
        const accessCode = await AccessCode.findOne({ code })
            .populate('usage.usedBy.user', 'firstname lastname email')
            .select('usage')
            .lean();

        if (!accessCode) {
            throw new Error('Access code not found');
        }

        return accessCode.usage
            .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
            .slice(0, limit);
    }

    /**
     * Get codes by user (generated or assigned)
     */
    static async getCodesByUser(userId, type = 'all') {
        if (!mongoose.isValidObjectId(userId)) {
            throw new Error('Invalid user ID format');
        }

        let filterQuery = {};

        if (type === 'generated') {
            filterQuery.generatedBy = userId;
        } else if (type === 'assigned') {
            filterQuery['assignedTo.user'] = userId;
        } else {
            filterQuery.$or = [
                { generatedBy: userId },
                { 'assignedTo.user': userId }
            ];
        }

        return await AccessCode.find(filterQuery)
            .populate('generatedBy', 'firstname lastname email')
            .populate('assignedTo.user', 'firstname lastname email')
            .populate('permissions.resourceId')
            .sort({ createdAt: -1 })
            .lean();
    }

    /**
     * Get expiring codes (within specified days)
     */
    static async getExpiringCodes(days = 7) {
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(now.getDate() + days);

        return await AccessCode.find({
            status: 'active',
            'validity.endDate': { 
                $gte: now,
                $lte: futureDate 
            }
        })
        .populate('generatedBy', 'firstname lastname email')
        .populate('assignedTo.user', 'firstname lastname email')
        .sort({ 'validity.endDate': 1 })
        .lean();
    }

    /**
     * Cleanup expired codes
     */
    static async cleanupExpiredCodes() {
        const result = await AccessCode.cleanupExpired();
        return {
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        };
    }

    /**
     * Get access code statistics
     */
    static async getAccessCodeStats() {
        const now = new Date();
        
        const stats = await AccessCode.aggregate([
            {
                $addFields: {
                    isCurrentlyValid: {
                        $and: [
                            { $eq: ['$status', 'active'] },
                            { $lte: ['$validity.startDate', now] },
                            { $gte: ['$validity.endDate', now] },
                            {
                                $or: [
                                    { $eq: ['$validity.maxUsages', null] },
                                    { $lt: ['$validity.usageCount', '$validity.maxUsages'] }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                    expired: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
                    revoked: { $sum: { $cond: [{ $eq: ['$status', 'revoked'] }, 1, 0] } },
                    used: { $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] } },
                    currentlyValid: { $sum: { $cond: ['$isCurrentlyValid', 1, 0] } },
                    totalUsages: { $sum: '$validity.usageCount' }
                }
            }
        ]);

        const typeStats = await AccessCode.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalUsages: { $sum: '$validity.usageCount' }
                }
            }
        ]);

        const securityStats = await AccessCode.aggregate([
            {
                $group: {
                    _id: '$security.requireTwoFactor',
                    count: { $sum: 1 }
                }
            }
        ]);

        return {
            overview: stats[0] || {
                total: 0,
                active: 0,
                expired: 0,
                revoked: 0,
                used: 0,
                currentlyValid: 0,
                totalUsages: 0
            },
            byType: typeStats,
            security: {
                twoFactorEnabled: securityStats.find(s => s._id === true)?.count || 0,
                basicSecurity: securityStats.find(s => s._id === false)?.count || 0
            }
        };
    }

    /**
     * Bulk operations
     */
    static async bulkRevoke(codeIds, revokedBy, reason) {
        if (!Array.isArray(codeIds) || codeIds.length === 0) {
            throw new Error('Invalid code IDs array');
        }

        const validCodeIds = codeIds.filter(id => mongoose.isValidObjectId(id));
        
        if (validCodeIds.length === 0) {
            throw new Error('No valid code IDs provided');
        }

        const result = await AccessCode.updateMany(
            { 
                _id: { $in: validCodeIds },
                status: 'active'
            },
            { 
                status: 'revoked',
                'revocation.revokedAt': new Date(),
                'revocation.revokedBy': revokedBy,
                'revocation.reason': reason
            }
        );

        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount
        };
    }

    /**
     * Generate bulk access codes
     */
    static async generateBulkCodes(baseCodeData, count) {
        if (!baseCodeData || count <= 0 || count > 100) {
            throw new Error('Invalid parameters for bulk generation');
        }

        const codes = [];
        for (let i = 0; i < count; i++) {
            const codeData = {
                ...baseCodeData,
                code: await AccessCode.generateUniqueCode()
            };
            
            if (baseCodeData.assignedTo && Array.isArray(baseCodeData.assignedTo)) {
                codeData.assignedTo = baseCodeData.assignedTo[i % baseCodeData.assignedTo.length];
            }
            
            codes.push(codeData);
        }

        const insertedCodes = await AccessCode.insertMany(codes);
        return insertedCodes.map(code => code._id);
    }

    /**
     * Get access analytics for reporting
     */
    static async getAccessAnalytics(startDate, endDate) {
        const matchStage = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        };

        const [dailyUsage, resourceAccess, userActivity] = await Promise.all([
            // Daily usage pattern
            AccessCode.aggregate([
                { $match: matchStage },
                { $unwind: '$usage' },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$usage.usedAt'
                            }
                        },
                        totalAccess: { $sum: 1 },
                        successfulAccess: {
                            $sum: { $cond: ['$usage.success', 1, 0] }
                        },
                        uniqueCodes: { $addToSet: '$_id' }
                    }
                },
                {
                    $addFields: {
                        uniqueCodesCount: { $size: '$uniqueCodes' }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            
            // Resource access patterns
            AccessCode.aggregate([
                { $match: matchStage },
                { $unwind: '$usage' },
                {
                    $group: {
                        _id: '$usage.resource',
                        accessCount: { $sum: 1 },
                        uniqueUsers: { $addToSet: '$usage.usedBy.user' }
                    }
                },
                {
                    $addFields: {
                        uniqueUsersCount: { $size: '$uniqueUsers' }
                    }
                }
            ]),
            
            // User activity
            AccessCode.aggregate([
                { $match: matchStage },
                { $unwind: '$usage' },
                {
                    $group: {
                        _id: '$usage.usedBy.user',
                        accessCount: { $sum: 1 },
                        lastAccess: { $max: '$usage.usedAt' },
                        resources: { $addToSet: '$usage.resource' }
                    }
                },
                {
                    $addFields: {
                        resourcesCount: { $size: '$resources' }
                    }
                },
                { $sort: { accessCount: -1 } },
                { $limit: 100 }
            ])
        ]);

        return {
            dailyUsage,
            resourceAccess,
            userActivity
        };
    }
}

module.exports = AccessCodeRepository;