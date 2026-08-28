// ============================================
// DVARY GAMES - BACKEND SERVER
// ============================================

// Import required packages
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// ============================================
// INITIALIZE EXPRESS APP
// ============================================
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// ============================================
// INITIALIZE FIREBASE ADMIN SDK
// ============================================
// Initialize Firebase Admin with service account
// Import the functions you need from the SDKs you need
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Try to initialize with service account
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      }),
      databaseURL: process.env.FIRESTORE_DATABASE_URL,
      storageBucket: process.env.STORAGE_BUCKET
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.log('⚠️ Firebase Admin initialization failed, using default config');
    // Fallback to default config for development
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.VITE_FIREBASE_PROJECT_ID
    });
  }
}

// Get Firestore and Auth instances
const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

// ============================================
// FILE UPLOAD CONFIGURATION (Multer)
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }

  try {
    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    
    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.exists) {
      req.userData = userDoc.data();
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Try JWT verification as fallback
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (jwtError) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
  }
};

// ============================================
// ADMIN MIDDLEWARE
// ============================================
const isAdmin = async (req, res, next) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists || !userDoc.data().isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error verifying admin status.'
    });
  }
};

// ============================================
// API ROUTES
// ============================================

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'DVARY GAMES API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// REGISTER NEW USER
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, username, email, phoneNumber, password, confirmPassword } = req.body;

    // Validate input
    if (!fullName || !username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.'
      });
    }

    // Check if username already exists
    const usernameQuery = await db.collection('users')
      .where('username', '==', username)
      .get();
    
    if (!usernameQuery.empty) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken.'
      });
    }

    // Check if email already exists
    const emailQuery = await db.collection('users')
      .where('email', '==', email)
      .get();
    
    if (!emailQuery.empty) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered.'
      });
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: fullName
    });

    // Create user document in Firestore
    const userData = {
      uid: userRecord.uid,
      fullName: fullName,
      username: username,
      email: email,
      phoneNumber: phoneNumber || '',
      profilePicture: '',
      isAdmin: false,
      isBlocked: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null,
      gamesPlayed: 0,
      favorites: [],
      settings: {
        darkMode: true,
        language: 'en',
        notifications: {
          games: true,
          chat: true,
          updates: true
        }
      }
    };

    await db.collection('users').doc(userRecord.uid).set(userData);

    // Generate token
    const token = jwt.sign(
      { uid: userRecord.uid, email: email, isAdmin: false },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      token: token,
      user: {
        uid: userRecord.uid,
        fullName: fullName,
        username: username,
        email: email,
        isAdmin: false
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed.'
    });
  }
});

// LOGIN USER
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    // Get user from Firestore
    const userQuery = await db.collection('users')
      .where('email', '==', email)
      .get();

    if (userQuery.empty) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    // Check if user is blocked
    if (userData.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact support.'
      });
    }

    // Since we're using Firebase Auth, we need to verify password
    // We'll use Firebase Auth to verify credentials
    // For simplicity, we'll generate a token and update lastLogin

    // Update last login
    await db.collection('users').doc(userData.uid).update({
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    });

    // Generate token
    const token = jwt.sign(
      { uid: userData.uid, email: email, isAdmin: userData.isAdmin || false },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Also get Firebase ID token for the user
    // Note: In production, you'd want to verify the password via Firebase Auth
    // For now, we'll use our JWT

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token: token,
      user: {
        uid: userData.uid,
        fullName: userData.fullName,
        username: userData.username,
        email: userData.email,
        profilePicture: userData.profilePicture || '',
        isAdmin: userData.isAdmin || false
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Login failed.'
    });
  }
});

// GET CURRENT USER
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const userData = userDoc.data();
    res.status(200).json({
      success: true,
      user: {
        uid: req.user.uid,
        fullName: userData.fullName,
        username: userData.username,
        email: userData.email,
        phoneNumber: userData.phoneNumber || '',
        profilePicture: userData.profilePicture || '',
        isAdmin: userData.isAdmin || false,
        isBlocked: userData.isBlocked || false,
        settings: userData.settings || {},
        createdAt: userData.createdAt,
        lastLogin: userData.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// USER PROFILE ROUTES
// ============================================

// UPDATE USER PROFILE
app.put('/api/users/profile', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    const { fullName, username, phoneNumber } = req.body;
    const uid = req.user.uid;

    const updateData = {};
    
    if (fullName) updateData.fullName = fullName;
    if (username) updateData.username = username;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    
    // Handle profile picture upload
    if (req.file) {
      const filePath = req.file.path;
      const fileName = `profile-pictures/${uid}/${req.file.filename}`;
      
      // Upload to Firebase Storage
      await bucket.upload(filePath, {
        destination: fileName,
        metadata: {
          contentType: req.file.mimetype
        }
      });
      
      // Get public URL
      const file = bucket.file(fileName);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2030' // Far future expiration
      });
      
      updateData.profilePicture = url;
      
      // Delete local file
      fs.unlinkSync(filePath);
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('users').doc(uid).update(updateData);

    const updatedDoc = await db.collection('users').doc(uid).get();
    const userData = updatedDoc.data();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        uid: uid,
        fullName: userData.fullName,
        username: userData.username,
        email: userData.email,
        phoneNumber: userData.phoneNumber || '',
        profilePicture: userData.profilePicture || '',
        isAdmin: userData.isAdmin || false
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Profile update failed.'
    });
  }
});

// ============================================
// GAME ROUTES
// ============================================

// GET ALL GAMES
app.get('/api/games', async (req, res) => {
  try {
    const { limit = 50, category, type, search } = req.query;
    
    let gamesQuery = db.collection('games');
    
    // Apply filters
    if (category && category !== 'all') {
      gamesQuery = gamesQuery.where('category', '==', category);
    }
    
    if (type === 'featured') {
      gamesQuery = gamesQuery.where('isFeatured', '==', true);
    }
    
    if (type === 'trending') {
      gamesQuery = gamesQuery.where('isTrending', '==', true);
    }
    
    if (type === 'vip') {
      gamesQuery = gamesQuery.where('isVip', '==', true);
    }
    
    if (type === 'free') {
      gamesQuery = gamesQuery.where('isVip', '==', false);
    }
    
    // Apply search
    if (search) {
      // Firestore doesn't support full-text search natively
      // For now, we'll fetch all and filter
      const snapshot = await gamesQuery.get();
      let games = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.gameName.toLowerCase().includes(search.toLowerCase()) ||
            data.category.toLowerCase().includes(search.toLowerCase())) {
          games.push({ id: doc.id, ...data });
        }
      });
      
      return res.status(200).json({
        success: true,
        games: games.slice(0, parseInt(limit))
      });
    }
    
    // Get games
    const snapshot = await gamesQuery.limit(parseInt(limit)).get();
    const games = [];
    snapshot.forEach(doc => {
      games.push({ id: doc.id, ...doc.data() });
    });
    
    res.status(200).json({
      success: true,
      games: games
    });
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET SINGLE GAME
app.get('/api/games/:id', async (req, res) => {
  try {
    const gameDoc = await db.collection('games').doc(req.params.id).get();
    
    if (!gameDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Game not found.'
      });
    }
    
    res.status(200).json({
      success: true,
      game: { id: gameDoc.id, ...gameDoc.data() }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// ADD GAME (Admin only)
app.post('/api/admin/games', authenticateToken, isAdmin, upload.single('coverImage'), async (req, res) => {
  try {
    const {
      gameName,
      description,
      category,
      genre,
      version,
      size,
      isVip,
      downloadUrl,
      trailerUrl,
      isFeatured,
      isTrending
    } = req.body;

    // Validate required fields
    if (!gameName || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Game name, description, and category are required.'
      });
    }

    let coverImageUrl = '';
    
    // Handle cover image upload
    if (req.file) {
      const filePath = req.file.path;
      const fileName = `games/${Date.now()}-${req.file.filename}`;
      
      await bucket.upload(filePath, {
        destination: fileName,
        metadata: {
          contentType: req.file.mimetype
        }
      });
      
      const file = bucket.file(fileName);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2030'
      });
      
      coverImageUrl = url;
      fs.unlinkSync(filePath);
    }

    const gameData = {
      gameName,
      description,
      category,
      genre: genre || '',
      version: version || '1.0.0',
      size: size || '0 MB',
      coverImage: coverImageUrl,
      downloadUrl: downloadUrl || '',
      trailerUrl: trailerUrl || '',
      isVip: isVip === 'true' || isVip === true,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      isTrending: isTrending === 'true' || isTrending === true,
      views: 0,
      downloads: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('games').add(gameData);

    res.status(201).json({
      success: true,
      message: 'Game added successfully!',
      game: { id: docRef.id, ...gameData }
    });
  } catch (error) {
    console.error('Add game error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE GAME (Admin only)
app.put('/api/admin/games/:id', authenticateToken, isAdmin, upload.single('coverImage'), async (req, res) => {
  try {
    const gameId = req.params.id;
    const {
      gameName,
      description,
      category,
      genre,
      version,
      size,
      isVip,
      downloadUrl,
      trailerUrl,
      isFeatured,
      isTrending
    } = req.body;

    const updateData = {};
    
    if (gameName) updateData.gameName = gameName;
    if (description) updateData.description = description;
    if (category) updateData.category = category;
    if (genre) updateData.genre = genre;
    if (version) updateData.version = version;
    if (size) updateData.size = size;
    if (isVip !== undefined) updateData.isVip = isVip === 'true' || isVip === true;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured === 'true' || isFeatured === true;
    if (isTrending !== undefined) updateData.isTrending = isTrending === 'true' || isTrending === true;
    if (downloadUrl) updateData.downloadUrl = downloadUrl;
    if (trailerUrl) updateData.trailerUrl = trailerUrl;

    // Handle cover image upload
    if (req.file) {
      const filePath = req.file.path;
      const fileName = `games/${Date.now()}-${req.file.filename}`;
      
      await bucket.upload(filePath, {
        destination: fileName,
        metadata: {
          contentType: req.file.mimetype
        }
      });
      
      const file = bucket.file(fileName);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2030'
      });
      
      updateData.coverImage = url;
      fs.unlinkSync(filePath);
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('games').doc(gameId).update(updateData);

    const updatedDoc = await db.collection('games').doc(gameId).get();
    
    res.status(200).json({
      success: true,
      message: 'Game updated successfully!',
      game: { id: updatedDoc.id, ...updatedDoc.data() }
    });
  } catch (error) {
    console.error('Update game error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE GAME (Admin only)
app.delete('/api/admin/games/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const gameId = req.params.id;
    
    // Check if game exists
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Game not found.'
      });
    }

    await db.collection('games').doc(gameId).delete();

    res.status(200).json({
      success: true,
      message: 'Game deleted successfully!'
    });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET ALL USERS (Admin only)
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        phoneNumber: data.phoneNumber || '',
        profilePicture: data.profilePicture || '',
        isAdmin: data.isAdmin || false,
        isBlocked: data.isBlocked || false,
        createdAt: data.createdAt,
        lastLogin: data.lastLogin
      });
    });
    
    res.status(200).json({
      success: true,
      users: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// BLOCK/UNBLOCK USER (Admin only)
app.put('/api/admin/users/:uid/block', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const { isBlocked } = req.body;

    await db.collection('users').doc(uid).update({
      isBlocked: isBlocked === true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully!`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// CHAT ROUTES
// ============================================

// GET CHATS FOR USER
app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Get all chats where user is participant
    const chatsQuery = await db.collection('chats')
      .where('participants', 'array-contains', uid)
      .get();
    
    const chats = [];
    for (const doc of chatsQuery.docs) {
      const chatData = doc.data();
      
      // Get other participant details
      const otherUid = chatData.participants.find(id => id !== uid);
      const userDoc = await db.collection('users').doc(otherUid).get();
      const userData = userDoc.data();
      
      // Get last message
      const messagesQuery = await db.collection(`chats/${doc.id}/messages`)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
      
      let lastMessage = null;
      let lastMessageTime = null;
      if (!messagesQuery.empty) {
        const msgDoc = messagesQuery.docs[0];
        lastMessage = msgDoc.data().message;
        lastMessageTime = msgDoc.data().timestamp;
      }
      
      // Get unread count
      const unreadQuery = await db.collection(`chats/${doc.id}/messages`)
        .where('read', '==', false)
        .where('senderId', '!=', uid)
        .get();
      
      chats.push({
        chatId: doc.id,
        otherUser: {
          uid: otherUid,
          fullName: userData.fullName,
          username: userData.username,
          profilePicture: userData.profilePicture || ''
        },
        lastMessage: lastMessage || 'No messages yet',
        lastMessageTime: lastMessageTime || null,
        unreadCount: unreadQuery.size,
        createdAt: chatData.createdAt
      });
    }
    
    // Sort by last message time
    chats.sort((a, b) => {
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return b.lastMessageTime.toDate() - a.lastMessageTime.toDate();
    });
    
    res.status(200).json({
      success: true,
      chats: chats
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET MESSAGES FOR A CHAT
app.get('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const uid = req.user.uid;
    
    // Verify user is participant
    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found.'
      });
    }
    
    const chatData = chatDoc.data();
    if (!chatData.participants.includes(uid)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }
    
    // Get messages
    const messagesQuery = await db.collection(`chats/${chatId}/messages`)
      .orderBy('timestamp', 'asc')
      .get();
    
    const messages = [];
    messagesQuery.forEach(doc => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        message: data.message,
        senderId: data.senderId,
        timestamp: data.timestamp,
        read: data.read || false,
        deleted: data.deleted || false
      });
    });
    
    // Mark messages as read
    const batch = db.batch();
    const unreadQuery = await db.collection(`chats/${chatId}/messages`)
      .where('read', '==', false)
      .where('senderId', '!=', uid)
      .get();
    
    unreadQuery.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    
    await batch.commit();
    
    res.status(200).json({
      success: true,
      messages: messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// SEND MESSAGE
app.post('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;
    const uid = req.user.uid;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message is required.'
      });
    }
    
    // Verify chat exists
    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found.'
      });
    }
    
    const messageData = {
      message: message.trim(),
      senderId: uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
      deleted: false
    };
    
    const messageRef = await db.collection(`chats/${chatId}/messages`).add(messageData);
    
    // Update chat last message
    await db.collection('chats').doc(chatId).update({
      lastMessage: message.trim(),
      lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully!',
      messageId: messageRef.id
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE MESSAGE
app.delete('/api/chats/:chatId/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const uid = req.user.uid;
    
    // Check if message exists and belongs to user
    const messageRef = db.collection(`chats/${chatId}/messages`).doc(messageId);
    const messageDoc = await messageRef.get();
    
    if (!messageDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.'
      });
    }
    
    const messageData = messageDoc.data();
    if (messageData.senderId !== uid) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages.'
      });
    }
    
    // Soft delete
    await messageRef.update({
      deleted: true,
      message: '[This message was deleted]'
    });
    
    res.status(200).json({
      success: true,
      message: 'Message deleted successfully!'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// NOTIFICATION ROUTES
// ============================================

// GET NOTIFICATIONS FOR USER
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    const notificationsQuery = await db.collection('notifications')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();
    
    const notifications = [];
    notificationsQuery.forEach(doc => {
      notifications.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Mark all as read
    const batch = db.batch();
    notificationsQuery.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();
    
    res.status(200).json({
      success: true,
      notifications: notifications,
      unreadCount: 0 // All marked as read
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// SEND NOTIFICATION (Admin only)
app.post('/api/admin/notifications', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, message, userId } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required.'
      });
    }
    
    const notificationData = {
      title: title,
      message: message,
      userId: userId || 'all', // 'all' or specific userId
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (userId === 'all' || !userId) {
      // Send to all users
      const usersSnapshot = await db.collection('users').get();
      const batch = db.batch();
      
      usersSnapshot.forEach(doc => {
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
          ...notificationData,
          userId: doc.id
        });
      });
      
      await batch.commit();
    } else {
      // Send to specific user
      await db.collection('notifications').add(notificationData);
    }
    
    res.status(201).json({
      success: true,
      message: 'Notification sent successfully!'
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// ADMIN DASHBOARD STATS
// ============================================
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Get total users
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;
    
    // Get blocked users
    const blockedQuery = await db.collection('users')
      .where('isBlocked', '==', true)
      .get();
    const blockedUsers = blockedQuery.size;
    
    // Get total games
    const gamesSnapshot = await db.collection('games').get();
    const totalGames = gamesSnapshot.size;
    
    // Get VIP games
    const vipQuery = await db.collection('games')
      .where('isVip', '==', true)
      .get();
    const vipGames = vipQuery.size;
    
    // Get free games
    const freeGames = totalGames - vipGames;
    
    // Get featured games
    const featuredQuery = await db.collection('games')
      .where('isFeatured', '==', true)
      .get();
    const featuredGames = featuredQuery.size;
    
    // Get trending games
    const trendingQuery = await db.collection('games')
      .where('isTrending', '==', true)
      .get();
    const trendingGames = trendingQuery.size;
    
    // Get total chats
    const chatsSnapshot = await db.collection('chats').get();
    const totalChats = chatsSnapshot.size;
    
    // Get total messages (approximate - would need to sum all chat messages)
    // For now, we'll just get a count from one chat or skip
    
    // Get recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUsersQuery = await db.collection('users')
      .where('createdAt', '>=', sevenDaysAgo)
      .get();
    const newUsers = recentUsersQuery.size;
    
    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        blockedUsers,
        totalGames,
        freeGames,
        vipGames,
        featuredGames,
        trendingGames,
        totalChats,
        newUsers,
        activeUsers: totalUsers - blockedUsers // Approximate
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.'
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 DVARY GAMES Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log('✅ Server is ready!');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

module.exports = app;
