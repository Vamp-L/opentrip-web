const prisma = require('../config/prisma');
const { generateInvoicePDF } = require('../utils/pdfGenerator');

/**
 * 1. Menampilkan Katalog Paket Open Trip yang Tersedia
 */
exports.renderCatalog = async (req, res) => {
  try {
    const searchQuery = req.query.q ? req.query.q.trim() : '';

    const whereCondition = searchQuery
      ? {
          OR: [
            { title: { contains: searchQuery } },
            { destination: { contains: searchQuery } }
          ]
        }
      : {};

    const trips = await prisma.trip.findMany({
      where: whereCondition,
      orderBy: { departureDate: 'asc' }
    });

    res.render('customer/catalog', {
      title: 'Katalog Paket Open Trip',
      pageTitle: 'Jelajahi Katalog Open Trip',
      trips,
      searchQuery
    });
  } catch (error) {
    console.error('Error rendering catalog:', error);
    res.status(500).send('Terjadi kesalahan saat memuat katalog paket Open Trip.');
  }
};

/**
 * 2. Menampilkan Halaman Form Pemesanan Paket Trip (Input Jumlah Peserta & Catatan)
 */
exports.renderBookingForm = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    const defaultPax = parseInt(req.query.pax, 10) || 1;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      req.session.flash = {
        type: 'error',
        message: 'Paket Open Trip yang Anda pilih tidak ditemukan.'
      };
      return res.redirect('/catalog');
    }

    if (trip.remainingQuota < 1) {
      req.session.flash = {
        type: 'error',
        message: 'Maaf, kuota untuk paket Open Trip ini sudah penuh.'
      };
      return res.redirect('/catalog');
    }

    res.render('customer/booking-form', {
      title: `Pesan Paket — ${trip.title}`,
      pageTitle: 'Formulir Pemesanan Open Trip',
      trip,
      defaultPax: Math.min(Math.max(defaultPax, 1), trip.remainingQuota)
    });
  } catch (error) {
    console.error('Error rendering booking form:', error);
    return res.redirect('/catalog');
  }
};

/**
 * 3. Memproses Pembuatan Booking Baru (Status PENDING) & Mengarahkan ke Sandbox Payment
 */
exports.createBooking = async (req, res) => {
  try {
    const { tripId, participants, notes } = req.body;
    const parsedTripId = parseInt(tripId, 10);
    const parsedParticipants = parseInt(participants, 10);

    if (!parsedTripId || !parsedParticipants || parsedParticipants < 1) {
      req.session.flash = {
        type: 'error',
        message: 'Jumlah peserta minimal adalah 1 orang.'
      };
      return res.redirect('/catalog');
    }

    const trip = await prisma.trip.findUnique({
      where: { id: parsedTripId }
    });

    if (!trip) {
      req.session.flash = {
        type: 'error',
        message: 'Paket Open Trip tidak ditemukan.'
      };
      return res.redirect('/catalog');
    }

    if (trip.remainingQuota < parsedParticipants) {
      req.session.flash = {
        type: 'error',
        message: `Maaf, sisa kuota paket "${trip.title}" hanya tersisa ${trip.remainingQuota} kursi.`
      };
      return res.redirect(`/trips/${trip.id}/book`);
    }

    const totalAmount = Number(trip.price) * parsedParticipants;
    const yearNow = new Date().getFullYear();
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const bookingCode = `INV-${yearNow}${randomDigits}`;
    const referenceCode = `8808${yearNow}${randomDigits}`;

    const createdBooking = await prisma.booking.create({
      data: {
        bookingCode,
        userId: req.session.user.id,
        tripId: trip.id,
        participants: parsedParticipants,
        notes: notes && notes.trim() !== '' ? notes.trim() : null,
        totalAmount,
        status: 'PENDING',
        payment: {
          create: {
            paymentMethod: 'Virtual Account / QRIS Sandbox',
            referenceCode,
            amount: totalAmount,
            status: 'UNPAID'
          }
        }
      }
    });

    req.session.flash = {
      type: 'success',
      message: `Pesanan ${createdBooking.bookingCode} berhasil dibuat dengan status PENDING. Silakan selesaikan pembayaran di bawah ini.`
    };

    return res.redirect(`/bookings/${createdBooking.id}/payment`);
  } catch (error) {
    console.error('Error creating booking:', error);
    req.session.flash = {
      type: 'error',
      message: 'Terjadi kesalahan saat menyimpan pesanan Anda.'
    };
    return res.redirect('/catalog');
  }
};

/**
 * 4. Menampilkan Halaman Riwayat Pesanan Customer
 */
exports.renderMyBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.session.user.id },
      include: {
        trip: true,
        payment: true
      },
      orderBy: { bookingDate: 'desc' }
    });

    res.render('customer/my-bookings', {
      title: 'Riwayat Pesanan Saya',
      pageTitle: 'Riwayat Pesanan & Tiket Saya',
      bookings
    });
  } catch (error) {
    console.error('Error rendering my bookings:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal memuat daftar riwayat pesanan.'
    };
    return res.redirect('/catalog');
  }
};

/**
 * 5. Menampilkan Halaman Simulasi Payment Gateway Sandbox
 */
exports.renderPaymentSandbox = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        trip: true,
        payment: true
      }
    });

    if (!booking || booking.userId !== req.session.user.id) {
      req.session.flash = {
        type: 'error',
        message: 'Data transaksi tidak ditemukan atau Anda tidak memiliki akses.'
      };
      return res.redirect('/my-bookings');
    }

    res.render('customer/payment-sandbox', {
      title: `Simulasi Pembayaran — ${booking.bookingCode}`,
      pageTitle: 'Payment Gateway Sandbox',
      booking
    });
  } catch (error) {
    console.error('Error rendering payment sandbox:', error);
    return res.redirect('/my-bookings');
  }
};

/**
 * 6. Memproses Simulasi Pembayaran Sandbox: PAID atau FAILED
 */
exports.simulatePayment = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const { action, paymentChannel } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: true,
        payment: true
      }
    });

    if (!booking || booking.userId !== req.session.user.id) {
      req.session.flash = {
        type: 'error',
        message: 'Transaksi tidak valid.'
      };
      return res.redirect('/my-bookings');
    }

    if (booking.status !== 'PENDING') {
      req.session.flash = {
        type: 'error',
        message: `Transaksi ${booking.bookingCode} sudah berstatus ${booking.status} dan tidak dapat diubah lagi.`
      };
      return res.redirect('/my-bookings');
    }

    if (action === 'PAID') {
      if (booking.trip.remainingQuota < booking.participants) {
        req.session.flash = {
          type: 'error',
          message: `Gagal melunasi pesanan! Sisa kuota paket "${booking.trip.title}" saat ini hanya ${booking.trip.remainingQuota} kursi.`
        };
        return res.redirect(`/bookings/${booking.id}/payment`);
      }

      const now = new Date();
      const selectedMethod = paymentChannel || 'QRIS / Virtual Account Sandbox';

      await prisma.$transaction([
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'PAID' }
        }),
        prisma.payment.update({
          where: { bookingId: booking.id },
          data: {
            status: 'PAID',
            paymentMethod: selectedMethod,
            paidAt: now
          }
        }),
        prisma.trip.update({
          where: { id: booking.tripId },
          data: {
            remainingQuota: {
              decrement: booking.participants
            }
          }
        })
      ]);

      req.session.flash = {
        type: 'success',
        message: `Pembayaran LUNAS (PAID)! Kuota paket "${booking.trip.title}" otomatis berkurang ${booking.participants} kursi. Silakan unduh Invoice PDF Anda.`
      };
      return res.redirect('/my-bookings');
    } else if (action === 'FAILED') {
      await prisma.$transaction([
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'FAILED' }
        }),
        prisma.payment.update({
          where: { bookingId: booking.id },
          data: { status: 'FAILED' }
        })
      ]);

      req.session.flash = {
        type: 'error',
        message: `Simulasi Pembayaran GAGAL / DIBATALKAN untuk pesanan ${booking.bookingCode}.`
      };
      return res.redirect('/my-bookings');
    }

    return res.redirect(`/bookings/${booking.id}/payment`);
  } catch (error) {
    console.error('Error simulating payment:', error);
    req.session.flash = {
      type: 'error',
      message: 'Terjadi kesalahan saat memproses simulasi pembayaran.'
    };
    return res.redirect('/my-bookings');
  }
};

/**
 * 7. Mengunduh / Mencetak Struk Invoice PDF (GET /transactions/:id/invoice-pdf)
 */
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        trip: true,
        payment: true
      }
    });

    if (!booking) {
      req.session.flash = {
        type: 'error',
        message: 'Data transaksi tidak ditemukan.'
      };
      return res.redirect('/');
    }

    const currentUser = req.session.user;
    if (currentUser.role !== 'ADMIN' && booking.userId !== currentUser.id) {
      req.session.flash = {
        type: 'error',
        message: 'Anda tidak memiliki akses untuk mencetak invoice transaksi ini.'
      };
      return res.redirect('/my-bookings');
    }

    if (booking.status !== 'PAID') {
      req.session.flash = {
        type: 'error',
        message: 'Invoice PDF hanya dapat dicetak untuk transaksi yang sudah LUNAS (PAID).'
      };
      return res.redirect(currentUser.role === 'ADMIN' ? '/admin/transactions' : '/my-bookings');
    }

    return generateInvoicePDF(booking, res);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    req.session.flash = {
      type: 'error',
      message: 'Gagal mencetak dokumen PDF Invoice.'
    };
    return res.redirect('/');
  }
};
