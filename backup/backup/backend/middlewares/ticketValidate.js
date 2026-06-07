const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename:    (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  // Allow images and common document types
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('File type not allowed'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ─── VALIDATION MIDDLEWARE ────────────────────────────────────────────────────
const validate = (schema) => (req, res, next) => {
  // For multipart requests, body fields arrive as strings — that's fine
  const { error, value } = schema.validate(req.body, {
    abortEarly:    false,
    stripUnknown:  true,
    allowUnknown:  false,
  });

  if (error) {
    console.error('❌ Validation error:', error.details);
    return res.status(400).json({
      message: 'Validation error',
      errors:  error.details.map(e => ({
        field:   e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // ✅ Replace body with validated + cleaned values
  req.body = value;
  next();
};

module.exports = { upload, validate };