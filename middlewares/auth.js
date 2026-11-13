function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login?error=' + encodeURIComponent('Silakan masuk ke akun Anda terlebih dahulu.'));
}

function ensureAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'ADMIN') {
    return next();
  }
  if (!req.session || !req.session.user) {
    return res.redirect('/login?error=' + encodeURIComponent('Akses khusus Admin. Silakan login sebagai Admin.'));
  }
  return res.status(403).render('public/error', {
    title: 'Akses Ditolak - NusaTrip',
    message: 'Halaman ini hanya dapat diakses oleh Administrator NusaTrip.',
  });
}

function ensureCustomer(req, res, next) {
  if (req.session && req.session.user && (req.session.user.role === 'CUSTOMER' || req.session.user.role === 'ADMIN')) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login?error=' + encodeURIComponent('Silakan masuk sebagai Customer untuk memesan paket trip.'));
}

function forwardAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'ADMIN') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/');
  }
  return next();
}

module.exports = {
  ensureAuthenticated,
  ensureAdmin,
  ensureCustomer,
  forwardAuthenticated,
};
