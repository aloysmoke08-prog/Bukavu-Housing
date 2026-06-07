const cloudinary = require('cloudinary').v2;
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dlyoolyqo',
  api_key: process.env.CLOUDINARY_API_KEY || '654295665615129',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'n7OOf-PqmW1O7HFkvd62EPyxEXk',
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      return cb(new Error('Format image non supporte. Utilisez JPG, PNG ou WebP.'));
    }
    cb(null, true);
  },
});

function uploadOnce(file, folder = 'bukavu_housing/logements', timestampOffsetSeconds = 0) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'image',
        timestamp: Math.floor(Date.now() / 1000) + timestampOffsetSeconds,
        transformation: [{ width: 1200, height: 900, crop: 'limit', quality: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

async function uploadBufferToCloudinary(file, folder = 'bukavu_housing/logements') {
  try {
    return await uploadOnce(file, folder);
  } catch (error) {
    if (/stale request/i.test(error.message || '')) {
      return uploadOnce(file, folder, 2 * 60 * 60);
    }
    throw error;
  }
}

module.exports = { cloudinary, upload, uploadBufferToCloudinary };

