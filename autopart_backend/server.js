const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const multer = require('multer');

// Serve static images from ./images if present
app.use('/images', express.static(path.join(__dirname, 'images')));

// Ensure images/users directory exists
const usersImagesDir = path.join(__dirname, 'images', 'users');
if (!fs.existsSync(usersImagesDir)) {
  fs.mkdirSync(usersImagesDir, { recursive: true });
}

// Multer setup for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, usersImagesDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const fname = `${Date.now()}-${Math.random().toString(36).substring(2,8)}${ext}`;
    cb(null, fname);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autopart_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// ================================
// SCHEMAS / MODELS
// ================================

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  // Avatar stores structured metadata about uploaded profile images
  avatar: {
    url: { type: String, trim: true, default: null },
    filename: { type: String, trim: true, default: null },
    mimeType: { type: String, trim: true, default: null },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: null }
  },
  role: {
    type: String,
    enum: ['admin', 'employee'],
    default: 'employee'
  }
  ,
  // Shipping addresses (embedded metadata only)
  shipping: {
    type: [new mongoose.Schema({
      label: { type: String, trim: true },           // e.g., 'Home', 'Office'
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      phone: { type: String, trim: true },
      street: { type: String, trim: true },
      subdistrict: { type: String, trim: true },
      district: { type: String, trim: true },
      province: { type: String, trim: true },
      zip: { type: String, trim: true },
      apt: { type: String, trim: true },
      isDefault: { type: Boolean, default: false }
    }, { _id: true })],
    default: []
  },
  // Payment methods - store metadata and token from payment provider only
  paymentMethods: {
    type: [new mongoose.Schema({
      provider: { type: String, trim: true },     // e.g., 'stripe'
      token: { type: String, trim: true },        // provider token/id (NOT PAN/CVV)
      brand: { type: String, trim: true },        // Visa, MasterCard
      last4: { type: String, trim: true },
      expMonth: { type: Number },
      expYear: { type: Number },
      isDefault: { type: Boolean, default: false }
    }, { _id: true })],
    default: []
  }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  // Convert structured avatar object to a simple URL string for API consumers
  if (user.avatar && typeof user.avatar === 'object') {
    user.avatar = user.avatar.url || null;
  }
  delete user.password;
  return user;
};

const User = mongoose.model('User', userSchema);

// Product Schema
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
  ,
  // additional fields for car parts / storefront
  description: { type: String, trim: true },
  sku: { type: String, trim: true, index: true },
  imageUrl: { type: String, trim: true },
  originalPrice: { type: Number, min: 0 },
  salePrice: { type: Number, min: 0 },
  onSale: { type: Boolean, default: false },
  rating: { type: Number, min: 0, max: 5 },
  reviewsCount: { type: Number, min: 0, default: 0 },
  fits: { type: [String], default: [] }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// Review Schema
const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  author: { type: String, trim: true },
  rating: { type: Number, min: 0, max: 5, required: true },
  title: { type: String, trim: true },
  comment: { type: String, trim: true },
  helpfulCount: { type: Number, default: 0 },
  replies: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    author: { type: String, trim: true },
    comment: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Review = mongoose.model('Review', reviewSchema);

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  type: {
    type: String,
    required: true,
    enum: ['in', 'out']
  }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

// Order Schema (for pending orders that admin can approve)
const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: { type: [orderItemSchema], required: true },
  shipping: { type: Object },
  paymentMethod: { type: String },
  status: { type: String, enum: ['pending','approved','cancelled'], default: 'pending' }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// ================================
// MIDDLEWARE
// ================================

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

// Admin Authorization Middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// Validation Error Handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// ================================
// AUTH ROUTES
// ================================

// Register
app.post('/api/auth/register',
  [
    body('name').isLength({ min: 2, max: 100 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').optional().isIn(['admin', 'employee'])
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Create user
      const user = new User({
        name,
        email,
        password,
        role: role || 'employee'
      });

      await user.save();

      // Generate token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user,
          token
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  }
);

// Login
app.post('/api/auth/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;

  // DEBUG: log incoming login attempt (avoid logging passwords in production)
  console.log(`Login attempt from IP=${req.ip} email=${email}`);

      // Find user
      const user = await User.findOne({ email });
  console.log('User lookup result for', email, '=>', user ? 'FOUND' : 'NOT FOUND');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
  console.log('Password compare for', email, '=>', isMatch);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user,
          token
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }
);

// ================================
// USER ROUTES
// ================================

// Get all users (Admin only)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Get user profile
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user }
  });
});

// ================================
// ADDRESSES & PAYMENT METHODS
// ================================

// List user's shipping addresses
app.get('/api/users/addresses', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, data: { addresses: req.user.shipping || [] } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch addresses', error: err.message });
  }
});

// Backward-compatible alias: use '/api/users/shipping' path as preferred name
app.get('/api/users/shipping', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, data: { addresses: req.user.shipping || [] } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch shipping', error: err.message });
  }
});

// Add a shipping address
app.post('/api/users/addresses', authenticateToken, async (req, res) => {
  try {
    const addr = req.body;
    // basic validation
    if (!addr || !addr.street) return res.status(400).json({ success: false, message: 'Address street required' });

    // if this is the first address, set as default
    if (!Array.isArray(req.user.shipping) || req.user.shipping.length === 0) {
      addr.isDefault = true;
    }

    req.user.shipping = req.user.shipping || [];
    req.user.shipping.push(addr);
    await req.user.save();

    res.status(201).json({ success: true, message: 'Address added', data: { address: addr } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add address', error: err.message });
  }
});

// Preferred shipping path (alias)
app.post('/api/users/shipping', authenticateToken, async (req, res) => {
  try {
    const addr = req.body;
    if (!addr || !addr.street) return res.status(400).json({ success: false, message: 'Address street required' });

    if (!Array.isArray(req.user.shipping) || req.user.shipping.length === 0) {
      addr.isDefault = true;
    }

    req.user.shipping = req.user.shipping || [];
    req.user.shipping.push(addr);
    await req.user.save();

    res.status(201).json({ success: true, message: 'Shipping address added', data: { address: addr } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add shipping', error: err.message });
  }
});

// Update an address by its _id
app.put('/api/users/addresses/:addrId', authenticateToken, async (req, res) => {
  try {
    const { addrId } = req.params;
    const idx = (req.user.shipping || []).findIndex(a => a._id && a._id.toString() === addrId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Address not found' });

    Object.assign(req.user.shipping[idx], req.body);
    await req.user.save();
    res.json({ success: true, message: 'Address updated', data: { address: req.user.shipping[idx] } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update address', error: err.message });
  }
});

// Alias for update via /shipping
app.put('/api/users/shipping/:addrId', authenticateToken, async (req, res) => {
  try {
    const { addrId } = req.params;
    const idx = (req.user.shipping || []).findIndex(a => a._id && a._id.toString() === addrId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Shipping address not found' });

    Object.assign(req.user.shipping[idx], req.body);
    await req.user.save();
    res.json({ success: true, message: 'Shipping address updated', data: { address: req.user.shipping[idx] } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update shipping', error: err.message });
  }
});

// Delete an address
app.delete('/api/users/addresses/:addrId', authenticateToken, async (req, res) => {
  try {
    const { addrId } = req.params;
    const before = req.user.shipping || [];
    req.user.shipping = before.filter(a => !(a._id && a._id.toString() === addrId));
    await req.user.save();
    res.json({ success: true, message: 'Address removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove address', error: err.message });
  }
});

// Alias for delete via /shipping
app.delete('/api/users/shipping/:addrId', authenticateToken, async (req, res) => {
  try {
    const { addrId } = req.params;
    const before = req.user.shipping || [];
    req.user.shipping = before.filter(a => !(a._id && a._id.toString() === addrId));
    await req.user.save();
    res.json({ success: true, message: 'Shipping address removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove shipping', error: err.message });
  }
});

// List payment methods (metadata only)
app.get('/api/users/payment-methods', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, data: { paymentMethods: req.user.paymentMethods || [] } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment methods', error: err.message });
  }
});

// Add a payment method (expect tokenized data from frontend/payment provider)
app.post('/api/users/payment-methods', authenticateToken, [
  body('provider').notEmpty(),
  body('token').notEmpty(),
  body('last4').optional().isLength({ min: 2 })
], handleValidationErrors, async (req, res) => {
  try {
    const pm = {
      provider: req.body.provider,
      token: req.body.token,
      brand: req.body.brand || null,
      last4: req.body.last4 || null,
      expMonth: req.body.expMonth || null,
      expYear: req.body.expYear || null
    };

  // Enforce single payment method per account: replace any existing methods with this one
  pm.isDefault = true;
  req.user.paymentMethods = [pm];
    await req.user.save();

    res.status(201).json({ success: true, message: 'Payment method added', data: { paymentMethod: pm } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add payment method', error: err.message });
  }
});

// Delete a payment method by its _id
app.delete('/api/users/payment-methods/:pmId', authenticateToken, async (req, res) => {
  try {
    const { pmId } = req.params;
    const before = req.user.paymentMethods || [];
    req.user.paymentMethods = before.filter(p => !(p._id && p._id.toString() === pmId));
    await req.user.save();
    res.json({ success: true, message: 'Payment method removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove payment method', error: err.message });
  }
});

// Update a payment method by its _id
app.put('/api/users/payment-methods/:pmId', authenticateToken, async (req, res) => {
  try {
    const { pmId } = req.params;
    const idx = (req.user.paymentMethods || []).findIndex(p => p._id && p._id.toString() === pmId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Payment method not found' });

    // allowed fields: brand, last4, expMonth, expYear, provider, isDefault
    const allowed = ['brand','last4','expMonth','expYear','provider','isDefault'];
    // modify the found subdocument
    for (const key of Object.keys(req.body)) {
      if (allowed.includes(key)) {
        req.user.paymentMethods[idx][key] = req.body[key];
      }
    }

    // Replace the paymentMethods array with only the updated object to enforce single-method policy
    const updated = req.user.paymentMethods[idx];
    req.user.paymentMethods = [updated];

    await req.user.save();
    res.json({ success: true, message: 'Payment method updated', data: { paymentMethod: updated } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update payment method', error: err.message });
  }
});

// Update user profile
app.put('/api/users/profile',
  authenticateToken,
  [
    body('name').optional().isLength({ min: 2, max: 100 }).trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
        const { name, avatar } = req.body;
      
        if (name) {
          req.user.name = name;
        }
        if (typeof avatar === 'string') {
          // store avatar URI or path (client can send absolute URL or server-relative path)
          req.user.avatar = req.user.avatar || {};
          req.user.avatar.url = avatar;
          req.user.avatar.uploadedAt = new Date();
        }

      await req.user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: req.user }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message
      });
    }
  }
);

// Avatar upload endpoint (multipart) - saves file under ./images/users and updates user.avatar to /images/users/<file>
app.post('/api/users/profile/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
  // Debug: log incoming content-type and whether multer parsed a file
  try { console.log('[debug] Avatar upload content-type:', req.headers['content-type']); } catch (e) { }
  try { console.log('[debug] Avatar upload req.file present:', !!req.file, req.file ? { filename: req.file.filename, mimetype: req.file.mimetype, size: req.file.size } : null); } catch (e) { }
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const relPath = `/images/users/${req.file.filename}`;
  req.user.avatar = req.user.avatar || {};
  req.user.avatar.url = relPath;
  req.user.avatar.filename = req.file.filename;
  req.user.avatar.mimeType = req.file.mimetype;
  req.user.avatar.size = req.file.size;
  req.user.avatar.uploadedAt = new Date();
  await req.user.save();
  res.json({ success: true, message: 'Avatar uploaded', data: { user: req.user } });
  } catch (error) {
    console.error('Avatar upload error', error);
    res.status(500).json({ success: false, message: 'Failed to upload avatar', error: error.message });
  }
});

// Download image from URL, save to ./images/users and update user.avatar
app.post('/api/users/profile/avatar-from-url', authenticateToken, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') return res.status(400).json({ success: false, message: 'URL required' });

    // helper to follow redirects and perform HEAD
    const headRequest = (u, maxRedirects = 5) => new Promise((resolve, reject) => {
      try {
        const parsed = new URL(u);
        const lib = parsed.protocol === 'https:' ? https : http;
        const reqHead = lib.request(parsed, { method: 'HEAD', headers: { 'User-Agent': 'autopart-backend/1.0' } }, (resp) => {
          const { statusCode, headers } = resp;
          if (statusCode >= 300 && statusCode < 400 && headers.location && maxRedirects > 0) {
            const next = new URL(headers.location, parsed).toString();
            resolve(headRequest(next, maxRedirects - 1));
            return;
          }
          resolve({ statusCode, headers });
        });
        reqHead.on('error', reject);
        reqHead.end();
      } catch (err) { reject(err); }
    });

    const parsedUrl = new URL(url);
    // probe headers
    const head = await headRequest(url);
    const contentType = (head.headers['content-type'] || '').toLowerCase();
    const contentLength = head.headers['content-length'] ? parseInt(head.headers['content-length'], 10) : 0;

    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'URL is not an image' });
    }
    // size limit 5MB
    const MAX = 5 * 1024 * 1024;
    if (contentLength && contentLength > MAX) {
      return res.status(400).json({ success: false, message: 'Image is too large' });
    }

    // determine extension
    let ext = path.extname(parsedUrl.pathname) || '';
    if (!ext) {
      // fallback from content-type
      if (contentType.includes('jpeg')) ext = '.jpg';
      else if (contentType.includes('png')) ext = '.png';
      else if (contentType.includes('gif')) ext = '.gif';
      else if (contentType.includes('webp')) ext = '.webp';
      else ext = '.jpg';
    }

    const filename = `${Date.now()}-${Math.random().toString(36).substring(2,8)}${ext}`;
    const destPath = path.join(usersImagesDir, filename);

    // download with redirect support
    const downloadWithRedirect = (u, dest, maxRedirects = 5) => new Promise((resolve, reject) => {
      try {
        const p = new URL(u);
        const lib = p.protocol === 'https:' ? https : http;
        const reqGet = lib.get(p, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location && maxRedirects > 0) {
            const next = new URL(resp.headers.location, p).toString();
            resolve(downloadWithRedirect(next, dest, maxRedirects - 1));
            return;
          }
          if (resp.statusCode < 200 || resp.statusCode >= 300) {
            return reject(new Error('Failed to download image, status ' + resp.statusCode));
          }
          const file = fs.createWriteStream(dest);
          resp.pipe(file);
          file.on('finish', () => file.close(() => resolve({ size: fs.statSync(dest).size, mimeType: resp.headers['content-type'] }))); 
          file.on('error', (err) => reject(err));
        });
        reqGet.on('error', reject);
      } catch (err) { reject(err); }
    });

    // if user already has a stored filename, try to remove it to avoid orphan files
    try {
      const existing = req.user.avatar || {};
      let oldFilename = existing.filename;
      if (!oldFilename && existing.url) {
        const parts = existing.url.split('/');
        oldFilename = parts[parts.length - 1];
      }
      if (oldFilename) {
        const oldPath = path.join(usersImagesDir, oldFilename);
        try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore deletion errors */ }

    const result = await downloadWithRedirect(url, destPath);
    const savedSize = result.size || (fs.existsSync(destPath) ? fs.statSync(destPath).size : 0);
    const savedMime = result.mimeType || contentType || null;

    // update user avatar metadata
    const relPath = `/images/users/${filename}`;
    req.user.avatar = req.user.avatar || {};
    req.user.avatar.url = relPath;
    req.user.avatar.filename = filename;
    req.user.avatar.mimeType = savedMime;
    req.user.avatar.size = savedSize;
    req.user.avatar.uploadedAt = new Date();
    await req.user.save();

    res.json({ success: true, message: 'Avatar downloaded and saved', data: { user: req.user } });
  } catch (error) {
    console.error('avatar-from-url error', error);
    res.status(500).json({ success: false, message: 'Failed to fetch and save avatar', error: error.message });
  }
});

// Update (replace) avatar from URL - same behavior as POST but provided as PUT for explicit updates
app.put('/api/users/profile/avatar-from-url', authenticateToken, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') return res.status(400).json({ success: false, message: 'URL required' });

    // helper to follow redirects and perform HEAD
    const headRequest = (u, maxRedirects = 5) => new Promise((resolve, reject) => {
      try {
        const parsed = new URL(u);
        const lib = parsed.protocol === 'https:' ? https : http;
        const reqHead = lib.request(parsed, { method: 'HEAD', headers: { 'User-Agent': 'autopart-backend/1.0' } }, (resp) => {
          const { statusCode, headers } = resp;
          if (statusCode >= 300 && statusCode < 400 && headers.location && maxRedirects > 0) {
            const next = new URL(headers.location, parsed).toString();
            resolve(headRequest(next, maxRedirects - 1));
            return;
          }
          resolve({ statusCode, headers });
        });
        reqHead.on('error', reject);
        reqHead.end();
      } catch (err) { reject(err); }
    });

    const parsedUrl = new URL(url);
    // probe headers
    const head = await headRequest(url);
    const contentType = (head.headers['content-type'] || '').toLowerCase();
    const contentLength = head.headers['content-length'] ? parseInt(head.headers['content-length'], 10) : 0;

    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'URL is not an image' });
    }
    // size limit 5MB
    const MAX = 5 * 1024 * 1024;
    if (contentLength && contentLength > MAX) {
      return res.status(400).json({ success: false, message: 'Image is too large' });
    }

    // determine extension
    let ext = path.extname(parsedUrl.pathname) || '';
    if (!ext) {
      // fallback from content-type
      if (contentType.includes('jpeg')) ext = '.jpg';
      else if (contentType.includes('png')) ext = '.png';
      else if (contentType.includes('gif')) ext = '.gif';
      else if (contentType.includes('webp')) ext = '.webp';
      else ext = '.jpg';
    }

    const filename = `${Date.now()}-${Math.random().toString(36).substring(2,8)}${ext}`;
    const destPath = path.join(usersImagesDir, filename);

    // remove previous stored file if present
    try {
      const existing = req.user.avatar || {};
      let oldFilename = existing.filename;
      if (!oldFilename && existing.url) {
        const parts = existing.url.split('/');
        oldFilename = parts[parts.length - 1];
      }
      if (oldFilename) {
        const oldPath = path.join(usersImagesDir, oldFilename);
        try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }

    // download with redirect support
    const downloadWithRedirect = (u, dest, maxRedirects = 5) => new Promise((resolve, reject) => {
      try {
        const p = new URL(u);
        const lib = p.protocol === 'https:' ? https : http;
        const reqGet = lib.get(p, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location && maxRedirects > 0) {
            const next = new URL(resp.headers.location, p).toString();
            resolve(downloadWithRedirect(next, dest, maxRedirects - 1));
            return;
          }
          if (resp.statusCode < 200 || resp.statusCode >= 300) {
            return reject(new Error('Failed to download image, status ' + resp.statusCode));
          }
          const file = fs.createWriteStream(dest);
          resp.pipe(file);
          file.on('finish', () => file.close(() => resolve({ size: fs.statSync(dest).size, mimeType: resp.headers['content-type'] })));
          file.on('error', (err) => reject(err));
        });
        reqGet.on('error', reject);
      } catch (err) { reject(err); }
    });

    const result = await downloadWithRedirect(url, destPath);
    const savedSize = result.size || (fs.existsSync(destPath) ? fs.statSync(destPath).size : 0);
    const savedMime = result.mimeType || contentType || null;

    // update user avatar metadata
    const relPath = `/images/users/${filename}`;
    req.user.avatar = req.user.avatar || {};
    req.user.avatar.url = relPath;
    req.user.avatar.filename = filename;
    req.user.avatar.mimeType = savedMime;
    req.user.avatar.size = savedSize;
    req.user.avatar.uploadedAt = new Date();
    await req.user.save();

    res.json({ success: true, message: 'Avatar downloaded and saved (updated)', data: { user: req.user } });
  } catch (error) {
    console.error('avatar-from-url PUT error', error);
    res.status(500).json({ success: false, message: 'Failed to fetch and save avatar', error: error.message });
  }
});

// Delete user avatar (remove file and clear metadata)
app.delete('/api/users/profile/avatar', authenticateToken, async (req, res) => {
  try {
    const av = req.user.avatar || {};
    let filename = av.filename;
    // if filename missing, try deriving from URL
    if (!filename && av.url) {
      const parts = av.url.split('/');
      filename = parts[parts.length - 1];
    }
    if (filename) {
      const filePath = path.join(usersImagesDir, filename);
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { /* ignore delete errors */ }
    }

    // clear avatar metadata
    req.user.avatar = { url: null, filename: null, mimeType: null, size: 0, uploadedAt: null };
    await req.user.save();
    res.json({ success: true, message: 'Avatar removed', data: { user: req.user } });
  } catch (error) {
    console.error('Delete avatar error', error);
    res.status(500).json({ success: false, message: 'Failed to remove avatar', error: error.message });
  }
});

// Change password for current user
app.put('/api/users/change-password',
  authenticateToken,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.user;

      // Verify current password
      const match = await user.comparePassword(currentPassword);
      if (!match) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }

      // Update password (pre-save hook will hash)
      user.password = newPassword;
      await user.save();

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error', error);
      res.status(500).json({ success: false, message: 'Failed to change password', error: error.message });
    }
  }
);

// Get orders for current authenticated user
app.get('/api/orders/mine', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
    // populate product info for items
    const productIds = orders.flatMap(o => (o.items || []).map(i => i.productId));
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = {};
    products.forEach(p => { productMap[p._id.toString()] = p; });

    const enriched = orders.map(o => ({
      ...o,
      items: (o.items || []).map(it => ({
        ...it,
        product: productMap[it.productId.toString()] || null
      }))
    }));

    res.json({ success: true, data: { orders: enriched } });
  } catch (error) {
    console.error('Get user orders error', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders', error: error.message });
  }
});

// Update user (Admin only)
app.put('/api/users/:id',
  authenticateToken,
  requireAdmin,
  [
    body('name').optional().isLength({ min: 2, max: 100 }).trim(),
    body('role').optional().isIn(['admin', 'employee'])
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      Object.assign(user, req.body);
      await user.save();

      res.json({
        success: true,
        message: 'User updated successfully',
        data: { user }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        error: error.message
      });
    }
  }
);

// Delete user (Admin only)
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// ================================
// PRODUCT ROUTES
// ================================

// ================================
// PRODUCT ROUTES
// ================================

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API is working!' });
});

// Public endpoint for storefront - get products without authentication
app.get('/api/public/products', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: {
        products,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalProducts: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

// Public endpoint for top selling products
app.get('/api/public/products/top-sellers', async (req, res) => {
  try {
    const topProducts = await Product.find({ stock: { $gt: 0 } })
      .sort({ reviewsCount: -1, rating: -1 })
      .limit(5);

    res.json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top sellers',
      error: error.message
    });
  }
});

// Get all products (authenticated)
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
  const { page = 1, limit = 100, search, category } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: {
        products,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalProducts: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

// Get product by ID
// Public get product by ID (returns product details for storefront)
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch product', error: error.message });
  }
});

// Get reviews for a product (public)
app.get('/api/products/:id/reviews', async (req, res) => {
  try {
    const productId = req.params.id;
    const reviews = await Review.find({ productId }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch reviews', error: error.message });
  }
});

// Post a review for a product (public)
app.post('/api/products/:id/reviews', async (req, res) => {
  try {
    const productId = req.params.id;
    const { rating, comment, title, name } = req.body;
    // if authenticated, prefer user info, otherwise accept provided name or fall back to Anonymous
    const author = (req.user && req.user.name) || name || 'Anonymous';

    // simple validation
    if (typeof rating === 'undefined' || !comment) {
      return res.status(400).json({ success: false, message: 'Rating and comment required' });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const userId = req.user ? req.user._id : null;
    const review = new Review({ productId, userId, author, rating, title, comment });
    await review.save();

    // update product aggregate
    // recompute average rating and count
    const agg = await Review.aggregate([
      { $match: { productId: product._id } },
      { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    if (agg && agg[0]) {
      product.rating = agg[0].avg;
      product.reviewsCount = agg[0].count;
    } else {
      product.rating = rating;
      product.reviewsCount = (product.reviewsCount || 0) + 1;
    }
    await product.save();

    res.status(201).json({ success: true, message: 'Review submitted', review });
  } catch (error) {
    console.error('post review error', error);
    res.status(500).json({ success: false, message: 'Failed to post review', error: error.message });
  }
});

// Post a reply to a review (public)
app.post('/api/products/:productId/reviews/:reviewId/replies', async (req, res) => {
  try {
    const { comment, name } = req.body;
    const { productId, reviewId } = req.params;
    if (!comment) return res.status(400).json({ success: false, message: 'Reply comment required' });

    const review = await Review.findOne({ _id: reviewId, productId });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    const userId = req.user ? req.user._id : null;
    const author = (req.user && req.user.name) || name || 'Anonymous';

    review.replies.push({ userId, author, comment });
    await review.save();

    const newReply = review.replies[review.replies.length - 1];
    res.status(201).json({ success: true, reply: newReply });
  } catch (error) {
    console.error('post reply error', error);
    res.status(500).json({ success: false, message: 'Failed to post reply', error: error.message });
  }
});

// Increment helpful/like for a review (public)
app.post('/api/products/:productId/reviews/:reviewId/helpful', async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    // validate ids to avoid Mongoose CastError
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: 'Invalid productId or reviewId' });
    }
    const review = await Review.findOne({ _id: reviewId, productId });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    review.helpfulCount = (review.helpfulCount || 0) + 1;
    await review.save();

    res.json({ success: true, helpfulCount: review.helpfulCount });
  } catch (error) {
    console.error('helpful increment error', error);
    res.status(500).json({ success: false, message: 'Failed to update helpful count', error: error.message });
  }
});

// Delete a review (author or admin)
app.delete('/api/products/:productId/reviews/:reviewId', authenticateToken, async (req, res) => {
  try {
    const { productId: productIdParam, reviewId } = req.params;
    // find by review id first (more tolerant if caller passed wrong productId param)
    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    // if productId param doesn't match the review, log a note but continue using the review's productId
    const actualProductId = (review.productId || '').toString();
    if (productIdParam && productIdParam.toString() !== actualProductId) {
      console.warn(`ProductId param mismatch for delete: param=${productIdParam} review.productId=${actualProductId}`);
    }

    // allow only author or admin to delete
    const isAuthor = review.userId && req.user && review.userId.toString() === req.user._id.toString();
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAuthor && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized to delete this review' });

    await Review.deleteOne({ _id: reviewId });

    // recompute product aggregates (rating and count) using actualProductId
    const agg = await Review.aggregate([
      { $match: { productId: mongoose.Types.ObjectId(actualProductId) } },
      { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const product = await Product.findById(actualProductId);
    if (product) {
      if (agg && agg[0]) {
        product.rating = agg[0].avg;
        product.reviewsCount = agg[0].count;
      } else {
        product.rating = 0;
        product.reviewsCount = 0;
      }
      await product.save();
    }

    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    console.error('delete review error', error);
    res.status(500).json({ success: false, message: 'Failed to delete review', error: error.message });
  }
});

// Create product
app.post('/api/products',
  authenticateToken,
  [
    body('name').notEmpty().trim(),
    body('category').notEmpty().trim(),
    body('price').isNumeric().isFloat({ min: 0 }),
    body('stock').optional().isNumeric().isInt({ min: 0 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, category, price, stock } = req.body;

      const product = new Product({
        name,
        category,
        price,
        stock: stock || 0
      });

      await product.save();

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: { product }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: error.message
      });
    }
  }
);

// Update product
app.put('/api/products/:id',
  authenticateToken,
  [
    body('name').optional().trim(),
    body('category').optional().trim(),
    body('price').optional().isNumeric().isFloat({ min: 0 }),
    body('stock').optional().isNumeric().isInt({ min: 0 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      Object.assign(product, req.body);
      await product.save();

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: { product }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: error.message
      });
    }
  }
);

// Delete product
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Soft delete
    product.isActive = false;
    await product.save();

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
});

// Search products
app.get('/api/products/search/:query', authenticateToken, async (req, res) => {
  try {
    const { query } = req.params;
    const { category } = req.query;

    const searchQuery = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } }
      ]
    };

    if (category) {
      searchQuery.category = { $regex: category, $options: 'i' };
    }

    const products = await Product.find(searchQuery)
      .sort({ name: 1 })
      .limit(20);

    res.json({
      success: true,
      data: { products }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
});

// ================================
// TRANSACTION ROUTES
// ================================

// Get all transactions
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, type, productId, userId, startDate, endDate } = req.query;
    const query = {};

    if (type) query.type = type;
    if (productId) query.productId = productId;
    if (userId && req.user.role === 'admin') query.userId = userId;
    if (req.user.role !== 'admin') query.userId = req.user._id;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .populate('productId', 'name category')
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      data: {
        transactions,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalTransactions: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

// Create transaction (Stock In/Out)
app.post('/api/transactions',
  authenticateToken,
  [
    body('type').isIn(['in', 'out']),
    body('productId').isMongoId(),
    body('quantity').isNumeric().isInt({ min: 1 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { type, productId, quantity } = req.body;

      // Get product
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check stock for 'out' transactions
      if (type === 'out' && product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock'
        });
      }

      // Create transaction
      const transaction = new Transaction({
        userId: req.user._id,
        productId,
        quantity,
        type
      });

      await transaction.save();

      // Update product stock
      if (type === 'in') {
        product.stock += quantity;
      } else if (type === 'out') {
        product.stock -= quantity;
      }
      await product.save();

      res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        data: { transaction }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create transaction',
        error: error.message
      });
    }
  }
);

// Get transaction by ID
app.get('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('productId', 'name category')
      .populate('userId', 'name');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check permission (non-admin users can only see their own transactions)
    if (req.user.role !== 'admin' && transaction.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { transaction }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction',
      error: error.message
    });
  }
});

// ================================
// ORDER ROUTES
// ================================

// Create an order (customer checkout creates a pending order)
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { items, shipping, paymentMethod } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: 'Order items required' });

    // validate items
    const sanitized = items.map(it => ({ productId: it.productId, quantity: Number(it.quantity || 1) }));

    const order = new Order({ userId: req.user._id, items: sanitized, shipping, paymentMethod, status: 'pending' });
    await order.save();

    res.status(201).json({ success: true, message: 'Order created', data: { order } });
  } catch (error) {
    console.error('create order error', error);
    res.status(500).json({ success: false, message: 'Failed to create order', error: error.message });
  }
});

// Admin: list orders
app.get('/api/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find().populate('userId', 'name email').sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: { orders } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders', error: error.message });
  }
});

// Get single order by ID (owner or admin)
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid order id' });

    // fetch raw order
    const order = await Order.findById(id).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // allow admins or the owner
    if (req.user.role !== 'admin' && (!order.userId || order.userId.toString() !== req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // enrich items with product details
    const productIds = (order.items || []).map(i => i.productId).filter(Boolean);
    const products = productIds.length ? await Product.find({ _id: { $in: productIds } }).lean() : [];
    const productMap = {};
    products.forEach(p => { productMap[p._id.toString()] = p; });

    const enriched = {
      ...order,
      items: (order.items || []).map(it => ({
        ...it,
        product: productMap[(it.productId || '').toString()] || null
      }))
    };

    res.json({ success: true, data: { order: enriched } });
  } catch (error) {
    console.error('Get order by id error', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order', error: error.message });
  }
});

// Admin: approve an order -> create transactions and decrement stock atomically per item
app.post('/api/orders/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'pending') return res.status(400).json({ success: false, message: 'Order not in pending state' });

    // check stock availability for all items
    for (const it of order.items) {
      const p = await Product.findById(it.productId);
      if (!p) return res.status(404).json({ success: false, message: `Product ${it.productId} not found` });
      if (p.stock < it.quantity) return res.status(400).json({ success: false, message: `Insufficient stock for product ${p._id}` });
    }

    // create transactions and update stock
    const created = [];
    for (const it of order.items) {
      const transaction = new Transaction({ userId: order.userId, productId: it.productId, quantity: it.quantity, type: 'out' });
      await transaction.save();
      const p = await Product.findById(it.productId);
      p.stock -= it.quantity;
      await p.save();
      created.push(transaction);
    }

    order.status = 'approved';
    await order.save();

    res.json({ success: true, message: 'Order approved and transactions created', data: { transactions: created, order } });
  } catch (error) {
    console.error('approve order error', error);
    res.status(500).json({ success: false, message: 'Failed to approve order', error: error.message });
  }
});

// ================================
// DASHBOARD & ANALYTICS ROUTES
// ================================

// Dashboard stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const [
      totalProducts,
      totalTransactions,
      recentTransactions
    ] = await Promise.all([
      Product.countDocuments(),
      Transaction.countDocuments(),
      Transaction.find()
        .populate('productId', 'name')
        .populate('userId', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    const stats = {
      totalProducts,
      totalTransactions,
      recentTransactions
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
});

// ================================
// REPORT FEATURES API
// ================================

// 1. Sales Report (ยอดขาย)
app.get("/reports/sales", authenticateToken, async (req, res) => {
  try {
    const salesReport = await Transaction.aggregate([
      { $match: { type: "out" } }, // เอาเฉพาะรายการขายออก
      { $group: { _id: "$productId", totalSold: { $sum: "$quantity" } } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $project: {
          _id: 0,
          product: { $arrayElemAt: ["$product.name", 0] },
          totalSold: 1,
        },
      },
    ]);

    res.json({
      success: true,
      data: salesReport
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate sales report',
      error: err.message 
    });
  }
});

// Backward-compatible alias for frontend expecting /api/reports/sales
app.get('/api/reports/sales', authenticateToken, async (req, res) => {
  // delegate to existing handler logic
  try {
    const salesReport = await Transaction.aggregate([
      { $match: { type: "out" } },
      { $group: { _id: "$productId", totalSold: { $sum: "$quantity" } } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $project: {
          _id: 0,
          product: { $arrayElemAt: ["$product.name", 0] },
          totalSold: 1,
        },
      },
    ]);

    res.json({ success: true, data: salesReport });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate sales report', error: err.message });
  }
});

// 2. Low Stock Report (สินค้าคงเหลือน้อย)
app.get("/reports/low-stock", authenticateToken, async (req, res) => {
  try {
    const threshold = req.query.threshold || 10;
    const lowStockProducts = await Product.find({ 
      stock: { $lt: parseInt(threshold) } 
    });

    res.json({
      success: true,
      data: lowStockProducts
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate low stock report',
      error: err.message 
    });
  }
});

// 3. Transaction Report by User
app.get("/reports/user/:userId", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const userTransactions = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $project: {
          _id: 1,
          type: 1,
          quantity: 1,
          product: { $arrayElemAt: ["$product.name", 0] },
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json({
      success: true,
      data: userTransactions
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate user transaction report',
      error: err.message 
    });
  }
});

// 4. Purchase/Buy Report (รายงานการซื้อเข้า)
app.get("/reports/buy", authenticateToken, async (req, res) => {
  try {
    const buyReport = await Transaction.aggregate([
      { $match: { type: "in" } }, // เอาเฉพาะรายการซื้อเข้า
      { $group: { _id: "$productId", totalBought: { $sum: "$quantity" } } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $project: {
          _id: 0,
          product: { $arrayElemAt: ["$product.name", 0] },
          category: { $arrayElemAt: ["$product.category", 0] },
          totalBought: 1,
        },
      },
      { $sort: { totalBought: -1 } }
    ]);

    res.json({
      success: true,
      data: buyReport
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate purchase report',
      error: err.message 
    });
  }
});

// Backward-compatible alias for frontend expecting /api/reports/buy
app.get('/api/reports/buy', authenticateToken, async (req, res) => {
  try {
    const buyReport = await Transaction.aggregate([
      { $match: { type: "in" } },
      { $group: { _id: "$productId", totalBought: { $sum: "$quantity" } } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $project: {
          _id: 0,
          product: { $arrayElemAt: ["$product.name", 0] },
          category: { $arrayElemAt: ["$product.category", 0] },
          totalBought: 1,
        },
      },
      { $sort: { totalBought: -1 } }
    ]);

    res.json({ success: true, data: buyReport });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate purchase report', error: err.message });
  }
});

// ================================
// START SERVER
// ================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`� Inventory Management System API Ready!`);
});
