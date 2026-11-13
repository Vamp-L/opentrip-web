const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { ensureAdmin } = require('../middlewares/auth');

const prisma = new PrismaClient();

// GET /admin/dashboard - Ringkasan Eksekutif Admin
router.get('/dashboard', ensureAdmin, async (req, res) => {
  try {
    const [totalTrips, totalUsers, allBookings, recentBookings] = await Promise.all([
      prisma.trip.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.booking.findMany({
        include: { transaction: true },
      }),
      prisma.booking.findMany({
        take: 6,
        orderBy: { bookingDate: 'desc' },
        include: {
          user: true,
          trip: true,
          transaction: true,
        },
      }),
    ]);

    const paidBookings = allBookings.filter((b) => b.status === 'PAID');
    const totalRevenue = paidBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalParticipants = paidBookings.reduce((sum, b) => sum + b.participants, 0);
    const pendingCount = allBookings.filter((b) => b.status === 'PENDING').length;

    res.render('admin/dashboard', {
      title: 'Dashboard Admin - NusaTrip',
      activePage: 'dashboard',
      metrics: {
        totalRevenue,
        totalParticipants,
        paidCount: paidBookings.length,
        pendingCount,
        totalTrips,
        totalUsers,
      },
      recentBookings,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).render('public/error', {
      title: 'Kesalahan Server - NusaTrip',
      message: 'Gagal memuat halaman Dashboard Admin.',
    });
  }
});

// GET /admin/trips - Daftar & Kelola Paket Open Trip
router.get('/trips', ensureAdmin, async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });

    res.render('admin/trips', {
      title: 'Kelola Paket Trip - NusaTrip Admin',
      activePage: 'trips',
      trips,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (error) {
    console.error('Admin trips list error:', error);
    res.status(500).render('public/error', {
      title: 'Kesalahan Server - NusaTrip',
      message: 'Gagal memuat daftar paket trip.',
    });
  }
});

// GET /admin/trips/new - Form Tambah Paket Trip
router.get('/trips/new', ensureAdmin, (req, res) => {
  res.render('admin/trip-form', {
    title: 'Tambah Paket Open Trip - NusaTrip Admin',
    activePage: 'trips',
    trip: null,
    error: null,
  });
});

// POST /admin/trips - Simpan Paket Trip Baru
router.post('/trips', ensureAdmin, async (req, res) => {
  try {
    const { title, destination, description, imageUrl, price, startDate, endDate, quota, availableQuota } = req.body;
    const parsedQuota = parseInt(quota, 10) || 10;
    const parsedAvailable =
      availableQuota !== undefined && availableQuota !== '' ? parseInt(availableQuota, 10) : parsedQuota;

    await prisma.trip.create({
      data: {
        title: title.trim(),
        destination: destination.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        price: parseInt(price, 10) || 0,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        quota: parsedQuota,
        availableQuota: parsedAvailable,
      },
    });

    res.redirect('/admin/trips?success=' + encodeURIComponent('Paket Open Trip baru berhasil ditambahkan.'));
  } catch (error) {
    console.error('Create trip error:', error);
    res.render('admin/trip-form', {
      title: 'Tambah Paket Open Trip - NusaTrip Admin',
      activePage: 'trips',
      trip: req.body,
      error: 'Gagal menyimpan paket trip. Pastikan seluruh input dan tanggal valid.',
    });
  }
});

// GET /admin/trips/:id/edit - Form Edit Paket Trip
router.get('/trips/:id/edit', ensureAdmin, async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return res.redirect('/admin/trips?error=' + encodeURIComponent('Paket trip tidak ditemukan.'));
    }

    res.render('admin/trip-form', {
      title: `Edit ${trip.title} - NusaTrip Admin`,
      activePage: 'trips',
      trip,
      error: null,
    });
  } catch (error) {
    console.error('Edit trip form error:', error);
    res.redirect('/admin/trips?error=' + encodeURIComponent('Gagal memuat form edit paket trip.'));
  }
});

// POST /admin/trips/:id/update - Update Paket Trip
router.post('/trips/:id/update', ensureAdmin, async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    const { title, destination, description, imageUrl, price, startDate, endDate, quota, availableQuota } = req.body;

    await prisma.trip.update({
      where: { id: tripId },
      data: {
        title: title.trim(),
        destination: destination.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        price: parseInt(price, 10) || 0,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        quota: parseInt(quota, 10) || 0,
        availableQuota: parseInt(availableQuota, 10) || 0,
      },
    });

    res.redirect('/admin/trips?success=' + encodeURIComponent('Data paket Open Trip berhasil diperbarui.'));
  } catch (error) {
    console.error('Update trip error:', error);
    res.redirect('/admin/trips?error=' + encodeURIComponent('Gagal memperbarui paket Open Trip.'));
  }
});

// POST /admin/trips/:id/delete - Hapus Paket Trip
router.post('/trips/:id/delete', ensureAdmin, async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    await prisma.trip.delete({ where: { id: tripId } });
    res.redirect('/admin/trips?success=' + encodeURIComponent('Paket Open Trip berhasil dihapus.'));
  } catch (error) {
    console.error('Delete trip error:', error);
    res.redirect('/admin/trips?error=' + encodeURIComponent('Gagal menghapus paket trip.'));
  }
});

// GET /admin/transactions - Data Transaksi & Booking Lengkap
router.get('/transactions', ensureAdmin, async (req, res) => {
  try {
    const statusFilter = req.query.status || '';
    const whereClause = {};
    if (statusFilter && ['PENDING', 'PAID', 'CANCELLED'].includes(statusFilter)) {
      whereClause.status = statusFilter;
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: { bookingDate: 'desc' },
      include: {
        user: true,
        trip: true,
        transaction: true,
      },
    });

    res.render('admin/transactions', {
      title: 'Data Transaksi - NusaTrip Admin',
      activePage: 'transactions',
      bookings,
      statusFilter,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (error) {
    console.error('Admin transactions error:', error);
    res.status(500).render('public/error', {
      title: 'Kesalahan Server - NusaTrip',
      message: 'Gagal memuat data transaksi.',
    });
  }
});

module.exports = router;
