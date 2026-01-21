const mongoose = require('mongoose');


const taskAssignmentSchema = new mongoose.Schema({
    taskId: {
        type: String,
        minlength: 5,
        required: true
    },
    userId: {
        type: String,
        minlength: 5,
        required: true
    }

});

const TaskAssignment = mongoose.model( 'TaskAssignment', taskAssignmentSchema)

module.exports = TaskAssignment;