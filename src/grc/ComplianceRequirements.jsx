import React, { useState } from 'react';
import { supabase } from '../supabase.js';

/* ════════════════════════════════════════════════════════════
   YÊU CẦU TUÂN THỦ (Compliance Requirements)
════════════════════════════════════════════════════════════ */

const CATEGORY = {
  regulatory:    { label:'Pháp lý/Quy định', cls:'bg-blue-100 text-blue-700'   },
  internal:      { label:'Nội bộ',           cls:'bg-purple-100 text-purple-700'},
  international: { label:'Quốc tế',          cls:'bg-teal-100 text-teal-700'   },
};

const PRIORITY = {
  high:   { label:'Cao',       cls:'bg-red-100 text-red-700'      },
  medium: { label:'Trung bình',cls:'bg-yellow-100 text-yellow-700'},
  low:    { label:'Thấp',      cls:'bg-green-100 text-green-700'  },
};

const STATUS_MAP = {
  active:     { label:'Còn hiệu lực', cls:'bg-green-100 text-green-700'  },
  pending:    { label:'Chờ áp dụng',  cls:'bg-yellow-100 text-yellow-700'},
  expired:    { label:'Hết hạn',      cls:'bg-gray-100 text-gray-500'    },
  superseded: { label:'Đã thay thế',  cls:'bg-gray-100 text-gray-500'    },
};

const FREQ = {
  monthly:   'Hàng tháng',
  quarterly: 'Hàng quý',
  annually:  'Hàng năm',
};

const emptyForm = () => ({
  code:'', title:'', description:'', regulation_source:'', regulation_number:'',
  effective_date:'', expiry_date:'', category:'regulatory', priority:'medium',
  review_frequency:'annually', next_review_date:'', responsible_id:'',
});

const ComplianceRequirements = ({
  currentUser, departments, users, addToast,
  complianceRequirements, setComplianceRequirements,
}) => {
  const isAdmin    = ['admin','manager'].includes(currentUser.role);
  const [search,   setSearch]   = useState('');
  const [catFilter,setCatFilter]= useState('all');
  const [selected, setSelected] = useState(null);
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState(emptyForm());
  const [saving,   setSaving]   = useState(false);

  const getUserName = id => users.find(u => u.id === id)?.full_name || '—';

  const filtered = complianceRequirements.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.code?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || r.category === catFilter;
    return matchSearch && matchCat;
  });

  const openAdd = () => { setForm(emptyForm()); setModal({ mode:'add' }); };
  const openEdit = (item) => {
    setForm({
      code: item.code, title: item.title, description: item.description || '',
      regulation_source: item.regulation_source || '', regulation_number: item.regulation_number || '',
      effective_date: item.effective_date || '', expiry_date: item.expiry_date || '',
      category: item.category, priority: item.priority,
      review_frequency: item.review_frequency || 'annually',
      next_review_date: item.next_review_date || '',
      responsible_id: item.responsible_id || '',
    });
    setModal({ mode:'edit', item });
  };

  const save = async () => {
    if (!form.code.trim() || !form.title.trim()) { addToast('Vui lòng nhập mã và tiêu đề', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        regulation_source: form.regulation_source.trim() || null,
        regulation_number: form.regulation_number.trim() || null,
        effective_date: form.effective_date || null,
        expiry_date: form.expiry_date || null,
        category: form.category,
        priority: form.priority,
        review_frequency: form.review_frequency,
        next_review_date: form.next_review_date || null,
        responsible_id: form.responsible_id || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      };
      if (modal.mode === 'add') {
        const { data, error } = await supabase.from('compliance_requirements').insert(payload).select().single();
        if (error) throw error;
        setComplianceRequirements(prev => [...prev, data]);
        addToast('Thêm yêu cầu tuân thủ thành công', 'success');
      } else {
        const { data, error } = await supabase.from('compliance_requirements').update(payload).eq('id', modal.item.id).select().single();
        if (error) throw error;
        setComplianceRequirements(prev => prev.map(r => r.id === modal.item.id ? data : r));
        if (selected?.id === modal.item.id) setSelected(data);
        addToast('Cập nhật thành công', 'success');
      }
      setModal(null);
    } catch(err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  // Check if next review is coming up
  const isReviewDue = (req) => {
    if (!req.next_review_date) return false;
    const diff = (new Date(req.next_review_date) - new Date()) / 86400000;
    return diff <= 30;
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* List */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">📜 Yêu Cầu Tuân Thủ</h2>
            {isAdmin && (
              <button onClick={openAdd}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">
                + Thêm
              </button>
            )}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-400 mb-2"/>
          <div className="flex gap-1 flex-wrap">
            {[{id:'all',label:'Tất cả'}, ...Object.entries(CATEGORY).map(([k,v]) => ({id:k,label:v.label}))].map(c => (
              <button key={c.id} onClick={() => setCatFilter(c.id)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${catFilter === c.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0
            ? <div className="p-6 text-center text-xs text-gray-400">Không có yêu cầu tuân thủ nào</div>
            : filtered.map(r => {
                const cat = CATEGORY[r.category] || CATEGORY.regulatory;
                const pri = PRIORITY[r.priority] || PRIORITY.medium;
                const st  = STATUS_MAP[r.status] || STATUS_MAP.active;
                return (
                  <div key={r.id} onClick={() => setSelected(r)}
                    className={`px-4 py-3 cursor-pointer hover:bg-blue-50 ${selected?.id === r.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">{r.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{r.code}</div>
                        {r.regulation_source && <div className="text-xs text-gray-400 truncate">{r.regulation_source}</div>}
                        {isReviewDue(r) && <div className="text-xs text-orange-600 font-medium mt-0.5">⏰ Sắp đến ngày rà soát</div>}
                      </div>
                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cat.cls}`}>{cat.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${pri.cls}`}>{pri.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        {!selected
          ? <div className="h-full flex items-center justify-center text-gray-400 text-sm">Chọn một yêu cầu tuân thủ để xem chi tiết</div>
          : (() => {
              const cat = CATEGORY[selected.category] || CATEGORY.regulatory;
              const pri = PRIORITY[selected.priority] || PRIORITY.medium;
              const st  = STATUS_MAP[selected.status] || STATUS_MAP.active;
              return (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{selected.code}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.cls}`}>{cat.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${pri.cls}`}>{pri.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">{selected.title}</h2>
                      </div>
                      {isAdmin && (
                        <button onClick={() => openEdit(selected)}
                          className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-xl text-xs font-medium hover:bg-gray-50 flex-shrink-0">
                          Sửa
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Thông tin văn bản</h3>
                      {[
                        { label:'Số hiệu văn bản',   val: selected.regulation_number  },
                        { label:'Nguồn ban hành',     val: selected.regulation_source  },
                        { label:'Ngày có hiệu lực',   val: selected.effective_date     },
                        { label:'Ngày hết hiệu lực',  val: selected.expiry_date || '—' },
                        { label:'Tần suất rà soát',   val: FREQ[selected.review_frequency] },
                        { label:'Ngày rà soát tiếp',  val: selected.next_review_date   },
                        { label:'Người phụ trách',    val: getUserName(selected.responsible_id) },
                      ].map(({label,val}) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-500">{label}</span>
                          <span className="font-medium text-gray-800">{val || '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2 mb-3">Nội dung yêu cầu</h3>
                      {selected.description
                        ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.description}</p>
                        : <p className="text-sm text-gray-400 italic">Chưa có mô tả chi tiết</p>
                      }
                    </div>
                  </div>
                </div>
              );
            })()
        }
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800">{modal.mode==='add' ? 'Thêm Yêu Cầu Tuân Thủ' : 'Sửa Yêu Cầu Tuân Thủ'}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mã yêu cầu *</label>
                  <input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))}
                    placeholder="VD: TC-001"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phân loại</label>
                  <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(CATEGORY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tiêu đề *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  placeholder="Tên yêu cầu tuân thủ"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nguồn ban hành</label>
                  <input value={form.regulation_source} onChange={e => setForm(f => ({...f, regulation_source: e.target.value}))}
                    placeholder="VD: Ngân hàng Nhà nước"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Số hiệu văn bản</label>
                  <input value={form.regulation_number} onChange={e => setForm(f => ({...f, regulation_number: e.target.value}))}
                    placeholder="VD: Thông tư 13/2018/TT-NHNN"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày có hiệu lực</label>
                  <input type="date" value={form.effective_date} onChange={e => setForm(f => ({...f, effective_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ưu tiên</label>
                  <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(PRIORITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Rà soát định kỳ</label>
                  <select value={form.review_frequency} onChange={e => setForm(f => ({...f, review_frequency: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(FREQ).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày rà soát tiếp theo</label>
                  <input type="date" value={form.next_review_date} onChange={e => setForm(f => ({...f, next_review_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Người phụ trách</label>
                  <select value={form.responsible_id} onChange={e => setForm(f => ({...f, responsible_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nội dung / Mô tả yêu cầu</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  rows={3} placeholder="Tóm tắt nội dung yêu cầu tuân thủ"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : modal.mode==='add' ? 'Thêm mới' : 'Cập nhật'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceRequirements;
