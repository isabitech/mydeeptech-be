const mongoose = require('mongoose');

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
        type: Date, // Specifies the data type as Date
        required: [true, 'Due date is required'], // Makes the field mandatory and provides a custom error message
        validate: { // Adds custom validation logic for this field
          validator: function (value) {
            return value > Date.now(); // Ensure the due date is in the future
          },
          message: 'Due date must be in the future', // Error message shown if validation fails
        },
      },
});

const Projects = mongoose.model('Project', projectSchema);

module.exports = Projects;