const prisma = require('../config/prisma');
const { generateSalesReportPDF } = require('../utils/pdfGenerator');
const { generateSalesReportExcel } = require('../utils/excelGenerator');

/**
 * Helper Internal: Mengambil data transaksi berstatus PAID berdasarkan filter rentang tanggal
 */
async function getFilteredPaidBookings(startDateStr, endDateStr) {
  const dateFilter = {};

  if (startDateStr && startDateStr.trim() !== '') {
    const start = new Date(`${startDateStr}T00:00:00.000Z`);
    if (!isNaN(start.getTime())) {
      dateFilter.gte = start;
    }
  }

  if (endDateStr && endDateStr.trim() !== '') {
    const end = new Date(`${endDateStr}T23:59:59.999Z`);
    if (!isNaN(end.getTime())) {
      dateFilter.lte = end;
    }
  }

  const whereClause = {
    status: 'PAID'
  };

  if (Object.keys(dateFilter).length > 0) {
    whereClause.bookingDate = dateFilter;
  }

  const bookings = await prisma.booking.findMany({
    where: whereClause,
    include: {
      user: true,
      trip: true,
      payment: true
    },
    orderBy: {
      bookingDate: 'desc'
    }
  });

  const totalRevenue = bookings.reduce((sum, item) => sum + Number(item.totalAmount), 0);
  const totalParticipants = bookings.reduce((sum, item) => sum + Number(item.participants), 0);
  const totalTransactions = bookings.length;

  return {
    bookings,
    startDate: startDateStr || '',
    endDate: endDateStr || '',
    summary: {
      totalRevenue,
      totalTransactions,
      totalParticipants
    }
  };
}

/**
 * 1. Menampilkan Dashboard Ringkasan Admin
 */
exports.renderDashboard = async (req, res) => {
  try {
    const [totalTrips, totalCustomers, totalBookings, paidBookings, latestTrips, recentBookings] = await Promise.all([
      prisma.trip.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.booking.count(),
      prisma.booking.findMany({ where: { status: 'PAID' } }),
      prisma.trip.findMany({
        orderBy: { departureDate: 'asc' },
        take: 5
      }),
      prisma.booking.findMany({
        include: { user: true, trip: true, payment: true },
        orderBy: { bookingDate: 'desc' },
        take: 5
      })
    ]);

    const totalRevenue = paidBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);

    res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      pageTitle: 'Dashboard Ringkasan',
      stats: {
        totalTrips,
        totalCustomers,
        totalBookings,
        paidBookingsCount: paidBookings.length,
        totalRevenue
      },
      latestTrips,
      recentBookings
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal memuat data dashboard.'
    };
    res.redirect('/admin/trips');
  }
};

/**
 * 2. Menampilkan Tabel Daftar Paket Open Trip
 */
exports.listTrips = async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      orderBy: { departureDate: 'asc' },
      include: {
        _count: {
          select: { bookings: true }
        }
      }
    });

    res.render('admin/trips', {
      title: 'Manajemen Paket Open Trip',
      pageTitle: 'Manajemen Paket Open Trip',
      trips
    });
  } catch (error) {
    console.error('Error listing trips:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal mengambil daftar paket Open Trip.'
    };
    res.redirect('/admin/dashboard');
  }
};

/**
 * 3. Menampilkan Form Tambah Paket Open Trip Baru
 */
exports.renderCreateTrip = (req, res) => {
  res.render('admin/trip-form', {
    title: 'Tambah Paket Open Trip',
    pageTitle: 'Tambah Paket Open Trip Baru',
    isEdit: false,
    trip: null
  });
};

/**
 * 4. Menyimpan Paket Open Trip Baru ke Database
 */
exports.createTrip = async (req, res) => {
  try {
    const {
      title,
      destination,
      price,
      departureDate,
      maxQuota,
      remainingQuota,
      imageUrl,
      description
    } = req.body;

    const parsedMaxQuota = parseInt(maxQuota, 10);
    const parsedRemainingQuota =
      remainingQuota !== undefined && remainingQuota !== ''
        ? parseInt(remainingQuota, 10)
        : parsedMaxQuota;

    if (parsedRemainingQuota > parsedMaxQuota) {
      req.session.flash = {
        type: 'error',
        message: 'Sisa kuota tidak boleh melebihi kuota maksimal.'
      };
      return res.redirect('/admin/trips/create');
    }

    await prisma.trip.create({
      data: {
        title: title.trim(),
        destination: destination.trim(),
        price: parseFloat(price),
        departureDate: new Date(departureDate),
        maxQuota: parsedMaxQuota,
        remainingQuota: parsedRemainingQuota,
        imageUrl: imageUrl && imageUrl.trim() !== ''
          ? imageUrl.trim()
          : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
        description: description.trim()
      }
    });

    req.session.flash = {
      type: 'success',
      message: `Paket Open Trip "${title}" berhasil ditambahkan!`
    };
    return res.redirect('/admin/trips');
  } catch (error) {
    console.error('Error creating trip:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal menambahkan paket Open Trip. Pastikan seluruh kolom valid.'
    };
    return res.redirect('/admin/trips/create');
  }
};

/**
 * 5. Menampilkan Form Edit Paket Open Trip
 */
exports.renderEditTrip = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    const trip = await prisma.trip.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      req.session.flash = {
        type: 'error',
        message: 'Data paket Open Trip tidak ditemukan.'
      };
      return res.redirect('/admin/trips');
    }

    res.render('admin/trip-form', {
      title: `Edit Paket — ${trip.title}`,
      pageTitle: 'Edit Paket Open Trip',
      isEdit: true,
      trip
    });
  } catch (error) {
    console.error('Error rendering edit trip:', error);
    return res.redirect('/admin/trips');
  }
};

/**
 * 6. Memperbarui Data Paket Open Trip
 */
exports.updateTrip = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    const {
      title,
      destination,
      price,
      departureDate,
      maxQuota,
      remainingQuota,
      imageUrl,
      description
    } = req.body;

    const parsedMaxQuota = parseInt(maxQuota, 10);
    const parsedRemainingQuota = parseInt(remainingQuota, 10);

    if (parsedRemainingQuota > parsedMaxQuota) {
      req.session.flash = {
        type: 'error',
        message: 'Sisa kuota tidak boleh lebih besar dari kuota maksimal.'
      };
      return res.redirect(`/admin/trips/${tripId}/edit`);
    }

    await prisma.trip.update({
      where: { id: tripId },
      data: {
        title: title.trim(),
        destination: destination.trim(),
        price: parseFloat(price),
        departureDate: new Date(departureDate),
        maxQuota: parsedMaxQuota,
        remainingQuota: parsedRemainingQuota,
        imageUrl: imageUrl && imageUrl.trim() !== ''
          ? imageUrl.trim()
          : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
        description: description.trim()
      }
    });

    req.session.flash = {
      type: 'success',
      message: `Paket Open Trip "${title}" berhasil diperbarui!`
    };
    return res.redirect('/admin/trips');
  } catch (error) {
    console.error('Error updating trip:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal memperbarui data paket Open Trip.'
    };
    return res.redirect('/admin/trips');
  }
};

/**
 * 7. Menghapus Paket Open Trip
 */
exports.deleteTrip = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });

    if (!trip) {
      req.session.flash = {
        type: 'error',
        message: 'Paket Open Trip tidak ditemukan.'
      };
      return res.redirect('/admin/trips');
    }

    await prisma.trip.delete({ where: { id: tripId } });

    req.session.flash = {
      type: 'success',
      message: `Paket Open Trip "${trip.title}" berhasil dihapus.`
    };
    return res.redirect('/admin/trips');
  } catch (error) {
    console.error('Error deleting trip:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal menghapus paket Open Trip.'
    };
    return res.redirect('/admin/trips');
  }
};

/**
 * 8. Menampilkan Halaman Daftar Transaksi Admin (Beserta Tombol Cetak Invoice PDF)
 */
exports.listTransactions = async (req, res) => {
  try {
    const statusFilter = req.query.status || 'ALL';

    const whereClause =
      statusFilter !== 'ALL' && ['PENDING', 'PAID', 'FAILED', 'CANCELLED'].includes(statusFilter)
        ? { status: statusFilter }
        : {};

    const transactions = await prisma.booking.findMany({
      where: whereClause,
      include: {
        user: true,
        trip: true,
        payment: true
      },
      orderBy: { bookingDate: 'desc' }
    });

    res.render('admin/transactions', {
      title: 'Daftar Transaksi Pesanan',
      pageTitle: 'Daftar Transaksi Customer',
      transactions,
      statusFilter
    });
  } catch (error) {
    console.error('Error listing transactions:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal memuat daftar transaksi.'
    };
    return res.redirect('/admin/dashboard');
  }
};

/**
 * 9. Menampilkan Halaman Laporan Penjualan & Keuangan (GET /admin/reports)
 */
exports.renderReports = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const reportData = await getFilteredPaidBookings(start_date, end_date);

    res.render('admin/reports', {
      title: 'Laporan Penjualan & Keuangan',
      pageTitle: 'Laporan Penjualan & Keuangan',
      bookings: reportData.bookings,
      startDate: reportData.startDate,
      endDate: reportData.endDate,
      summary: reportData.summary
    });
  } catch (error) {
    console.error('Error rendering sales reports:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal memuat halaman laporan keuangan.'
    };
    return res.redirect('/admin/dashboard');
  }
};

/**
 * 10. Ekspor Laporan Penjualan ke PDF (GET /admin/reports/export-pdf)
 */
exports.exportReportsPDF = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const reportData = await getFilteredPaidBookings(start_date, end_date);

    return generateSalesReportPDF(reportData, res);
  } catch (error) {
    console.error('Error exporting sales report PDF:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal mengekspor laporan ke format PDF.'
    };
    return res.redirect('/admin/reports');
  }
};

/**
 * 11. Ekspor Laporan Penjualan ke Excel .xlsx (GET /admin/reports/export-excel)
 */
exports.exportReportsExcel = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const reportData = await getFilteredPaidBookings(start_date, end_date);

    return await generateSalesReportExcel(reportData, res);
  } catch (error) {
    console.error('Error exporting sales report Excel:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal mengekspor laporan ke format Excel (.xlsx).'
    };
    return res.redirect('/admin/reports');
  }
};
