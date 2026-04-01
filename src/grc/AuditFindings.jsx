import React, { useState } from 'react';
import { supabase } from '../supabase.js';

/* ════════════════════════════════════════════════════════════
   FINDINGS KIỂM TOÁN (Audit Findings)
════════════════════════════════════════════════════════════ */

const FINDING_TYPE = {
  major:         { label:'Trọng yếu',      cls:'bg-red-100 text-red-700'     },
  minor:         { label:'Thứ yếu',        cls:'bg-orange-100 text-orange-700'},
  observation:   { label:'Quan sát',       cls:'bg-yellow-100 text-yellow-700'},
  best_practice: { label:'Thực hành tốt',  cls:'bg-blue-100 text-blue-700'   },
};

const SEVERITY = {
  critical: { label:'Nghiêm trọng', cls:'bg-red-600 text-white'        },
  high:     { label:'Cao',          cls:'bg-orange-500 text-white'      },
  medium:   { label:'Trung bình',   cls:'bg-yellow-400 text-gray-900'   },
  low:      { label:'Thấp',         cls:'bg-green-400 text-gray-900'    },
};

const STATUS_MAP = {
  open:        { label:'Mở',            cls:'bg-red-100 text-red-700'    },
  in_progress: { label:'Đang xử lý',   cls:'bg-blue-100 text-blue-700'  },
  closed:      { label:'Đã đóng',       cls:'bg-green-100 text-green-700'},
  deferred:    { label:'Tạm hoãn',      cls:'bg-gray-100 text-gray-600'  },
};

const emptyForm = () => ({
  title:'', description:'', audit_plan_id:'', finding_type:'minor',
  severity:'medium', department_id:'', risk_category_id:'',
  root_cause:'', recommendation:'', target_date:'', assignee_id:'',
});

const AuditFindings = ({
  currentUser, departments, users, addToast, riskCategories,
  auditFindings, setAuditFindings, auditPlans,
  actionPlans, setActionPlans,
}) => {
  const canManage = ['admin','director','manager'].includes(currentUser.role);

  const [selected, setSelected]   = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [form,     setForm]       = useState(emptyForm());
  const [saving,   setSaving]     = useState(false);
  const [tab,      setTab]        = useState('all');
  const [respModal,setRespModal]  = useState(null); // management response
  const [respText, setRespText]   = useState('');

  const getUserName = id => users.find(u => u.id === id)?.full_name || '—';
  const getDeptName = id => departments.find(d => d.id === id)?.name || '—';
  const getPlanName = id => auditPlans.find(p => p.id === id)?.title || '—';

  const genCode = () => `FND-${new Date().getFullYear()}-${(auditFindings.length+1).toString().padStart(3,'0')}`;

  const filtered = auditFindings.filter(f =>
    tab === 'all' || f.status === tab
  );

  const save = async () => {
    if (!form.title.trim() || !form.audit_plan_id) {
      addToast('Vui lòng nhập tiêu đề và chọn kế hoạch kiểm tra', 'error'); return;
    }
    setSaving(true);
    try {
      const payload = {
        code: genCode(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        audit_plan_id: form.audit_plan_id,
        finding_type: form.finding_type,
        severity: form.severity,
        department_id: form.department_id || null,
        risk_category_id: form.risk_category_id || null,
        root_cause: form.root_cause.trim() || null,
        recommendation: form.recommendation.trim() || null,
        target_date: form.target_date || null,
        assignee_id: form.assignee_id || null,
        status: 'open',
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('audit_findings').insert(payload).select().single();
      if (error) throw error;
      setAuditFindings(prev => [data, ...prev]);
      setShowForm(false);
      setForm(emptyForm());
      addToast('Ghi nhận finding thành công', 'success');
    } catch(err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  const updateStatus = async (finding, newStatus) => {
    const updates = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'closed') {
      updates.closed_date  = new Date().toISOString().split('T')[0];
      updates.verified_by  = currentUser.id;
    }
    const { error } = await supabase.from('audit_findings').update(updates).eq('id', finding.id);
    if (error) { addToast('Lỗi: ' + error.message, 'error'); return; }
    setAuditFindings(prev => prev.map(f => f.id === finding.id ? {...f,...updates} : f));
    if (selected?.id === finding.id) setSelected({...selected,...updates});
    addToast('Cập nhật trạng thái thành công', 'success');
  };

  const saveResponse = async () => {
    if (!respModal) return;
    const updates = { management_response: respText.trim(), updated_at: new Date().toISOString() };
    const { error } = await supabase.from('audit_findings').update(updates).eq('id', respModal.id);
    if (error) { addToast('Lỗi: ' + error.message, 'error'); return; }
    setAuditFindings(prev => prev.map(f => f.id === respModal.id ? {...f,...updates} : f));
    if (selected?.id === respModal.id) setSelected({...selected,...updates});
    setRespModal(null);
    setRespText('');
    addToast('Lưu phản hồi thành công', 'success');
  };

  const createActionPlan = async (finding) => {
    const code = `AP-${new Date().getFullYear()}-${(actionPlans.length+1).toString().padStart(3,'0')}`;
    const payload = {
      code,
      title: `Khắc phục finding: ${finding.title}`,
      description: finding.recommendation || null,
      source_type: 'finding',
      source_id: finding.id,
      priority: finding.severity === 'critical' ? 'critical' : finding.severity === 'high' ? 'high' : 'medium',
      owner_id: finding.assignee_id || null,
      department_id: finding.department_id || null,
      due_date: finding.target_date || null,
      status: 'not_started',
      completion_pct: 0,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('action_plans').insert(payload).select().single();
    if (error) { addToast('Lỗi tạo action plan: ' + error.message, 'error'); return; }
    setActionPlans(prev => [...prev, data]);
    addToast('Tạo Action Plan từ finding thành công', 'success');
  };

  const tabs = [
    { id:'all',         label:'Tất cả',    count: auditFindings.length },
    { id:'open',        label:'Mở',        count: auditFindings.filter(f=>f.status==='open').length },
    { id:'in_progress', label:'Đang xử lý',count: auditFindings.filter(f=>f.status==='in_progress').length },
    { id:'closed',      label:'Đã đóng',   count: auditFindings.filter(f=>f.status==='closed').length },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* List */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">🔍 Findings Kiểm Toán</h2>
            {canManage && (
              <button onClick={() => { setForm(emptyForm()); setShowForm(true); }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">
                + Ghi nhận
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
            ? <div className="p-6 text-center text-xs text-gray-400">Không có findings nào</div>
            : filtered.map(f => {
                const ft = FINDING_TYPE[f.finding_type] || FINDING_TYPE.minor;
                const sv = SEVERITY[f.severity] || SEVERITY.medium;
                const st = STATUS_MAP[f.status] || STATUS_MAP.open;
                return (
                  <div key={f.id} onClick={() => setSelected(f)}
                    className={`px-4 py-3 cursor-pointer hover:bg-blue-50 ${selected?.id === f.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">{f.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{f.code} · {getDeptName(f.department_id)}</div>
                      </div>
                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${sv.cls}`}>{f.severity?.toUpperCase()}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
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
          ? <div className="h-full flex items-center justify-center text-gray-400 text-sm">Chọn finding để xem chi tiết</div>
          : (() => {
              const ft = FINDING_TYPE[selected.finding_type] || FINDING_TYPE.minor;
              const sv = SEVERITY[selected.severity] || SEVERITY.medium;
              const st = STATUS_MAP[selected.status] || STATUS_MAP.open;
              const existingAP = actionPlans.some(a => a.source_type === 'finding' && a.source_id === selected.id);
              return (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{selected.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${sv.cls}`}>{sv.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ft.cls}`}>{ft.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">{selected.title}</h2>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {selected.status === 'open' && canManage && (
                        <button onClick={() => updateStatus(selected, 'in_progress')}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">
                          Tiếp nhận xử lý
                        </button>
                      )}
                      {selected.status === 'in_progress' && canManage && (
                        <button onClick={() => updateStatus(selected, 'closed')}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700">
                          Đóng Finding
                        </button>
                      )}
                      {['admin','manager'].includes(currentUser.role) && !selected.management_response && (
                        <button onClick={() => { setRespModal(selected); setRespText(''); }}
                          className="px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700">
                          Phản hồi đơn vị
                        </button>
                      )}
                      {canManage && !existingAP && ['major','minor'].includes(selected.finding_type) && (
                        <button onClick={() => createActionPlan(selected)}
                          className="px-3 py-1.5 bg-orange-500 text-white rounded-xl text-xs font-semibold hover:bg-orange-600">
                          Tạo Action Plan
                        </button>
                      )}
                      {existingAP && (
                        <span className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-xl font-medium">✓ Đã có Action Plan</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Thông tin finding</h3>
                      {[
                        { label:'Kế hoạch KT',  val: getPlanName(selected.audit_plan_id) },
                        { label:'Phòng ban',     val: getDeptName(selected.department_id) },
                        { label:'Người phụ trách',val: getUserName(selected.assignee_id) },
                        { label:'Người xác minh',val: getUserName(selected.verified_by)  },
                        { label:'Hạn xử lý',    val: selected.target_date               },
                        { label:'Ngày đóng',    val: selected.closed_date               },
                      ].map(({label,val}) => (
                        <div key={label} className="flex justify-between text-sm gap-2">
                          <span className="text-gray-500 flex-shrink-0">{label}</span>
                          <span className="font-medium text-gray-800 text-right">{val || '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Chi tiết</h3>
                      {selected.description && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Mô tả</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.description}</p>
                        </div>
                      )}
                      {selected.root_cause && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Nguyên nhân</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.root_cause}</p>
                        </div>
                      )}
                      {selected.recommendation && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Kiến nghị</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.recommendation}</p>
                        </div>
                      )}
                      {selected.management_response && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Phản hồi đơn vị</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-purple-50 rounded-lg p-2">{selected.management_response}</p>
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
              <h3 className="font-bold text-gray-800">Ghi Nhận Finding Kiểm Toán</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tiêu đề finding *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  placeholder="Mô tả ngắn gọn về phát hiện kiểm toán"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Kế hoạch kiểm tra *</label>
                  <select value={form.audit_plan_id} onChange={e => setForm(f => ({...f, audit_plan_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn kế hoạch KT --</option>
                    {auditPlans.map(p => <option key={p.id} value={p.id}>{p.code} - {p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phòng ban</label>
                  <select value={form.department_id} onChange={e => setForm(f => ({...f, department_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn phòng ban --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Loại finding</label>
                  <select value={form.finding_type} onChange={e => setForm(f => ({...f, finding_type: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(FINDING_TYPE).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mức độ</label>
                  <select value={form.severity} onChange={e => setForm(f => ({...f, severity: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(SEVERITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Hạn xử lý</label>
                  <input type="date" value={form.target_date} onChange={e => setForm(f => ({...f, target_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Người phụ trách</label>
                  <select value={form.assignee_id} onChange={e => setForm(f => ({...f, assignee_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Danh mục rủi ro</label>
                  <select value={form.risk_category_id} onChange={e => setForm(f => ({...f, risk_category_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn danh mục --</option>
                    {riskCategories.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả chi tiết</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  rows={2} placeholder="Mô tả chi tiết về finding..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Kiến nghị</label>
                <textarea value={form.recommendation} onChange={e => setForm(f => ({...f, recommendation: e.target.value}))}
                  rows={2} placeholder="Kiến nghị của kiểm toán viên"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Ghi nhận finding'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Management Response Modal */}
      {respModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setRespModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800">Phản Hồi Đơn Vị</h3>
              <button onClick={() => setRespModal(null)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <div className="font-semibold text-gray-800">{respModal.title}</div>
                <div className="text-gray-500 text-xs mt-0.5">{respModal.code}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phản hồi của đơn vị</label>
                <textarea value={respText} onChange={e => setRespText(e.target.value)}
                  rows={4} placeholder="Nhập phản hồi, giải thích hoặc kế hoạch xử lý của đơn vị..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRespModal(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={saveResponse}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700">
                  Lưu phản hồi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditFindings;
