/**
 * Middleware: Memastikan pengguna sudah login
 */
const isAuthenticated = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.session.flash = {
      type: 'error',
      message: 'Silakan login terlebih dahulu untuk mengakses halaman tersebut.'
    };
    return res.redirect('/auth/login');
  }
  next();
};

/**
 * Middleware: Memastikan pengguna memiliki role ADMIN
 */
const isAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.session.flash = {
      type: 'error',
      message: 'Silakan login terlebih dahulu.'
    };
    return res.redirect('/auth/login');
  }

  if (req.session.user.role !== 'ADMIN') {
    req.session.flash = {
      type: 'error',
      message: 'Akses ditolak! Halaman ini hanya untuk Administrator.'
    };
    return res.redirect('/catalog');
  }

  next();
};

/**
 * Middleware: Memastikan pengguna memiliki role CUSTOMER
 */
const isCustomer = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.session.flash = {
      type: 'error',
      message: 'Silakan login terlebih dahulu untuk memesan paket Open Trip.'
    };
    return res.redirect('/auth/login');
  }

  if (req.session.user.role !== 'CUSTOMER') {
    req.session.flash = {
      type: 'error',
      message: 'Akun Admin tidak dapat melakukan pemesanan Customer. Gunakan akun Customer.'
    };
    return res.redirect('/admin/dashboard');
  }

  next();
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isCustomer
};
