import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  projectName: {
    type: String,
    minlength: 4,
    required: 'Project name is required'
  },
  company: {
    type: String,
    minlength: 4,
    required: 'Company is required'
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
      validator: function (value) {
        return value > Date.now();
      },
      message: 'Due date must be in the future',
    },
  },
});

const Project = mongoose.model('Project', projectSchema);
export default Project;