const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const { ensureAuthenticated } = require('../middlewares/auth');
const midtransService = require('../services/midtrans');

const prisma = new PrismaClient();

function formatRupiah(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

function formatDateID(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTimeID(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// GET /bookings/my - Riwayat Pesanan Customer
router.get('/bookings/my', ensureAuthenticated, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.session.user.id },
      orderBy: { bookingDate: 'desc' },
      include: {
        trip: true,
        transaction: true,
      },
    });

    res.render('customer/my-bookings', {
      title: 'Riwayat Pesanan Saya - NusaTrip',
      bookings,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).render('public/error', {
      title: 'Kesalahan Server - NusaTrip',
      message: 'Gagal memuat riwayat pesanan Anda.',
    });
  }
});

// GET /bookings/checkout/:tripId - Halaman Checkout Booking
router.get('/bookings/checkout/:tripId', ensureAuthenticated, async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId, 10);
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });

    if (!trip) {
      return res.redirect('/?error=' + encodeURIComponent('Paket trip tidak ditemukan.'));
    }

    const participants = Math.max(1, parseInt(req.query.participants, 10) || 1);

    res.render('customer/checkout', {
      title: `Pesan ${trip.title} - NusaTrip`,
      trip,
      participants,
      error: req.query.error || null,
    });
  } catch (error) {
    console.error('Checkout page error:', error);
    res.redirect('/?error=' + encodeURIComponent('Gagal membuka halaman pemesanan.'));
  }
});

// POST /bookings - Buat Booking & Potong availableQuota di PostgreSQL secara Transaksional
router.post('/bookings', ensureAuthenticated, async (req, res) => {
  try {
    const tripId = parseInt(req.body.tripId, 10);
    const participants = parseInt(req.body.participants, 10);
    const paymentMethod = req.body.paymentMethod || 'QRIS NusaPay';

    if (isNaN(tripId) || isNaN(participants) || participants < 1) {
      return res.redirect(`/trips/${tripId}?error=` + encodeURIComponent('Jumlah peserta tidak valid.'));
    }

    const result = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id: tripId } });
      if (!trip) {
        throw new Error('Paket Open Trip tidak ditemukan.');
      }

      if (trip.availableQuota < participants) {
        throw new Error(`Kuota tidak mencukupi. Sisa kuota saat ini hanya ${trip.availableQuota} kursi.`);
      }

      // Potong availableQuota di PostgreSQL
      await tx.trip.update({
        where: { id: trip.id },
        data: {
          availableQuota: {
            decrement: participants,
          },
        },
      });

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomNum = Math.floor(100 + Math.random() * 900);
      const bookingCode = `NUSA-${dateStr}-${randomNum}`;
      const totalAmount = trip.price * participants;

      const booking = await tx.booking.create({
        data: {
          bookingCode,
          userId: req.session.user.id,
          tripId: trip.id,
          participants,
          totalAmount,
          status: 'PENDING',
        },
      });

      const gatewayRef = `NPAY-${Date.now().toString().slice(-8)}`;
      await tx.transaction.create({
        data: {
          bookingId: booking.id,
          paymentMethod,
          paymentStatus: 'UNPAID',
          paymentGatewayRef: gatewayRef,
        },
      });

      return booking;
    });

    res.redirect(`/bookings/${result.id}/payment`);
  } catch (error) {
    console.error('Create booking error:', error);
    const tripId = req.body.tripId;
    if (tripId) {
      return res.redirect(`/trips/${tripId}?error=` + encodeURIComponent(error.message || 'Gagal memproses pesanan.'));
    }
    res.redirect('/?error=' + encodeURIComponent(error.message || 'Gagal memproses pesanan.'));
  }
});

// GET /bookings/:id/payment - Halaman Payment Gateway Sandbox (NusaPay Sandbox)
router.get('/bookings/:id/payment', ensureAuthenticated, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: true,
        user: true,
        transaction: true,
      },
    });

    if (!booking) {
      return res.redirect('/bookings/my?error=' + encodeURIComponent('Data pesanan tidak ditemukan.'));
    }

    if (req.session.user.role !== 'ADMIN' && booking.userId !== req.session.user.id) {
      return res.status(403).render('public/error', {
        title: 'Akses Ditolak - NusaTrip',
        message: 'Anda tidak memiliki akses ke halaman pembayaran pesanan ini.',
      });
    }

    res.render('customer/payment-sandbox', {
      title: `NusaPay Sandbox (${booking.bookingCode}) - NusaTrip`,
      booking,
      midtransClientKey: midtransService.clientKey,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (error) {
    console.error('Payment sandbox load error:', error);
    res.redirect('/bookings/my?error=' + encodeURIComponent('Gagal memuat halaman pembayaran NusaPay Sandbox.'));
  }
});

// POST /bookings/:id/snap-token - Generate Midtrans Snap Token
router.post('/bookings/:id/snap-token', ensureAuthenticated, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: true,
        user: true,
        transaction: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    if (booking.status === 'PAID') {
      return res.status(400).json({ error: 'Pesanan sudah berstatus LUNAS' });
    }

    const payload = {
      transaction_details: {
        order_id: `${booking.bookingCode}-${Date.now().toString().slice(-4)}`,
        gross_amount: booking.totalAmount,
      },
      item_details: [
        {
          id: `TRIP-${booking.trip.id}`,
          price: booking.trip.price,
          quantity: booking.participants,
          name: booking.trip.title.slice(0, 50),
        },
      ],
      customer_details: {
        first_name: booking.user.name,
        email: booking.user.email,
      },
    };

    const snapResponse = await midtransService.createSnapToken(payload);
    res.json({
      token: snapResponse.token,
      redirect_url: snapResponse.redirect_url,
      order_id: payload.transaction_details.order_id,
    });
  } catch (error) {
    console.error('Error generating Midtrans Snap token:', error);
    res.status(500).json({ error: error.message || 'Gagal membuat sesi pembayaran Midtrans' });
  }
});

// POST /bookings/:id/midtrans-callback - Callback saat pembayaran Midtrans selesai dari frontend
router.post('/bookings/:id/midtrans-callback', ensureAuthenticated, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const { order_id, transaction_status, payment_type, transaction_id } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { transaction: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    const isSuccess = ['capture', 'settlement', 'success'].includes(transaction_status);
    const now = new Date();

    if (isSuccess) {
      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'PAID' },
        });

        const paymentMethodName = `Midtrans (${payment_type || 'Snap'})`;
        const ref = transaction_id || order_id || `MID-${Date.now()}`;

        if (booking.transaction) {
          await tx.transaction.update({
            where: { bookingId },
            data: {
              paymentMethod: paymentMethodName,
              paymentStatus: 'PAID',
              paymentGatewayRef: ref,
              paidAt: now,
            },
          });
        } else {
          await tx.transaction.create({
            data: {
              bookingId,
              paymentMethod: paymentMethodName,
              paymentStatus: 'PAID',
              paymentGatewayRef: ref,
              paidAt: now,
            },
          });
        }
      });

      return res.json({ success: true, message: 'Pembayaran Midtrans berhasil diverifikasi.' });
    } else if (transaction_status === 'pending') {
      return res.json({ success: true, message: 'Menunggu pembayaran selesai.' });
    } else {
      return res.json({ success: false, message: 'Status transaksi: ' + transaction_status });
    }
  } catch (error) {
    console.error('Error handling Midtrans callback:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /bookings/:id/pay - Simulasi Bayar Lunas (Ubah Transaction & Booking jadi PAID + paidAt)
router.post('/bookings/:id/pay', ensureAuthenticated, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const selectedMethod = req.body.paymentMethod;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { transaction: true },
    });

    if (!booking) {
      return res.redirect('/bookings/my?error=' + encodeURIComponent('Pesanan tidak ditemukan.'));
    }

    if (req.session.user.role !== 'ADMIN' && booking.userId !== req.session.user.id) {
      return res.status(403).render('public/error', {
        title: 'Akses Ditolak - NusaTrip',
        message: 'Anda tidak diizinkan mengubah status pembayaran ini.',
      });
    }

    const now = new Date();
    const gatewayRef =
      booking.transaction && booking.transaction.paymentGatewayRef
        ? booking.transaction.paymentGatewayRef
        : `NPAY-PAID-${Date.now().toString().slice(-8)}`;

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'PAID' },
      });

      if (booking.transaction) {
        await tx.transaction.update({
          where: { bookingId: bookingId },
          data: {
            paymentMethod: selectedMethod || booking.transaction.paymentMethod,
            paymentStatus: 'PAID',
            paymentGatewayRef: gatewayRef,
            paidAt: now,
          },
        });
      } else {
        await tx.transaction.create({
          data: {
            bookingId: bookingId,
            paymentMethod: selectedMethod || 'QRIS NusaPay',
            paymentStatus: 'PAID',
            paymentGatewayRef: gatewayRef,
            paidAt: now,
          },
        });
      }
    });

    res.redirect(
      `/bookings/${bookingId}/payment?success=` +
        encodeURIComponent('Pembayaran berhasil diverifikasi! Status pesanan Anda kini LUNAS (PAID).')
    );
  } catch (error) {
    console.error('Simulate payment error:', error);
    res.redirect(
      `/bookings/${req.params.id}/payment?error=` + encodeURIComponent('Gagal memproses simulasi pelunasan.')
    );
  }
});

// GET /bookings/:id/invoice - Cetak Invoice/Struk PDF Resmi Ukuran A4 menggunakan PDFKit
router.get('/bookings/:id/invoice', ensureAuthenticated, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        trip: true,
        transaction: true,
      },
    });

    if (!booking) {
      return res.status(404).send('Data pesanan tidak ditemukan.');
    }

    if (req.session.user.role !== 'ADMIN' && booking.userId !== req.session.user.id) {
      return res.status(403).send('Akses ditolak.');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = `Invoice-${booking.bookingCode}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Header / Kop Resmi NusaTrip
    doc.rect(0, 0, doc.page.width, 115).fill('#0F172A');
    doc.fillColor('#059669').roundedRect(50, 32, 42, 42, 8).fill();
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('N', 63, 43);

    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('NusaTrip', 105, 34);
    doc
      .fillColor('#CBD5E1')
      .fontSize(10)
      .font('Helvetica')
      .text('PT NusaTrip Eksplorasi Nusantara • Layanan Resmi Open Trip Indonesia', 105, 60);
    doc
      .fillColor('#94A3B8')
      .fontSize(9)
      .text('Jl. Sudirman Kav. 45, Jakarta Pusat • support@nusatrip.com • +62 811-9000-8899', 105, 76);

    // Judul Dokumen di Kanan Atas
    doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text('INVOICE / BUKTI PEMBAYARAN', 330, 38, {
      align: 'right',
      width: 215,
    });
    doc
      .fillColor('#10B981')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`#${booking.bookingCode}`, 330, 58, { align: 'right', width: 215 });

    // Kotak Informasi Pemesan & Transaksi
    let y = 145;
    doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('INFORMASI PEMESAN', 50, y);
    doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('DETAIL TRANSAKSI', 320, y);

    y += 20;
    doc.fontSize(10).font('Helvetica').fillColor('#475569');
    doc.text('Nama Pemesan', 50, y);
    doc.fillColor('#0F172A').font('Helvetica-Bold').text(`:  ${booking.user.name}`, 140, y);

    doc.fillColor('#475569').font('Helvetica').text('Kode Booking', 320, y);
    doc.fillColor('#0F172A').font('Helvetica-Bold').text(`:  ${booking.bookingCode}`, 420, y);

    y += 18;
    doc.fillColor('#475569').font('Helvetica').text('Email Pelanggan', 50, y);
    doc.fillColor('#0F172A').font('Helvetica').text(`:  ${booking.user.email}`, 140, y);

    doc.fillColor('#475569').font('Helvetica').text('Tanggal Pesan', 320, y);
    doc.fillColor('#0F172A').font('Helvetica').text(`:  ${formatDateTimeID(booking.bookingDate)}`, 420, y);

    y += 18;
    doc.fillColor('#475569').font('Helvetica').text('Metode Bayar', 50, y);
    doc
      .fillColor('#0F172A')
      .font('Helvetica')
      .text(`:  ${booking.transaction ? booking.transaction.paymentMethod : 'NusaPay Sandbox'}`, 140, y);

    doc.fillColor('#475569').font('Helvetica').text('Waktu Lunas', 320, y);
    doc
      .fillColor('#0F172A')
      .font('Helvetica')
      .text(
        `:  ${
          booking.transaction && booking.transaction.paidAt
            ? formatDateTimeID(booking.transaction.paidAt)
            : 'Menunggu Pembayaran'
        }`,
        420,
        y
      );

    y += 18;
    doc.fillColor('#475569').font('Helvetica').text('Referensi Gateway', 50, y);
    doc
      .fillColor('#0F172A')
      .font('Helvetica')
      .text(`:  ${booking.transaction && booking.transaction.paymentGatewayRef ? booking.transaction.paymentGatewayRef : '-'}`, 140, y);

    // Garis Pemisah
    y += 30;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E2E8F0').lineWidth(1).stroke();

    // Tabel Detail Paket Open Trip
    y += 22;
    doc.rect(50, y, 495, 28).fill('#F1F5F9');
    doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold');
    doc.text('DESKRIPSI PAKET OPEN TRIP', 62, y + 9);
    doc.text('HARGA / PAX', 300, y + 9, { width: 80, align: 'right' });
    doc.text('PESERTA', 385, y + 9, { width: 55, align: 'right' });
    doc.text('SUBTOTAL', 445, y + 9, { width: 88, align: 'right' });

    y += 38;
    doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text(booking.trip.title, 62, y, { width: 230 });
    const titleHeight = doc.heightOfString(booking.trip.title, { width: 230 });

    doc
      .fillColor('#475569')
      .fontSize(9)
      .font('Helvetica')
      .text(`Destinasi: ${booking.trip.destination}`, 62, y + titleHeight + 4, { width: 230 })
      .text(
        `Keberangkatan: ${formatDateID(booking.trip.startDate)} s/d ${formatDateID(booking.trip.endDate)}`,
        62,
        y + titleHeight + 18,
        { width: 230 }
      );

    doc.fillColor('#0F172A').fontSize(10).font('Helvetica');
    doc.text(formatRupiah(booking.trip.price), 300, y, { width: 80, align: 'right' });
    doc.text(`${booking.participants} Orang`, 385, y, { width: 55, align: 'right' });
    doc.font('Helvetica-Bold').text(formatRupiah(booking.totalAmount), 445, y, { width: 88, align: 'right' });

    y += Math.max(titleHeight + 42, 55);
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E2E8F0').lineWidth(1).stroke();

    // Ringkasan Total Bayar
    y += 18;
    doc.roundedRect(310, y, 235, 68, 8).fill('#F8FAFC');
    doc.fillColor('#475569').fontSize(10).font('Helvetica').text('Total Pembayaran', 325, y + 16);
    doc
      .fillColor('#059669')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(formatRupiah(booking.totalAmount), 325, y + 34, { width: 205, align: 'right' });

    // Cap Resmi LUNAS / PENDING
    const isPaid = booking.status === 'PAID';
    const stampColor = isPaid ? '#059669' : '#D97706';
    const stampText = isPaid ? 'LUNAS / PAID' : 'BELUM LUNAS';

    doc.save();
    doc.roundedRect(50, y + 4, 175, 58, 8).lineWidth(2.5).strokeColor(stampColor).stroke();
    doc
      .fillColor(stampColor)
      .fontSize(17)
      .font('Helvetica-Bold')
      .text(stampText, 50, y + 16, { width: 175, align: 'center' });
    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('TERVERIFIKASI NUSAPAY', 50, y + 39, { width: 175, align: 'center' });
    doc.restore();

    // Catatan Kaki Resmi
    y += 105;
    doc
      .fillColor('#0F172A')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Ketentuan & Informasi Keberangkatan:', 50, y);
    doc
      .fillColor('#475569')
      .fontSize(9)
      .font('Helvetica')
      .text(
        '1. Simpan dan tunjukkan Invoice resmi ini kepada Tour Leader NusaTrip saat registrasi ulang di titik kumpul (Meeting Point).\n' +
          '2. Peserta diharapkan hadir selambat-lambatnya 30 menit sebelum jadwal keberangkatan.\n' +
          '3. Bukti pembayaran ini sah dan diterbitkan secara otomatis oleh sistem keuangan PT NusaTrip Eksplorasi Nusantara.',
        50,
        y + 16,
        { width: 495, lineGap: 4 }
      );

    doc
      .fillColor('#94A3B8')
      .fontSize(8)
      .text(
        `Dicetak otomatis oleh sistem NusaTrip pada ${formatDateTimeID(new Date())} WIB`,
        50,
        doc.page.height - 65,
        { align: 'center', width: 495 }
      );

    doc.end();
  } catch (error) {
    console.error('Generate invoice PDF error:', error);
    res.status(500).send('Gagal menghasilkan dokumen PDF Invoice.');
  }
});

module.exports = router;
