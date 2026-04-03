const mongoose = require("mongoose");

const assessmentReviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    emailAddress: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    dateOfSubmission: {
      type: Date,
      required: true,
    },

    timeOfSubmission: {
      type: String, // stored as "HH:MM AM/PM"
      required: true,
    },

    submissionStatus: {
      englishTestUploaded: {
        type: Boolean,
        required: true,
        default: false,
      },
      problemSolvingTestUploaded: {
        type: Boolean,
        required: true,
        default: false,
      },
    },

    englishTestScore: {
      type: String,
      required: true,
    },

    problemSolvingScore: {
      type: String,
      required: true,
    },

    googleDriveLink: {
      type: String,
      required: true,
      trim: true,
    },

    encounteredIssues: {
      type: String,
      enum: ["Yes, I encountered issues.", "No, the process was smooth."],
      default: null,
    },

    issueDescription: {
      type: String,
      trim: true,
      default: null,
    },

    instructionClarityRating: {
      type: Number,
      min: 1,
      max: 7,
      default: null,
    },
    reviewerComment: {
      type: String,
      trim: true,
      default: null,
    },
    reviewStatus: {
      type: String,
      enum: ["Pending", "Reviewed"],
      default: "Pending",
    },
    reviewRating: {
      grade: {
        type: String,
        enum: ["Pre-A1", "A1", "A2", "B1", "B2", "C1"],
        default: null,
      },
      score: {
        type: Number,
        min: 0,
        max: 599,
        default: null,
      },
      level: {
        type: String,
        enum: [
          "Beginner",
          "Elementary",
          "Pre Intermediate",
          "Intermediate",
          "Upper Intermediate",
          "Advanced",
        ],
        default: null,
      },
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const AssessmentReview = mongoose.model(
  "AssessmentReview",
  assessmentReviewSchema,
);

module.exports = AssessmentReview;
