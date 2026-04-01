import React, { useState } from 'react';
import { supabase } from '../supabase.js';

/* ════════════════════════════════════════════════════════════
   LỖI NGHIỆP VỤ (Business Errors)
════════════════════════════════════════════════════════════ */

const ERROR_TYPE = {
  manual:   { label:'Lỗi thủ công',  cls:'bg-orange-100 text-orange-700' },
  system:   { label:'Lỗi hệ thống', cls:'bg-red-100 text-red-700'      },
  process:  { label:'Lỗi quy trình', cls:'bg-yellow-100 text-yellow-700'},
  external: { label:'Yếu tố ngoài',  cls:'bg-blue-100 text-blue-700'   },
};

const SEVERITY = {
  low:    { label:'Thấp',       cls:'bg-green-100 text-green-700'  },
  medium: { label:'Trung bình', cls:'bg-yellow-100 text-yellow-700'},
  high:   { label:'Cao',        cls:'bg-red-100 text-red-700'      },
};

const STATUS_MAP = {
  open:        { label:'Mở',         cls:'bg-red-100 text-red-700'    },
  in_progress: { label:'Đang xử lý', cls:'bg-blue-100 text-blue-700'  },
  resolved:    { label:'Đã giải quyết',cls:'bg-teal-100 text-teal-700'},
  closed:      { label:'Đã đóng',    cls:'bg-gray-100 text-gray-600'  },
};

const emptyForm = () => ({
  title:'', description:'', error_date:'', error_type:'manual',
  severity:'low', impact_amount:'', root_cause:'',
  department_id:'', risk_event_id:'',
});

const BusinessErrors = ({
  currentUser, departments, users, addToast,
  businessErrors, setBusinessErrors, riskEvents,
}) => {
  const [search,   setSearch]   = useState('');
  const [tab,      setTab]      = useState('all');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(emptyForm());
  const [saving,   setSaving]   = useState(false);

  const can = { create: ['admin','manager','employee'].includes(currentUser.role) };

  const getDeptName = id => departments.find(d => d.id === id)?.name || '—';
  const getUserName = id => users.find(u => u.id === id)?.full_name || '—';

  const genCode = () => {
    const n = (businessErrors.length + 1).toString().padStart(3,'0');
    return `LNV-${new Date().getFullYear()}-${n}`;
  };

  const filtered = businessErrors.filter(e => {
    const matchTab = tab === 'all' || e.status === tab;
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.code?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const saveError = async () => {
    if (!form.title.trim() || !form.error_date) { addToast('Vui lòng nhập tiêu đề và ngày lỗi', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        code: genCode(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        error_date: form.error_date,
        error_type: form.error_type,
        severity: form.severity,
        impact_amount: form.impact_amount ? Number(form.impact_amount) : null,
        root_cause: form.root_cause.trim() || null,
        department_id: form.department_id || null,
        risk_event_id: form.risk_event_id || null,
        reporter_id: currentUser.id,
        status: 'open',
      };
      const { data, error } = await supabase.from('business_errors').insert(payload).select().single();
      if (error) throw error;
      setBusinessErrors(prev => [data, ...prev]);
      setShowForm(false);
      setForm(emptyForm());
      addToast('Ghi nhận lỗi nghiệp vụ thành công', 'success');
    } catch(err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  const updateStatus = async (item, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'resolved' || newStatus === 'closed') {
      updates.resolved_by = currentUser.id;
      updates.resolved_at = new Date().toISOString();
    }
    const { error } = await supabase.from('business_errors').update(updates).eq('id', item.id);
    if (error) { addToast('Lỗi cập nhật trạng thái', 'error'); return; }
    setBusinessErrors(prev => prev.map(e => e.id === item.id ? { ...e, ...updates } : e));
    if (selected?.id === item.id) setSelected({ ...selected, ...updates });
    addToast('Cập nhật trạng thái thành công', 'success');
  };

  const tabs = [
    { id:'all',        label:'Tất cả',       count: businessErrors.length },
    { id:'open',       label:'Mở',           count: businessErrors.filter(e=>e.status==='open').length },
    { id:'in_progress',label:'Đang xử lý',   count: businessErrors.filter(e=>e.status==='in_progress').length },
    { id:'resolved',   label:'Đã giải quyết',count: businessErrors.filter(e=>e.status==='resolved').length },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* List */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">🔧 Lỗi Nghiệp Vụ</h2>
            {can.create && (
              <button onClick={() => { setForm(emptyForm()); setShowForm(true); }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">
                + Ghi nhận
              </button>
            )}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm lỗi..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-400"/>
          <div className="flex gap-1 mt-2 flex-wrap">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0
            ? <div className="p-6 text-center text-xs text-gray-400">Không có lỗi nghiệp vụ nào</div>
            : filtered.map(e => {
                const sev = SEVERITY[e.severity] || SEVERITY.low;
                const st  = STATUS_MAP[e.status] || STATUS_MAP.open;
                return (
                  <div key={e.id} onClick={() => setSelected(e)}
                    className={`px-4 py-3 cursor-pointer hover:bg-blue-50 ${selected?.id === e.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">{e.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{e.code} · {e.error_date}</div>
                        <div className="text-xs text-gray-400">{getDeptName(e.department_id)}</div>
                      </div>
                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sev.cls}`}>{sev.label}</span>
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
          ? <div className="h-full flex items-center justify-center text-gray-400 text-sm">Chọn một lỗi nghiệp vụ để xem chi tiết</div>
          : (() => {
              const st  = STATUS_MAP[selected.status] || STATUS_MAP.open;
              const sev = SEVERITY[selected.severity] || SEVERITY.low;
              const et  = ERROR_TYPE[selected.error_type] || ERROR_TYPE.manual;
              return (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{selected.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${sev.cls}`}>{sev.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${et.cls}`}>{et.label}</span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-800 mt-1">{selected.title}</h2>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {selected.status === 'open' && (
                        <button onClick={() => updateStatus(selected, 'in_progress')}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">
                          Tiếp nhận xử lý
                        </button>
                      )}
                      {selected.status === 'in_progress' && (
                        <button onClick={() => updateStatus(selected, 'resolved')}
                          className="px-3 py-1.5 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700">
                          Đánh dấu đã giải quyết
                        </button>
                      )}
                      {selected.status === 'resolved' && (
                        <button onClick={() => updateStatus(selected, 'closed')}
                          className="px-3 py-1.5 bg-gray-600 text-white rounded-xl text-xs font-semibold hover:bg-gray-700">
                          Đóng lỗi
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Thông tin lỗi</h3>
                      {[
                        { label:'Ngày xảy ra lỗi',  val: selected.error_date },
                        { label:'Loại lỗi',          val: et.label            },
                        { label:'Phòng ban',          val: getDeptName(selected.department_id) },
                        { label:'Người ghi nhận',     val: getUserName(selected.reporter_id)   },
                        { label:'Người giải quyết',   val: getUserName(selected.resolved_by)   },
                        { label:'Tổn thất TC',        val: selected.impact_amount ? `${Number(selected.impact_amount).toLocaleString()} VND` : '—' },
                      ].map(({label,val}) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-500">{label}</span>
                          <span className="font-medium text-gray-800">{val || '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Mô tả</h3>
                      {selected.description && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Mô tả</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.description}</p>
                        </div>
                      )}
                      {selected.root_cause && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Nguyên nhân gốc rễ</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.root_cause}</p>
                        </div>
                      )}
                      {selected.risk_event_id && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Liên kết SKKR</div>
                          <span className="text-sm font-medium text-blue-600">
                            {riskEvents.find(e => e.id === selected.risk_event_id)?.title || selected.risk_event_id}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
        }
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-screen overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800">Ghi Nhận Lỗi Nghiệp Vụ</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tiêu đề lỗi *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  placeholder="Mô tả ngắn gọn về lỗi nghiệp vụ"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày lỗi *</label>
                  <input type="date" value={form.error_date} onChange={e => setForm(f => ({...f, error_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Loại lỗi</label>
                  <select value={form.error_type} onChange={e => setForm(f => ({...f, error_type: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(ERROR_TYPE).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mức độ</label>
                  <select value={form.severity} onChange={e => setForm(f => ({...f, severity: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(SEVERITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phòng ban</label>
                  <select value={form.department_id} onChange={e => setForm(f => ({...f, department_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn phòng ban --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tổn thất (VND)</label>
                  <input type="number" value={form.impact_amount} onChange={e => setForm(f => ({...f, impact_amount: e.target.value}))}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Liên kết SKKR (nếu có)</label>
                <select value={form.risk_event_id} onChange={e => setForm(f => ({...f, risk_event_id: e.target.value}))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">-- Không liên kết --</option>
                  {riskEvents.map(e => <option key={e.id} value={e.id}>{e.code} - {e.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả chi tiết</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  rows={3} placeholder="Chi tiết về lỗi xảy ra..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nguyên nhân gốc rễ</label>
                <textarea value={form.root_cause} onChange={e => setForm(f => ({...f, root_cause: e.target.value}))}
                  rows={2} placeholder="Nguyên nhân dẫn đến lỗi"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={saveError} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Ghi nhận lỗi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessErrors;
