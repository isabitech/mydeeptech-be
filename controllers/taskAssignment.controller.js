const TaskSubmission = require("../models/task-submission.model");
const Task = require("../models/task.model");
const TaskAssignment = require("../models/taskAssignment.model");

/**
 * POST /api/task-assignments
 * Admin assigns a task to one or multiple users
 */
const assignTask = async (req, res) => {
      const { adminId } = req.user;
        const { taskId, userIds } = req.body; // userIds is an array

        // ── 1. Validate fields
        if (!taskId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'taskId and a non-empty userIds array are required.',
            });
        }

        // ── 2. Verify task exists and is active 
        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found.',
            });
        }

        if (!task.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Cannot assign a deactivated task.',
            });
        }

        if (new Date() > new Date(task.dueDate)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot assign a task whose due date has already passed.',
            });
        }

        // ── 3. Find already assigned users to avoid duplicates
        const existingAssignments = await TaskAssignment.find({
            task: taskId,
            assignedTo: { $in: userIds },
        }).select('assignedTo');

        const alreadyAssignedIds = existingAssignments.map(assignment => assignment.assignedTo.toString());

        const newUserIds = userIds.filter(id => !alreadyAssignedIds.includes(id.toString()));

        if (newUserIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'All provided users have already been assigned this task.',
                data: alreadyAssignedIds,
            });
        }

        // ── 4. Bulk create assignments
        const assignments = await TaskAssignment.insertMany(
            newUserIds.map(userId => ({
                task: taskId,
                assignedTo: userId,
                assignedBy: adminId,
                dueDate: task.dueDate, // snapshot due date at assignment time
                status: 'Pending',
            }))
        );

        return res.status(201).json({
            success: true,
            message: `Task assigned to ${assignments.length} user(s) successfully.`,
            data: {
                assigned: assignments,
                // Let admin know if some users were skipped
                skipped: alreadyAssignedIds.length > 0
                    ? {
                        count: alreadyAssignedIds.length,
                        userIds: alreadyAssignedIds,
                        reason: 'Already assigned this task.',
                    }
                    : null,
            },
        });
};


/**
 * GET /api/task-assignments/all
 * Admin fetches all assignments with optional filters
 */
const getAllAssignments = async (req, res) => {
     const { status, taskId, userId, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (taskId) filter.task   = taskId;
        if (userId) filter.assignedTo = userId;

        const assignments = await TaskAssignment.find(filter)
            .populate('task',       'taskName dueDate')
            .populate('assignedTo', 'name email')
            .populate('assignedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await TaskAssignment.countDocuments(filter);

        return res.status(200).json({
            success: true,
            data: assignments,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            },
        });
};


/**
 * PUT /api/task-assignments/:assignmentId/review
 * Admin approves or rejects a submitted assignment
 */
const reviewAssignment = async (req, res) => {
    try {
        const { status, reviewNote } = req.body;

        // ── 1. Only allow valid review statuses ───────────────────────────
        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be either "Approved" or "Rejected".',
            });
        }

        // ── 2. Rejection requires a note ──────────────────────────────────
        if (status === 'Rejected' && !reviewNote) {
            return res.status(400).json({
                success: false,
                message: 'A reviewNote is required when rejecting an assignment.',
            });
        }

        const assignment = await TaskAssignment.findById(req.params.assignmentId);

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found.',
            });
        }

        // ── 3. Can only review submitted assignments
        if (assignment.status !== 'Submitted') {
            return res.status(400).json({
                success: false,
                message: `Only submitted assignments can be reviewed. Current status: "${assignment.status}".`,
            });
        }

        assignment.status     = status;
        assignment.reviewNote = reviewNote || null;
        assignment.reviewedAt = new Date();

        await assignment.save();

        // ── 4. If rejected, reopen the submission so user can re-upload
        if (status === 'Rejected') {
            await TaskSubmission.findOneAndUpdate(
                { assignment: assignment._id },
                { isComplete: false },
            );
        }

        return res.status(200).json({
            success: true,
            message: `Assignment ${status.toLowerCase()} successfully.`,
            data: assignment,
        });

    } catch (error) {
        console.error('[reviewAssignment]', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred.',
        });
    }
};


/**
 * GET /api/task-assignments/my
 * User fetches all their own assignments
 */
const getMyAssignments = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status, page = 1, limit = 20 } = req.query;

        const filter = { assignedTo: userId };
        if (status) filter.status = status;

        const assignments = await TaskAssignment.find(filter)
            .populate('task', 'taskName taskLink taskGuidelineLink dueDate')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await TaskAssignment.countDocuments(filter);

        return res.status(200).json({
            success: true,
            data: assignments,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            },
        });

    } catch (error) {
        console.error('[getMyAssignments]', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred.',
        });
    }
};


/**
 * GET /api/task-assignments/:assignmentId
 * User fetches a single assignment with submission progress
 */
const getAssignmentById = async (req, res) => {
    try {
        const userId = req.user._id;

        const assignment = await TaskAssignment.findOne({
            _id: req.params.assignmentId,
            assignedTo: userId,
        }).populate('task', 'taskName taskLink taskGuidelineLink dueDate imageRequirements');

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found or does not belong to you.',
            });
        }

        // Attach submission progress so user sees everything in one call
        const submission = await TaskSubmission.findOne({
            assignment: assignment._id,
        }).select('uploadProgress isComplete images');

        return res.status(200).json({
            success: true,
            data: {
                assignment,
                submission: submission || null,
            },
        });

    } catch (error) {
        console.error('[getAssignmentById]', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred.',
        });
    }
};


module.exports = {
    assignTask,
    getAllAssignments,
    reviewAssignment,
    getMyAssignments,
    getAssignmentById,
};