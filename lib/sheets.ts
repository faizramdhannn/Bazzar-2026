import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export async function getGoogleSheetsClient() {
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (keyFilePath) {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: SCOPES,
    });
    return google.sheets({ version: 'v4', auth });
  }

  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('GOOGLE_PRIVATE_KEY atau GOOGLE_APPLICATION_CREDENTIALS harus diset');
  }

  let formattedKey = privateKey;
  
  if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
    formattedKey = formattedKey.slice(1, -1);
  }
  
  formattedKey = formattedKey.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: formattedKey,
    },
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

export const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
export const MASTER_SHEET = 'master_bazzar';
export const ORDER_SHEET = 'order_list';

export interface MasterItem {
  id: string;
  item_sku: string;
  item_name: string;
  item_price: number;
  item_quantity: number;
  rowIndex?: number;
}

export async function getMasterItems(): Promise<MasterItem[]> {
  const sheets = await getGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${MASTER_SHEET}!A2:E`,
  });

  const rows = response.data.values || [];
  
  return rows.map((row, index) => ({
    id: row[0] || '',
    item_sku: row[1] || '',
    item_name: row[2] || '',
    item_price: parseFloat(row[3]) || 0,
    item_quantity: parseInt(row[4]) || 0,
    rowIndex: index + 2,
  }));
}

export async function getItemBySku(sku: string): Promise<MasterItem | null> {
  const items = await getMasterItems();
  return items.find((item) => item.item_sku.toLowerCase() === sku.toLowerCase()) || null;
}

export async function getLastOrderId(): Promise<string> {
  const sheets = await getGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORDER_SHEET}!A:A`,
  });

  const rows = response.data.values || [];
  
  if (rows.length <= 1) {
    return 'BAZ-0000';
  }

  const orderIds = rows.slice(1).map(row => row[0]).filter(Boolean);
  const uniqueIds = Array.from(new Set(orderIds));
  
  if (uniqueIds.length === 0) {
    return 'BAZ-0000';
  }

  const lastId = uniqueIds[uniqueIds.length - 1];
  return lastId;
}

export async function generateOrderId(): Promise<string> {
  const lastId = await getLastOrderId();
  const match = lastId.match(/BAZ-(\d+)/);
  const num = match ? parseInt(match[1]) + 1 : 1;
  return `BAZ-${num.toString().padStart(4, '0')}`;
}

// Validasi stok - return error message jika stok tidak cukup
export async function validateStock(items: Array<{ sku: string; quantity: number }>): Promise<string | null> {
  const masterItems = await getMasterItems();
  
  for (const orderItem of items) {
    const masterItem = masterItems.find(
      (m) => m.item_sku.toLowerCase() === orderItem.sku.toLowerCase()
    );
    
    if (!masterItem) {
      return `SKU ${orderItem.sku} tidak ditemukan`;
    }
    
    if (masterItem.item_quantity < orderItem.quantity) {
      return `Stok ${masterItem.item_name} tidak cukup (sisa: ${masterItem.item_quantity})`;
    }
  }
  
  return null; // null = valid
}

// Fungsi untuk mengurangi stok di master_bazzar
export async function reduceStock(items: Array<{ sku: string; quantity: number }>): Promise<void> {
  const sheets = await getGoogleSheetsClient();
  const masterItems = await getMasterItems();
  
  const updateData: Array<{ range: string; values: number[][] }> = [];
  
  for (const orderItem of items) {
    const masterItem = masterItems.find(
      (m) => m.item_sku.toLowerCase() === orderItem.sku.toLowerCase()
    );
    
    if (masterItem && masterItem.rowIndex) {
      const newQty = Math.max(0, masterItem.item_quantity - orderItem.quantity);
      updateData.push({
        range: `${MASTER_SHEET}!E${masterItem.rowIndex}`,
        values: [[newQty]],
      });
    }
  }
  
  if (updateData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updateData,
      },
    });
  }
}

export async function saveOrder(orderData: {
  orderId: string;
  customerName: string;
  items: Array<{
    sku: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  subTotal: number;
  discount: number;
  total: number;
  note: string;
  status: 'paid' | 'unpaid';
}): Promise<{ success: boolean; error?: string }> {
  
  // Validasi stok dulu
  const stockError = await validateStock(
    orderData.items.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
    }))
  );
  
  if (stockError) {
    return { success: false, error: stockError };
  }
  
  const sheets = await getGoogleSheetsClient();
  const now = new Date().toISOString();
  
  const rows = orderData.items.map((item, index) => {
    const isFirstRow = index === 0;
    return [
      orderData.orderId,
      isFirstRow ? now : '',
      isFirstRow ? orderData.status : '',
      isFirstRow ? orderData.customerName : '',
      item.sku,
      item.name,
      item.price,
      item.quantity,
      item.price * item.quantity,
      isFirstRow ? orderData.discount : '',
      isFirstRow ? orderData.total : '',
      isFirstRow ? orderData.note : '',
      now,
    ];
  });

  // Simpan order
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORDER_SHEET}!A:M`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: rows,
    },
  });

  // Kurangi stok di master_bazzar
  await reduceStock(
    orderData.items.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
    }))
  );

  return { success: true };
}