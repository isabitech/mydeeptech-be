import VideoReel from '../models/videoReel.model.js';

class VideoReelRepository {
    async findById(id) {
        return await VideoReel.findById(id);
    }

    async findByIdWithPopulate(id, populateFields = []) {
        let query = VideoReel.findById(id);
        populateFields.forEach(field => {
            query = query.populate(field);
        });
        return await query;
    }

    async findOne(filter) {
        return await VideoReel.findOne(filter);
    }

    async find(filter, sort = {}, skip = 0, limit = 0, populateFields = []) {
        let query = VideoReel.find(filter).sort(sort);
        if (skip > 0) query = query.skip(skip);
        if (limit > 0) query = query.limit(limit);
        populateFields.forEach(field => {
            query = query.populate(field);
        });
        return await query;
    }

    async count(filter) {
        return await VideoReel.countDocuments(filter);
    }

    async create(data) {
        const videoReel = new VideoReel(data);
        return await videoReel.save();
    }

    async update(id, data) {
        return await VideoReel.findByIdAndUpdate(id, data, { new: true });
    }

    async aggregate(pipeline) {
        return await VideoReel.aggregate(pipeline);
    }
}

export default new VideoReelRepository();
