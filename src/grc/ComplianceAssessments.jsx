import React, { useState } from 'react';
import { supabase } from '../supabase.js';

/* ════════════════════════════════════════════════════════════
   RÀ SOÁT TUÂN THỦ (Compliance Assessments) — Workflow WF-4
════════════════════════════════════════════════════════════ */

const COMPLIANCE_LEVEL = {
  compliant:     { label:'Đạt',        cls:'bg-green-100 text-green-700',  score: [80,100] },
  partial:       { label:'Một phần',   cls:'bg-yellow-100 text-yellow-700',score: [40,79]  },
  non_compliant: { label:'Không đạt',  cls:'bg-red-100 text-red-700',      score: [0,39]   },
};

const STATUS_MAP = {
  draft:     { label:'Nháp',        cls:'bg-gray-100 text-gray-600',    next:['submitted'] },
  submitted: { label:'Đã nộp',      cls:'bg-blue-100 text-blue-700',    next:['approved']  },
  approved:  { label:'Đã phê duyệt',cls:'bg-green-100 text-green-700',  next:[]            },
};

const emptyForm = () => ({
  requirement_id:'', period:'', compliance_level:'compliant',
  score: 100, evidence:'', gaps:'', action_required: false,
});

const ComplianceAssessments = ({
  currentUser, users, addToast,
  complianceAssessments, setComplianceAssessments,
  complianceRequirements,
}) => {
  const canApprove = ['admin','director'].includes(currentUser.role);
  const canAssess  = ['admin','manager'].includes(currentUser.role);

  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(emptyForm());
  const [filter,   setFilter]   = useState({ status:'all', period:'' });
  const [saving,   setSaving]   = useState(false);

  const getUserName = id => users.find(u => u.id === id)?.full_name || '—';
  const getReqName  = id => complianceRequirements.find(r => r.id === id)?.title || '—';
  const getReqCode  = id => complianceRequirements.find(r => r.id === id)?.code || '—';

  const periods = [...new Set(complianceAssessments.map(a => a.period))].sort().reverse();

  const filtered = complianceAssessments.filter(a => {
    const matchStatus = filter.status === 'all' || a.status === filter.status;
    const matchPeriod = !filter.period || a.period === filter.period;
    return matchStatus && matchPeriod;
  });

  const save = async () => {
    if (!form.requirement_id || !form.period.trim()) {
      addToast('Vui lòng chọn yêu cầu và nhập kỳ đánh giá', 'error'); return;
    }
    setSaving(true);
    try {
      const payload = {
        requirement_id: form.requirement_id,
        period: form.period.trim(),
        assessor_id: currentUser.id,
        compliance_level: form.compliance_level,
        score: Number(form.score),
        evidence: form.evidence.trim() || null,
        gaps: form.gaps.trim() || null,
        action_required: form.action_required,
        assessed_at: new Date().toISOString(),
        status: 'draft',
      };
      const { data, error } = await supabase.from('compliance_assessments').insert(payload).select().single();
      if (error) throw error;
      setComplianceAssessments(prev => [data, ...prev]);
      setShowForm(false);
      setForm(emptyForm());
      addToast('Tạo đánh giá tuân thủ thành công', 'success');
    } catch(err) {
      addToast('Lỗi: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  const doAction = async (assessment, nextStatus) => {
    const updates = { status: nextStatus };
    if (nextStatus === 'approved') updates.approved_by = currentUser.id;
    const { error } = await supabase.from('compliance_assessments').update(updates).eq('id', assessment.id);
    if (error) { addToast('Lỗi: ' + error.message, 'error'); return; }
    setComplianceAssessments(prev => prev.map(a => a.id === assessment.id ? { ...a, ...updates } : a));
    if (selected?.id === assessment.id) setSelected({ ...selected, ...updates });
    addToast('Cập nhật trạng thái thành công', 'success');
  };

  // Score → compliance_level auto-detect
  const scoreToLevel = (score) => {
    const n = Number(score);
    if (n >= 80) return 'compliant';
    if (n >= 40) return 'partial';
    return 'non_compliant';
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* List */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">✅ Rà Soát Tuân Thủ</h2>
            {canAssess && (
              <button onClick={() => { setForm(emptyForm()); setShowForm(true); }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700">
                + Đánh giá
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <select value={filter.period} onChange={e => setFilter(f => ({...f, period: e.target.value}))}
              className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400">
              <option value="">Tất cả kỳ đánh giá</option>
              {periods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="flex gap-1 flex-wrap">
              {[{id:'all',label:'Tất cả'},{id:'draft',label:'Nháp'},{id:'submitted',label:'Đã nộp'},{id:'approved',label:'Đã duyệt'}].map(s => (
                <button key={s.id} onClick={() => setFilter(f => ({...f, status:s.id}))}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${filter.status === s.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0
            ? <div className="p-6 text-center text-xs text-gray-400">Không có đánh giá tuân thủ nào</div>
            : filtered.map(a => {
                const lvl = COMPLIANCE_LEVEL[a.compliance_level] || COMPLIANCE_LEVEL.compliant;
                const st  = STATUS_MAP[a.status] || STATUS_MAP.draft;
                return (
                  <div key={a.id} onClick={() => setSelected(a)}
                    className={`px-4 py-3 cursor-pointer hover:bg-blue-50 ${selected?.id === a.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-xs truncate">{getReqName(a.requirement_id)}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{getReqCode(a.requirement_id)} · {a.period}</div>
                        <div className="text-xs text-gray-400">{getUserName(a.assessor_id)}</div>
                      </div>
                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${lvl.cls}`}>{lvl.label}</span>
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
          ? <div className="h-full flex items-center justify-center text-gray-400 text-sm">Chọn một đánh giá để xem chi tiết</div>
          : (() => {
              const lvl = COMPLIANCE_LEVEL[selected.compliance_level] || COMPLIANCE_LEVEL.compliant;
              const st  = STATUS_MAP[selected.status] || STATUS_MAP.draft;
              return (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lvl.cls}`}>{lvl.label}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Kỳ: {selected.period}</span>
                    </div>
                    <h2 className="text-base font-bold text-gray-800">{getReqName(selected.requirement_id)}</h2>
                    <div className="text-sm text-gray-500 mt-0.5">{getReqCode(selected.requirement_id)}</div>

                    {/* Score */}
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Điểm tuân thủ</span>
                        <span className="font-bold text-gray-800">{selected.score}/100</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${selected.score >= 80 ? 'bg-green-500' : selected.score >= 40 ? 'bg-yellow-400' : 'bg-red-500'}`}
                          style={{width:`${selected.score}%`}}/>
                      </div>
                    </div>

                    {/* Workflow actions */}
                    <div className="flex gap-2 mt-3">
                      {st.next.map(nextStatus => {
                        const canDo = nextStatus === 'submitted' ? (canAssess && selected.assessor_id === currentUser.id)
                                    : nextStatus === 'approved'  ? canApprove
                                    : false;
                        return canDo ? (
                          <button key={nextStatus} onClick={() => doAction(selected, nextStatus)}
                            className={`px-3 py-1.5 text-white rounded-xl text-xs font-semibold transition-colors ${nextStatus === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {nextStatus === 'submitted' ? 'Nộp đánh giá' : 'Phê duyệt'}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Thông tin đánh giá</h3>
                      {[
                        { label:'Người đánh giá',  val: getUserName(selected.assessor_id)  },
                        { label:'Người phê duyệt', val: getUserName(selected.approved_by)  },
                        { label:'Ngày đánh giá',   val: selected.assessed_at ? new Date(selected.assessed_at).toLocaleDateString('vi-VN') : '—' },
                        { label:'Cần action plan', val: selected.action_required ? 'Có' : 'Không' },
                      ].map(({label,val}) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-500">{label}</span>
                          <span className="font-medium text-gray-800">{val}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Bằng chứng & Khoảng cách</h3>
                      {selected.evidence && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Bằng chứng tuân thủ</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.evidence}</p>
                        </div>
                      )}
                      {selected.gaps && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Khoảng cách / Điểm chưa đạt</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.gaps}</p>
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
              <h3 className="font-bold text-gray-800">Tạo Đánh Giá Tuân Thủ</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Yêu cầu tuân thủ *</label>
                <select value={form.requirement_id} onChange={e => setForm(f => ({...f, requirement_id: e.target.value}))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">-- Chọn yêu cầu tuân thủ --</option>
                  {complianceRequirements.map(r => <option key={r.id} value={r.id}>{r.code} - {r.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Kỳ đánh giá *</label>
                  <input value={form.period} onChange={e => setForm(f => ({...f, period: e.target.value}))}
                    placeholder="VD: Q2-2024"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Điểm tuân thủ (0-100)</label>
                  <input type="number" min={0} max={100} value={form.score}
                    onChange={e => setForm(f => ({...f, score: e.target.value, compliance_level: scoreToLevel(e.target.value)}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mức độ tuân thủ</label>
                  <select value={form.compliance_level} onChange={e => setForm(f => ({...f, compliance_level: e.target.value}))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {Object.entries(COMPLIANCE_LEVEL).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input type="checkbox" checked={form.action_required} onChange={e => setForm(f => ({...f, action_required: e.target.checked}))}
                      className="w-4 h-4 rounded border-gray-300"/>
                    <span className="text-sm font-semibold text-gray-700">Cần Action Plan</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Bằng chứng tuân thủ</label>
                <textarea value={form.evidence} onChange={e => setForm(f => ({...f, evidence: e.target.value}))}
                  rows={2} placeholder="Mô tả bằng chứng, tài liệu chứng minh tuân thủ"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Khoảng cách / Điểm chưa đạt</label>
                <textarea value={form.gaps} onChange={e => setForm(f => ({...f, gaps: e.target.value}))}
                  rows={2} placeholder="Mô tả các điểm còn thiếu, chưa tuân thủ đầy đủ"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Tạo đánh giá'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceAssessments;
