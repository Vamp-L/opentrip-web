const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { ensureAdmin } = require('../middlewares/auth');

const prisma = new PrismaClient();

function buildDateFilter(startDateStr, endDateStr) {
  const where = {
    status: 'PAID',
  };

  if (startDateStr || endDateStr) {
    where.bookingDate = {};
    if (startDateStr) {
      const start = new Date(`${startDateStr}T00:00:00.000Z`);
      if (!isNaN(start.getTime())) {
        where.bookingDate.gte = start;
      }
    }
    if (endDateStr) {
      const end = new Date(`${endDateStr}T23:59:59.999Z`);
      if (!isNaN(end.getTime())) {
        where.bookingDate.lte = end;
      }
    }
  }

  return where;
}

function formatRupiah(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

function formatShortDate(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// GET /admin/reports - Halaman Laporan Penjualan & Keuangan Admin
router.get('/reports', ensureAdmin, async (req, res) => {
  try {
    const start_date = req.query.start_date ? req.query.start_date.trim() : '';
    const end_date = req.query.end_date ? req.query.end_date.trim() : '';

    const whereClause = buildDateFilter(start_date, end_date);

    const paidBookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: { bookingDate: 'desc' },
      include: {
        user: true,
        trip: true,
        transaction: true,
      },
    });

    const totalRevenue = paidBookings.reduce((acc, item) => acc + item.totalAmount, 0);
    const totalParticipants = paidBookings.reduce((acc, item) => acc + item.participants, 0);
    const totalPaidTransactions = paidBookings.length;

    res.render('admin/reports', {
      title: 'Laporan Penjualan & Keuangan - NusaTrip Admin',
      activePage: 'reports',
      paidBookings,
      start_date,
      end_date,
      metrics: {
        totalRevenue,
        totalParticipants,
        totalPaidTransactions,
      },
    });
  } catch (error) {
    console.error('Error loading financial reports:', error);
    res.status(500).render('public/error', {
      title: 'Kesalahan Server - NusaTrip',
      message: 'Gagal memuat laporan penjualan dan keuangan.',
    });
  }
});

// GET /admin/reports/export-pdf - Ekspor Laporan Keuangan ke PDF menggunakan PDFKit
router.get('/reports/export-pdf', ensureAdmin, async (req, res) => {
  try {
    const start_date = req.query.start_date ? req.query.start_date.trim() : '';
    const end_date = req.query.end_date ? req.query.end_date.trim() : '';

    const whereClause = buildDateFilter(start_date, end_date);
    const paidBookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: { bookingDate: 'desc' },
      include: {
        user: true,
        trip: true,
        transaction: true,
      },
    });

    const totalRevenue = paidBookings.reduce((acc, item) => acc + item.totalAmount, 0);
    const totalParticipants = paidBookings.reduce((acc, item) => acc + item.participants, 0);
    const totalPaidTransactions = paidBookings.length;

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const filename = `Laporan-Keuangan-NusaTrip-${start_date || 'Semua'}-${end_date || 'Semua'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Header Laporan
    doc.rect(0, 0, doc.page.width, 95).fill('#0F172A');
    doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold').text('LAPORAN PENJUALAN & KEUANGAN NUSATRIP', 40, 28);
    doc
      .fillColor('#CBD5E1')
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Periode Filter: ${start_date ? start_date : 'Awal Transaksi'} s/d ${end_date ? end_date : 'Sekarang'}`,
        40,
        54
      );
    doc
      .fillColor('#10B981')
      .fontSize(9)
      .text(`Dicetak pada: ${formatShortDate(new Date())}`, 40, 70);

    // Ringkasan 3 Kartu Metrik
    let y = 115;
    doc.roundedRect(40, y, 165, 58, 6).fill('#F8FAFC');
    doc.roundedRect(215, y, 165, 58, 6).fill('#F8FAFC');
    doc.roundedRect(390, y, 165, 58, 6).fill('#F8FAFC');

    doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('TOTAL OMZET (PAID)', 52, y + 12);
    doc.fillColor('#059669').fontSize(13).font('Helvetica-Bold').text(formatRupiah(totalRevenue), 52, y + 30);

    doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('TOTAL PESERTA', 227, y + 12);
    doc.fillColor('#0F172A').fontSize(13).font('Helvetica-Bold').text(`${totalParticipants} Orang`, 227, y + 30);

    doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('TRANSAKSI LUNAS', 402, y + 12);
    doc.fillColor('#0F172A').fontSize(13).font('Helvetica-Bold').text(`${totalPaidTransactions} Transaksi`, 402, y + 30);

    // Header Tabel
    y += 78;
    doc.rect(40, y, 515, 24).fill('#0F172A');
    doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
    doc.text('TANGGAL', 48, y + 8, { width: 65 });
    doc.text('KODE BOOKING', 115, y + 8, { width: 85 });
    doc.text('PEMESAN', 202, y + 8, { width: 85 });
    doc.text('PAKET OPEN TRIP', 290, y + 8, { width: 115 });
    doc.text('PAX', 408, y + 8, { width: 32, align: 'right' });
    doc.text('TOTAL BAYAR', 445, y + 8, { width: 102, align: 'right' });

    y += 28;
    doc.font('Helvetica').fontSize(8.5);

    if (paidBookings.length === 0) {
      doc.fillColor('#64748B').text('Tidak ada transaksi berstatus PAID pada rentang tanggal ini.', 48, y + 10);
      y += 30;
    } else {
      paidBookings.forEach((b, idx) => {
        if (y > doc.page.height - 90) {
          doc.addPage();
          y = 50;
        }
        if (idx % 2 === 1) {
          doc.rect(40, y - 4, 515, 22).fill('#F8FAFC');
        }
        doc.fillColor('#0F172A').font('Helvetica');
        doc.text(formatShortDate(b.bookingDate), 48, y + 2, { width: 65 });
        doc.font('Helvetica-Bold').text(b.bookingCode, 115, y + 2, { width: 85 });
        doc.font('Helvetica').text(b.user.name.slice(0, 18), 202, y + 2, { width: 85 });
        doc.text(b.trip.title.slice(0, 26), 290, y + 2, { width: 115 });
        doc.text(`${b.participants}`, 408, y + 2, { width: 32, align: 'right' });
        doc.font('Helvetica-Bold').text(formatRupiah(b.totalAmount), 445, y + 2, { width: 102, align: 'right' });
        y += 22;
      });
    }

    // Baris Total Keseluruhan Omzet
    y += 6;
    doc.rect(40, y, 515, 28).fill('#ECFDF5');
    doc.fillColor('#0F172A').fontSize(9.5).font('Helvetica-Bold');
    doc.text('TOTAL KESELURUHAN OMZET', 48, y + 9);
    doc.text(`${totalParticipants} Pax`, 390, y + 9, { width: 50, align: 'right' });
    doc.fillColor('#059669').text(formatRupiah(totalRevenue), 445, y + 9, { width: 102, align: 'right' });

    doc.end();
  } catch (error) {
    console.error('Export PDF report error:', error);
    res.status(500).send('Gagal mengekspor laporan PDF.');
  }
});

// GET /admin/reports/export-excel - Ekspor Laporan Keuangan ke File Excel (.xlsx) menggunakan ExcelJS
router.get('/reports/export-excel', ensureAdmin, async (req, res) => {
  try {
    const start_date = req.query.start_date ? req.query.start_date.trim() : '';
    const end_date = req.query.end_date ? req.query.end_date.trim() : '';

    const whereClause = buildDateFilter(start_date, end_date);
    const paidBookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: { bookingDate: 'desc' },
      include: {
        user: true,
        trip: true,
        transaction: true,
      },
    });

    const totalRevenue = paidBookings.reduce((acc, item) => acc + item.totalAmount, 0);
    const totalParticipants = paidBookings.reduce((acc, item) => acc + item.participants, 0);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NusaTrip Admin System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Laporan Keuangan');

    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'LAPORAN PENJUALAN DAN KEUANGAN NUSATRIP (STATUS: PAID)';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 28;

    sheet.mergeCells('A2:G2');
    const periodCell = sheet.getCell('A2');
    periodCell.value = `Periode Filter: ${start_date || 'Semua'} s/d ${end_date || 'Semua'} | Total Transaksi Lunas: ${paidBookings.length}`;
    periodCell.font = { name: 'Calibri', size: 10, italic: true };
    periodCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 20;

    sheet.addRow([]);

    const headerRow = sheet.addRow([
      'Tanggal Transaksi',
      'Kode Booking',
      'Nama Pemesan',
      'Nama Paket Trip',
      'Metode Pembayaran',
      'Jumlah Peserta',
      'Total Nominal (Rp)',
    ]);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    paidBookings.forEach((b) => {
      const row = sheet.addRow([
        formatShortDate(b.bookingDate),
        b.bookingCode,
        b.user.name,
        b.trip.title,
        b.transaction ? b.transaction.paymentMethod : 'NusaPay',
        b.participants,
        b.totalAmount,
      ]);
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(7).numFmt = '#,##0';
      row.getCell(7).alignment = { horizontal: 'right' };
    });

    const totalRow = sheet.addRow([
      'TOTAL KESELURUHAN OMZET',
      '',
      '',
      '',
      '',
      totalParticipants,
      totalRevenue,
    ]);
    sheet.mergeCells(`A${totalRow.number}:E${totalRow.number}`);
    totalRow.font = { bold: true, size: 11 };
    totalRow.height = 24;
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
    });
    totalRow.getCell(6).alignment = { horizontal: 'right' };
    totalRow.getCell(7).numFmt = '#,##0';
    totalRow.getCell(7).alignment = { horizontal: 'right' };

    sheet.columns = [
      { width: 18 },
      { width: 22 },
      { width: 24 },
      { width: 38 },
      { width: 22 },
      { width: 16 },
      { width: 22 },
    ];

    const filename = `Laporan-Keuangan-NusaTrip-${start_date || 'Semua'}-${end_date || 'Semua'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export Excel report error:', error);
    res.status(500).send('Gagal mengekspor laporan Excel.');
  }
});

module.exports = router;
