const ExcelJS = require('exceljs');

/**
 * Helper format tanggal Indonesia untuk sel Excel
 */
const formatDateID = (dateInput) => {
  if (!dateInput) return '-';
  return new Date(dateInput).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

/**
 * Menghasilkan file Excel (.xlsx) Laporan Penjualan & Keuangan Open Trip
 */
exports.generateSalesReportExcel = async (reportData, res) => {
  const { bookings, startDate, endDate, summary } = reportData;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OpenTrip Argon Indonesia';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Laporan Penjualan PAID', {
    views: [{ showGridLines: true }]
  });

  // 1. Judul Utama Laporan di Baris 1 & 2
  worksheet.mergeCells('A1:I1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'LAPORAN PENJUALAN & KEUANGAN — OPENTRIP ARGON INDONESIA';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF5E72E4' }
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 30;

  // Sub-judul Periode Filter Tanggal di Baris 2
  worksheet.mergeCells('A2:I2');
  const periodCell = worksheet.getCell('A2');
  const periodText =
    startDate && endDate
      ? `Periode Filter: ${formatDateID(startDate)} s/d ${formatDateID(endDate)}`
      : startDate
      ? `Periode Mulai: ${formatDateID(startDate)}`
      : endDate
      ? `Periode Sampai: ${formatDateID(endDate)}`
      : 'Periode Filter: Semua Periode (Seluruh Transaksi Lunas / PAID)';

  periodCell.value = `${periodText}  |  Total Transaksi: ${summary.totalTransactions}  |  Total Peserta: ${summary.totalParticipants} Orang`;
  periodCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF172B4D' } };
  periodCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' }
  };
  periodCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 22;

  worksheet.addRow([]);

  // 2. Definisi Lebar Kolom
  worksheet.columns = [
    { key: 'no', width: 6 },
    { key: 'bookingCode', width: 20 },
    { key: 'txDate', width: 20 },
    { key: 'customerName', width: 24 },
    { key: 'customerEmail', width: 26 },
    { key: 'tripTitle', width: 34 },
    { key: 'unitPrice', width: 18 },
    { key: 'participants', width: 14 },
    { key: 'totalAmount', width: 22 }
  ];

  // 3. Header Tabel di Baris 4
  const headerValues = [
    'No',
    'No. Invoice',
    'Tanggal Lunas',
    'Nama Pemesan',
    'Email Customer',
    'Paket Open Trip',
    'Harga / Pax (Rp)',
    'Jml Peserta',
    'Total Bayar (Rp)'
  ];

  const headerRow = worksheet.getRow(4);
  headerRow.values = headerValues;
  headerRow.height = 25;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF172B4D' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  // 4. Isi Baris Data Transaksi
  bookings.forEach((item, index) => {
    const paidDate = item.payment && item.payment.paidAt ? item.payment.paidAt : item.bookingDate;

    const row = worksheet.addRow({
      no: index + 1,
      bookingCode: item.bookingCode,
      txDate: formatDateID(paidDate),
      customerName: item.user.name,
      customerEmail: item.user.email,
      tripTitle: item.trip.title,
      unitPrice: Number(item.trip.price),
      participants: Number(item.participants),
      totalAmount: Number(item.totalAmount)
    });

    row.height = 20;

    row.getCell('unitPrice').numFmt = '"Rp"#,##0';
    row.getCell('totalAmount').numFmt = '"Rp"#,##0';
    row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('participants').alignment = { vertical: 'middle', horizontal: 'center' };

    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10.5 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  // 5. Baris Total Omzet di Bagian Paling Bawah
  const totalRow = worksheet.addRow({
    no: '',
    bookingCode: '',
    txDate: '',
    customerName: '',
    customerEmail: '',
    tripTitle: 'GRAND TOTAL OMZET (PAID)',
    unitPrice: '',
    participants: Number(summary.totalParticipants),
    totalAmount: Number(summary.totalRevenue)
  });

  totalRow.height = 26;
  const totalRowNumber = totalRow.number;
  worksheet.mergeCells(`A${totalRowNumber}:G${totalRowNumber}`);

  const labelTotalCell = worksheet.getCell(`A${totalRowNumber}`);
  labelTotalCell.value = 'GRAND TOTAL PENDAPATAN / OMZET (TRANSAKSI LUNAS)';
  labelTotalCell.alignment = { vertical: 'middle', horizontal: 'right' };

  totalRow.getCell('participants').alignment = { vertical: 'middle', horizontal: 'center' };
  totalRow.getCell('totalAmount').numFmt = '"Rp"#,##0';

  totalRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF065F46' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1FAE5' }
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF10B981' } },
      left: { style: 'thin', color: { argb: 'FFA7F3D0' } },
      bottom: { style: 'double', color: { argb: 'FF10B981' } },
      right: { style: 'thin', color: { argb: 'FFA7F3D0' } }
    };
  });

  const periodSlug =
    startDate && endDate ? `${startDate}_sd_${endDate}` : 'Semua_Periode';
  const fileName = `Laporan-Keuangan-OpenTrip-${periodSlug}.xlsx`;

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  await workbook.xlsx.write(res);
  res.end();
};
