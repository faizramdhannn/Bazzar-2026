import { NextResponse } from 'next/server';
import { getItemBySku, getMasterItems } from '@/lib/sheets';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');

    if (sku) {
      const item = await getItemBySku(sku);
      if (item) {
        return NextResponse.json({ success: true, item });
      }
      return NextResponse.json({ success: false, message: 'Item tidak ditemukan' }, { status: 404 });
    }

    const items = await getMasterItems();
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching master items:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data' },
      { status: 500 }
    );
  }
}
