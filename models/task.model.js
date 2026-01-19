import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    taskLink: {
        type: String,
        required: true,
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
    dateCreated: {
        type: String,
        default: new Date().toJSON()
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
    }
});

const Task = mongoose.model('Task', taskSchema);
export default Task;