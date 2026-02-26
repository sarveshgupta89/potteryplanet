import React, { useState } from 'react';
import { Plus, Upload, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'add' | 'bulk'>('add');
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Add Product State
  const [formData, setFormData] = useState({
    unit_number: '',
    name: '',
    description: '',
    price: '',
    vendor: 'Pottery Planet',
    type: 'Planter',
    size: '',
    image_url: ''
  });

  // Bulk Update State
  const [csvData, setCsvData] = useState('');

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price) || 0
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: 'Product added successfully!' });
        setFormData({
          unit_number: '', name: '', description: '', price: '',
          vendor: 'Pottery Planet', type: 'Planter', size: '', image_url: ''
        });
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to add product' });
    }
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    
    try {
      // Parse simple CSV: unit_number,price
      const lines = csvData.split('\\n').filter(line => line.trim() !== '');
      const updates = lines.map(line => {
        const [unit_number, priceStr] = line.split(',');
        return {
          unit_number: unit_number.trim(),
          price: parseFloat(priceStr.trim()) || 0
        };
      });

      const res = await fetch('/api/products/bulk-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: `Successfully updated ${updates.length} prices!` });
        setCsvData('');
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to parse or update prices. Ensure format is unit_number,price' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto font-sans">
      <header className="mb-6 py-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif font-medium text-stone-900 mb-2">Admin</h1>
          <p className="text-stone-500 text-sm">Manage catalog and pricing.</p>
        </div>
        <button 
          onClick={handleLogout}
          className="text-xs font-semibold uppercase tracking-wider text-stone-500 hover:text-stone-900 transition-colors"
        >
          Sign Out
        </button>
      </header>

      <div className="flex gap-2 mb-6 bg-stone-100 p-1 rounded-2xl">
        <button
          onClick={() => { setActiveTab('add'); setStatus(null); }}
          className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${activeTab === 'add' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Add Product
        </button>
        <button
          onClick={() => { setActiveTab('bulk'); setStatus(null); }}
          className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${activeTab === 'bulk' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Bulk Prices
        </button>
      </div>

      {status && (
        <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          {status.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0" /> : <AlertCircle size={20} className="text-red-500 shrink-0" />}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}

      {activeTab === 'add' ? (
        <form onSubmit={handleAddProduct} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Unit Number</label>
              <input
                type="text"
                required
                value={formData.unit_number}
                onChange={e => setFormData({...formData, unit_number: e.target.value})}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm"
                placeholder="e.g. 2316"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Price ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm font-mono"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Product Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm"
              placeholder="e.g. Anduze de Lys Pot Medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Vendor</label>
              <select
                value={formData.vendor}
                onChange={e => setFormData({...formData, vendor: e.target.value})}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm appearance-none"
              >
                <option value="Pottery Planet">Pottery Planet</option>
                <option value="Campia">Campia</option>
                <option value="Herit">Herit</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Type</label>
              <select
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm appearance-none"
              >
                <option value="Planter">Planter</option>
                <option value="Urn">Urn</option>
                <option value="Fountain">Fountain</option>
                <option value="Wall Ornament">Wall Ornament</option>
                <option value="Ornament">Ornament</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Size / Dimensions</label>
            <input
              type="text"
              value={formData.size}
              onChange={e => setFormData({...formData, size: e.target.value})}
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm"
              placeholder='e.g. 27"H x 24"W x 13" Dia Base'
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Image URL</label>
            <input
              type="url"
              required
              value={formData.image_url}
              onChange={e => setFormData({...formData, image_url: e.target.value})}
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm resize-none"
              placeholder="Optional description..."
            />
          </div>

          <button
            type="submit"
            className="w-full bg-stone-900 text-white font-medium py-3.5 rounded-xl hover:bg-stone-800 transition-colors mt-2 flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            <span>Add Product</span>
          </button>
        </form>
      ) : (
        <form onSubmit={handleBulkUpdate} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-stone-900">Paste CSV Data</label>
            <p className="text-xs text-stone-500">Format: <code className="bg-stone-100 px-1 rounded">unit_number,price</code> (one per line)</p>
            <textarea
              required
              rows={10}
              value={csvData}
              onChange={e => setCsvData(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm font-mono resize-none"
              placeholder="2316,155.00&#10;2315,260.00&#10;2094,125.50"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-stone-900 text-white font-medium py-3.5 rounded-xl hover:bg-stone-800 transition-colors mt-2 flex items-center justify-center gap-2"
          >
            <Save size={18} />
            <span>Update Prices</span>
          </button>
        </form>
      )}
    </div>
  );
}
