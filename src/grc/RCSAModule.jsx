import React, { useState } from 'react';
import { supabase } from '../supabase.js';

/* ════════════════════════════════════════════════════════════
   RCSA — Risk & Control Self-Assessment — Workflow WF-2
   draft → in_progress → submitted → reviewed → approved
════════════════════════════════════════════════════════════ */

const CONTROL_EFF = {
  adequate:   { label:'Hiệu quả',      cls:'bg-green-100 text-green-700',  score: 0.4 },
  partial:    { label:'Một phần',      cls:'bg-yellow-100 text-yellow-700',score: 0.6 },
  inadequate: { label:'Chưa hiệu quả', cls:'bg-red-100 text-red-700',      score: 1.0 },
};

const RISK_LEVEL = {
  low:      { label:'Thấp',       cls:'bg-green-100 text-green-700',   range:[1,4]   },
  medium:   { label:'Trung bình', cls:'bg-yellow-100 text-yellow-700', range:[5,9]   },
  high:     { label:'Cao',        cls:'bg-orange-100 text-orange-700', range:[10,14] },
  critical: { label:'Nghiêm trọng',cls:'bg-red-100 text-red-700',     range:[15,25] },
};

const STATUS_MAP = {
  draft:       { label:'Nháp',         cls:'bg-gray-100 text-gray-600',    next:['in_progress']    },
  in_progress: { label:'Đang điền',    cls:'bg-blue-100 text-blue-700',    next:['submitted']      },
  submitted:   { label:'Đã nộp',       cls:'bg-purple-100 text-purple-700',next:['reviewed','in_progress'] },
  reviewed:    { label:'Đã rà soát',   cls:'bg-yellow-100 text-yellow-700',next:['approved','in_progress'] },
  approved:    { label:'Đã phê duyệt', cls:'bg-green-100 text-green-700',  next:[]                 },
};

const scoreToLevel = (score) => {
  if (score >= 15) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 5)  return 'medium';
  return 'low';
};

const emptySession = () => ({
  title:'', period:'', department_id:'', assessor_id:'', reviewer_id:'', approver_id:'',
  start_date:'', due_date:'',
});

const emptyItem = () => ({
  risk_category_id:'', risk_description:'',
  inherent_likelihood:3, inherent_impact:3,
  control_description:'', control_effectiveness:'partial',
  residual_likelihood:2, residual_impact:2, notes:'',
});

const RCSAModule = ({
  currentUser, departments, users, addToast, riskCategories,
  rcsaSessions, setRcsaSessions,
  rcsaItems, setRcsaItems,
  actionPlans, setActionPlans,
}) => {
  const canManage  = ['admin','manager'].includes(currentUser.role);
  const canApprove = ['admin','director'].includes(currentUser.role);

  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionItems,    setSessionItems]    = useState([]);
  const [showNewSession,  setShowNewSession]  = useState(false);
  const [sessionForm,     setSessionForm]     = useState(emptySession());
  const [showAddItem,     setShowAddItem]     = useState(false);
  const [itemForm,        setItemForm]        = useState(emptyItem());
  const [saving,          setSaving]          = useState(false);
  const [viewTab,         setViewTab]         = useState('all');

  const getUserName  = id => users.find(u => u.id === id)?.full_name || '—';
  const getDeptName  = id => departments.find(d => d.id === id)?.name || '—';
  const getCatName   = id => riskCategories.find(c => c.id === id)?.name || '—';

  const genCode = () => `RCSA-${sessionForm.period || new Date().getFullYear()}-${(rcsaSessions.length+1).toString().padStart(3,'0')}`;

  const selectSession = async (session) => {
    setSelectedSession(session);
    // Load items for this session
    const sessionSpecificItems = rcsaItems.filter(i => i.session_id === session.id);
    setSessionItems(sessionSpecificItems);
  };

  const saveSession = async () => {
    if (!sessionForm.title.trim() || !sessionForm.period.trim()) {
      addToast('Vui lòng nhập tên và kỳ đánh giá', 'error'); return;
    }
    setSaving(true);
    try {
      const payload = {
        code: genCode(),
        title: sessionForm.title.trim(),
        period: sessionForm.period.trim(),
        department_id: sessionForm.department_id || null,
        assessor_id: sessionForm.assessor_id || currentUser.id,
        reviewer_id: sessionForm.reviewer_id || null,
        approver_id: sessionForm.approver_id || null,
        start_date: sessionForm.start_date || null,
        due_date: sessionForm.due_date || null,
        status: 'draft',
      };
      const { data, error } = await supabase.from('rcsa_sessions').insert(payload).select().single();
      if (error) throw error;
      setRcsaSessions(prev => [data, ...prev]);
      setShowNewSession(false);
      setSessionForm(emptySession());
      addToast('Tạo đợt RCSA thành công', 'success');
    } catch(err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  const saveItem = async () => {
    if (!itemForm.risk_description.trim()) { addToast('Vui lòng nhập mô tả rủi ro', 'error'); return; }
    setSaving(true);
    try {
      const inh_score = Number(itemForm.inherent_likelihood) * Number(itemForm.inherent_impact);
      const res_score = Number(itemForm.residual_likelihood) * Number(itemForm.residual_impact);
      const payload = {
        session_id: selectedSession.id,
        risk_category_id: itemForm.risk_category_id || null,
        risk_description: itemForm.risk_description.trim(),
        inherent_likelihood: Number(itemForm.inherent_likelihood),
        inherent_impact: Number(itemForm.inherent_impact),
        inherent_score: inh_score,
        control_description: itemForm.control_description.trim() || null,
        control_effectiveness: itemForm.control_effectiveness,
        residual_likelihood: Number(itemForm.residual_likelihood),
        residual_impact: Number(itemForm.residual_impact),
        residual_score: res_score,
        risk_level: scoreToLevel(res_score),
        action_required: res_score >= 10,
        notes: itemForm.notes.trim() || null,
      };
      const { data, error } = await supabase.from('rcsa_items').insert(payload).select().single();
      if (error) throw error;
      setSessionItems(prev => [...prev, data]);
      setRcsaItems(prev => [...prev, data]);
      setShowAddItem(false);
      setItemForm(emptyItem());
      addToast('Thêm mục RCSA thành công', 'success');
    } catch(err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  const doAction = async (session, nextStatus) => {
    const updates = { status: nextStatus };
    if (nextStatus === 'submitted')  updates.submitted_at = new Date().toISOString();
    if (nextStatus === 'approved')   updates.approved_at  = new Date().toISOString();

    const { error } = await supabase.from('rcsa_sessions').update(updates).eq('id', session.id);
    if (error) { addToast('Lỗi: ' + error.message, 'error'); return; }
    setRcsaSessions(prev => prev.map(s => s.id === session.id ? {...s,...updates} : s));
    if (selectedSession?.id === session.id) setSelectedSession({...selectedSession,...updates});

    // Auto-create action plans for high/critical items when approved
    if (nextStatus === 'approved') {
      const highItems = sessionItems.filter(i => ['high','critical'].includes(i.risk_level));
      for (const item of highItems) {
        const hasAP = actionPlans.some(a => a.source_type === 'rcsa' && a.source_id === item.id);
        if (!hasAP) {
          const code = `AP-${new Date().getFullYear()}-${(actionPlans.length+1).toString().padStart(3,'0')}`;
          const { data } = await supabase.from('action_plans').insert({
            code,
            title: `RCSA: Kiểm soát rủi ro "${item.risk_description.substring(0,50)}"`,
            source_type: 'rcsa',
            source_id: item.id,
            priority: item.risk_level === 'critical' ? 'critical' : 'high',
            department_id: session.department_id || null,
            status: 'not_started',
            completion_pct: 0,
            updated_at: new Date().toISOString(),
          }).select().single();
          if (data) setActionPlans(prev => [...prev, data]);
        }
      }
      if (highItems.length > 0) {
        addToast(`Đã tạo ${highItems.length} Action Plan cho rủi ro cao/nghiêm trọng`, 'info');
      }
    }
    addToast('Cập nhật trạng thái thành công', 'success');
  };

  const filteredSessions = rcsaSessions.filter(s =>
    viewTab === 'all' || s.status === viewTab
  );

  const tabs = [
    { id:'all',         label:'Tất cả',    count: rcsaSessions.length },
    { id:'draft',       label:'Nháp',      count: rcsaSessions.filter(s=>s.status==='draft').length },
    { id:'in_progress', label:'Đang điền', count: rcsaSessions.filter(s=>s.status==='in_progress').length },
    { id:'submitted',   label:'Đã nộp',    count: rcsaSessions.filter(s=>s.status==='submitted').length },
    { id:'approved',    label:'Đã duyệt',  count: rcsaSessions.filter(s=>s.status==='approved').length },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Session List */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">🧮 RCSA</h2>
            {canManage && (
              <button onClick={() => { setSessionForm(emptySession()); setShowNewSession(true); }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">
                + Tạo đợt
              </button>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setViewTab(t.id)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${viewTab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filteredSessions.length === 0
            ? <div className="p-6 text-center text-xs text-gray-400">Chưa có đợt RCSA nào</div>
            : filteredSessions.map(s => {
                const st = STATUS_MAP[s.status] || STATUS_MAP.draft;
                return (
                  <div key={s.id} onClick={() => selectSession(s)}
                    className={`px-4 py-3 cursor-pointer hover:bg-blue-50 ${selectedSession?.id === s.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                    <div className="font-semibold text-gray-800 text-sm truncate">{s.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.code} · {s.period}</div>
                    <div className="text-xs text-gray-400">{getDeptName(s.department_id)}</div>
                    <span className={`mt-1 inline-block text-xs px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                );
              })
          }
        </div>
      </div>

      {/* RCSA Detail */}
      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        {!selectedSession
          ? <div className="h-full flex items-center justify-center text-gray-400 text-sm">Chọn đợt RCSA để xem và điền đánh giá</div>
          : (() => {
              const st = STATUS_MAP[selectedSession.status] || STATUS_MAP.draft;
              const canEdit = canManage && ['draft','in_progress'].includes(selectedSession.status);
              return (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{selectedSession.code}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{selectedSession.period}</span>
                        </div>
                        <h2 className="text-base font-bold text-gray-800">{selectedSession.title}</h2>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {getDeptName(selectedSession.department_id)} · Người đánh giá: {getUserName(selectedSession.assessor_id)}
                        </div>
                      </div>
                    </div>

                    {/* Workflow Actions */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {st.next.map(nextStatus => {
                        const canDo = nextStatus === 'in_progress'  ? canManage
                                    : nextStatus === 'submitted'    ? canManage
                                    : nextStatus === 'reviewed'     ? canApprove
                                    : nextStatus === 'approved'     ? canApprove
                                    : false;
                        if (!canDo) return null;
                        return (
                          <button key={nextStatus} onClick={() => doAction(selectedSession, nextStatus)}
                            className={`px-3 py-1.5 text-white rounded-xl text-xs font-semibold transition-colors
                              ${nextStatus === 'in_progress'  ? 'bg-blue-600 hover:bg-blue-700'
                              : nextStatus === 'submitted'   ? 'bg-purple-600 hover:bg-purple-700'
                              : nextStatus === 'reviewed'    ? 'bg-yellow-500 hover:bg-yellow-600'
                              : nextStatus === 'approved'    ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-orange-500 hover:bg-orange-600'}`}>
                            {nextStatus === 'in_progress'  ? 'Bắt đầu điền'
                            : nextStatus === 'submitted'   ? 'Nộp đánh giá'
                            : nextStatus === 'reviewed'    ? 'Xác nhận rà soát'
                            : nextStatus === 'approved'    ? 'Phê duyệt'
                            : 'Yêu cầu chỉnh sửa'}
                          </button>
                        );
                      })}
                      {canEdit && (
                        <button onClick={() => { setItemForm(emptyItem()); setShowAddItem(true); }}
                          className="px-3 py-1.5 bg-gray-700 text-white rounded-xl text-xs font-semibold hover:bg-gray-800">
                          + Thêm mục RR
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary stats */}
                  {sessionItems.length > 0 && (
                    <div className="grid grid-cols-4 gap-3">
                      {Object.entries(RISK_LEVEL).map(([lvl, config]) => {
                        const count = sessionItems.filter(i => i.risk_level === lvl).length;
                        return (
                          <div key={lvl} className={`rounded-xl border p-3 ${config.cls.replace('text-','border-').replace('100','200')}`}>
                            <div className="text-xl font-bold">{count}</div>
                            <div className={`text-xs font-medium ${config.cls.split(' ')[1]}`}>{config.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* RCSA Items Table */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <h3 className="font-semibold text-gray-700 text-sm">Bảng Đánh Giá Rủi Ro & Kiểm Soát</h3>
                    </div>
                    {sessionItems.length === 0
                      ? <div className="p-8 text-center text-gray-400 text-sm">
                          {canEdit ? 'Nhấn "+ Thêm mục RR" để bắt đầu điền bảng RCSA' : 'Chưa có mục đánh giá nào'}
                        </div>
                      : <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 min-w-48">Mô tả rủi ro</th>
                                <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Danh mục</th>
                                <th className="text-center px-2 py-2.5 font-semibold text-gray-600">I-L</th>
                                <th className="text-center px-2 py-2.5 font-semibold text-gray-600">I-I</th>
                                <th className="text-center px-2 py-2.5 font-semibold text-gray-600">I-Score</th>
                                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 min-w-32">Biện pháp KS</th>
                                <th className="text-center px-2 py-2.5 font-semibold text-gray-600">HQ KS</th>
                                <th className="text-center px-2 py-2.5 font-semibold text-gray-600">R-L</th>
                                <th className="text-center px-2 py-2.5 font-semibold text-gray-600">R-I</th>
                                <th className="text-center px-2 py-2.5 font-semibold text-gray-600">R-Score</th>
                                <th className="text-center px-2 py-2.5 font-semibold text-gray-600">Mức RR</th>
                                <th className="text-center px-2 py-2.5 font-semibold text-gray-600">AP?</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {sessionItems.map((item, idx) => {
                                const rl = RISK_LEVEL[item.risk_level] || RISK_LEVEL.medium;
                                const ce = CONTROL_EFF[item.control_effectiveness] || CONTROL_EFF.partial;
                                return (
                                  <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2.5 text-gray-800 font-medium">{item.risk_description}</td>
                                    <td className="px-3 py-2.5 text-gray-500">{getCatName(item.risk_category_id)}</td>
                                    <td className="px-2 py-2.5 text-center text-gray-700">{item.inherent_likelihood}</td>
                                    <td className="px-2 py-2.5 text-center text-gray-700">{item.inherent_impact}</td>
                                    <td className="px-2 py-2.5 text-center font-bold text-gray-800">{item.inherent_score}</td>
                                    <td className="px-3 py-2.5 text-gray-600 max-w-40 truncate">{item.control_description || '—'}</td>
                                    <td className="px-2 py-2.5 text-center">
                                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ce.cls}`}>{ce.label}</span>
                                    </td>
                                    <td className="px-2 py-2.5 text-center text-gray-700">{item.residual_likelihood}</td>
                                    <td className="px-2 py-2.5 text-center text-gray-700">{item.residual_impact}</td>
                                    <td className="px-2 py-2.5 text-center font-bold text-gray-800">{item.residual_score}</td>
                                    <td className="px-2 py-2.5 text-center">
                                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${rl.cls}`}>{rl.label}</span>
                                    </td>
                                    <td className="px-2 py-2.5 text-center">
                                      {item.action_required
                                        ? <span className="text-orange-500 font-bold">✓</span>
                                        : <span className="text-gray-300">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                    }
                  </div>
                </div>
              );
            })()
        }
      </div>

      {/* New Session Modal */}
      {showNewSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowNewSession(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-screen overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800">Tạo Đợt Đánh Giá RCSA</h3>
              <button onClick={() => setShowNewSession(false)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tên đợt đánh giá *</label>
                  <input value={sessionForm.title} onChange={e => setSessionForm(f => ({...f, title: e.target.value}))}
                    placeholder="VD: RCSA Q2 2024 - Phòng Tín Dụng"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Kỳ đánh giá *</label>
                  <input value={sessionForm.period} onChange={e => setSessionForm(f => ({...f, period: e.target.value}))}
                    placeholder="VD: Q2-2024"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Đơn vị thực hiện</label>
                  <select value={sessionForm.department_id} onChange={e => setSessionForm(f => ({...f, department_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn đơn vị --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Người đánh giá</label>
                  <select value={sessionForm.assessor_id} onChange={e => setSessionForm(f => ({...f, assessor_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Mặc định (bạn) --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Người rà soát</label>
                  <select value={sessionForm.reviewer_id} onChange={e => setSessionForm(f => ({...f, reviewer_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Người phê duyệt</label>
                  <select value={sessionForm.approver_id} onChange={e => setSessionForm(f => ({...f, approver_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">-- Chọn --</option>
                    {users.filter(u => ['admin','director'].includes(u.role)).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày bắt đầu</label>
                  <input type="date" value={sessionForm.start_date} onChange={e => setSessionForm(f => ({...f, start_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Hạn nộp</label>
                  <input type="date" value={sessionForm.due_date} onChange={e => setSessionForm(f => ({...f, due_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNewSession(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={saveSession} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Tạo đợt RCSA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add RCSA Item Modal */}
      {showAddItem && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddItem(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800">Thêm Mục Đánh Giá Rủi Ro</h3>
              <button onClick={() => setShowAddItem(false)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả rủi ro *</label>
                <textarea value={itemForm.risk_description} onChange={e => setItemForm(f => ({...f, risk_description: e.target.value}))}
                  rows={2} placeholder="Mô tả cụ thể về rủi ro này"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Danh mục rủi ro</label>
                <select value={itemForm.risk_category_id} onChange={e => setItemForm(f => ({...f, risk_category_id: e.target.value}))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">-- Chọn danh mục --</option>
                  {riskCategories.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                </select>
              </div>

              <div className="bg-blue-50 rounded-xl p-4">
                <h4 className="text-sm font-bold text-blue-800 mb-3">Rủi ro tiềm ẩn (Inherent Risk)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Khả năng xảy ra: <span className="text-blue-600">{itemForm.inherent_likelihood}</span>/5
                    </label>
                    <input type="range" min={1} max={5} value={itemForm.inherent_likelihood}
                      onChange={e => setItemForm(f => ({...f, inherent_likelihood: Number(e.target.value)}))}
                      className="w-full accent-blue-600"/>
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>Hiếm</span><span>Thỉnh thoảng</span><span>Thường</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tác động: <span className="text-blue-600">{itemForm.inherent_impact}</span>/5
                    </label>
                    <input type="range" min={1} max={5} value={itemForm.inherent_impact}
                      onChange={e => setItemForm(f => ({...f, inherent_impact: Number(e.target.value)}))}
                      className="w-full accent-blue-600"/>
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>Không đáng kể</span><span>Nghiêm trọng</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">Điểm tiềm ẩn: </span>
                  <span className="font-bold text-blue-700">
                    {Number(itemForm.inherent_likelihood) * Number(itemForm.inherent_impact)}
                  </span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{background: '#dbeafe', color:'#1d4ed8'}}>
                    {RISK_LEVEL[scoreToLevel(Number(itemForm.inherent_likelihood) * Number(itemForm.inherent_impact))]?.label}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Biện pháp kiểm soát hiện tại</label>
                <textarea value={itemForm.control_description} onChange={e => setItemForm(f => ({...f, control_description: e.target.value}))}
                  rows={2} placeholder="Mô tả các biện pháp kiểm soát đang áp dụng"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Hiệu quả kiểm soát</label>
                <div className="flex gap-2">
                  {Object.entries(CONTROL_EFF).map(([k,v]) => (
                    <button key={k} type="button" onClick={() => setItemForm(f => ({...f, control_effectiveness: k}))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${itemForm.control_effectiveness === k ? `border-current ${v.cls}` : 'border-gray-200 text-gray-500'}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-4">
                <h4 className="text-sm font-bold text-green-800 mb-3">Rủi ro còn lại (Residual Risk)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Khả năng xảy ra: <span className="text-green-600">{itemForm.residual_likelihood}</span>/5
                    </label>
                    <input type="range" min={1} max={5} value={itemForm.residual_likelihood}
                      onChange={e => setItemForm(f => ({...f, residual_likelihood: Number(e.target.value)}))}
                      className="w-full accent-green-600"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tác động: <span className="text-green-600">{itemForm.residual_impact}</span>/5
                    </label>
                    <input type="range" min={1} max={5} value={itemForm.residual_impact}
                      onChange={e => setItemForm(f => ({...f, residual_impact: Number(e.target.value)}))}
                      className="w-full accent-green-600"/>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">Điểm còn lại: </span>
                  <span className="font-bold text-green-700">
                    {Number(itemForm.residual_likelihood) * Number(itemForm.residual_impact)}
                  </span>
                  {(() => {
                    const score = Number(itemForm.residual_likelihood) * Number(itemForm.residual_impact);
                    const lvl = RISK_LEVEL[scoreToLevel(score)];
                    return <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${lvl.cls}`}>{lvl.label}</span>;
                  })()}
                  {Number(itemForm.residual_likelihood) * Number(itemForm.residual_impact) >= 10 && (
                    <span className="ml-2 text-xs text-orange-600 font-medium">⚠ Cần Action Plan</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú</label>
                <textarea value={itemForm.notes} onChange={e => setItemForm(f => ({...f, notes: e.target.value}))}
                  rows={1} placeholder="Ghi chú thêm (tùy chọn)"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddItem(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={saveItem} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Thêm mục'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RCSAModule;
