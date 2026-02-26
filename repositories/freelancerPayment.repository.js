const FreelancerPaymentModel = require("../models/freelancerPayment.model");

class FreelancerPaymentRepository {

  // Basic CRUD operations
  static create(payload) {
    const newPayment = new FreelancerPaymentModel(payload);
    return newPayment.save();
  }

  static findById(id) {
    return FreelancerPaymentModel.findById(id)
      .populate('freelancerId', 'firstName lastName email phone')
      .populate('projectId', 'projectName description')
      .populate('invoiceId', 'invoiceNumber invoiceAmount')
      .populate('initiatedBy', 'firstName lastName email');
  }

  static findByReference(reference) {
    return FreelancerPaymentModel.findByReference(reference)
      .populate('freelancerId', 'firstName lastName email phone')
      .populate('projectId', 'projectName description')
      .populate('invoiceId', 'invoiceNumber invoiceAmount');
  }

  static findByPaystackReference(paystackReference) {
    return FreelancerPaymentModel.findOne({ paystackReference })
      .populate('freelancerId', 'firstName lastName email phone')
      .populate('projectId', 'projectName description');
  }

  static findAll(query = {}) {
    return FreelancerPaymentModel.find(query)
      .populate('freelancerId', 'firstName lastName email')
      .populate('projectId', 'projectName')
      .sort({ createdAt: -1 });
  }

  // Pagination and search
  static findWithPagination(query = {}, options = {}) {
    const { skip = 0, limit = 10, sort = { createdAt: -1 } } = options;
    return FreelancerPaymentModel.find(query)
      .populate('freelancerId', 'firstName lastName email')
      .populate('projectId', 'projectName')
      .skip(skip)
      .limit(limit)
      .sort(sort);
  }

  static countDocuments(query = {}) {
    return FreelancerPaymentModel.countDocuments(query);
  }

  // Update operations
  static updateById(id, updateData) {
    return FreelancerPaymentModel.findByIdAndUpdate(id, updateData, { 
      new: true,
      runValidators: true 
    })
    .populate('freelancerId', 'firstName lastName email')
    .populate('projectId', 'projectName');
  }

  static updateByReference(reference, updateData) {
    return FreelancerPaymentModel.findOneAndUpdate(
      { $or: [{ paymentReference: reference }, { paystackReference: reference }] },
      updateData,
      { new: true, runValidators: true }
    )
    .populate('freelancerId', 'firstName lastName email')
    .populate('projectId', 'projectName');
  }

  static markAsCompleted(paymentId, paystackData = {}) {
    return FreelancerPaymentModel.findByIdAndUpdate(
      paymentId,
      {
        status: 'success',
        completedAt: new Date(),
        webhookReceived: true,
        ...(paystackData && { paystackData: { ...paystackData } })
      },
      { new: true }
    );
  }

  static markAsFailed(paymentId, reason = 'Payment failed') {
    return FreelancerPaymentModel.findByIdAndUpdate(
      paymentId,
      {
        status: 'failed',
        failedAt: new Date(),
        failureReason: reason
      },
      { new: true }
    );
  }

  // Freelancer-specific queries
  static getFreelancerPayments(freelancerId, status = null, options = {}) {
    const query = { freelancerId };
    if (status) query.status = status;

    const { skip = 0, limit = 10 } = options;
    return FreelancerPaymentModel.find(query)
      .populate('projectId', 'projectName description')
      .populate('invoiceId', 'invoiceNumber invoiceAmount')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  static getFreelancerPaymentStats(freelancerId) {
    return FreelancerPaymentModel.aggregate([
      { $match: { freelancerId: freelancerId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: null,
          stats: {
            $push: {
              status: '$_id',
              count: '$count',
              totalAmount: '$totalAmount'
            }
          },
          totalPayments: { $sum: '$count' },
          grandTotal: { $sum: '$totalAmount' }
        }
      }
    ]);
  }

  // Project-specific queries
  static getProjectPayments(projectId, status = null, options = {}) {
    const query = { projectId };
    if (status) query.status = status;

    const { skip = 0, limit = 10 } = options;
    return FreelancerPaymentModel.find(query)
      .populate('freelancerId', 'firstName lastName email')
      .populate('invoiceId', 'invoiceNumber invoiceAmount')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  static getProjectPaymentStats(projectId) {
    return FreelancerPaymentModel.aggregate([
      { $match: { projectId: projectId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: null,
          stats: {
            $push: {
              status: '$_id',
              count: '$count',
              totalAmount: '$totalAmount'
            }
          },
          totalPayments: { $sum: '$count' },
          grandTotal: { $sum: '$totalAmount' }
        }
      }
    ]);
  }

  // Status-specific queries
  static getPendingPayments(options = {}) {
    const { skip = 0, limit = 10 } = options;
    return FreelancerPaymentModel.find({ status: 'pending' })
      .populate('freelancerId', 'firstName lastName email')
      .populate('projectId', 'projectName')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  static getFailedPayments(options = {}) {
    const { skip = 0, limit = 10 } = options;
    return FreelancerPaymentModel.find({ status: 'failed' })
      .populate('freelancerId', 'firstName lastName email')
      .populate('projectId', 'projectName')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  static getSuccessfulPayments(options = {}) {
    const { skip = 0, limit = 10 } = options;
    return FreelancerPaymentModel.find({ status: 'success' })
      .populate('freelancerId', 'firstName lastName email')
      .populate('projectId', 'projectName')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  // Analytics and reporting
  static getPaymentsByDateRange(startDate, endDate, status = null) {
    const query = {
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };
    if (status) query.status = status;

    return FreelancerPaymentModel.find(query)
      .populate('freelancerId', 'firstName lastName email')
      .populate('projectId', 'projectName')
      .sort({ createdAt: -1 });
  }

  static getDailyPaymentStats(startDate, endDate) {
    return FreelancerPaymentModel.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            status: '$status'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);
  }

  // Payment verification
  static getPaymentsForVerification() {
    return FreelancerPaymentModel.find({
      status: 'processing',
      verificationAttempts: { $lt: 3 }
    }).sort({ createdAt: 1 });
  }

  static incrementVerificationAttempt(paymentId) {
    return FreelancerPaymentModel.findByIdAndUpdate(
      paymentId,
      { 
        $inc: { verificationAttempts: 1 },
        lastVerifiedAt: new Date()
      },
      { new: true }
    );
  }

  // Search functionality
  static searchPayments(searchTerm, options = {}) {
    const { skip = 0, limit = 10 } = options;
    const searchRegex = new RegExp(searchTerm, 'i');
    
    return FreelancerPaymentModel.find({
      $or: [
        { paymentReference: searchRegex },
        { paystackReference: searchRegex },
        { customerEmail: searchRegex },
        { customerName: searchRegex },
        { description: searchRegex }
      ]
    })
    .populate('freelancerId', 'firstName lastName email')
    .populate('projectId', 'projectName')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });
  }

  // Delete operations (soft delete recommended)
  static deleteById(id) {
    return FreelancerPaymentModel.findByIdAndDelete(id);
  }

  static softDeleteById(id) {
    return FreelancerPaymentModel.findByIdAndUpdate(
      id,
      { deletedAt: new Date(), status: 'cancelled' },
      { new: true }
    );
  }
}

module.exports = FreelancerPaymentRepository;