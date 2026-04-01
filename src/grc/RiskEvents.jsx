import React, { useState } from 'react';
import { supabase } from '../supabase.js';

/* ════════════════════════════════════════════════════════════
   SỰ KIỆN RỦI RO (SKKR) — Workflow WF-1
   draft → declared → under_review → closed | rejected
════════════════════════════════════════════════════════════ */

const SEVERITY = {
  low:      { label:'Thấp',     cls:'bg-green-100 text-green-700'  },
  medium:   { label:'Trung bình',cls:'bg-yellow-100 text-yellow-700'},
  high:     { label:'Cao',      cls:'bg-orange-100 text-orange-700'},
  critical: { label:'Nghiêm trọng',cls:'bg-red-100 text-red-700'  },
};

const STATUS = {
  draft:        { label:'Nháp',         cls:'bg-gray-100 text-gray-600',    next:['declared']                  },
  declared:     { label:'Đã khai báo',  cls:'bg-blue-100 text-blue-700',    next:['under_review','rejected']   },
  under_review: { label:'Đang xem xét', cls:'bg-yellow-100 text-yellow-700',next:['closed','rejected']         },
  closed:       { label:'Đã đóng',      cls:'bg-green-100 text-green-700',  next:[]                            },
  rejected:     { label:'Từ chối',      cls:'bg-red-100 text-red-700',      next:['declared']                  },
};

const ACTION_LABELS = {
  declared:     { label:'Khai báo',     btn:'bg-blue-600 hover:bg-blue-700'   },
  under_review: { label:'Tiếp nhận XR', btn:'bg-yellow-500 hover:bg-yellow-600'},
  closed:       { label:'Đóng SKKR',    btn:'bg-green-600 hover:bg-green-700' },
  rejected:     { label:'Từ chối',      btn:'bg-red-500 hover:bg-red-600'     },
};

const emptyForm = () => ({
  title:'', description:'', event_date:'', discovery_date:'',
  category_id:'', department_id:'', severity:'low',
  financial_impact:'', root_cause:'', corrective_action:'', assignee_id:'',
});

const RiskEvents = ({
  currentUser, departments, users, addToast,
  riskCategories, riskEvents, setRiskEvents,
}) => {
  const [tab,          setTab]          = useState('all');
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState(null);
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState(emptyForm());
  const [actionModal,  setActionModal]  = useState(null); // {event, nextStatus}
  const [actionComment,setActionComment]= useState('');
  const [saving,       setSaving]       = useState(false);

  const can = {
    create:  ['admin','manager','employee'].includes(currentUser.role),
    review:  ['admin','manager'].includes(currentUser.role),
    approve: ['admin','director'].includes(currentUser.role),
  };

  const getDeptName = id => departments.find(d => d.id === id)?.name || '—';
  const getUserName = id => users.find(u => u.id === id)?.full_name || '—';
  const getCatName  = id => riskCategories.find(c => c.id === id)?.name || '—';

  const genCode = () => {
    const d = new Date();
    const n = (riskEvents.length + 1).toString().padStart(3,'0');
    return `SKKR-${d.getFullYear()}-${n}`;
  };

  const tabs = [
    { id:'all',          label:'Tất cả',       count: riskEvents.length },
    { id:'draft',        label:'Nháp',          count: riskEvents.filter(e=>e.status==='draft').length },
    { id:'declared',     label:'Khai báo',      count: riskEvents.filter(e=>e.status==='declared').length },
    { id:'under_review', label:'Xem xét',       count: riskEvents.filter(e=>e.status==='under_review').length },
    { id:'closed',       label:'Đã đóng',       count: riskEvents.filter(e=>e.status==='closed').length },
  ];

  const filtered = riskEvents.filter(e => {
    const matchTab = tab === 'all' || e.status === tab;
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.code?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const saveEvent = async () => {
    if (!form.title.trim() || !form.event_date) { addToast('Vui lòng nhập tiêu đề và ngày xảy ra', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        code: genCode(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_date: form.event_date,
        discovery_date: form.discovery_date || null,
        category_id: form.category_id || null,
        department_id: form.department_id || null,
        reporter_id: currentUser.id,
        status: 'draft',
        severity: form.severity,
        financial_impact: form.financial_impact ? Number(form.financial_impact) : null,
        root_cause: form.root_cause.trim() || null,
        corrective_action: form.corrective_action.trim() || null,
        assignee_id: form.assignee_id || null,
      };
      const { data, error } = await supabase.from('risk_events').insert(payload).select().single();
      if (error) throw error;
      setRiskEvents(prev => [data, ...prev]);
      setShowForm(false);
      setForm(emptyForm());
      addToast('Tạo SKKR thành công', 'success');
    } catch(err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  const doAction = async () => {
    if (!actionModal) return;
    const { event, nextStatus } = actionModal;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updates = { status: nextStatus, updated_at: now };
      if (nextStatus === 'under_review') updates.reviewed_by = currentUser.id;
      if (nextStatus === 'under_review') updates.reviewed_at = now;
      if (nextStatus === 'closed') updates.closed_at = now;

      // Log
      const log = { event_id: event.id, action: nextStatus, comment: actionComment.trim() || null, performed_by: currentUser.id };

      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('risk_events').update(updates).eq('id', event.id),
        supabase.from('risk_event_logs').insert(log),
      ]);
      if (e1) throw e1;

      setRiskEvents(prev => prev.map(e => e.id === event.id ? { ...e, ...updates } : e));
      if (selected?.id === event.id) setSelected({ ...selected, ...updates });
      setActionModal(null);
      setActionComment('');
      addToast(`${ACTION_LABELS[nextStatus]?.label || nextStatus} thành công`, 'success');
    } catch(err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  const canDoAction = (event, nextStatus) => {
    if (nextStatus === 'declared')     return can.create && event.reporter_id === currentUser.id;
    if (nextStatus === 'under_review') return can.review;
    if (nextStatus === 'closed')       return can.approve;
    if (nextStatus === 'rejected')     return can.review || can.approve;
    return false;
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* List panel */}
      <div className="w-96 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">⚠️ Sự Kiện Rủi Ro (SKKR)</h2>
            {can.create && (
              <button onClick={() => { setForm(emptyForm()); setShowForm(true); }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">
                + Khai báo
              </button>
            )}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm SKKR..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-400"/>
          <div className="flex gap-1 mt-2 flex-wrap">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label} {t.count > 0 && <span className="ml-0.5 opacity-70">({t.count})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0
            ? <div className="p-6 text-center text-xs text-gray-400">Không có sự kiện rủi ro nào</div>
            : filtered.map(e => {
                const sev = SEVERITY[e.severity] || SEVERITY.low;
                const st  = STATUS[e.status] || STATUS.draft;
                return (
                  <div key={e.id} onClick={() => setSelected(e)}
                    className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors ${selected?.id === e.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">{e.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{e.code} · {getDeptName(e.department_id)}</div>
                        <div className="text-xs text-gray-400">{e.event_date}</div>
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

      {/* Detail panel */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        {!selected
          ? <div className="h-full flex items-center justify-center text-gray-400 text-sm">Chọn một sự kiện rủi ro để xem chi tiết</div>
          : (() => {
              const st  = STATUS[selected.status] || STATUS.draft;
              const sev = SEVERITY[selected.severity] || SEVERITY.low;
              return (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{selected.code}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${sev.cls}`}>{sev.label}</span>
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">{selected.title}</h2>
                      </div>
                    </div>

                    {/* Workflow actions */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {st.next.map(nextStatus => canDoAction(selected, nextStatus) && (
                        <button key={nextStatus}
                          onClick={() => { setActionModal({event: selected, nextStatus}); setActionComment(''); }}
                          className={`px-3 py-1.5 text-white rounded-xl text-xs font-semibold transition-colors ${ACTION_LABELS[nextStatus]?.btn || 'bg-gray-500 hover:bg-gray-600'}`}>
                          {ACTION_LABELS[nextStatus]?.label || nextStatus}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Thông tin sự kiện</h3>
                      {[
                        { label:'Ngày xảy ra',    val: selected.event_date },
                        { label:'Ngày phát hiện', val: selected.discovery_date },
                        { label:'Phòng ban',       val: getDeptName(selected.department_id) },
                        { label:'Danh mục RR',     val: getCatName(selected.category_id) },
                        { label:'Người khai báo',  val: getUserName(selected.reporter_id) },
                        { label:'Người xử lý',     val: getUserName(selected.assignee_id) },
                        { label:'Tổn thất TC',     val: selected.financial_impact ? `${Number(selected.financial_impact).toLocaleString()} VND` : '—' },
                      ].map(({label,val}) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-500">{label}</span>
                          <span className="font-medium text-gray-800">{val || '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Mô tả & Xử lý</h3>
                      {selected.description && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Mô tả sự kiện</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.description}</p>
                        </div>
                      )}
                      {selected.root_cause && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Nguyên nhân gốc rễ</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.root_cause}</p>
                        </div>
                      )}
                      {selected.corrective_action && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Hành động khắc phục</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.corrective_action}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
        }
      </div>

      {/* Create SKKR Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800">Khai Báo Sự Kiện Rủi Ro (SKKR)</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tiêu đề sự kiện *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  placeholder="Mô tả ngắn gọn về sự kiện rủi ro"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày xảy ra *</label>
                  <input type="date" value={form.event_date} onChange={e => setForm(f => ({...f, event_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày phát hiện</label>
                  <input type="date" value={form.discovery_date} onChange={e => setForm(f => ({...f, discovery_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mức độ nghiêm trọng</label>
                  <select value={form.severity} onChange={e => setForm(f => ({...f, severity: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(SEVERITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Danh mục rủi ro</label>
                  <select value={form.category_id} onChange={e => setForm(f => ({...f, category_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn danh mục --</option>
                    {riskCategories.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phòng ban</label>
                  <select value={form.department_id} onChange={e => setForm(f => ({...f, department_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn phòng ban --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tổn thất tài chính (VND)</label>
                  <input type="number" value={form.financial_impact} onChange={e => setForm(f => ({...f, financial_impact: e.target.value}))}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả chi tiết sự kiện</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  rows={3} placeholder="Mô tả chi tiết về sự kiện xảy ra, bối cảnh, tác động..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nguyên nhân gốc rễ</label>
                <textarea value={form.root_cause} onChange={e => setForm(f => ({...f, root_cause: e.target.value}))}
                  rows={2} placeholder="Nguyên nhân gốc rễ dẫn đến sự kiện (có thể bổ sung sau)"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Hành động khắc phục đề xuất</label>
                <textarea value={form.corrective_action} onChange={e => setForm(f => ({...f, corrective_action: e.target.value}))}
                  rows={2} placeholder="Các biện pháp khắc phục đề xuất"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={saveEvent} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Tạo SKKR'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirm Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800">
                {ACTION_LABELS[actionModal.nextStatus]?.label || actionModal.nextStatus}
              </h3>
              <button onClick={() => setActionModal(null)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">
                Bạn đang thực hiện <strong>{ACTION_LABELS[actionModal.nextStatus]?.label}</strong> cho sự kiện rủi ro:
              </p>
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <div className="font-semibold text-gray-800">{actionModal.event.title}</div>
                <div className="text-gray-500 text-xs mt-0.5">{actionModal.event.code}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú / Nhận xét</label>
                <textarea value={actionComment} onChange={e => setActionComment(e.target.value)}
                  rows={3} placeholder="Nhập ghi chú (tùy chọn)"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setActionModal(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={doAction} disabled={saving}
                  className={`flex-1 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-60 ${ACTION_LABELS[actionModal.nextStatus]?.btn || 'bg-blue-600 hover:bg-blue-700'}`}>
                  {saving ? 'Đang xử lý...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskEvents;
