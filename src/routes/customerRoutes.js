const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { isAuthenticated, isCustomer } = require('../middlewares/authMiddleware');

// 1. Halaman Katalog Publik
router.get('/catalog', customerController.renderCatalog);

// 2. Halaman Form Detail & Pemesanan Paket Trip (Input Jumlah Peserta & Catatan)
router.get('/trips/:id/book', isCustomer, customerController.renderBookingForm);

// 3. Proses Simpan Pemesanan (Status: PENDING)
router.post('/bookings/create', isCustomer, customerController.createBooking);

// 4. Halaman Riwayat Pesanan Customer
router.get('/my-bookings', isCustomer, customerController.renderMyBookings);

// 5. Halaman Simulasi Payment Gateway Sandbox (VA / QRIS Dummy)
router.get('/bookings/:id/payment', isCustomer, customerController.renderPaymentSandbox);

// 6. Aksi Simulasi Bayar Lunas (PAID) & Simulasi Gagal/Batal (FAILED)
router.post('/bookings/:id/payment/simulate', isCustomer, customerController.simulatePayment);

// 7. Endpoint Cetak Struk / Invoice PDF (Bisa diakses oleh Customer pemilik pesanan maupun Admin)
router.get('/transactions/:id/invoice-pdf', isAuthenticated, customerController.downloadInvoicePDF);

module.exports = router;
