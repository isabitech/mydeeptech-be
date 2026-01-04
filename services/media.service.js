import {
    deleteCloudinaryFile,
    getCloudinaryFileInfo,
    generateOptimizedUrl,
    generateThumbnail
} from '../config/cloudinary.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import dtUserRepository from '../repositories/dtUser.repository.js';

class MediaService {
    async uploadImage(file, userId) {
        if (!file) throw new ValidationError('No image file provided');

        const fileData = {
            publicId: file.filename,
            url: file.path,
            originalName: file.originalname,
            size: file.size,
            format: file.format,
            resourceType: file.resource_type,
            thumbnail: generateThumbnail(file.filename),
            optimizedUrl: generateOptimizedUrl(file.filename, { width: 800, height: 600 })
        };

        return {
            file: fileData,
            uploadedAt: new Date(),
            uploadedBy: userId || null
        };
    }

    async uploadMultipleImages(files, userId) {
        if (!files || files.length === 0) throw new ValidationError('No image files provided');

        const filesData = files.map(file => ({
            publicId: file.filename,
            url: file.path,
            originalName: file.originalname,
            size: file.size,
            format: file.format,
            resourceType: file.resource_type,
            thumbnail: generateThumbnail(file.filename),
            optimizedUrl: generateOptimizedUrl(file.filename, { width: 800, height: 600 })
        }));

        return {
            files: filesData,
            uploadedAt: new Date(),
            uploadedBy: userId || null,
            totalFiles: files.length
        };
    }

    async uploadDocument(file, userId) {
        if (!file) throw new ValidationError('No document file provided');

        const fileData = {
            publicId: file.filename,
            url: file.path,
            originalName: file.originalname,
            size: file.size,
            format: file.format,
            resourceType: file.resource_type,
            pages: file.pages || null
        };

        return {
            file: fileData,
            uploadedAt: new Date(),
            uploadedBy: userId || null
        };
    }

    async uploadVideo(file, userId) {
        if (!file) throw new ValidationError('No video file provided');

        const fileData = {
            publicId: file.filename,
            url: file.path,
            originalName: file.originalname,
            size: file.size,
            format: file.format,
            resourceType: file.resource_type,
            duration: file.duration || null,
            thumbnail: generateThumbnail(file.filename),
            streamingUrl: generateOptimizedUrl(file.filename, {
                resource_type: 'video',
                format: 'mp4',
                quality: 'auto'
            })
        };

        return {
            file: fileData,
            uploadedAt: new Date(),
            uploadedBy: userId || null
        };
    }

    async uploadAudio(file, userId) {
        if (!file) throw new ValidationError('No audio file provided');

        const fileData = {
            publicId: file.filename,
            url: file.path,
            originalName: file.originalname,
            size: file.size,
            format: file.format,
            resourceType: file.resource_type,
            duration: file.duration || null,
            streamingUrl: generateOptimizedUrl(file.filename, {
                resource_type: 'video',
                format: 'mp3',
                quality: 'auto'
            })
        };

        return {
            file: fileData,
            uploadedAt: new Date(),
            uploadedBy: userId || null
        };
    }

    async uploadFile(file, userId) {
        if (!file) throw new ValidationError('No file provided');

        const fileData = {
            publicId: file.filename,
            url: file.path,
            originalName: file.originalname,
            size: file.size,
            format: file.format,
            resourceType: file.resource_type,
            mimeType: file.mimetype
        };

        if (file.mimetype.startsWith('image/')) {
            fileData.thumbnail = generateThumbnail(file.filename);
            fileData.optimizedUrl = generateOptimizedUrl(file.filename);
        }

        if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
            fileData.duration = file.duration || null;
            fileData.streamingUrl = generateOptimizedUrl(file.filename, {
                resource_type: 'video',
                quality: 'auto'
            });
        }

        return {
            file: fileData,
            uploadedAt: new Date(),
            uploadedBy: userId || null
        };
    }

    async deleteFile(publicId, userId) {
        if (!publicId) throw new ValidationError('Public ID is required for file deletion');

        const result = await deleteCloudinaryFile(publicId);

        if (result.result !== 'ok' && result.result !== 'not found') {
            throw new Error(`Failed to delete file from Cloudinary: ${JSON.stringify(result)}`);
        }

        return {
            publicId,
            deletedAt: new Date(),
            deletedBy: userId || null
        };
    }

    async getFileInfo(publicId) {
        if (!publicId) throw new ValidationError('Public ID is required');

        try {
            const fileInfo = await getCloudinaryFileInfo(publicId);

            const responseData = {
                publicId: fileInfo.public_id,
                url: fileInfo.secure_url,
                format: fileInfo.format,
                resourceType: fileInfo.resource_type,
                size: fileInfo.bytes,
                width: fileInfo.width,
                height: fileInfo.height,
                createdAt: fileInfo.created_at,
                version: fileInfo.version,
                etag: fileInfo.etag
            };

            if (fileInfo.resource_type === 'video') {
                responseData.duration = fileInfo.duration;
                responseData.bitRate = fileInfo.bit_rate;
                responseData.frameRate = fileInfo.frame_rate;
            }

            if (fileInfo.pages) {
                responseData.pages = fileInfo.pages;
            }

            return responseData;
        } catch (error) {
            if (error.http_code === 404) {
                throw new NotFoundError('File not found');
            }
            throw error;
        }
    }

    async updateProfilePicture(userId, userEmail, file) {
        if (!file) throw new ValidationError('No image file provided');

        const user = await dtUserRepository.findById(userId);

        if (user && user.profilePicture && user.profilePicture.publicId) {
            try {
                await deleteCloudinaryFile(user.profilePicture.publicId);
            } catch (deleteError) {
                console.warn(`⚠️ Could not delete old profile picture: ${deleteError.message}`);
            }
        }

        const profilePictureData = {
            publicId: file.filename,
            url: file.path,
            thumbnail: generateThumbnail(file.filename),
            optimizedUrl: generateOptimizedUrl(file.filename, { width: 300, height: 300 })
        };

        await dtUserRepository.update(userId, {
            profilePicture: profilePictureData,
            updatedAt: new Date()
        });

        return {
            profilePicture: profilePictureData,
            updatedAt: new Date()
        };
    }
}

export default new MediaService();
