const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { forwardAuthenticated } = require('../middlewares/auth');

let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = require('bcryptjs');
}

const prisma = new PrismaClient();

// GET /login
router.get('/login', forwardAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Masuk Akun - NusaTrip',
    error: req.query.error || null,
    success: req.query.success || null,
  });
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.render('auth/login', {
        title: 'Masuk Akun - NusaTrip',
        error: 'Email dan password wajib diisi.',
        success: null,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.render('auth/login', {
        title: 'Masuk Akun - NusaTrip',
        error: 'Email atau password tidak valid.',
        success: null,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Masuk Akun - NusaTrip',
        error: 'Email atau password tidak valid.',
        success: null,
      });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const returnTo = req.session.returnTo;
    delete req.session.returnTo;

    if (user.role === 'ADMIN') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect(returnTo || '/');
  } catch (error) {
    console.error('Login error:', error);
    return res.render('auth/login', {
      title: 'Masuk Akun - NusaTrip',
      error: 'Terjadi kesalahan pada server saat proses login.',
      success: null,
    });
  }
});

// GET /register
router.get('/register', forwardAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Daftar Akun Baru - NusaTrip',
    error: req.query.error || null,
  });
});

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    if (!name || !email || !password) {
      return res.render('auth/register', {
        title: 'Daftar Akun Baru - NusaTrip',
        error: 'Semua kolom wajib diisi.',
      });
    }

    if (password.length < 6) {
      return res.render('auth/register', {
        title: 'Daftar Akun Baru - NusaTrip',
        error: 'Password minimal harus terdiri dari 6 karakter.',
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.render('auth/register', {
        title: 'Daftar Akun Baru - NusaTrip',
        error: 'Konfirmasi password tidak cocok.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return res.render('auth/register', {
        title: 'Daftar Akun Baru - NusaTrip',
        error: 'Email sudah terdaftar. Silakan gunakan email lain atau masuk.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: 'CUSTOMER',
      },
    });

    req.session.user = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };

    return res.redirect('/?success=' + encodeURIComponent('Selamat datang di NusaTrip! Akun Anda berhasil dibuat.'));
  } catch (error) {
    console.error('Register error:', error);
    return res.render('auth/register', {
      title: 'Daftar Akun Baru - NusaTrip',
      error: 'Terjadi kesalahan saat mendaftarkan akun.',
    });
  }
});

// GET /logout & POST /logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login?success=' + encodeURIComponent('Anda telah berhasil keluar dari sesi.'));
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login?success=' + encodeURIComponent('Anda telah berhasil keluar dari sesi.'));
  });
});

module.exports = router;
