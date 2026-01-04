import mongoose from 'mongoose';

const SuserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  }
}, {
  timestamps: true
});

const SurveyUser = mongoose.model('Suser', SuserSchema);
export default SurveyUser;
