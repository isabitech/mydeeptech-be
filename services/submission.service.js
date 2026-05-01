const MicroTask = require("../models/microTask.model");
const TaskSlot = require("../models/taskSlot.model");
const MicroTaskSubmission = require("../models/microTaskSubmission.model");
const SubmissionImage = require("../models/submissionImage.model");
const DTUser = require("../models/dtUser.model");
const cloudinary = require("../config/cloudinary");

class SubmissionService {

  /**
   * Start a new submission for a user
   * @param {String} taskId - Task ID
   * @param {String} userId - User ID
   * @returns {Object} Created submission
   */
  async startSubmission(taskId, userId) {
    try {
      // Validate task exists and is active
      const task = await MicroTask.findById(taskId);
      if (!task) {
        throw new Error("Task not found");
      }
      if (task.status !== "active") {
        throw new Error("Task is not active");
      }

      // Check if user already has a submission for this task
      const existingSubmission = await MicroTaskSubmission.findOne({ taskId, userId });
      if (existingSubmission) {
        return existingSubmission;
      }

      // Validate user profile is complete
      const user = await DTUser.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      if (!user.isMicroTaskProfileComplete()) {
        throw new Error("Please complete your profile before starting micro tasks. Required: Full name, date of birth, gender, country of residence, and country of origin.");
      }

      // Check max participants limit
      if (task.maxParticipants) {
        const currentParticipants = await MicroTaskSubmission.countDocuments({
          taskId,
          status: { $in: ["in_progress", "completed", "under_review", "approved"] }
        });
        if (currentParticipants >= task.maxParticipants) {
          throw new Error("Task has reached maximum participants limit");
        }
      }

      // Get user metadata for submission
      const userMetadata = user.getMicroTaskMetadata();

      // Create submission
      const submission = new MicroTaskSubmission({
        taskId,
        userId,
        total_slots: task.required_count,
        user_metadata: userMetadata,
        system_metadata: {
          vendor_name: "MyDeep Technologies",
          task_category: task.category,
          platform_version: "1.0"
        },
        payment_amount: task.payRate,
        payment_currency: task.payRateCurrency
      });

      const savedSubmission = await submission.save();

      // Create appropriate slots based on task category
      let slots = [];
      try {
        if (task.category === "mask_collection") {
          slots = TaskSlot.generateMaskCollectionSlots(task._id);
          console.log("Generated mask collection slots:", slots.length);
        } else if (task.category === "age_progression") {
          slots = TaskSlot.generateAgeProgressionSlots(task._id);
          console.log("Generated age progression slots:", slots.length);
        } else {
          console.log("Unknown task category:", task.category);
        }

        // Insert slots if they don't already exist for this task
        if (slots.length > 0) {
          const existingSlots = await TaskSlot.find({ taskId: task._id });
          console.log("Existing slots found:", existingSlots.length);
          
          if (existingSlots.length === 0) {
            const insertedSlots = await TaskSlot.insertMany(slots);
            console.log(`Successfully created ${insertedSlots.length} slots for task ${task._id} (${task.category})`);
          } else {
            console.log("Slots already exist for this task");
          }
        } else {
          console.log("No slots generated for task category:", task.category);
        }
      } catch (error) {
        console.error("Error creating slots:", error);
        // Don't fail the submission creation if slot creation fails
      }

      return await this.getSubmissionById(savedSubmission._id);

    } catch (error) {
      throw new Error(`Error starting submission: ${error.message}`);
    }
  }

  /**
   * Upload image for a specific slot
   * @param {String} submissionId - Submission ID
   * @param {String} slotId - Slot ID
   * @param {Object} fileData - File upload data
   * @param {Object} metadata - Additional metadata (IP, user agent, etc.)
   * @returns {Object} Created submission image
   */
  async uploadImage(submissionId, slotId, fileData, metadata = {}) {
    try {
      // Validate submission exists and belongs to user
      const submission = await MicroTaskSubmission.findById(submissionId);
      if (!submission) {
        throw new Error("Submission not found");
      }
      if (submission.status !== "in_progress") {
        throw new Error("Cannot upload to a submission that is not in progress");
      }

      // Validate slot exists and belongs to task
      const slot = await TaskSlot.findById(slotId);
      if (!slot) {
        throw new Error("Slot not found");
      }
      if (slot.taskId.toString() !== submission.taskId.toString()) {
        throw new Error("Slot does not belong to this task");
      }

      // Check if slot already has an image
      const existingImage = await SubmissionImage.findOne({ submissionId, slotId });
      if (existingImage && existingImage.review_status !== "needs_replacement") {
        throw new Error("Slot already has an image uploaded");
      }

      // Upload to Cloudinary
      const cloudinaryResult = await this.uploadToCloudinary(fileData, {
        folder: "micro-tasks",
        transformation: [
          { width: 1920, height: 1920, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" }
        ]
      });

      // Create submission image record
      const imageData = {
        submissionId,
        slotId,
        cloudinary_data: {
          publicId: cloudinaryResult.public_id,
          url: cloudinaryResult.url,
          secure_url: cloudinaryResult.secure_url,
          optimized_url: cloudinaryResult.url,
          thumbnail_url: cloudinaryResult.url.replace("/upload/", "/upload/w_300,h_300,c_fill/"),
          original_filename: cloudinaryResult.original_filename,
          format: cloudinaryResult.format,
          resource_type: cloudinaryResult.resource_type,
          bytes: cloudinaryResult.bytes,
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          folder: cloudinaryResult.folder
        },
        is_replacement: !!existingImage
      };

      // If this is a replacement, mark the old image
      if (existingImage) {
        imageData.replaces_image = existingImage._id;
        imageData.replacement_reason = "QA requested replacement";
        // Delete old image from Cloudinary
        try {
          await cloudinary.uploader.destroy(existingImage.cloudinary_data.publicId);
        } catch (cloudinaryError) {
          console.warn("Failed to delete old image from Cloudinary:", cloudinaryError);
        }
        // Delete old image record
        await SubmissionImage.findByIdAndDelete(existingImage._id);
      }

      const submissionImage = new SubmissionImage(imageData);
      const savedImage = await submissionImage.save();

      // Update submission progress
      await this.updateSubmissionProgress(submissionId);

      // Update system metadata with request info
      if (metadata.ip || metadata.userAgent) {
        await MicroTaskSubmission.findByIdAndUpdate(submissionId, {
          $set: {
            "system_metadata.submission_ip": metadata.ip || "",
            "system_metadata.user_agent": metadata.userAgent || ""
          }
        });
      }

      return await SubmissionImage.findById(savedImage._id).populate("slotId");

    } catch (error) {
      throw new Error(`Error uploading image: ${error.message}`);
    }
  }

  /**
   * Upload file to Cloudinary
   * @param {Object} fileData - File data (buffer, path, etc.)
   * @param {Object} options - Cloudinary upload options
   * @returns {Object} Cloudinary result
   */
  async uploadToCloudinary(fileData, options = {}) {
    try {
      const defaultOptions = {
        resource_type: "image",
        folder: "micro-tasks",
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        ...options
      };

      let uploadResult;

      if (Buffer.isBuffer(fileData)) {
        // Upload from buffer
        uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            defaultOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(fileData);
        });
      } else if (typeof fileData === 'string') {
        // Upload from file path or base64
        uploadResult = await cloudinary.uploader.upload(fileData, defaultOptions);
      } else {
        throw new Error("Invalid file data format");
      }

      return uploadResult;

    } catch (error) {
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  }

  /**
   * Update submission progress based on uploaded images
   * @param {String} submissionId - Submission ID
   * @returns {Object} Updated submission
   */
  async updateSubmissionProgress(submissionId) {
    try {
      const submission = await MicroTaskSubmission.findById(submissionId);
      if (!submission) {
        throw new Error("Submission not found");
      }

      // Count uploaded images
      const uploadedCount = await SubmissionImage.countDocuments({ submissionId });
      
      // Update progress
      submission.completed_slots = uploadedCount;
      
      // If all slots are filled, mark as completed
      if (uploadedCount >= submission.total_slots) {
        submission.status = "completed";
      }

      await submission.save();
      return submission;

    } catch (error) {
      throw new Error(`Error updating submission progress: ${error.message}`);
    }
  }

  /**
   * Get submission by ID with all images and slots
   * @param {String} submissionId - Submission ID
   * @returns {Object} Complete submission data
   */
  async getSubmissionById(submissionId) {
    try {
      const submission = await MicroTaskSubmission.findById(submissionId)
        .populate("taskId", "title category required_count payRate payRateCurrency")
        .populate("userId", "fullName email")
        .populate("reviewedBy", "fullName email");

      if (!submission) {
        throw new Error("Submission not found");
      }

      // Get images with slot information
      const images = await SubmissionImage.find({ submissionId })
        .populate("slotId")
        .sort({ "slotId.sequence": 1 });

      // Get task slots to show missing ones
      const allSlots = await TaskSlot.find({ taskId: submission.taskId._id })
        .sort({ sequence: 1 });

      // If no slots exist, create them based on task category
      if (allSlots.length === 0) {
        console.log(`No slots found for task ${submission.taskId._id} (${submission.taskId.category}), creating them...`);
        let slots = [];
        
        try {
          if (submission.taskId.category === "mask_collection") {
            slots = TaskSlot.generateMaskCollectionSlots(submission.taskId._id);
            console.log("Generated mask collection slots:", slots.length);
          } else if (submission.taskId.category === "age_progression") {
            slots = TaskSlot.generateAgeProgressionSlots(submission.taskId._id);
            console.log("Generated age progression slots:", slots.length);
          } else {
            console.log("Unknown task category for slot generation:", submission.taskId.category);
          }

          if (slots.length > 0) {
            const createdSlots = await TaskSlot.insertMany(slots);
            console.log(`Successfully created ${createdSlots.length} slots for task ${submission.taskId._id}`);
            
            // Refetch the slots
            const newSlots = await TaskSlot.find({ taskId: submission.taskId._id })
              .sort({ sequence: 1 });
            allSlots.splice(0, allSlots.length, ...newSlots);
            console.log("Refetched slots:", allSlots.length);
          } else {
            console.log("No slots generated for task category:", submission.taskId.category);
          }
        } catch (error) {
          console.error("Error creating slots during submission fetch:", error);
        }
      }

      // Map images to slots
      const slotsWithImages = allSlots.map(slot => {
        const image = images.find(img => img.slotId._id.toString() === slot._id.toString());
        return {
          slot,
          image: image || null,
          uploaded: !!image,
          approved: image ? image.review_status === "approved" : false
        };
      });

      // Create slots array in the format expected by frontend
      const slots = allSlots.map(slot => {
        const image = images.find(img => img.slotId._id.toString() === slot._id.toString());
        return {
          _id: slot._id,
          angle: slot.metadata?.angle || slot.slot_name,
          time_period: slot.metadata?.time_period,
          description: slot.slot_instructions || slot.slot_name,
          sort_order: slot.sequence,
          uploaded: !!image,
          image_url: image?.cloudinary_data?.secure_url,
          image_id: image?._id,
          metadata: slot.metadata || {}
        };
      });

      return {
        ...submission.toJSON(),
        images,
        slots, // Add frontend-compatible slots array
        slotsWithImages, // Keep for backward compatibility
        progress: {
          uploaded: images.length,
          total: submission.total_slots,
          percentage: submission.progress_percentage,
          missing: submission.total_slots - images.length
        }
      };

    } catch (error) {
      throw new Error(`Error fetching submission: ${error.message}`);
    }
  }

  /**
   * Create slots for a task if they don't exist
   * @param {String} taskId - Task ID  
   * @returns {Array} Created slots
   */
  async createTaskSlots(taskId) {
    try {
      // Get task details
      const task = await MicroTask.findById(taskId);
      if (!task) {
        throw new Error("Task not found");
      }

      // Check if slots already exist
      const existingSlots = await TaskSlot.find({ taskId });
      if (existingSlots.length > 0) {
        return existingSlots;
      }

      // Generate slots based on task category
      let slots = [];
      if (task.category === "mask_collection") {
        // Create basic mask collection slots manually if static method fails
        slots = [
          {
            taskId,
            slot_name: "Front Mask A",
            sequence: 1,
            metadata: { angle: "Front", mask_type: "A", image_category: "mask" },
            validation_rules: { required_face_size: 240, lighting_requirements: "good", face_visibility: true },
            slot_instructions: "Upload Front Mask A - Ensure good lighting and face visibility"
          },
          {
            taskId,
            slot_name: "Left 45° Mask A",
            sequence: 2,
            metadata: { angle: "Left 45°", mask_type: "A", image_category: "mask" },
            validation_rules: { required_face_size: 240, lighting_requirements: "good", face_visibility: true },
            slot_instructions: "Upload Left 45° Mask A - Ensure good lighting and face visibility"
          },
          {
            taskId,
            slot_name: "Right 45° Mask A", 
            sequence: 3,
            metadata: { angle: "Right 45°", mask_type: "A", image_category: "mask" },
            validation_rules: { required_face_size: 240, lighting_requirements: "good", face_visibility: true },
            slot_instructions: "Upload Right 45° Mask A - Ensure good lighting and face visibility"
          }
        ];
      } else if (task.category === "age_progression") {
        // Create basic age progression slots
        slots = [
          {
            taskId,
            slot_name: "2021 Image 1",
            sequence: 1,
            metadata: { time_period: "2021", image_category: "age_progression" },
            validation_rules: { required_face_size: 240, lighting_requirements: "good", face_visibility: true },
            slot_instructions: "Upload image from 2021 - No selfies, face must be > 240px"
          },
          {
            taskId,
            slot_name: "2022 Image 1", 
            sequence: 2,
            metadata: { time_period: "2022", image_category: "age_progression" },
            validation_rules: { required_face_size: 240, lighting_requirements: "good", face_visibility: true },
            slot_instructions: "Upload image from 2022 - No selfies, face must be > 240px"
          }
        ];
      }

      if (slots.length > 0) {
        const createdSlots = await TaskSlot.insertMany(slots);
        console.log(`Manually created ${createdSlots.length} slots for task ${taskId}`);
        return createdSlots;
      }

      return [];
    } catch (error) {
      throw new Error(`Error creating task slots: ${error.message}`);
    }
  }

  /**
   * Get user's submissions with pagination
   * @param {String} userId - User ID
   * @param {Object} query - Query options
   * @returns {Object} Submissions with pagination
   */
  async getUserSubmissions(userId, query = {}) {
    try {
      const { page = 1, limit = 10, status } = query;
      const filter = { userId };
      
      if (status) filter.status = status;

      const skip = (page - 1) * limit;

      const [submissions, total] = await Promise.all([
        MicroTaskSubmission.find(filter)
          .populate("taskId", "title category payRate payRateCurrency")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        MicroTaskSubmission.countDocuments(filter)
      ]);

      return {
        submissions,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_items: total,
          total_pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      throw new Error(`Error fetching user submissions: ${error.message}`);
    }
  }

  /**
   * Submit completed submission for review
   * @param {String} submissionId - Submission ID
   * @param {String} userId - User ID for verification
   * @returns {Object} Updated submission
   */
  async submitForReview(submissionId, userId) {
    try {
      const submission = await MicroTaskSubmission.findOne({ _id: submissionId, userId });
      if (!submission) {
        throw new Error("Submission not found or does not belong to user");
      }

      if (submission.status !== "completed") {
        throw new Error("Submission must be completed before submitting for review");
      }

      // Verify all slots are filled
      const uploadedCount = await SubmissionImage.countDocuments({ submissionId });
      if (uploadedCount < submission.total_slots) {
        throw new Error("Please upload images for all required slots before submitting");
      }

      // Update status
      submission.status = "under_review";
      await submission.save();

      return await this.getSubmissionById(submissionId);

    } catch (error) {
      throw new Error(`Error submitting for review: ${error.message}`);
    }
  }

  /**
   * Delete an uploaded image
   * @param {String} submissionId - Submission ID
   * @param {String} imageId - Image ID
   * @param {String} userId - User ID for verification
   * @returns {Object} Deletion result
   */
  async deleteImage(submissionId, imageId, userId) {
    try {
      // Verify submission belongs to user
      const submission = await MicroTaskSubmission.findOne({ _id: submissionId, userId });
      if (!submission) {
        throw new Error("Submission not found or does not belong to user");
      }

      if (submission.status !== "in_progress") {
        throw new Error("Cannot delete images from a submission that is not in progress");
      }

      // Find and delete image
      const image = await SubmissionImage.findOne({ _id: imageId, submissionId });
      if (!image) {
        throw new Error("Image not found in this submission");
      }

      // Delete from Cloudinary
      try {
        await cloudinary.uploader.destroy(image.cloudinary_data.publicId);
      } catch (cloudinaryError) {
        console.warn("Failed to delete image from Cloudinary:", cloudinaryError);
      }

      // Delete image record
      await SubmissionImage.findByIdAndDelete(imageId);

      // Update submission progress
      await this.updateSubmissionProgress(submissionId);

      return { success: true, message: "Image deleted successfully" };

    } catch (error) {
      throw new Error(`Error deleting image: ${error.message}`);
    }
  }
}

module.exports = new SubmissionService();