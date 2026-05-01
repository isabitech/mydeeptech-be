const MicroTaskSubmission = require("../models/microTaskSubmission.model");
const MicroTask = require("../models/microTask.model");
const TaskSlot = require("../models/taskSlot.model");
const SubmissionImage = require("../models/submissionImage.model");
const DTUser = require("../models/dtUser.model");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose");

/**
 * Get user's submissions with pagination
 */
const getUserSubmissions = async (userId) => {
  try {
    const submissions = await MicroTaskSubmission.find({ userId })
      .populate({
        path: "taskId",
        select: "title description category payRate payRateCurrency estimated_time deadline"
      })
      .sort({ createdAt: -1 });

    return submissions;
  } catch (error) {
    console.error("Error getting user submissions:", error);
    throw new Error("Failed to get user submissions");
  }
};

/**
 * Check if user is eligible to start a task
 */
const checkUserEligibility = async (userId, taskId) => {
  try {
    // Check if task exists and is active
    const task = await MicroTask.findById(taskId);
    if (!task || task.status !== "active") {
      return {
        canStart: false,
        reason: "Task not available"
      };
    }

    // Check if user has complete profile
    const user = await DTUser.findById(userId);
    if (!user) {
      return {
        canStart: false,
        reason: "User not found"
      };
    }
    
    if (!user.isMicroTaskProfileComplete()) {
      const requiredFields = [
        !user.fullName && "Full Name",
        !user.personal_info?.country && "Country"
      ].filter(Boolean);

      return {
        canStart: false,
        reason: "Profile incomplete",
        requiredFields
      };
    }

    // Check for existing submission
    const existingSubmission = await MicroTaskSubmission.findOne({
      userId,
      taskId,
      status: { $in: ["in_progress", "completed", "under_review"] }
    });

    if (existingSubmission) {
      return {
        canStart: false,
        reason: "Existing submission found",
        existingSubmission: {
          id: existingSubmission._id.toString(),
          status: existingSubmission.status
        }
      };
    }

    // Check max participants limit
    if (task.maxParticipants) {
      const participantCount = await MicroTaskSubmission.countDocuments({
        taskId,
        status: { $ne: "rejected" }
      });

      if (participantCount >= task.maxParticipants) {
        return {
          canStart: false,
          reason: "Task is full"
        };
      }
    }

    // Check deadline
    if (task.deadline && new Date(task.deadline) < new Date()) {
      return {
        canStart: false,
        reason: "Task deadline has passed"
      };
    }

    return {
      canStart: true
    };
  } catch (error) {
    console.error("Error checking user eligibility:", error);
    throw new Error("Failed to check eligibility");
  }
};

/**
 * Start a new task submission
 */
const startTaskSubmission = async (userId, taskId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Re-check eligibility within transaction
    const eligibilityCheck = await checkUserEligibility(userId, taskId);
    if (!eligibilityCheck.canStart) {
      if (eligibilityCheck.reason === "Profile incomplete") {
        const error = new Error("Profile incomplete");
        error.required_fields = eligibilityCheck.requiredFields;
        throw error;
      }
      if (eligibilityCheck.reason === "Existing submission found") {
        const error = new Error("Existing submission found");
        error.existingSubmission = eligibilityCheck.existingSubmission;
        throw error;
      }
      throw new Error(eligibilityCheck.reason);
    }

    // Get task details
    const task = await MicroTask.findById(taskId).session(session);
    if (!task) {
      throw new Error("Task not found");
    }

    // Get user metadata for auto-population
    const user = await DTUser.findById(userId).session(session);
    const userMetadata = user.getMicroTaskMetadata();

    // Calculate total slots based on task category
    let totalSlots = 0;
    if (task.category === "mask_collection") {
      totalSlots = 20; // 10 Mask A + 10 Mask B slots
    } else if (task.category === "age_progression") {
      totalSlots = 15; // 6 years with varying slots per year
    }

    // Create submission with total_slots
    const submission = new MicroTaskSubmission({
      taskId,
      userId,
      total_slots: totalSlots,
      user_metadata: userMetadata
    });

    await submission.save({ session });

    // Generate task slots based on category (slots are saved separately)
    let slots;
    if (task.category === "mask_collection") {
      slots = TaskSlot.generateMaskCollectionSlots(taskId);
    } else if (task.category === "age_progression") {
      slots = TaskSlot.generateAgeProgressionSlots(taskId);
    }
    
    // Save the generated slots to the database
    if (slots && slots.length > 0) {
      await TaskSlot.insertMany(slots, { session });
    }

    await session.commitTransaction();

    // Populate task details for response
    await submission.populate({
      path: "taskId",
      select: "title description category required_count payRate payRateCurrency instructions quality_guidelines estimated_time deadline"
    });

    return submission;
  } catch (error) {
    await session.abortTransaction();
    console.error("Error starting task submission:", error);
    
    if (error.message === "Profile incomplete" || 
        error.message === "Task not available" || 
        error.message === "Existing submission found") {
      throw error;
    }
    
    throw new Error("Failed to start task submission");
  } finally {
    session.endSession();
  }
};

/**
 * Get detailed submission data with slots and images
 */
const getSubmissionDetails = async (submissionId, userId) => {
  try {
    const submission = await MicroTaskSubmission.findOne({
      _id: submissionId,
      userId
    }).populate({
      path: "taskId",
      select: "title description category required_count payRate payRateCurrency instructions quality_guidelines estimated_time deadline"
    });

    if (!submission) {
      return null;
    }

    // Get task slots with uploaded images
    const slots = await TaskSlot.find({ submissionId }).sort({ sort_order: 1 });
    
    // For each slot, check if there's an uploaded image
    const slotsWithImages = await Promise.all(
      slots.map(async (slot) => {
        const image = await SubmissionImage.findOne({ slotId: slot._id });
        
        return {
          ...slot.toObject(),
          uploaded: !!image,
          image_url: image?.cloudinary_url,
          image_id: image?._id,
          review_status: image?.review_status,
          feedback: image?.feedback
        };
      })
    );

    return {
      ...submission.toObject(),
      slots: slotsWithImages
    };
  } catch (error) {
    console.error("Error getting submission details:", error);
    throw new Error("Failed to get submission details");
  }
};

/**
 * Upload image for a submission slot
 */
const uploadSubmissionImage = async (submissionId, slotId, file, userId) => {
  try {
    // Verify submission ownership and status
    const submission = await MicroTaskSubmission.findOne({
      _id: submissionId,
      userId
    });

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (submission.status !== "in_progress") {
      throw new Error("Submission not editable");
    }

    // Verify slot belongs to this submission
    const slot = await TaskSlot.findOne({
      _id: slotId,
      submissionId
    });

    if (!slot) {
      throw new Error("Slot not found");
    }

    // Upload to Cloudinary
    const cloudinaryResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          folder: `microtasks/${submissionId}`,
          transformation: [
            { width: 800, height: 600, crop: "limit", quality: "auto" },
            { fetch_format: "auto" }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.buffer);
    });

    // Remove existing image if any
    const existingImage = await SubmissionImage.findOne({ slotId });
    if (existingImage) {
      // Delete from Cloudinary
      await cloudinary.uploader.destroy(existingImage.cloudinary_public_id);
      await SubmissionImage.findByIdAndDelete(existingImage._id);
    }

    // Create new submission image record
    const submissionImage = new SubmissionImage({
      submissionId,
      slotId,
      cloudinary_url: cloudinaryResult.secure_url,
      cloudinary_public_id: cloudinaryResult.public_id,
      file_size: file.size,
      mime_type: file.mimetype
    });

    await submissionImage.save();

    // Update submission progress
    await updateSubmissionProgress(submissionId);

    return {
      image_url: cloudinaryResult.secure_url,
      image_id: submissionImage._id
    };
  } catch (error) {
    console.error("Error uploading submission image:", error);
    
    if (error.message === "Submission not found" || 
        error.message === "Slot not found" || 
        error.message === "Submission not editable") {
      throw error;
    }
    
    throw new Error("Failed to upload image");
  }
};

/**
 * Delete image from a submission slot
 */
const deleteSubmissionImage = async (submissionId, slotId, userId) => {
  try {
    // Verify submission ownership and status
    const submission = await MicroTaskSubmission.findOne({
      _id: submissionId,
      userId
    });

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (submission.status !== "in_progress") {
      throw new Error("Submission not editable");
    }

    // Verify slot belongs to this submission
    const slot = await TaskSlot.findOne({
      _id: slotId,
      submissionId
    });

    if (!slot) {
      throw new Error("Slot not found");
    }

    // Find and delete the image
    const image = await SubmissionImage.findOne({ slotId });
    if (image) {
      // Delete from Cloudinary
      await cloudinary.uploader.destroy(image.cloudinary_public_id);
      
      // Delete from database
      await SubmissionImage.findByIdAndDelete(image._id);
      
      // Update submission progress
      await updateSubmissionProgress(submissionId);
    }

    return true;
  } catch (error) {
    console.error("Error deleting submission image:", error);
    
    if (error.message === "Submission not found" || 
        error.message === "Slot not found" || 
        error.message === "Submission not editable") {
      throw error;
    }
    
    throw new Error("Failed to delete image");
  }
};

/**
 * Submit task for review
 */
const submitTaskForReview = async (submissionId, userId) => {
  try {
    // Verify submission ownership and status
    const submission = await MicroTaskSubmission.findOne({
      _id: submissionId,
      userId
    }).populate("taskId", "required_count");

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (submission.status !== "in_progress") {
      throw new Error("Submission not ready");
    }

    // Check if all required slots are filled
    if (submission.completed_slots < submission.total_slots) {
      throw new Error("All slots must be completed");
    }

    // Update submission status
    submission.status = "completed";
    submission.submission_date = new Date();
    await submission.save();

    return submission;
  } catch (error) {
    console.error("Error submitting task for review:", error);
    
    if (error.message === "Submission not found" || 
        error.message === "All slots must be completed" || 
        error.message === "Submission not ready") {
      throw error;
    }
    
    throw new Error("Failed to submit task");
  }
};

/**
 * Update submission progress based on completed slots
 */
const updateSubmissionProgress = async (submissionId) => {
  try {
    const submission = await MicroTaskSubmission.findById(submissionId);
    if (!submission) return;

    // Count completed slots
    const slots = await TaskSlot.find({ submissionId });
    const completedSlots = await Promise.all(
      slots.map(async (slot) => {
        const image = await SubmissionImage.findOne({ slotId: slot._id });
        return !!image;
      })
    );

    const completed_count = completedSlots.filter(Boolean).length;
    const progress_percentage = Math.round((completed_count / slots.length) * 100);

    submission.completed_slots = completed_count;
    submission.progress_percentage = progress_percentage;
    await submission.save();

    return submission;
  } catch (error) {
    console.error("Error updating submission progress:", error);
    throw new Error("Failed to update progress");
  }
};

/**
 * Get review queue for admin/QA reviewers
 */
const getReviewQueue = async (filters = {}, pagination = {}) => {
  try {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      status: { $in: ["completed", "under_review"] }
    };

    if (filters.status && filters.status !== "all") {
      query.status = filters.status;
    }

    if (filters.category && filters.category !== "all") {
      // Need to lookup task category
      const matchingTasks = await MicroTask.find({ 
        category: filters.category,
        is_active: true 
      }).select("_id");
      
      query.taskId = { $in: matchingTasks.map(t => t._id) };
    }

    const submissions = await MicroTaskSubmission.find(query)
      .populate({
        path: "taskId",
        select: "title category payRate payRateCurrency required_count"
      })
      .populate({
        path: "userId",
        select: "first_name last_name email personal_info"
      })
      .sort({ submission_date: 1 }) // Oldest first for fair review
      .skip(skip)
      .limit(limit);

    const total = await MicroTaskSubmission.countDocuments(query);

    return {
      submissions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    };
  } catch (error) {
    console.error("Error getting review queue:", error);
    throw new Error("Failed to get review queue");
  }
};

/**
 * Review a submission (Admin/QA)
 */
const reviewSubmission = async (submissionId, reviewData) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { action, feedback, quality_score, slot_reviews, reviewer_id } = reviewData;

    // Get submission
    const submission = await MicroTaskSubmission.findById(submissionId)
      .session(session);

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (!["completed", "under_review"].includes(submission.status)) {
      throw new Error("Submission not in reviewable state");
    }

    // Update submission based on action
    if (action === "approve") {
      submission.status = "approved";
      submission.payment_status = "approved";
    } else if (action === "reject") {
      submission.status = "rejected";
      submission.payment_status = "rejected";
    } else if (action === "partial_approval") {
      submission.status = "partially_rejected";
      submission.payment_status = "pending";
    }

    submission.review_date = new Date();
    submission.reviewer_feedback = feedback;
    submission.quality_score = quality_score;

    await submission.save({ session });

    // Update individual slot reviews if provided
    if (slot_reviews && Array.isArray(slot_reviews)) {
      for (const review of slot_reviews) {
        const image = await SubmissionImage.findOne({ 
          slotId: review.slotId,
          submissionId 
        }).session(session);

        if (image) {
          image.review_status = review.status;
          image.feedback = review.feedback;
          await image.save({ session });
        }
      }
    }

    await session.commitTransaction();

    // Return updated submission with populated data
    const updatedSubmission = await MicroTaskSubmission.findById(submissionId)
      .populate({
        path: "taskId",
        select: "title category payRate payRateCurrency"
      })
      .populate({
        path: "userId",
        select: "first_name last_name email"
      });

    return updatedSubmission;
  } catch (error) {
    await session.abortTransaction();
    console.error("Error reviewing submission:", error);
    
    if (error.message === "Submission not found" || 
        error.message === "Submission not in reviewable state") {
      throw error;
    }
    
    throw new Error("Failed to review submission");
  } finally {
    session.endSession();
  }
};

/**
 * Create task slots for a submission if they don't exist
 */
const createTaskSlots = async (submissionId, userId) => {
  try {
    console.log(`Creating task slots for submission ${submissionId}`);
    
    // Get submission details
    const submission = await MicroTaskSubmission.findById(submissionId).populate('taskId');
    if (!submission) {
      throw new Error("Submission not found");
    }
    
    // Check if user owns this submission (unless admin)
    if (submission.userId.toString() !== userId) {
      throw new Error("Not authorized to access this submission");
    }
    
    console.log(`Found submission for task ${submission.taskId._id} with category ${submission.taskId.category}`);
    
    // Check if slots already exist for this task
    const existingSlots = await TaskSlot.find({ taskId: submission.taskId._id });
    if (existingSlots.length > 0) {
      console.log(`Task already has ${existingSlots.length} slots`);
      return existingSlots;
    }
    
    // Generate slots based on task category
    let slots = [];
    if (submission.taskId.category === "mask_collection") {
      slots = TaskSlot.generateMaskCollectionSlots(submission.taskId._id);
      console.log(`Generated ${slots.length} mask collection slots`);
    } else if (submission.taskId.category === "age_progression") {
      slots = TaskSlot.generateAgeProgressionSlots(submission.taskId._id);
      console.log(`Generated ${slots.length} age progression slots`);
    } else {
      // Create basic slots for unknown categories
      slots = [
        {
          taskId: submission.taskId._id,
          slot_name: "Front Mask A",
          sequence: 1,
          metadata: { angle: "Front", mask_type: "A", image_category: "mask" },
          validation_rules: { required_face_size: 240, lighting_requirements: "good", face_visibility: true },
          slot_instructions: "Upload Front Mask A - Ensure good lighting and face visibility"
        }
      ];
      console.log(`Generated ${slots.length} default slots for category ${submission.taskId.category}`);
    }
    
    if (slots.length > 0) {
      const createdSlots = await TaskSlot.insertMany(slots);
      console.log(`Successfully created ${createdSlots.length} slots for task ${submission.taskId._id}`);
      return createdSlots;
    }
    
    throw new Error(`Could not generate slots for task category: ${submission.taskId.category}`);
    
  } catch (error) {
    console.error("Error creating task slots:", error);
    throw error;
  }
};

module.exports = {
  getUserSubmissions,
  checkUserEligibility,
  startTaskSubmission,
  getSubmissionDetails,
  uploadSubmissionImage,
  deleteSubmissionImage,
  submitTaskForReview,
  updateSubmissionProgress,
  getReviewQueue,
  reviewSubmission,
  createTaskSlots
};