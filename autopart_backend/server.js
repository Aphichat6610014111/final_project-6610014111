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
  role: {
    type: String,
    enum: ['admin', 'employee'],
    default: 'employee'
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

// Update user profile
app.put('/api/users/profile',
  authenticateToken,
  [
    body('name').optional().isLength({ min: 2, max: 100 }).trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name } = req.body;
      
      if (name) {
        req.user.name = name;
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
app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: { product }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message
    });
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
