import React, { useState, useRef } from 'react';
import { Plus, Save, CheckCircle2, AlertCircle, Lock, Upload, Link, FileUp, FileText, Search } from 'lucide-react';

interface AdminProps {
  user: { id: number; username: string };
}

const INPUT = 'w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm';

export default function Admin({ user }: AdminProps) {
  const isAdmin = user.username === 'admin';
  const [activeTab, setActiveTab] = useState<'add' | 'edit' | 'bulk' | 'password'>(
    isAdmin ? 'add' : 'password'
  );
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Add Product State
  const emptyForm = {
    unit_number: '', name: '', description: '', price: '',
    vendor: 'Giannini', type: 'Planters_and_Urns', size: '', image_url: '',
    h: '', w: '', b: '', d: '', base: '',
  };
  const [formData, setFormData] = useState(emptyForm);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Product State
  const [editQuery, setEditQuery] = useState('');
  const [editProduct, setEditProduct] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [editImageMode, setEditImageMode] = useState<'upload' | 'url'>('url');
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Bulk Update State
  const [csvData, setCsvData] = useState('');
  const [bulkMode, setBulkMode] = useState<'file' | 'paste'>('file');
  const [bulkVendor, setBulkVendor] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  // Change Password State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData(f => ({ ...f, [field]: e.target.value }));

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    setStatus(null);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setFormData(f => ({ ...f, image_url: data.url }));
        setImagePreview(data.url);
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch {
      setStatus({ type: 'error', message: 'Image upload failed' });
    } finally {
      setImageUploading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!formData.image_url) {
      setStatus({ type: 'error', message: 'Please upload an image or provide an image URL' });
      return;
    }
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, price: parseFloat(formData.price) || 0 }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: 'Product added successfully!' });
        setFormData(emptyForm);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch {
      setStatus({ type: 'error', message: 'Failed to add product' });
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setEditProduct(null);
    setEditForm(null);
    try {
      const res = await fetch(`/api/products/by-unit/${encodeURIComponent(editQuery.trim())}`);
      const data = await res.json();
      if (data.success) {
        setEditProduct(data.product);
        setEditForm({ ...data.product, price: String(data.product.price ?? '') });
        setEditImageMode('url');
        setEditImagePreview(data.product.image_url || null);
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch {
      setStatus({ type: 'error', message: 'Lookup failed' });
    }
  };

  const handleEditImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditImageUploading(true);
    setStatus(null);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setEditForm((f: any) => ({ ...f, image_url: data.url }));
        setEditImagePreview(data.url);
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch {
      setStatus({ type: 'error', message: 'Image upload failed' });
    } finally {
      setEditImageUploading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      const res = await fetch(`/api/products/${editProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: 'Product updated successfully!' });
        setEditProduct({ ...editProduct, ...editForm });
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch {
      setStatus({ type: 'error', message: 'Failed to save changes' });
    }
  };

  const setEdit = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditForm((f: any) => ({ ...f, [field]: e.target.value }));

  const handleBulkFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const file = bulkFileRef.current?.files?.[0];
    if (!file) {
      setStatus({ type: 'error', message: 'Please select a file' });
      return;
    }
    setBulkUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (bulkVendor) fd.append('vendor', bulkVendor);
      const res = await fetch('/api/products/bulk-price-file', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: data.message || 'Prices updated successfully!' });
        if (bulkFileRef.current) bulkFileRef.current.value = '';
      } else {
        setStatus({ type: 'error', message: data.message || 'Upload failed' });
      }
    } catch {
      setStatus({ type: 'error', message: 'File upload failed' });
    } finally {
      setBulkUploading(false);
    }
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      const lines = csvData.split('\n').filter(l => l.trim() !== '');
      const updates = lines.map(line => {
        const [unit_number, priceStr] = line.split(',');
        return { unit_number: unit_number.trim(), price: parseFloat(priceStr.trim()) || 0 };
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
    } catch {
      setStatus({ type: 'error', message: 'Failed to parse or update prices. Ensure format is unit_number,price' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setStatus({ type: 'error', message: 'New passwords do not match' });
      return;
    }
    try {
      const res = await fetch(`/api/users/${user.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: 'Password updated successfully!' });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch {
      setStatus({ type: 'error', message: 'Failed to update password' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const tabClass = (tab: typeof activeTab) =>
    `flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${activeTab === tab ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`;

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto font-sans">
      <header className="mb-6 py-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif font-medium text-stone-900 mb-2">
            {isAdmin ? 'Admin' : 'Account'}
          </h1>
          <p className="text-stone-500 text-sm">
            {isAdmin ? 'Manage catalog and pricing.' : `Signed in as ${user.username}.`}
          </p>
        </div>
        <button onClick={handleLogout} className="text-xs font-semibold uppercase tracking-wider text-stone-500 hover:text-stone-900 transition-colors">
          Sign Out
        </button>
      </header>

      {isAdmin && (
        <div className="flex gap-2 mb-6 bg-stone-100 p-1 rounded-2xl">
          <button onClick={() => { setActiveTab('add'); setStatus(null); }} className={tabClass('add')}>Add</button>
          <button onClick={() => { setActiveTab('edit'); setStatus(null); }} className={tabClass('edit')}>Edit</button>
          <button onClick={() => { setActiveTab('bulk'); setStatus(null); }} className={tabClass('bulk')}>Prices</button>
          <button onClick={() => { setActiveTab('password'); setStatus(null); }} className={tabClass('password')}>Password</button>
        </div>
      )}

      {status && (
        <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          {status.type === 'success'
            ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
            : <AlertCircle size={20} className="text-red-500 shrink-0" />}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}

      {activeTab === 'add' && isAdmin && (
        <form onSubmit={handleAddProduct} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col gap-5">

          {/* Unit + Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Unit Number</label>
              <input type="text" required value={formData.unit_number} onChange={set('unit_number')} className={INPUT} placeholder="e.g. 2316" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Price ($)</label>
              <input type="number" step="0.01" value={formData.price} onChange={set('price')} className={INPUT + ' font-mono'} placeholder="0.00" />
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Product Name</label>
            <input type="text" required value={formData.name} onChange={set('name')} className={INPUT} placeholder="e.g. Venetian Urn Large" />
          </div>

          {/* Vendor + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Vendor</label>
              <select value={formData.vendor} onChange={set('vendor')} className={INPUT + ' appearance-none'}>
                <option value="Giannini">Giannini</option>
                <option value="Campia">Campia</option>
                <option value="Herit">Herit</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Type</label>
              <select value={formData.type} onChange={set('type')} className={INPUT + ' appearance-none'}>
                <option value="Planters_and_Urns">Planters &amp; Urns</option>
                <option value="Fountains">Fountains</option>
                <option value="Benches_and_Tables">Benches &amp; Tables</option>
                <option value="Fire_Pits_and_Tables">Fire Pits &amp; Tables</option>
                <option value="Ponds_and_Coping">Ponds &amp; Coping</option>
                <option value="Italian_Ceramics">Italian Ceramics</option>
                <option value="Italian_Furniture">Italian Furniture</option>
                <option value="Home_Installations">Home Installations</option>
                <option value="Pizza_Ovens">Pizza Ovens</option>
                <option value="NEW_for_2025">New for 2025</option>
              </select>
            </div>
          </div>

          {/* Dimensions */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Dimensions</label>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider">Height (H)</span>
                <input type="text" value={formData.h} onChange={set('h')} className={INPUT} placeholder='e.g. 18"' />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider">Width (W)</span>
                <input type="text" value={formData.w} onChange={set('w')} className={INPUT} placeholder='e.g. 24"' />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider">Depth (D)</span>
                <input type="text" value={formData.d} onChange={set('d')} className={INPUT} placeholder='e.g. 14"' />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider">Base (B)</span>
                <input type="text" value={formData.b} onChange={set('b')} className={INPUT} placeholder='e.g. 13"' />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider">Base Description</span>
                <input type="text" value={formData.base} onChange={set('base')} className={INPUT} placeholder='e.g. 13" sq base' />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-stone-400 uppercase tracking-wider">Full Dimensions Label</span>
              <input type="text" value={formData.size} onChange={set('size')} className={INPUT} placeholder='e.g. 27"H x 24"W x 13" Dia Base' />
            </div>
          </div>

          {/* Image */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Product Image</label>
            <div className="flex gap-2 bg-stone-100 p-1 rounded-xl mb-1">
              <button type="button" onClick={() => { setImageMode('upload'); setFormData(f => ({ ...f, image_url: '' })); setImagePreview(null); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${imageMode === 'upload' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                <Upload size={12} /> Upload File
              </button>
              <button type="button" onClick={() => { setImageMode('url'); setFormData(f => ({ ...f, image_url: '' })); setImagePreview(null); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${imageMode === 'url' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                <Link size={12} /> Use URL
              </button>
            </div>

            {imageMode === 'upload' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative border-2 border-dashed border-stone-200 rounded-2xl overflow-hidden cursor-pointer hover:border-stone-400 transition-colors"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center gap-2 text-stone-400">
                    {imageUploading
                      ? <p className="text-sm">Uploading...</p>
                      : <><Upload size={22} /><p className="text-sm">Click to upload image</p></>
                    }
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
              </div>
            ) : (
              <input type="url" value={formData.image_url} onChange={set('image_url')}
                className={INPUT} placeholder="https://example.com/image.jpg" />
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Description</label>
            <textarea rows={3} value={formData.description} onChange={set('description')}
              className={INPUT + ' resize-none'} placeholder="Optional description..." />
          </div>

          <button type="submit" className="w-full bg-stone-900 text-white font-medium py-3.5 rounded-xl hover:bg-stone-800 transition-colors mt-2 flex items-center justify-center gap-2">
            <Plus size={18} />
            <span>Add Product</span>
          </button>
        </form>
      )}

      {activeTab === 'edit' && isAdmin && (
        <div className="flex flex-col gap-4">
          {/* Lookup bar */}
          <form onSubmit={handleLookup} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input
                type="text"
                value={editQuery}
                onChange={e => setEditQuery(e.target.value)}
                placeholder="Unit number, e.g. 2316"
                className={INPUT + ' pl-9'}
                required
              />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors shrink-0">
              Lookup
            </button>
          </form>

          {editForm && (
            <form onSubmit={handleSaveEdit} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col gap-5">
              {/* Product image preview + name header */}
              {editImagePreview && (
                <div className="w-full rounded-2xl overflow-hidden bg-stone-100 flex items-center justify-center">
                  <img src={editImagePreview} alt={editForm.name} className="w-full object-contain max-h-72" />
                </div>
              )}

              {/* Unit + Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Unit Number</label>
                  <input type="text" required value={editForm.unit_number} onChange={setEdit('unit_number')} className={INPUT} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Price ($)</label>
                  <input type="number" step="0.01" value={editForm.price} onChange={setEdit('price')} className={INPUT + ' font-mono'} placeholder="0.00" />
                </div>
              </div>

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Product Name</label>
                <input type="text" required value={editForm.name} onChange={setEdit('name')} className={INPUT} />
              </div>

              {/* Vendor + Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Vendor</label>
                  <select value={editForm.vendor} onChange={setEdit('vendor')} className={INPUT + ' appearance-none'}>
                    <option value="Giannini">Giannini</option>
                    <option value="Campia">Campia</option>
                    <option value="Herit">Herit</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Type</label>
                  <select value={editForm.type} onChange={setEdit('type')} className={INPUT + ' appearance-none'}>
                    <option value="Planters_and_Urns">Planters &amp; Urns</option>
                    <option value="Fountains">Fountains</option>
                    <option value="Benches_and_Tables">Benches &amp; Tables</option>
                    <option value="Fire_Pits_and_Tables">Fire Pits &amp; Tables</option>
                    <option value="Ponds_and_Coping">Ponds &amp; Coping</option>
                    <option value="Italian_Ceramics">Italian Ceramics</option>
                    <option value="Italian_Furniture">Italian Furniture</option>
                    <option value="Home_Installations">Home Installations</option>
                    <option value="Pizza_Ovens">Pizza Ovens</option>
                    <option value="NEW_for_2025">New for 2025</option>
                  </select>
                </div>
              </div>

              {/* Dimensions */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Dimensions</label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider">Height (H)</span>
                    <input type="text" value={editForm.h || ''} onChange={setEdit('h')} className={INPUT} placeholder='18"' />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider">Width (W)</span>
                    <input type="text" value={editForm.w || ''} onChange={setEdit('w')} className={INPUT} placeholder='24"' />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider">Depth (D)</span>
                    <input type="text" value={editForm.d || ''} onChange={setEdit('d')} className={INPUT} placeholder='14"' />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider">Base (B)</span>
                    <input type="text" value={editForm.b || ''} onChange={setEdit('b')} className={INPUT} placeholder='13"' />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider">Base Description</span>
                    <input type="text" value={editForm.base || ''} onChange={setEdit('base')} className={INPUT} placeholder='13" sq base' />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-stone-400 uppercase tracking-wider">Full Dimensions Label</span>
                  <input type="text" value={editForm.size || ''} onChange={setEdit('size')} className={INPUT} placeholder='27"H x 24"W x 13" Dia Base' />
                </div>
              </div>

              {/* Image */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Product Image</label>
                <div className="flex gap-2 bg-stone-100 p-1 rounded-xl mb-1">
                  <button type="button" onClick={() => { setEditImageMode('upload'); }}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${editImageMode === 'upload' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                    <Upload size={12} /> Upload File
                  </button>
                  <button type="button" onClick={() => setEditImageMode('url')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${editImageMode === 'url' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                    <Link size={12} /> Use URL
                  </button>
                </div>
                {editImageMode === 'upload' ? (
                  <div onClick={() => editFileInputRef.current?.click()}
                    className="relative border-2 border-dashed border-stone-200 rounded-2xl overflow-hidden cursor-pointer hover:border-stone-400 transition-colors">
                    {editImagePreview ? (
                      <img src={editImagePreview} alt="Preview" className="w-full object-contain max-h-72" />
                    ) : (
                      <div className="h-32 flex flex-col items-center justify-center gap-2 text-stone-400">
                        {editImageUploading ? <p className="text-sm">Uploading...</p> : <><Upload size={22} /><p className="text-sm">Click to upload image</p></>}
                      </div>
                    )}
                    <input ref={editFileInputRef} type="file" accept="image/*" onChange={handleEditImageFile} className="hidden" />
                  </div>
                ) : (
                  <input type="text" value={editForm.image_url || ''} onChange={e => { setEdit('image_url')(e); setEditImagePreview(e.target.value); }}
                    className={INPUT} placeholder="https://... or /images/photo.png" />
                )}
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Description</label>
                <textarea rows={3} value={editForm.description || ''} onChange={setEdit('description')}
                  className={INPUT + ' resize-none'} placeholder="Optional description..." />
              </div>

              <button type="submit" className="w-full bg-stone-900 text-white font-medium py-3.5 rounded-xl hover:bg-stone-800 transition-colors mt-2 flex items-center justify-center gap-2">
                <Save size={18} />
                <span>Save Changes</span>
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'bulk' && isAdmin && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col gap-5">
          {/* Mode toggle */}
          <div className="flex gap-2 bg-stone-100 p-1 rounded-xl">
            <button type="button" onClick={() => setBulkMode('file')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${bulkMode === 'file' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              <FileUp size={12} /> Upload File
            </button>
            <button type="button" onClick={() => setBulkMode('paste')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${bulkMode === 'paste' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              <FileText size={12} /> Paste CSV
            </button>
          </div>

          {bulkMode === 'file' ? (
            <form onSubmit={handleBulkFileUpload} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Vendor (optional — leave blank to match all)</label>
                <select value={bulkVendor} onChange={e => setBulkVendor(e.target.value)} className={INPUT + ' appearance-none'}>
                  <option value="">All Vendors</option>
                  <option value="Giannini">Giannini</option>
                  <option value="Campia">Campia</option>
                  <option value="Herit">Herit</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Price File</label>
                <p className="text-xs text-stone-500">CSV or XLSX with columns <code className="bg-stone-100 px-1 rounded">product_num</code> and <code className="bg-stone-100 px-1 rounded">price</code>. Dollar signs are handled automatically.</p>
                <label
                  onClick={() => bulkFileRef.current?.click()}
                  className="border-2 border-dashed border-stone-200 rounded-2xl h-28 flex flex-col items-center justify-center gap-2 text-stone-400 cursor-pointer hover:border-stone-400 transition-colors"
                >
                  <FileUp size={22} />
                  <span className="text-sm">{bulkFileRef.current?.files?.[0]?.name || 'Click to select CSV or XLSX'}</span>
                  <input ref={bulkFileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                    onChange={() => setStatus(null)} />
                </label>
              </div>
              <button type="submit" disabled={bulkUploading}
                className="w-full bg-stone-900 text-white font-medium py-3.5 rounded-xl hover:bg-stone-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                <Upload size={18} />
                <span>{bulkUploading ? 'Uploading...' : 'Upload & Update Prices'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleBulkUpdate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-stone-900">Paste CSV Data</label>
                <p className="text-xs text-stone-500">Format: <code className="bg-stone-100 px-1 rounded">unit_number,price</code> (one per line)</p>
                <textarea required rows={10} value={csvData} onChange={e => setCsvData(e.target.value)}
                  className={INPUT + ' resize-none font-mono'} placeholder={"2316,155.00\n2315,260.00\n2094,125.50"} />
              </div>
              <button type="submit" className="w-full bg-stone-900 text-white font-medium py-3.5 rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center gap-2">
                <Save size={18} />
                <span>Update Prices</span>
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'password' && (
        <form onSubmit={handleChangePassword} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col gap-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-stone-100 rounded-full flex items-center justify-center shrink-0">
              <Lock size={16} className="text-stone-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">Change Password</p>
              <p className="text-xs text-stone-500">Update the password for <span className="font-semibold">{user.username}</span></p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Current Password</label>
            <input type="password" required value={passwordForm.currentPassword}
              onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className={INPUT} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">New Password</label>
            <input type="password" required value={passwordForm.newPassword}
              onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className={INPUT} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Confirm New Password</label>
            <input type="password" required value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className={INPUT} />
          </div>
          <button type="submit" className="w-full bg-stone-900 text-white font-medium py-3.5 rounded-xl hover:bg-stone-800 transition-colors mt-2 flex items-center justify-center gap-2">
            <Lock size={18} />
            <span>Update Password</span>
          </button>
        </form>
      )}
    </div>
  );
}
