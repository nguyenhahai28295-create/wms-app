import React from 'react';

/* ════════════════════════════════════════════════════════════
   GRC DASHBOARD — Tổng quan rủi ro, tuân thủ, kiểm toán
════════════════════════════════════════════════════════════ */

const SEVERITY_COLOR = {
  critical: 'bg-red-600 text-white',
  high:     'bg-orange-500 text-white',
  medium:   'bg-yellow-400 text-gray-900',
  low:      'bg-green-400 text-gray-900',
};

const STATUS_LABEL = {
  draft:        { label:'Nháp',          cls:'bg-gray-100 text-gray-600'    },
  declared:     { label:'Đã khai báo',   cls:'bg-blue-100 text-blue-700'    },
  under_review: { label:'Đang xem xét',  cls:'bg-yellow-100 text-yellow-700'},
  closed:       { label:'Đã đóng',       cls:'bg-green-100 text-green-700'  },
  rejected:     { label:'Từ chối',       cls:'bg-red-100 text-red-700'      },
  open:         { label:'Mở',            cls:'bg-red-100 text-red-700'      },
  in_progress:  { label:'Đang xử lý',   cls:'bg-blue-100 text-blue-700'    },
  completed:    { label:'Hoàn thành',    cls:'bg-green-100 text-green-700'  },
  overdue:      { label:'Quá hạn',       cls:'bg-red-100 text-red-700'      },
  not_started:  { label:'Chưa bắt đầu', cls:'bg-gray-100 text-gray-600'    },
};

const KPICard = ({ label, value, sub, icon, color }) => {
  const colors = {
    blue:    'bg-blue-50 border-blue-200 text-blue-700',
    red:     'bg-red-50 border-red-200 text-red-700',
    green:   'bg-green-50 border-green-200 text-green-700',
    orange:  'bg-orange-50 border-orange-200 text-orange-700',
    purple:  'bg-purple-50 border-purple-200 text-purple-700',
    yellow:  'bg-yellow-50 border-yellow-200 text-yellow-700',
  };
  return (
    <div className={`rounded-xl border-2 p-4 ${colors[color] || colors.blue}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm font-semibold mt-0.5">{label}</div>
          {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
        </div>
        <span className="text-2xl opacity-70">{icon}</span>
      </div>
    </div>
  );
};

// Risk Heat Map 5x5
const RiskHeatMap = ({ items }) => {
  const LEVELS_Y = [5,4,3,2,1]; // tác động (impact) - từ cao xuống thấp
  const LEVELS_X = [1,2,3,4,5]; // khả năng xảy ra (likelihood) - từ thấp lên cao

  const getCellColor = (like, imp) => {
    const score = like * imp;
    if (score >= 15) return 'bg-red-500';
    if (score >= 9)  return 'bg-orange-400';
    if (score >= 4)  return 'bg-yellow-300';
    return 'bg-green-300';
  };

  const countInCell = (like, imp) =>
    items.filter(i => i.residual_likelihood === like && i.residual_impact === imp).length;

  return (
    <div>
      <div className="text-xs text-gray-500 text-center mb-2">Heat Map Rủi Ro (Residual)</div>
      <div className="flex gap-1 items-end">
        {/* Y label */}
        <div className="flex flex-col gap-1 text-xs text-gray-400 items-center" style={{width:40}}>
          <span className="text-center leading-tight" style={{fontSize:9}}>Tác động ↑</span>
          {LEVELS_Y.map(y => <div key={y} className="h-8 flex items-center">{y}</div>)}
        </div>
        {/* Grid */}
        <div>
          <div className="grid gap-1" style={{gridTemplateColumns:`repeat(5,2rem)`}}>
            {LEVELS_Y.map(y =>
              LEVELS_X.map(x => {
                const cnt = countInCell(x, y);
                return (
                  <div key={`${x}-${y}`}
                    className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${getCellColor(x,y)}`}>
                    {cnt > 0 ? cnt : ''}
                  </div>
                );
              })
            )}
          </div>
          {/* X labels */}
          <div className="grid gap-1 mt-1" style={{gridTemplateColumns:`repeat(5,2rem)`}}>
            {LEVELS_X.map(x => <div key={x} className="text-center text-xs text-gray-400">{x}</div>)}
          </div>
          <div className="text-center text-xs text-gray-400 mt-0.5" style={{fontSize:9}}>Khả năng xảy ra →</div>
        </div>
      </div>
      {/* Legend */}
      <div className="flex gap-2 mt-2 flex-wrap">
        {[
          {color:'bg-red-500', label:'Rất cao (≥15)'},
          {color:'bg-orange-400', label:'Cao (9-14)'},
          {color:'bg-yellow-300', label:'Trung bình (4-8)'},
          {color:'bg-green-300', label:'Thấp (<4)'},
        ].map(({color,label}) => (
          <div key={label} className="flex items-center gap-1 text-xs text-gray-500">
            <div className={`w-3 h-3 rounded ${color}`}/>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const GRCDashboard = ({
  currentUser, departments,
  riskEvents, businessErrors,
  complianceRequirements, complianceAssessments,
  auditFindings, actionPlans,
  rcsaSessions, riskCategories,
  onNavigate,
}) => {
  const today = new Date();
  const next7 = new Date(today); next7.setDate(today.getDate() + 7);

  // KPIs
  const openSKKR         = riskEvents.filter(e => ['declared','under_review'].includes(e.status)).length;
  const openFindings     = auditFindings.filter(f => f.status === 'open').length;
  const overdueActions   = actionPlans.filter(a => a.status === 'overdue' || (a.due_date && new Date(a.due_date) < today && !['completed','cancelled'].includes(a.status))).length;
  const nonCompliant     = complianceAssessments.filter(a => a.compliance_level === 'non_compliant').length;
  const upcomingActions  = actionPlans.filter(a => a.due_date && new Date(a.due_date) <= next7 && !['completed','cancelled'].includes(a.status)).length;
  const pendingRCSA      = rcsaSessions.filter(s => ['draft','in_progress'].includes(s.status)).length;
  const totalCompliance  = complianceAssessments.length;
  const compliantPct     = totalCompliance > 0
    ? Math.round(complianceAssessments.filter(a => a.compliance_level === 'compliant').length / totalCompliance * 100)
    : 0;

  // RCSA items for heat map
  const allRcsaItems = rcsaSessions.flatMap ? [] : [];

  // Recent SKKR
  const recentSKKR = [...riskEvents]
    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  // Action plans near due
  const nearDue = actionPlans
    .filter(a => a.due_date && !['completed','cancelled'].includes(a.status))
    .sort((a,b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  // High severity open findings
  const criticalFindings = auditFindings
    .filter(f => f.status === 'open' && ['critical','high'].includes(f.severity))
    .slice(0, 4);

  const getDeptName = (id) => departments.find(d => d.id === id)?.name || '—';

  return (
    <div className="p-6 space-y-6 overflow-auto h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🛡️ GRC Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Tổng quan Quản trị · Rủi ro · Tuân thủ
            <span className="ml-3 text-gray-400">{today.toLocaleDateString('vi-VN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="SKKR Đang Xử Lý"   value={openSKKR}       icon="⚠️" color="orange" sub="cần xem xét" />
        <KPICard label="Findings Chưa Đóng" value={openFindings}   icon="🔍" color="red"    sub="từ kiểm tra/kiểm toán" />
        <KPICard label="Action Plan Quá Hạn"value={overdueActions} icon="⏰" color="red"    sub="cần xử lý ngay" />
        <KPICard label="Vi Phạm Tuân Thủ"   value={nonCompliant}   icon="📜" color="purple" sub="yêu cầu không đạt" />
        <KPICard label="Tỷ Lệ Tuân Thủ"     value={`${compliantPct}%`} icon="✅" color="green" sub={`${totalCompliance} đánh giá`} />
        <KPICard label="RCSA Chưa Hoàn Thành"value={pendingRCSA}   icon="🧮" color="blue"  sub="đợt đánh giá đang mở" />
      </div>

      {/* 3 column layout */}
      <div className="grid grid-cols-3 gap-4">
        {/* Recent SKKR */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">⚠️ SKKR Gần Đây</h3>
            <button onClick={() => onNavigate('risk_events')}
              className="text-xs text-blue-600 hover:underline">Xem tất cả →</button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentSKKR.length === 0
              ? <div className="p-4 text-center text-xs text-gray-400">Chưa có sự kiện rủi ro</div>
              : recentSKKR.map(e => {
                  const st = STATUS_LABEL[e.status] || STATUS_LABEL.draft;
                  return (
                    <div key={e.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-700 truncate">{e.title}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{e.code} · {getDeptName(e.department_id)}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${st.cls}`}>{st.label}</span>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* Critical Findings */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">🔍 Findings Nghiêm Trọng</h3>
            <button onClick={() => onNavigate('audit_findings')}
              className="text-xs text-blue-600 hover:underline">Xem tất cả →</button>
          </div>
          <div className="divide-y divide-gray-50">
            {criticalFindings.length === 0
              ? <div className="p-4 text-center text-xs text-gray-400">Không có findings nghiêm trọng</div>
              : criticalFindings.map(f => (
                  <div key={f.id} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${SEVERITY_COLOR[f.severity] || 'bg-gray-200'}`}>
                        {f.severity?.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-700 truncate">{f.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{f.code}</div>
                      </div>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Action Plans Near Due */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">🎯 Action Plan Sắp Đến Hạn</h3>
            <button onClick={() => onNavigate('action_plans')}
              className="text-xs text-blue-600 hover:underline">Xem tất cả →</button>
          </div>
          <div className="divide-y divide-gray-50">
            {nearDue.length === 0
              ? <div className="p-4 text-center text-xs text-gray-400">Không có action plan đến hạn</div>
              : nearDue.map(a => {
                  const dueDate  = new Date(a.due_date);
                  const isOD     = dueDate < today;
                  const daysDiff = Math.ceil((dueDate - today) / 86400000);
                  return (
                    <div key={a.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-700 truncate">{a.title}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{a.code}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${isOD ? 'bg-red-100 text-red-700' : daysDiff <= 3 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>
                          {isOD ? `Quá ${-daysDiff}d` : daysDiff === 0 ? 'Hôm nay' : `${daysDiff}d`}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{width:`${a.completion_pct || 0}%`}}/>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>
      </div>

      {/* Compliance summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">📜 Tỷ Lệ Tuân Thủ Theo Yêu Cầu</h3>
        {complianceRequirements.length === 0
          ? <div className="text-center text-xs text-gray-400 py-4">Chưa có yêu cầu tuân thủ</div>
          : <div className="grid grid-cols-4 gap-3">
              {complianceRequirements.slice(0, 8).map(req => {
                const assessments = complianceAssessments.filter(a => a.requirement_id === req.id);
                const latest = assessments.sort((a,b) => new Date(b.assessed_at) - new Date(a.assessed_at))[0];
                const levelColor = {
                  compliant:     'bg-green-100 text-green-700',
                  partial:       'bg-yellow-100 text-yellow-700',
                  non_compliant: 'bg-red-100 text-red-700',
                }[latest?.compliance_level] || 'bg-gray-100 text-gray-500';
                const levelLabel = {
                  compliant:     'Đạt',
                  partial:       'Một phần',
                  non_compliant: 'Không đạt',
                }[latest?.compliance_level] || 'Chưa đánh giá';
                return (
                  <div key={req.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-700 truncate">{req.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{req.code}</div>
                    <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${levelColor}`}>
                      {levelLabel}
                    </span>
                  </div>
                );
              })}
            </div>
        }
      </div>
    </div>
  );
};

export default GRCDashboard;
