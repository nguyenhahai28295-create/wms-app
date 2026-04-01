import React, { useState } from 'react';
import { supabase } from '../supabase.js';

/* ════════════════════════════════════════════════════════════
   DANH MỤC RỦI RO — Cây phân cấp 3 cấp
════════════════════════════════════════════════════════════ */

const LEVEL_COLORS = ['bg-blue-600', 'bg-blue-400', 'bg-blue-200 text-blue-900'];
const LEVEL_LABELS = ['Nhóm rủi ro (Cấp 1)', 'Loại rủi ro (Cấp 2)', 'Rủi ro cụ thể (Cấp 3)'];

const RiskCategories = ({ currentUser, riskCategories, addToast, reload }) => {
  const isAdmin   = currentUser.role === 'admin';
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState(null); // {mode:'add'|'edit', item?}
  const [form,    setForm]    = useState({ code:'', name:'', parent_id:'', level:1, description:'' });
  const [saving,  setSaving]  = useState(false);
  const [expand,  setExpand]  = useState({});

  const filtered = riskCategories.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  );

  // Build tree
  const tree = filtered.filter(c => c.level === 1).map(l1 => ({
    ...l1,
    children: filtered.filter(c => c.parent_id === l1.id).map(l2 => ({
      ...l2,
      children: filtered.filter(c => c.parent_id === l2.id),
    })),
  }));

  const openAdd = (parentId = null, level = 1) => {
    setForm({ code:'', name:'', parent_id: parentId || '', level, description:'' });
    setModal({ mode:'add' });
  };

  const openEdit = (item) => {
    setForm({ code: item.code, name: item.name, parent_id: item.parent_id || '', level: item.level, description: item.description || '' });
    setModal({ mode:'edit', item });
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) { addToast('Vui lòng nhập mã và tên danh mục', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        parent_id: form.parent_id || null,
        level: Number(form.level),
        description: form.description.trim() || null,
        created_by: currentUser.id,
      };
      if (modal.mode === 'add') {
        const { error } = await supabase.from('risk_categories').insert(payload);
        if (error) throw error;
        addToast('Thêm danh mục rủi ro thành công', 'success');
      } else {
        const { error } = await supabase.from('risk_categories').update(payload).eq('id', modal.item.id);
        if (error) throw error;
        addToast('Cập nhật danh mục rủi ro thành công', 'success');
      }
      setModal(null);
      reload();
    } catch (err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item) => {
    const { error } = await supabase.from('risk_categories').update({ is_active: !item.is_active }).eq('id', item.id);
    if (error) { addToast('Lỗi cập nhật trạng thái', 'error'); return; }
    addToast(`${item.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'} thành công`, 'success');
    reload();
  };

  const getParentOptions = (level) => riskCategories.filter(c => c.level === level - 1);

  return (
    <div className="p-6 h-full overflow-auto bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">🗂️ Danh Mục Rủi Ro</h2>
          <p className="text-sm text-gray-500 mt-0.5">Phân cấp rủi ro 3 cấp theo chuẩn Basel II</p>
        </div>
        {isAdmin && (
          <button onClick={() => openAdd(null, 1)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            + Thêm Nhóm Rủi Ro
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm kiếm mã hoặc tên danh mục..."
          className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm w-80 focus:outline-none focus:border-blue-500"/>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[1,2,3].map(level => (
          <div key={level} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-lg font-bold text-gray-800">
              {riskCategories.filter(c => c.level === level).length}
            </div>
            <div className="text-xs text-gray-500">{LEVEL_LABELS[level-1]}</div>
          </div>
        ))}
      </div>

      {/* Tree */}
      <div className="space-y-2">
        {tree.length === 0
          ? <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              {search ? 'Không tìm thấy danh mục phù hợp' : 'Chưa có danh mục rủi ro. Nhấn "+ Thêm Nhóm Rủi Ro" để bắt đầu.'}
            </div>
          : tree.map(l1 => (
              <div key={l1.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Level 1 */}
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border-b border-blue-100">
                  <button onClick={() => setExpand(e => ({...e, [l1.id]: !e[l1.id]}))}
                    className="text-blue-600 hover:text-blue-800 w-5 text-sm font-bold">
                    {expand[l1.id] === false ? '▶' : '▼'}
                  </button>
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded font-bold">{l1.code}</span>
                  <span className="font-semibold text-gray-800 flex-1">{l1.name}</span>
                  <span className="text-xs text-gray-400">{l1.children.length} loại</span>
                  {!l1.is_active && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Vô hiệu</span>}
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => openAdd(l1.id, 2)}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">+ Cấp 2</button>
                      <button onClick={() => openEdit(l1)}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">Sửa</button>
                      <button onClick={() => toggleActive(l1)}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                        {l1.is_active ? 'Vô hiệu' : 'Kích hoạt'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Level 2 & 3 */}
                {expand[l1.id] !== false && l1.children.map(l2 => (
                  <div key={l2.id}>
                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 bg-white hover:bg-gray-50 ml-6">
                      <button onClick={() => setExpand(e => ({...e, [l2.id]: !e[l2.id]}))}
                        className="text-gray-400 hover:text-gray-600 w-4 text-xs">
                        {l2.children.length > 0 ? (expand[l2.id] === false ? '▶' : '▼') : '•'}
                      </button>
                      <span className="px-2 py-0.5 bg-blue-400 text-white text-xs rounded font-medium">{l2.code}</span>
                      <span className="text-gray-700 text-sm flex-1">{l2.name}</span>
                      {l2.description && <span className="text-xs text-gray-400 truncate max-w-48">{l2.description}</span>}
                      {!l2.is_active && <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">Vô hiệu</span>}
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button onClick={() => openAdd(l2.id, 3)}
                            className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">+ Cấp 3</button>
                          <button onClick={() => openEdit(l2)}
                            className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded hover:bg-gray-200">Sửa</button>
                        </div>
                      )}
                    </div>

                    {/* Level 3 */}
                    {expand[l2.id] !== false && l2.children.map(l3 => (
                      <div key={l3.id}
                        className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 hover:bg-gray-50 ml-12">
                        <span className="w-4 text-gray-300 text-xs">◦</span>
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">{l3.code}</span>
                        <span className="text-gray-600 text-sm flex-1">{l3.name}</span>
                        {l3.description && <span className="text-xs text-gray-400 truncate max-w-48">{l3.description}</span>}
                        {!l3.is_active && <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">Vô hiệu</span>}
                        {isAdmin && (
                          <button onClick={() => openEdit(l3)}
                            className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded hover:bg-gray-200">Sửa</button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))
        }
      </div>

      {/* Modal thêm/sửa */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800">{modal.mode === 'add' ? 'Thêm Danh Mục Rủi Ro' : 'Sửa Danh Mục Rủi Ro'}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mã danh mục *</label>
                  <input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))}
                    placeholder="VD: OR-01"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cấp</label>
                  <select value={form.level} onChange={e => setForm(f => ({...f, level: Number(e.target.value), parent_id: ''}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value={1}>Cấp 1 (Nhóm)</option>
                    <option value={2}>Cấp 2 (Loại)</option>
                    <option value={3}>Cấp 3 (Chi tiết)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên danh mục *</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  placeholder="Nhập tên danh mục rủi ro"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              {form.level > 1 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Danh mục cha *</label>
                  <select value={form.parent_id} onChange={e => setForm(f => ({...f, parent_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn danh mục cha --</option>
                    {getParentOptions(form.level).map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  rows={2} placeholder="Mô tả ngắn về loại rủi ro này"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Hủy
                </button>
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : modal.mode === 'add' ? 'Thêm mới' : 'Cập nhật'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskCategories;
