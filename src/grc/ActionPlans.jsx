import React, { useState } from 'react';
import { supabase } from '../supabase.js';

/* ════════════════════════════════════════════════════════════
   ACTION PLAN — Theo dõi tiến độ khắc phục
════════════════════════════════════════════════════════════ */

const PRIORITY = {
  critical: { label:'Khẩn cấp',    cls:'bg-red-100 text-red-700',        dot:'bg-red-500'    },
  high:     { label:'Cao',          cls:'bg-orange-100 text-orange-700',   dot:'bg-orange-500' },
  medium:   { label:'Trung bình',   cls:'bg-yellow-100 text-yellow-700',   dot:'bg-yellow-400' },
  low:      { label:'Thấp',         cls:'bg-green-100 text-green-700',     dot:'bg-green-400'  },
};

const STATUS_MAP = {
  not_started: { label:'Chưa bắt đầu', cls:'bg-gray-100 text-gray-600'    },
  in_progress: { label:'Đang thực hiện',cls:'bg-blue-100 text-blue-700'   },
  completed:   { label:'Hoàn thành',   cls:'bg-green-100 text-green-700'  },
  overdue:     { label:'Quá hạn',      cls:'bg-red-100 text-red-700'      },
  cancelled:   { label:'Hủy',          cls:'bg-gray-100 text-gray-500'    },
};

const SOURCE_TYPE = {
  finding:    'Findings KT',
  risk_event: 'Sự kiện RR',
  compliance: 'Tuân thủ',
  rcsa:       'RCSA',
};

const emptyForm = () => ({
  title:'', description:'', source_type:'finding', source_id:'',
  priority:'medium', owner_id:'', department_id:'',
  start_date:'', due_date:'',
});

const ActionPlans = ({
  currentUser, departments, users, addToast,
  actionPlans, setActionPlans,
  riskEvents, auditFindings, complianceAssessments,
}) => {
  const [selected,    setSelected]    = useState(null);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(emptyForm());
  const [tab,         setTab]         = useState('all');
  const [saving,      setSaving]      = useState(false);
  const [updateModal, setUpdateModal] = useState(null);
  const [updateNote,  setUpdateNote]  = useState('');
  const [updatePct,   setUpdatePct]   = useState(0);

  const can = {
    create: ['admin','manager'].includes(currentUser.role),
    update: ['admin','manager','employee'].includes(currentUser.role),
    verify: ['admin','director'].includes(currentUser.role),
  };

  const getUserName = id => users.find(u => u.id === id)?.full_name || '—';
  const getDeptName = id => departments.find(d => d.id === id)?.name || '—';

  const genCode = () => `AP-${new Date().getFullYear()}-${(actionPlans.length+1).toString().padStart(3,'0')}`;

  const today = new Date();
  const isOverdue = (ap) => ap.due_date && new Date(ap.due_date) < today && !['completed','cancelled'].includes(ap.status);
  const daysLeft  = (ap) => Math.ceil((new Date(ap.due_date) - today) / 86400000);

  const filtered = actionPlans.filter(a => {
    if (tab === 'all') return true;
    if (tab === 'overdue') return isOverdue(a);
    return a.status === tab;
  });

  const getSourceName = (ap) => {
    if (ap.source_type === 'finding')    return auditFindings.find(f => f.id === ap.source_id)?.title || ap.source_id;
    if (ap.source_type === 'risk_event') return riskEvents.find(e => e.id === ap.source_id)?.title || ap.source_id;
    return ap.source_id || '—';
  };

  const save = async () => {
    if (!form.title.trim() || !form.due_date) { addToast('Vui lòng nhập tiêu đề và ngày hạn', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        code: genCode(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        source_type: form.source_type,
        source_id: form.source_id || null,
        priority: form.priority,
        owner_id: form.owner_id || null,
        department_id: form.department_id || null,
        start_date: form.start_date || null,
        due_date: form.due_date,
        status: 'not_started',
        completion_pct: 0,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('action_plans').insert(payload).select().single();
      if (error) throw error;
      setActionPlans(prev => [data, ...prev]);
      setShowForm(false);
      setForm(emptyForm());
      addToast('Tạo Action Plan thành công', 'success');
    } catch(err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  const saveUpdate = async () => {
    if (!updateModal) return;
    setSaving(true);
    try {
      const pct = Number(updatePct);
      const newStatus = pct === 100 ? 'completed'
        : isOverdue(updateModal) && pct < 100 ? 'overdue'
        : pct > 0 ? 'in_progress' : 'not_started';

      const [updateRes, planRes] = await Promise.all([
        supabase.from('action_plan_updates').insert({
          action_plan_id: updateModal.id,
          update_note: updateNote.trim(),
          completion_pct: pct,
          updated_by: currentUser.id,
        }),
        supabase.from('action_plans').update({
          completion_pct: pct,
          status: newStatus,
          actual_completion_date: pct === 100 ? new Date().toISOString().split('T')[0] : null,
          progress_notes: updateNote.trim(),
          updated_at: new Date().toISOString(),
        }).eq('id', updateModal.id).select().single(),
      ]);
      if (planRes.error) throw planRes.error;
      setActionPlans(prev => prev.map(a => a.id === updateModal.id ? planRes.data : a));
      if (selected?.id === updateModal.id) setSelected(planRes.data);
      setUpdateModal(null);
      setUpdateNote('');
      setUpdatePct(0);
      addToast('Cập nhật tiến độ thành công', 'success');
    } catch(err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  const verify = async (ap) => {
    const updates = { verified_by: currentUser.id, verified_at: new Date().toISOString(), status: 'completed', completion_pct: 100 };
    const { error } = await supabase.from('action_plans').update(updates).eq('id', ap.id);
    if (error) { addToast('Lỗi: ' + error.message, 'error'); return; }
    setActionPlans(prev => prev.map(a => a.id === ap.id ? { ...a, ...updates } : a));
    if (selected?.id === ap.id) setSelected({ ...selected, ...updates });
    addToast('Xác minh hoàn thành Action Plan', 'success');
  };

  const tabs = [
    { id:'all',         label:'Tất cả',     count: actionPlans.length },
    { id:'not_started', label:'Chưa bắt đầu',count: actionPlans.filter(a=>a.status==='not_started').length },
    { id:'in_progress', label:'Đang làm',   count: actionPlans.filter(a=>a.status==='in_progress').length },
    { id:'overdue',     label:'Quá hạn',    count: actionPlans.filter(a=>isOverdue(a)).length },
    { id:'completed',   label:'Hoàn thành', count: actionPlans.filter(a=>a.status==='completed').length },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* List */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">🎯 Action Plan</h2>
            {can.create && (
              <button onClick={() => { setForm(emptyForm()); setShowForm(true); }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">
                + Tạo mới
              </button>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label} {t.count > 0 && <span className={`ml-0.5 opacity-80`}>({t.count})</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0
            ? <div className="p-6 text-center text-xs text-gray-400">Không có action plan nào</div>
            : filtered.map(a => {
                const pri = PRIORITY[a.priority] || PRIORITY.medium;
                const od  = isOverdue(a);
                const st  = od ? STATUS_MAP.overdue : STATUS_MAP[a.status] || STATUS_MAP.not_started;
                return (
                  <div key={a.id} onClick={() => setSelected(a)}
                    className={`px-4 py-3 cursor-pointer hover:bg-blue-50 ${selected?.id === a.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${pri.dot}`}/>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">{a.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{a.code} · {SOURCE_TYPE[a.source_type]}</div>
                        {a.due_date && (
                          <div className={`text-xs mt-0.5 font-medium ${od ? 'text-red-600' : 'text-gray-400'}`}>
                            {od ? `⏰ Quá hạn ${Math.abs(daysLeft(a))}d` : `Hạn: ${a.due_date}`}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                        <span className="text-xs text-gray-400">{a.completion_pct}%</span>
                      </div>
                    </div>
                    {/* Mini progress */}
                    <div className="mt-1.5 ml-4 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${od && a.completion_pct < 100 ? 'bg-red-400' : 'bg-blue-500'}`}
                        style={{width:`${a.completion_pct||0}%`}}/>
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
          ? <div className="h-full flex items-center justify-center text-gray-400 text-sm">Chọn action plan để xem chi tiết</div>
          : (() => {
              const pri = PRIORITY[selected.priority] || PRIORITY.medium;
              const od  = isOverdue(selected);
              const st  = od ? STATUS_MAP.overdue : STATUS_MAP[selected.status] || STATUS_MAP.not_started;
              return (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{selected.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pri.cls}`}>{pri.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{SOURCE_TYPE[selected.source_type]}</span>
                    </div>
                    <h2 className="text-base font-bold text-gray-800">{selected.title}</h2>

                    {/* Progress */}
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Tiến độ</span>
                        <span className="font-bold text-gray-800">{selected.completion_pct || 0}%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${od && (selected.completion_pct||0) < 100 ? 'bg-red-400' : 'bg-blue-500'}`}
                          style={{width:`${selected.completion_pct||0}%`}}/>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {can.update && !['completed','cancelled'].includes(selected.status) && (
                        <button onClick={() => { setUpdateModal(selected); setUpdateNote(''); setUpdatePct(selected.completion_pct || 0); }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">
                          Cập nhật tiến độ
                        </button>
                      )}
                      {can.verify && selected.status !== 'completed' && selected.completion_pct === 100 && (
                        <button onClick={() => verify(selected)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700">
                          Xác minh hoàn thành
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Thông tin</h3>
                      {[
                        { label:'Người phụ trách',   val: getUserName(selected.owner_id)      },
                        { label:'Phòng ban',          val: getDeptName(selected.department_id) },
                        { label:'Ngày bắt đầu',       val: selected.start_date                 },
                        { label:'Hạn hoàn thành',     val: selected.due_date, cls: od ? 'text-red-600 font-bold' : '' },
                        { label:'Ngày hoàn thành TT', val: selected.actual_completion_date     },
                        { label:'Người xác minh',     val: getUserName(selected.verified_by)   },
                        { label:'Nguồn gốc',          val: getSourceName(selected)             },
                      ].map(({label,val,cls}) => (
                        <div key={label} className="flex justify-between text-sm gap-2">
                          <span className="text-gray-500 flex-shrink-0">{label}</span>
                          <span className={`font-medium text-gray-800 text-right ${cls || ''}`}>{val || '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Mô tả & Ghi chú</h3>
                      {selected.description && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Mô tả</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.description}</p>
                        </div>
                      )}
                      {selected.progress_notes && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Ghi chú tiến độ gần nhất</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-blue-50 rounded-lg p-2">{selected.progress_notes}</p>
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
              <h3 className="font-bold text-gray-800">Tạo Action Plan</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tiêu đề *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  placeholder="Mô tả hành động cần thực hiện"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Loại nguồn</label>
                  <select value={form.source_type} onChange={e => setForm(f => ({...f, source_type: e.target.value, source_id:''}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(SOURCE_TYPE).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ưu tiên</label>
                  <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(PRIORITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Người phụ trách</label>
                  <select value={form.owner_id} onChange={e => setForm(f => ({...f, owner_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phòng ban</label>
                  <select value={form.department_id} onChange={e => setForm(f => ({...f, department_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Hạn hoàn thành *</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  rows={2} placeholder="Mô tả chi tiết các bước thực hiện"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Tạo Action Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Progress Modal */}
      {updateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setUpdateModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800">Cập Nhật Tiến Độ</h3>
              <button onClick={() => setUpdateModal(null)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <div className="font-semibold text-gray-800">{updateModal.title}</div>
                <div className="text-gray-500 text-xs mt-0.5">{updateModal.code}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tiến độ: <span className="text-blue-600">{updatePct}%</span>
                </label>
                <input type="range" min={0} max={100} step={5} value={updatePct}
                  onChange={e => setUpdatePct(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"/>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú cập nhật *</label>
                <textarea value={updateNote} onChange={e => setUpdateNote(e.target.value)}
                  rows={3} placeholder="Mô tả công việc đã thực hiện, kết quả..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setUpdateModal(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={saveUpdate} disabled={saving || !updateNote.trim()}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionPlans;
