const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET / - Katalog Publik dengan Pencarian Destinasi & Filter Tanggal
router.get('/', async (req, res) => {
  try {
    const search = req.query.q ? req.query.q.trim() : '';
    const dateFilter = req.query.date ? req.query.date.trim() : '';

    const whereClause = {};
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { destination: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFilter) {
      const parsedDate = new Date(dateFilter);
      if (!isNaN(parsedDate.getTime())) {
        whereClause.startDate = {
          gte: parsedDate,
        };
      }
    }

    const trips = await prisma.trip.findMany({
      where: whereClause,
      orderBy: { startDate: 'asc' },
    });

    res.render('public/index', {
      title: 'NusaTrip - Jelajahi Keindahan Alam Nusantara',
      trips,
      search,
      dateFilter,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (error) {
    console.error('Error loading public catalog:', error);
    res.status(500).render('public/error', {
      title: 'Kesalahan Server - NusaTrip',
      message: 'Gagal memuat katalog paket Open Trip.',
    });
  }
});

// GET /trips/:id - Detail Paket Open Trip
router.get('/trips/:id', async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) {
      return res.status(404).render('public/error', {
        title: 'Paket Tidak Ditemukan - NusaTrip',
        message: 'ID paket perjalanan tidak valid.',
      });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      return res.status(404).render('public/error', {
        title: 'Paket Tidak Ditemukan - NusaTrip',
        message: 'Paket Open Trip yang Anda cari tidak tersedia.',
      });
    }

    const otherTrips = await prisma.trip.findMany({
      where: { id: { not: trip.id } },
      take: 3,
      orderBy: { startDate: 'asc' },
    });

    res.render('public/trip-detail', {
      title: `${trip.title} - NusaTrip`,
      trip,
      otherTrips,
      error: req.query.error || null,
    });
  } catch (error) {
    console.error('Error loading trip detail:', error);
    res.status(500).render('public/error', {
      title: 'Kesalahan Server - NusaTrip',
      message: 'Gagal memuat halaman detail paket perjalanan.',
    });
  }
});

module.exports = router;
