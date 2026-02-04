# Simple Kasir

Sistem kasir sederhana dengan Next.js dan Google Sheets integration.

## Fitur

- ✅ Input nama customer
- ✅ Scan/input SKU produk
- ✅ Auto increment qty jika SKU sama
- ✅ Diskon dalam Rupiah
- ✅ Catatan order (opsional)
- ✅ Dark mode / Light mode
- ✅ Mobile responsive (optimized untuk iPhone 13)
- ✅ Integrasi Google Sheets

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Google Cloud Console

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Buat project baru atau pilih project yang sudah ada
3. Enable **Google Sheets API**
4. Buat **Service Account**:
   - Go to IAM & Admin > Service Accounts
   - Create Service Account
   - Download JSON key file
5. Copy `client_email` dan `private_key` dari JSON file

### 3. Setup Google Spreadsheet

1. Buka spreadsheet: `https://docs.google.com/spreadsheets/d/11387AVF2PjdkXhR5xFf3wGgvzL6HZENfeuakfRPABH8/edit`
2. Share spreadsheet ke email service account (dengan role Editor)
3. Pastikan ada 2 sheet:

**Sheet: master_bazzar**
| id | item_sku | item_name | item_price | item_quantity |
|----|----------|-----------|------------|---------------|
| 1  | SKU001   | Produk A  | 50000      | 100           |

**Sheet: order_list**
| order_id | created_at | order_status | customer_name | item_sku | item_name | item_price | item_quantity | sub_total | discount | total | note | update_at |
|----------|------------|--------------|---------------|----------|-----------|------------|---------------|-----------|----------|-------|------|-----------|

### 4. Setup Environment Variables

Copy `.env.example` ke `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=11387AVF2PjdkXhR5xFf3wGgvzL6HZENfeuakfRPABH8
```

⚠️ **Penting**: Pastikan `GOOGLE_PRIVATE_KEY` dalam format dengan `\n` untuk newlines.

### 5. Run Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

## Cara Penggunaan

1. **Masukkan nama customer** → Tekan Enter
2. **Scan/ketik SKU** → Tekan Enter
   - Jika SKU ditemukan, item masuk ke keranjang
   - Jika SKU sudah ada di keranjang, qty +1
3. **Tambah diskon** (opsional) → Klik tombol "Diskon"
4. **Tambah catatan** (opsional) → Klik tombol "Tambah Catatan"
5. **Simpan order** → Pilih "Simpan Unpaid" atau "Simpan Paid"

## Format Data di Google Sheets

Order disimpan seperti format Shopify:
- Setiap item adalah baris terpisah
- `order_id` sama untuk semua item dalam 1 order
- `created_at`, `order_status`, `customer_name`, `discount`, `total`, `note` hanya di baris pertama
- `update_at` di semua baris

Contoh:
| order_id | created_at | order_status | customer_name | item_sku | item_name | item_price | item_quantity | sub_total | discount | total | note | update_at |
|----------|------------|--------------|---------------|----------|-----------|------------|---------------|-----------|----------|-------|------|-----------|
| ORD-0001 | 2024-01-15 | paid | John | SKU001 | Produk A | 50000 | 2 | 100000 | 10000 | 140000 | Test | 2024-01-15 |
| ORD-0001 | | | | SKU002 | Produk B | 25000 | 2 | 50000 | | | | 2024-01-15 |

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Google Sheets API

## License

MIT
