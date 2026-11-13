const PDFDocument = require('pdfkit');

/**
 * Helper format mata uang Rupiah untuk dokumen PDF
 */
const formatIDR = (nominal) => {
  const num = Number(nominal) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

/**
 * Helper format tanggal Indonesia untuk dokumen PDF
 */
const formatDateID = (dateInput, includeTime = false) => {
  if (!dateInput) return '-';
  const options = {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  };
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return new Date(dateInput).toLocaleDateString('id-ID', options);
};

/**
 * 1. Menghasilkan PDF Struk / Invoice Resmi untuk transaksi PAID
 */
exports.generateInvoicePDF = (booking, res) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const fileName = `Invoice-${booking.bookingCode}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  doc.pipe(res);

  // Header Banner Biru Argon
  doc.rect(0, 0, doc.page.width, 115).fill('#5e72e4');

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('OPENTRIP ARGON INDONESIA', 50, 35);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#e2e8f0')
    .text('Layanan Perjalanan Wisata & Open Trip Nusantara Resmi', 50, 62)
    .text('Jl. Jenderal Sudirman Kav. 52, Jakarta Selatan | support@opentrip.com', 50, 77);

  // Badge INVOICE di Kanan Atas
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(18)
    .text('INVOICE RESMI', 350, 38, { align: 'right', width: 195 });

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#a5f3fc')
    .text(`#${booking.bookingCode}`, 350, 63, { align: 'right', width: 195 });

  // Stempel Status LUNAS (PAID)
  doc
    .roundedRect(465, 82, 80, 20, 4)
    .fill('#2dce89');
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('STATUS: PAID', 465, 88, { width: 80, align: 'center' });

  // Informasi Pemesan & Informasi Pembayaran
  const infoTop = 140;

  doc
    .fillColor('#8392ab')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('DITERBITKAN UNTUK (PEMESAN):', 50, infoTop);

  doc
    .fillColor('#172b4d')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(booking.user.name, 50, infoTop + 16);

  doc
    .fillColor('#475569')
    .font('Helvetica')
    .fontSize(10)
    .text(`Email : ${booking.user.email}`, 50, infoTop + 34)
    .text(`No. HP : ${booking.user.phone || '-'}`, 50, infoTop + 50);

  doc
    .fillColor('#8392ab')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('DETAIL PEMBAYARAN:', 320, infoTop);

  doc
    .fillColor('#475569')
    .font('Helvetica')
    .fontSize(10)
    .text(`No. Invoice : ${booking.bookingCode}`, 320, infoTop + 16)
    .text(`No. Referensi VA : ${booking.payment ? booking.payment.referenceCode : '-'}`, 320, infoTop + 32)
    .text(`Metode Bayar : ${booking.payment ? booking.payment.paymentMethod : 'Sandbox'}`, 320, infoTop + 48)
    .text(`Waktu Lunas : ${booking.payment && booking.payment.paidAt ? formatDateID(booking.payment.paidAt, true) : formatDateID(booking.updatedAt, true)}`, 320, infoTop + 64);

  doc
    .moveTo(50, 230)
    .lineTo(545, 230)
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .stroke();

  // Header Tabel Detail Paket Trip
  const tableTop = 250;
  doc.rect(50, tableTop, 495, 28).fill('#f1f5f9');

  doc
    .fillColor('#1e293b')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('PAKET OPEN TRIP & DESTINASI', 62, tableTop + 9)
    .text('TGL BERANGKAT', 260, tableTop + 9)
    .text('HARGA / PAX', 360, tableTop + 9, { width: 80, align: 'right' })
    .text('PESERTA', 445, tableTop + 9, { width: 40, align: 'center' })
    .text('SUBTOTAL', 485, tableTop + 9, { width: 50, align: 'right' });

  const rowTop = tableTop + 40;
  const unitPrice = Number(booking.trip.price);
  const totalAmount = Number(booking.totalAmount);

  doc
    .fillColor('#172b4d')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(booking.trip.title, 62, rowTop, { width: 190 });

  doc
    .fillColor('#64748b')
    .font('Helvetica')
    .fontSize(9)
    .text(booking.trip.destination, 62, rowTop + 16, { width: 190 });

  doc
    .fillColor('#334155')
    .font('Helvetica')
    .fontSize(9)
    .text(formatDateID(booking.trip.departureDate), 260, rowTop)
    .text(formatIDR(unitPrice), 350, rowTop, { width: 90, align: 'right' })
    .text(`${booking.participants} Org`, 445, rowTop, { width: 40, align: 'center' });

  doc
    .fillColor('#172b4d')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(formatIDR(totalAmount), 455, rowTop, { width: 80, align: 'right' });

  doc
    .moveTo(50, rowTop + 45)
    .lineTo(545, rowTop + 45)
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .stroke();

  const summaryTop = rowTop + 60;
  doc
    .fillColor('#64748b')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('CATATAN PEMESANAN:', 50, summaryTop);

  doc
    .fillColor('#334155')
    .font('Helvetica')
    .fontSize(9)
    .text(booking.notes ? booking.notes : 'Tidak ada catatan khusus.', 50, summaryTop + 15, {
      width: 250
    });

  doc
    .roundedRect(330, summaryTop, 215, 70, 6)
    .fill('#f8fafc');

  doc
    .fillColor('#64748b')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('TOTAL PEMBAYARAN LUNAS', 345, summaryTop + 15);

  doc
    .fillColor('#5e72e4')
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(formatIDR(totalAmount), 345, summaryTop + 33);

  const footerBoxTop = summaryTop + 100;
  doc
    .roundedRect(50, footerBoxTop, 495, 65, 6)
    .fillAndStroke('#ecfdf5', '#a7f3d0');

  doc
    .fillColor('#065f46')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('BUKTI PEMBAYARAN SAH (OFFICIAL E-TICKET & RECEIPT)', 65, footerBoxTop + 14);

  doc
    .fillColor('#047857')
    .font('Helvetica')
    .fontSize(9)
    .text(
      'Struk PDF ini adalah bukti pembayaran yang sah. Harap tunjukkan dokumen ini (cetak atau digital di ponsel) kepada tim koordinator lapangan saat registrasi ulang di titik kumpul keberangkatan.',
      65,
      footerBoxTop + 30,
      { width: 465 }
    );

  doc
    .fillColor('#94a3b8')
    .font('Helvetica')
    .fontSize(8)
    .text(
      `Dicetak otomatis oleh Sistem OpenTrip Argon Indonesia pada ${formatDateID(new Date(), true)} WIB`,
      50,
      760,
      { align: 'center', width: 495 }
    );

  doc.end();
};

/**
 * 2. Menghasilkan PDF Laporan Penjualan & Keuangan (Admin)
 */
exports.generateSalesReportPDF = (reportData, res) => {
  const { bookings, startDate, endDate, summary } = reportData;

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 40
  });

  const periodSlug =
    startDate && endDate ? `${startDate}_sd_${endDate}` : 'Semua_Periode';
  const fileName = `Laporan-Keuangan-OpenTrip-${periodSlug}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  doc.pipe(res);

  // Header Banner Laporan
  doc.rect(0, 0, doc.page.width, 95).fill('#172b4d');

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(20)
    .text('LAPORAN PENJUALAN & KEUANGAN OPEN TRIP', 40, 28);

  const periodLabel =
    startDate && endDate
      ? `Periode Filter Tanggal: ${formatDateID(startDate)} s/d ${formatDateID(endDate)}`
      : startDate
      ? `Periode Mulai Tanggal: ${formatDateID(startDate)}`
      : endDate
      ? `Periode Sampai Tanggal: ${formatDateID(endDate)}`
      : 'Periode Filter: Seluruh Transaksi Lunas (Semua Periode)';

  doc
    .fillColor('#a5f3fc')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(periodLabel, 40, 55);

  doc
    .fillColor('#cbd5e1')
    .font('Helvetica')
    .fontSize(9)
    .text(`Dicetak pada: ${formatDateID(new Date(), true)} WIB | Status Transaksi: PAID (Lunas)`, 40, 72);

  // Kotak Ringkasan Statistik di Kanan Atas Header
  doc.roundedRect(560, 20, 240, 55, 6).fill('#5e72e4');
  doc
    .fillColor('#e0e7ff')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('TOTAL PENDAPATAN / OMZET PERIODE INI', 575, 30);
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(15)
    .text(formatIDR(summary.totalRevenue), 575, 44);
  doc
    .fillColor('#a5f3fc')
    .font('Helvetica')
    .fontSize(8)
    .text(`${summary.totalTransactions} Transaksi Lunas  •  ${summary.totalParticipants} Total Peserta`, 575, 62);

  const drawTableHeader = (yPos) => {
    doc.rect(40, yPos, 762, 26).fill('#f1f5f9');
    doc
      .fillColor('#1e293b')
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('NO', 48, yPos + 8, { width: 25 })
      .text('NO. INVOICE', 75, yPos + 8, { width: 95 })
      .text('TGL TRANSAKSI', 175, yPos + 8, { width: 85 })
      .text('NAMA PEMESAN', 265, yPos + 8, { width: 120 })
      .text('PAKET OPEN TRIP', 390, yPos + 8, { width: 175 })
      .text('HARGA / PAX', 570, yPos + 8, { width: 75, align: 'right' })
      .text('PAX', 650, yPos + 8, { width: 40, align: 'center' })
      .text('TOTAL BAYAR', 695, yPos + 8, { width: 98, align: 'right' });
  };

  let currentY = 115;
  drawTableHeader(currentY);
  currentY += 32;

  if (bookings.length === 0) {
    doc
      .fillColor('#64748b')
      .font('Helvetica-Oblique')
      .fontSize(10)
      .text('Tidak ada transaksi berstatus PAID pada rentang tanggal yang dipilih.', 40, currentY + 15, {
        width: 762,
        align: 'center'
      });
    currentY += 50;
  } else {
    bookings.forEach((item, index) => {
      if (currentY > 495) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 40 });
        currentY = 40;
        drawTableHeader(currentY);
        currentY += 32;
      }

      if (index % 2 === 1) {
        doc.rect(40, currentY - 5, 762, 24).fill('#f8fafc');
      }

      const txDate = item.payment && item.payment.paidAt ? item.payment.paidAt : item.bookingDate;

      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(8.5)
        .text(`${index + 1}`, 48, currentY, { width: 25 })
        .font('Helvetica-Bold')
        .text(item.bookingCode, 75, currentY, { width: 95 })
        .font('Helvetica')
        .text(formatDateID(txDate), 175, currentY, { width: 85 })
        .text(item.user.name, 265, currentY, { width: 120, ellipsis: true })
        .text(item.trip.title, 390, currentY, { width: 175, ellipsis: true })
        .text(formatIDR(item.trip.price), 570, currentY, { width: 75, align: 'right' })
        .text(`${item.participants}`, 650, currentY, { width: 40, align: 'center' })
        .font('Helvetica-Bold')
        .fillColor('#172b4d')
        .text(formatIDR(item.totalAmount), 695, currentY, { width: 98, align: 'right' });

      currentY += 24;
    });
  }

  if (currentY > 505) {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 40 });
    currentY = 50;
  }

  doc.rect(40, currentY + 4, 762, 30).fill('#ecfdf5');
  doc
    .moveTo(40, currentY + 4)
    .lineTo(802, currentY + 4)
    .strokeColor('#10b981')
    .lineWidth(1.5)
    .stroke();

  doc
    .fillColor('#065f46')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('GRAND TOTAL OMZET & PESERTA (STATUS PAID)', 52, currentY + 14)
    .text(`${summary.totalParticipants} Org`, 645, currentY + 14, { width: 45, align: 'center' })
    .fontSize(11)
    .text(formatIDR(summary.totalRevenue), 685, currentY + 13, { width: 108, align: 'right' });

  doc.end();
};
