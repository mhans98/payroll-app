# Sistem Gaji Mingguan - CV. Kreasi Indah Jaya

Aplikasi pengelolaan gaji karyawan mingguan.

## Fitur
- ✅ Data karyawan & tarif default
- ✅ Input gaji mingguan (kehadiran, lembur, kerajinan)
- ✅ Manajemen pinjaman karyawan
- ✅ Cetak slip gaji (individual & batch 3 per halaman)
- ✅ Daftar bayar (payout checklist)
- ✅ Laporan mingguan
- ✅ Export CSV
- ✅ Audit log

---

## Deploy ke Render.com (GRATIS)

### Langkah 1: Upload ke GitHub

1. Buat akun GitHub: https://github.com (jika belum punya)
2. Buat repository baru:
   - Klik tombol "+" → "New repository"
   - Nama: `payroll-app`
   - Pilih: Public
   - Klik: Create repository
3. Upload semua file dari folder `payroll-app` ke repository tersebut

### Langkah 2: Buat Database di Render

1. Buka https://render.com dan buat akun (bisa pakai GitHub)
2. Klik "New +" → "PostgreSQL"
3. Isi:
   - Name: `payroll-db`
   - Region: Singapore (terdekat)
   - Plan: Free
4. Klik "Create Database"
5. **PENTING:** Setelah database dibuat, copy "External Database URL" (akan dipakai nanti)

### Langkah 3: Deploy Aplikasi di Render

1. Klik "New +" → "Web Service"
2. Connect ke GitHub repository `payroll-app`
3. Isi:
   - Name: `payroll-app`
   - Region: Singapore
   - Branch: main
   - Build Command: `npm run build`
   - Start Command: `npm start`
4. Klik "Advanced" dan tambah Environment Variable:
   - Key: `DATABASE_URL`
   - Value: (paste External Database URL dari langkah 2)
   - Key: `NODE_ENV`
   - Value: `production`
5. Klik "Create Web Service"

### Langkah 4: Tunggu dan Akses

- Tunggu 5-10 menit untuk build selesai
- Setelah "Live", klik URL yang diberikan (contoh: https://payroll-app-xxxx.onrender.com)
- 🎉 Aplikasi Anda sudah online!

---

## Catatan Penting

### Render Free Tier
- Server akan "tidur" setelah 15 menit tidak aktif
- Pertama kali dibuka setelah tidur akan butuh ~30 detik untuk bangun
- Cocok untuk penggunaan mingguan (Sabtu bayar gaji)

### Backup Data
- Data tersimpan aman di PostgreSQL Render
- Untuk backup manual, gunakan fitur "Export CSV" di aplikasi

---

## Menjalankan Lokal (Development)

### Prasyarat
- Node.js 18+
- PostgreSQL (atau gunakan database cloud)

### Setup Lokal

1. Install dependencies:
```bash
cd payroll-app/backend && npm install
cd ../frontend && npm install
```

2. Set environment variable (buat file `.env` di folder backend):
```
DATABASE_URL=postgresql://user:password@localhost:5432/payroll
```

3. Jalankan:
```bash
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend
cd frontend && npm run dev
```

4. Buka http://localhost:3000

---

## Struktur Folder

```
payroll-app/
├── package.json          # Root scripts untuk deployment
├── backend/
│   ├── server.js         # API server
│   ├── package.json
│   └── db/
│       └── schema.sql    # Database structure
└── frontend/
    ├── src/
    │   └── App.jsx       # Main React app
    ├── package.json
    └── vite.config.js
```
