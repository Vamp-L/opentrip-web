require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');

const authRoutes = require('./routes/authRoutes');
const publicRoutes = require('./routes/publicRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminTripRoutes = require('./routes/adminTripRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi View Engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware Standar
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi Express Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'nusatrip_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 jam
    },
  })
);

// Global Helper & Variabel Session untuk Seluruh View EJS
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.formatRupiah = (nominal) => {
    return 'Rp ' + Number(nominal || 0).toLocaleString('id-ID');
  };
  res.locals.formatDate = (dateInput) => {
    if (!dateInput) return '-';
    return new Date(dateInput).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };
  next();
});

// Registrasi Seluruh Route
app.use('/', authRoutes);
app.use('/', publicRoutes);
app.use('/', bookingRoutes);
app.use('/admin', adminTripRoutes);
app.use('/admin', reportRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('public/error', {
    title: 'Halaman Tidak Ditemukan - NusaTrip',
    message: 'Halaman yang Anda tuju tidak ditemukan di NusaTrip.',
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  NusaTrip Server berjalan di http://localhost:${PORT}`);
  console.log(`====================================================`);
});
