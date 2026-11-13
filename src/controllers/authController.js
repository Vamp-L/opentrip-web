const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

/**
 * Menampilkan halaman Login
 */
exports.renderLogin = (req, res) => {
  if (req.session.user) {
    return req.session.user.role === 'ADMIN'
      ? res.redirect('/admin/dashboard')
      : res.redirect('/catalog');
  }
  res.render('auth/login', { title: 'Login Akun' });
};

/**
 * Memproses form Login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.session.flash = {
        type: 'error',
        message: 'Email dan password wajib diisi.'
      };
      return res.redirect('/auth/login');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (!user) {
      req.session.flash = {
        type: 'error',
        message: 'Email atau password yang Anda masukkan salah.'
      };
      return res.redirect('/auth/login');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      req.session.flash = {
        type: 'error',
        message: 'Email atau password yang Anda masukkan salah.'
      };
      return res.redirect('/auth/login');
    }

    // Simpan ke session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    };

    req.session.flash = {
      type: 'success',
      message: `Selamat datang kembali, ${user.name}!`
    };

    if (user.role === 'ADMIN') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/catalog');
  } catch (error) {
    console.error('Login error:', error);
    req.session.flash = {
      type: 'error',
      message: 'Terjadi kesalahan pada server saat proses login.'
    };
    return res.redirect('/auth/login');
  }
};

/**
 * Menampilkan halaman Registrasi Customer
 */
exports.renderRegister = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register', { title: 'Registrasi Customer' });
};

/**
 * Memproses pendaftaran akun Customer baru
 */
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      req.session.flash = {
        type: 'error',
        message: 'Nama lengkap, email, dan password wajib diisi.'
      };
      return res.redirect('/auth/register');
    }

    if (password.length < 6) {
      req.session.flash = {
        type: 'error',
        message: 'Password minimal harus terdiri dari 6 karakter.'
      };
      return res.redirect('/auth/register');
    }

    if (password !== confirmPassword) {
      req.session.flash = {
        type: 'error',
        message: 'Konfirmasi password tidak cocok.'
      };
      return res.redirect('/auth/register');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      req.session.flash = {
        type: 'error',
        message: 'Email sudah terdaftar. Silakan gunakan email lain atau login.'
      };
      return res.redirect('/auth/register');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        phone: phone ? phone.trim() : null,
        password: hashedPassword,
        role: 'CUSTOMER'
      }
    });

    // Otomatis login setelah berhasil mendaftar
    req.session.user = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role
    };

    req.session.flash = {
      type: 'success',
      message: 'Registrasi berhasil! Selamat menjelajahi paket Open Trip kami.'
    };

    return res.redirect('/catalog');
  } catch (error) {
    console.error('Register error:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal melakukan registrasi akun.'
    };
    return res.redirect('/auth/register');
  }
};

/**
 * Memproses Logout pengguna
 */
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
};
