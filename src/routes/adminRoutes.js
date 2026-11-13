const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middlewares/authMiddleware');

// Seluruh route di bawah ini wajib memiliki role ADMIN
router.use(isAdmin);

// 1. Ringkasan Dashboard Admin
router.get('/dashboard', adminController.renderDashboard);

// 2. CRUD Paket Open Trip
router.get('/trips', adminController.listTrips);
router.get('/trips/create', adminController.renderCreateTrip);
router.post('/trips', adminController.createTrip);
router.get('/trips/:id/edit', adminController.renderEditTrip);
router.post('/trips/:id/update', adminController.updateTrip);
router.post('/trips/:id/delete', adminController.deleteTrip);

// 3. Daftar Seluruh Transaksi Pesanan & Cetak Invoice PDF
router.get('/transactions', adminController.listTransactions);

// 4. Laporan Penjualan & Keuangan + Filter Tanggal + Ekspor PDF & Excel (.xlsx)
router.get('/reports', adminController.renderReports);
router.get('/reports/export-pdf', adminController.exportReportsPDF);
router.get('/reports/export-excel', adminController.exportReportsExcel);

module.exports = router;
