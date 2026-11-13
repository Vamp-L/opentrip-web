const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Tampilan & Proses Login
router.get('/login', authController.renderLogin);
router.post('/login', authController.login);

// Tampilan & Proses Register Customer
router.get('/register', authController.renderRegister);
router.post('/register', authController.register);

// Proses Logout
router.post('/logout', authController.logout);

module.exports = router;
