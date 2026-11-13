const { PrismaClient } = require('@prisma/client');
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = require('bcryptjs');
}

const prisma = new PrismaClient();

async function main() {
  console.log('Memulai proses seeding database NusaTrip...');

  // Bersihkan data lama dengan urutan relasi yang aman
  await prisma.transaction.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();

  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Administrator NusaTrip',
      email: 'admin@nusatrip.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: 'Budi Santoso',
      email: 'user@nusatrip.com',
      password: userPassword,
      role: 'CUSTOMER',
    },
  });

  const tripsData = [
    {
      title: 'Taman Nasional Bromo Sunrise Expedition',
      destination: 'Taman Nasional Bromo, Jawa Timur',
      description:
        'Nikmati pesona matahari terbit terbaik di Penanjakan 1, jelajahi lautan pasir berbisik dengan Jeep 4x4 Hardtop, mendaki kawah Gunung Bromo yang ikonik, serta bersantai di Bukit Teletubbies bersama pemandu lokal berpengalaman dan dokumentasi profesional.',
      imageUrl:
        'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1200&q=80',
      price: 1500000,
      startDate: new Date('2026-11-15T00:00:00.000Z'),
      endDate: new Date('2026-11-17T23:59:59.000Z'),
      quota: 20,
      availableQuota: 14,
    },
    {
      title: 'Sailing Komodo Labuan Bajo Liveaboard Phinisi',
      destination: 'Labuan Bajo, Nusa Tenggara Timur',
      description:
        'Berlayar selama 3 hari 2 malam menggunakan kapal Phinisi kayu autentik melintasi kepulauan Taman Nasional Komodo. Trekking ke puncak Pulau Padar, bertemu langsung dengan satwa purba Komodo, bersantai di Pink Beach, dan snorkeling bersama Manta Ray di Manta Point.',
      imageUrl:
        'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80',
      price: 4250000,
      startDate: new Date('2026-11-22T00:00:00.000Z'),
      endDate: new Date('2026-11-25T23:59:59.000Z'),
      quota: 16,
      availableQuota: 10,
    },
    {
      title: 'Raja Ampat Wayag & Piaynemo Island Hopping',
      destination: 'Raja Ampat, Papua Barat Daya',
      description:
        'Eksplorasi surga bawah laut dunia di jantung segitiga terumbu karang Raja Ampat. Mengunjungi gugusan pulau karst ikonik Wayag dan Piaynemo, menyelami jernihnya perairan Arborek dan Yenbuba, serta merasakan kehangatan budaya masyarakat lokal Papua.',
      imageUrl:
        'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=80',
      price: 7800000,
      startDate: new Date('2026-12-05T00:00:00.000Z'),
      endDate: new Date('2026-12-09T23:59:59.000Z'),
      quota: 12,
      availableQuota: 8,
    },
  ];

  const createdTrips = [];
  for (const trip of tripsData) {
    const created = await prisma.trip.create({ data: trip });
    createdTrips.push(created);
  }

  // Buat sampel transaksi PAID agar dashboard & laporan keuangan langsung kaya data
  const sampleBookings = [
    {
      bookingCode: 'NUSA-20261101-881',
      userId: customer.id,
      tripId: createdTrips[0].id,
      participants: 2,
      totalAmount: createdTrips[0].price * 2,
      status: 'PAID',
      bookingDate: new Date('2026-11-01T09:15:00.000Z'),
      paymentMethod: 'QRIS NusaPay',
      paymentGatewayRef: 'NPAY-QRIS-99281721',
      paidAt: new Date('2026-11-01T09:18:30.000Z'),
    },
    {
      bookingCode: 'NUSA-20261101-904',
      userId: customer.id,
      tripId: createdTrips[1].id,
      participants: 2,
      totalAmount: createdTrips[1].price * 2,
      status: 'PAID',
      bookingDate: new Date('2026-11-01T14:20:00.000Z'),
      paymentMethod: 'Virtual Account BCA',
      paymentGatewayRef: 'NPAY-VA-77482910',
      paidAt: new Date('2026-11-01T14:25:10.000Z'),
    },
    {
      bookingCode: 'NUSA-20261102-112',
      userId: customer.id,
      tripId: createdTrips[2].id,
      participants: 1,
      totalAmount: createdTrips[2].price * 1,
      status: 'PENDING',
      bookingDate: new Date('2026-11-02T10:00:00.000Z'),
      paymentMethod: 'E-Wallet GoPay',
      paymentGatewayRef: 'NPAY-EW-55102938',
      paidAt: null,
    },
  ];

  for (const b of sampleBookings) {
    const booking = await prisma.booking.create({
      data: {
        bookingCode: b.bookingCode,
        userId: b.userId,
        tripId: b.tripId,
        participants: b.participants,
        totalAmount: b.totalAmount,
        status: b.status,
        bookingDate: b.bookingDate,
      },
    });

    await prisma.transaction.create({
      data: {
        bookingId: booking.id,
        paymentMethod: b.paymentMethod,
        paymentStatus: b.status === 'PAID' ? 'PAID' : 'UNPAID',
        paymentGatewayRef: b.paymentGatewayRef,
        paidAt: b.paidAt,
      },
    });
  }

  console.log('Seeding berhasil diselesaikan!');
  console.log('Admin    : admin@nusatrip.com / admin123');
  console.log('Customer : user@nusatrip.com / user123');
}

main()
  .catch((e) => {
    console.error('Gagal melakukan seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
