import React, { useState } from 'react';
import { supabase } from '../supabase.js';

/* ════════════════════════════════════════════════════════════
   KẾ HOẠCH KIỂM TRA / KIỂM TOÁN (Audit Plans) — Workflow WF-3
════════════════════════════════════════════════════════════ */

const AUDIT_TYPE = {
  internal:        { label:'Kiểm toán nội bộ', cls:'bg-blue-100 text-blue-700'   },
  external:        { label:'Kiểm toán độc lập', cls:'bg-purple-100 text-purple-700'},
  regulatory:      { label:'Thanh tra Nhà nước',cls:'bg-red-100 text-red-700'     },
  self_assessment: { label:'Tự kiểm tra',        cls:'bg-teal-100 text-teal-700'  },
};

const STATUS_MAP = {
  planned:     { label:'Kế hoạch',    cls:'bg-gray-100 text-gray-600',    next:['in_progress','cancelled'] },
  in_progress: { label:'Đang kiểm',  cls:'bg-blue-100 text-blue-700',    next:['completed']               },
  completed:   { label:'Hoàn thành', cls:'bg-green-100 text-green-700',  next:[]                          },
  cancelled:   { label:'Hủy',        cls:'bg-red-100 text-red-700',      next:[]                          },
};

const emptyForm = () => ({
  title:'', audit_type:'internal', scope:'', objectives:'', methodology:'',
  start_date:'', end_date:'', lead_auditor_id:'', department_ids:[],
});

const AuditPlans = ({ currentUser, departments, users, addToast, auditPlans, setAuditPlans }) => {
  const canManage = ['admin','director'].includes(currentUser.role);

  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(emptyForm());
  const [saving,   setSaving]   = useState(false);
  const [tab,      setTab]      = useState('all');

  const getUserName = id => users.find(u => u.id === id)?.full_name || '—';
  const getDeptName = id => departments.find(d => d.id === id)?.name || id;

  const genCode = () => `AUD-${new Date().getFullYear()}-${(auditPlans.length+1).toString().padStart(3,'0')}`;

  const filtered = auditPlans.filter(p =>
    tab === 'all' || p.status === tab
  );

  const toggleDept = (deptId) => {
    setForm(f => ({
      ...f,
      department_ids: f.department_ids.includes(deptId)
        ? f.department_ids.filter(d => d !== deptId)
        : [...f.department_ids, deptId],
    }));
  };

  const save = async () => {
    if (!form.title.trim()) { addToast('Vui lòng nhập tên kế hoạch', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        code: genCode(),
        title: form.title.trim(),
        audit_type: form.audit_type,
        scope: form.scope.trim() || null,
        objectives: form.objectives.trim() || null,
        methodology: form.methodology.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        lead_auditor_id: form.lead_auditor_id || null,
        department_ids: form.department_ids,
        team_members: [],
        status: 'planned',
      };
      const { data, error } = await supabase.from('audit_plans').insert(payload).select().single();
      if (error) throw error;
      setAuditPlans(prev => [data, ...prev]);
      setShowForm(false);
      setForm(emptyForm());
      addToast('Tạo kế hoạch kiểm tra thành công', 'success');
    } catch(err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  const doAction = async (plan, nextStatus) => {
    const { error } = await supabase.from('audit_plans').update({ status: nextStatus }).eq('id', plan.id);
    if (error) { addToast('Lỗi: ' + error.message, 'error'); return; }
    setAuditPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: nextStatus } : p));
    if (selected?.id === plan.id) setSelected({ ...selected, status: nextStatus });
    addToast('Cập nhật trạng thái thành công', 'success');
  };

  const tabs = [
    { id:'all',         label:'Tất cả',    count: auditPlans.length },
    { id:'planned',     label:'Kế hoạch',  count: auditPlans.filter(p=>p.status==='planned').length },
    { id:'in_progress', label:'Đang kiểm', count: auditPlans.filter(p=>p.status==='in_progress').length },
    { id:'completed',   label:'Hoàn thành',count: auditPlans.filter(p=>p.status==='completed').length },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* List */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">📋 Kế Hoạch Kiểm Tra</h2>
            {canManage && (
              <button onClick={() => { setForm(emptyForm()); setShowForm(true); }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">
                + Lập kế hoạch
              </button>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
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
            ? <div className="p-6 text-center text-xs text-gray-400">Không có kế hoạch kiểm tra nào</div>
            : filtered.map(p => {
                const at = AUDIT_TYPE[p.audit_type] || AUDIT_TYPE.internal;
                const st = STATUS_MAP[p.status] || STATUS_MAP.planned;
                return (
                  <div key={p.id} onClick={() => setSelected(p)}
                    className={`px-4 py-3 cursor-pointer hover:bg-blue-50 ${selected?.id === p.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">{p.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{p.code}</div>
                        {p.start_date && <div className="text-xs text-gray-400">{p.start_date} → {p.end_date || '...'}</div>}
                      </div>
                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${at.cls}`}>{at.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${st.cls}`}>{st.label}</span>
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
          ? <div className="h-full flex items-center justify-center text-gray-400 text-sm">Chọn kế hoạch kiểm tra để xem chi tiết</div>
          : (() => {
              const at = AUDIT_TYPE[selected.audit_type] || AUDIT_TYPE.internal;
              const st = STATUS_MAP[selected.status] || STATUS_MAP.planned;
              return (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{selected.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${at.cls}`}>{at.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">{selected.title}</h2>

                    {/* Actions */}
                    {canManage && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {st.next.map(nextStatus => (
                          <button key={nextStatus} onClick={() => doAction(selected, nextStatus)}
                            className={`px-3 py-1.5 text-white rounded-xl text-xs font-semibold transition-colors
                              ${nextStatus === 'in_progress' ? 'bg-blue-600 hover:bg-blue-700'
                              : nextStatus === 'completed'   ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-red-500 hover:bg-red-600'}`}>
                            {nextStatus === 'in_progress' ? 'Bắt đầu kiểm tra'
                            : nextStatus === 'completed'  ? 'Hoàn thành kiểm tra'
                            : 'Hủy kế hoạch'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Thông tin kế hoạch</h3>
                      {[
                        { label:'Ngày bắt đầu',   val: selected.start_date },
                        { label:'Ngày kết thúc',  val: selected.end_date },
                        { label:'Trưởng đoàn',    val: getUserName(selected.lead_auditor_id) },
                        { label:'Đơn vị kiểm tra',val: (selected.department_ids || []).map(getDeptName).join(', ') || '—' },
                      ].map(({label,val}) => (
                        <div key={label} className="flex justify-between text-sm gap-2">
                          <span className="text-gray-500 flex-shrink-0">{label}</span>
                          <span className="font-medium text-gray-800 text-right">{val || '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Mục tiêu & Phạm vi</h3>
                      {selected.scope && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Phạm vi kiểm tra</div>
                          <p className="text-sm text-gray-700">{selected.scope}</p>
                        </div>
                      )}
                      {selected.objectives && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Mục tiêu</div>
                          <p className="text-sm text-gray-700">{selected.objectives}</p>
                        </div>
                      )}
                      {selected.methodology && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Phương pháp</div>
                          <p className="text-sm text-gray-700">{selected.methodology}</p>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800">Lập Kế Hoạch Kiểm Tra / Kiểm Toán</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên kế hoạch *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  placeholder="VD: Kiểm toán nội bộ Q3 2024 - Phòng Tín Dụng"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Loại kiểm tra</label>
                  <select value={form.audit_type} onChange={e => setForm(f => ({...f, audit_type: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(AUDIT_TYPE).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Trưởng đoàn</label>
                  <select value={form.lead_auditor_id} onChange={e => setForm(f => ({...f, lead_auditor_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn trưởng đoàn --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày bắt đầu</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày kết thúc</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
              {departments.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Đơn vị được kiểm tra</label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2">
                    {departments.map(d => (
                      <label key={d.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={form.department_ids.includes(d.id)} onChange={() => toggleDept(d.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300"/>
                        <span className="text-gray-700">{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phạm vi kiểm tra</label>
                <textarea value={form.scope} onChange={e => setForm(f => ({...f, scope: e.target.value}))}
                  rows={2} placeholder="Mô tả phạm vi, giới hạn của cuộc kiểm tra"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mục tiêu kiểm tra</label>
                <textarea value={form.objectives} onChange={e => setForm(f => ({...f, objectives: e.target.value}))}
                  rows={2} placeholder="Mục tiêu, nội dung trọng tâm của cuộc kiểm tra"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Tạo kế hoạch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditPlans;
