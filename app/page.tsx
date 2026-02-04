'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface MasterItem {
  id: string;
  item_sku: string;
  item_name: string;
  item_price: number;
  item_quantity: number;
}

interface CartItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
  stock: number; // track available stock
}

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [skuInput, setSkuInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [note, setNote] = useState('');
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [scanningEnabled, setScanningEnabled] = useState(false);
  
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [masterLoaded, setMasterLoaded] = useState(false);
  const [masterLoading, setMasterLoading] = useState(true);
  
  const skuInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMasterData();
    fetchNewOrderId();
  }, []);

  const fetchMasterData = async () => {
    try {
      setMasterLoading(true);
      const res = await fetch('/api/master');
      const data = await res.json();
      if (data.success) {
        setMasterItems(data.items);
        setMasterLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching master data:', error);
      showMessage('Gagal load data produk', 'error');
    } finally {
      setMasterLoading(false);
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (customerName && scanningEnabled) {
      skuInputRef.current?.focus();
    }
  }, [customerName, scanningEnabled]);

  const fetchNewOrderId = async () => {
    try {
      const res = await fetch('/api/order');
      const data = await res.json();
      if (data.success) {
        setOrderId(data.orderId);
      }
    } catch (error) {
      console.error('Error fetching order ID:', error);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 2000);
  };

  const findItemBySku = useCallback((sku: string): MasterItem | null => {
    return masterItems.find(
      (item) => item.item_sku.toLowerCase() === sku.toLowerCase()
    ) || null;
  }, [masterItems]);

  // Hitung sisa stok yang tersedia (stok master - qty di cart)
  const getAvailableStock = useCallback((sku: string): number => {
    const masterItem = findItemBySku(sku);
    if (!masterItem) return 0;
    
    const cartItem = cart.find(
      (item) => item.sku.toLowerCase() === sku.toLowerCase()
    );
    const qtyInCart = cartItem ? cartItem.quantity : 0;
    
    return masterItem.item_quantity - qtyInCart;
  }, [masterItems, cart, findItemBySku]);

  const handleSkuScan = useCallback((sku: string) => {
    if (!sku.trim()) return;
    
    const existingIndex = cart.findIndex(
      (item) => item.sku.toLowerCase() === sku.toLowerCase()
    );

    if (existingIndex !== -1) {
      // Cek stok sebelum tambah qty
      const availableStock = getAvailableStock(sku);
      
      if (availableStock <= 0) {
        showMessage(`Stok ${cart[existingIndex].name} habis!`, 'error');
        setSkuInput('');
        skuInputRef.current?.focus();
        return;
      }
      
      // Increase quantity
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
      setSkuInput('');
      skuInputRef.current?.focus();
      return;
    }

    // Item baru
    const item = findItemBySku(sku);

    if (item) {
      // Cek stok
      if (item.item_quantity <= 0) {
        showMessage(`Stok ${item.item_name} habis!`, 'error');
        setSkuInput('');
        skuInputRef.current?.focus();
        return;
      }
      
      setCart([
        ...cart,
        {
          sku: item.item_sku,
          name: item.item_name,
          price: item.item_price,
          quantity: 1,
          stock: item.item_quantity,
        },
      ]);
      setSkuInput('');
    } else {
      showMessage('SKU tidak ditemukan!', 'error');
    }
    
    skuInputRef.current?.focus();
  }, [cart, findItemBySku, getAvailableStock]);

  const handleSkuKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSkuScan(skuInput);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    
    // Jika tambah, cek stok dulu
    if (delta > 0) {
      const availableStock = getAvailableStock(item.sku);
      if (availableStock <= 0) {
        showMessage(`Stok ${item.name} habis!`, 'error');
        return;
      }
    }
    
    item.quantity += delta;
    if (item.quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  };

  const removeItem = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const subTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subTotal - discount);

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const handleSaveOrder = async (status: 'paid' | 'unpaid') => {
    if (!customerName.trim()) {
      showMessage('Masukkan nama customer!', 'error');
      customerInputRef.current?.focus();
      return;
    }

    if (cart.length === 0) {
      showMessage('Keranjang kosong!', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          customerName,
          items: cart.map((item) => ({
            sku: item.sku,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          subTotal,
          discount,
          total,
          note,
          status,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setCustomerName('');
        setCart([]);
        setDiscount(0);
        setNote('');
        setScanningEnabled(false);
        // Refresh master data untuk update stok terbaru
        fetchMasterData();
        fetchNewOrderId();
        customerInputRef.current?.focus();
      } else {
        showMessage(data.message || 'Gagal menyimpan order', 'error');
      }
    } catch (error) {
      showMessage('Error menyimpan order', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDiscount = () => {
    const discountValue = parseInt(discountInput.replace(/\D/g, '')) || 0;
    setDiscount(discountValue);
    setShowDiscountModal(false);
    setDiscountInput('');
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customerName.trim()) {
      setScanningEnabled(true);
      skuInputRef.current?.focus();
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-sm mx-auto px-3 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              Kasir
            </h1>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {orderId} {masterLoaded && <span className="text-green-500">● Online</span>}
            </p>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' 
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {darkMode ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
              </svg>
            )}
          </button>
        </div>

        {/* Loading Master Data */}
        {masterLoading && (
          <div className={`mb-3 p-3 rounded-lg text-sm text-center ${darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>
            <svg className="animate-spin h-4 w-4 inline mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Memuat data produk...
          </div>
        )}

        {/* Error Message Only */}
        {message.text && message.type === 'error' && (
          <div className="mb-3 p-2 rounded-lg text-sm text-center bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            {message.text}
          </div>
        )}

        {/* Customer Name Input */}
        <div className="mb-3">
          <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Nama Customer
          </label>
          <input
            ref={customerInputRef}
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            onKeyDown={handleCustomerKeyDown}
            placeholder="Masukkan nama customer..."
            className={`w-full px-3 py-2 rounded-lg text-sm border transition-colors ${
              darkMode 
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
            }`}
          />
        </div>

        {/* SKU Scanner Input */}
        <div className="mb-3">
          <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Scan SKU
          </label>
          <input
            ref={skuInputRef}
            type="text"
            value={skuInput}
            onChange={(e) => setSkuInput(e.target.value.toUpperCase())}
            onKeyDown={handleSkuKeyDown}
            placeholder={scanningEnabled ? "Scan atau ketik SKU..." : "Isi nama customer dulu..."}
            disabled={!scanningEnabled || !masterLoaded}
            className={`w-full px-3 py-2 rounded-lg text-sm border transition-colors ${
              darkMode 
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 disabled:bg-gray-900 disabled:text-gray-600' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400'
            }`}
          />
        </div>

        {/* Cart Items */}
        <div className={`rounded-lg border mb-3 overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`px-3 py-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Keranjang ({cart.reduce((sum, item) => sum + item.quantity, 0)} item)
            </h2>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {cart.length === 0 ? (
              <p className={`text-center py-6 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Belum ada item
              </p>
            ) : (
              cart.map((item, index) => (
                <div 
                  key={item.sku} 
                  className={`px-3 py-2 border-b last:border-b-0 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {item.name}
                      </p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {item.sku}
                      </p>
                      <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {formatCurrency(item.price)} x {item.quantity}
                        <span className={`ml-2 ${getAvailableStock(item.sku) <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          (sisa: {getAvailableStock(item.sku)})
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(index, -1)}
                        className={`w-6 h-6 rounded flex items-center justify-center text-sm ${
                          darkMode 
                            ? 'bg-gray-700 text-white hover:bg-gray-600' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        -
                      </button>
                      <span className={`w-6 text-center text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(index, 1)}
                        disabled={getAvailableStock(item.sku) <= 0}
                        className={`w-6 h-6 rounded flex items-center justify-center text-sm ${
                          darkMode 
                            ? 'bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(index)}
                        className="w-6 h-6 rounded flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 ml-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Summary */}
        <div className={`rounded-lg border p-3 mb-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Subtotal</span>
              <span className={darkMode ? 'text-white' : 'text-gray-900'}>{formatCurrency(subTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <button
                onClick={() => setShowDiscountModal(true)}
                className={`flex items-center gap-1 ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                Diskon
              </button>
              <span className={`${discount > 0 ? 'text-red-500' : darkMode ? 'text-white' : 'text-gray-900'}`}>
                {discount > 0 ? `-${formatCurrency(discount)}` : formatCurrency(0)}
              </span>
            </div>
            <div className={`flex justify-between text-base font-bold pt-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <span className={darkMode ? 'text-white' : 'text-gray-900'}>Total</span>
              <span className={darkMode ? 'text-white' : 'text-gray-900'}>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Note Button */}
        <button
          onClick={() => setShowNoteModal(true)}
          className={`w-full mb-3 px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 ${
            darkMode 
              ? 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700' 
              : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          {note ? 'Edit Catatan' : 'Tambah Catatan'}
        </button>

        {/* Note Preview */}
        {note && (
          <div className={`mb-3 p-2 rounded-lg text-xs ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
            <span className="font-medium">Catatan:</span> {note}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSaveOrder('unpaid')}
            disabled={loading || cart.length === 0}
            className="px-4 py-3 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Menyimpan...' : 'Unpaid'}
          </button>
          <button
            onClick={() => handleSaveOrder('paid')}
            disabled={loading || cart.length === 0}
            className="px-4 py-3 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Menyimpan...' : 'Paid'}
          </button>
        </div>
      </div>

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-xs rounded-lg p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Masukkan Diskon
            </h3>
            <div className="relative mb-4">
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Rp
              </span>
              <input
                type="text"
                value={discountInput}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setDiscountInput(value ? parseInt(value).toLocaleString('id-ID') : '');
                }}
                placeholder="0"
                autoFocus
                className={`w-full pl-10 pr-3 py-2 rounded-lg text-sm border ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDiscountModal(false);
                  setDiscountInput('');
                }}
                className={`flex-1 px-4 py-2 rounded-lg text-sm ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Batal
              </button>
              <button
                onClick={handleApplyDiscount}
                className="flex-1 px-4 py-2 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-xs rounded-lg p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Catatan Order
            </h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tulis catatan di sini..."
              rows={3}
              autoFocus
              className={`w-full px-3 py-2 rounded-lg text-sm border resize-none ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' 
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowNoteModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Tutup
              </button>
              {note && (
                <button
                  onClick={() => {
                    setNote('');
                    setShowNoteModal(false);
                  }}
                  className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}