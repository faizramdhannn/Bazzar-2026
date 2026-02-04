import { NextResponse } from 'next/server';
import { generateOrderId, saveOrder } from '@/lib/sheets';

export async function GET() {
  try {
    const orderId = await generateOrderId();
    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error('Error generating order ID:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal generate order ID' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { orderId, customerName, items, subTotal, discount, total, note, status } = body;

    const errors: string[] = [];
    
    if (!orderId) errors.push('Order ID kosong');
    if (!customerName || !customerName.trim()) errors.push('Nama customer kosong');
    if (!items) errors.push('Items tidak ada');
    if (items && items.length === 0) errors.push('Keranjang kosong');

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, message: errors.join(', ') },
        { status: 400 }
      );
    }

    const result = await saveOrder({
      orderId,
      customerName,
      items,
      subTotal,
      discount,
      total,
      note: note || '',
      status: status || 'unpaid',
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Order berhasil disimpan' });
  } catch (error) {
    console.error('Error saving order:', error);
    return NextResponse.json(
      { success: false, message: `Gagal menyimpan order: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}