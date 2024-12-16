const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({

    taskLink: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: function (v) {
                return /^(http|https):\/\/[^\s$.?#].[^\s]*$/.test(v); // Regex for URL validation
            },
            message: props => `${props.value} is not a valid URL!`,
    }
    },
    taskGuidelineLink: {
        type: String,
        minlength: 4,
        required: true
    },
    taskName: {
        type: String,
        minlength: 4,
        required: true 
    },
    createdBy: {
        type: String,
        minlength: 4,
        required: true 
    },
    dateCreated:{
        type: String,
        default: new Date().toJSON()
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
    }

});

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;