import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase.js';
import GRCDashboard from './GRCDashboard.jsx';
import RiskCategories from './RiskCategories.jsx';
import RiskEvents from './RiskEvents.jsx';
import BusinessErrors from './BusinessErrors.jsx';
import ComplianceRequirements from './ComplianceRequirements.jsx';
import ComplianceAssessments from './ComplianceAssessments.jsx';
import AuditPlans from './AuditPlans.jsx';
import AuditFindings from './AuditFindings.jsx';
import ActionPlans from './ActionPlans.jsx';
import RCSAModule from './RCSAModule.jsx';

/* ════════════════════════════════════════════════════════════
   GRC MODULE — Top-level coordinator
   Props: currentUser, departments, users, addToast
════════════════════════════════════════════════════════════ */
const GRC_NAV = [
  { id:'grc_dashboard',           label:'Tổng Quan GRC',       icon:'📊', group:'overview' },
  { id:'risk_categories',         label:'Danh Mục Rủi Ro',     icon:'🗂️', group:'risk' },
  { id:'risk_events',             label:'Sự Kiện Rủi Ro',      icon:'⚠️', group:'risk' },
  { id:'business_errors',         label:'Lỗi Nghiệp Vụ',       icon:'🔧', group:'risk' },
  { id:'compliance_requirements', label:'Yêu Cầu Tuân Thủ',    icon:'📜', group:'compliance' },
  { id:'compliance_assessments',  label:'Rà Soát Tuân Thủ',    icon:'✅', group:'compliance' },
  { id:'audit_plans',             label:'Kế Hoạch Kiểm Tra',   icon:'📋', group:'audit' },
  { id:'audit_findings',          label:'Findings Kiểm Toán',  icon:'🔍', group:'audit' },
  { id:'action_plans',            label:'Action Plan',          icon:'🎯', group:'audit' },
  { id:'rcsa',                    label:'RCSA',                 icon:'🧮', group:'rcsa' },
];

const GROUP_LABELS = {
  overview:   'Tổng Quan',
  risk:       'Quản Lý Rủi Ro',
  compliance: 'Tuân Thủ',
  audit:      'Kiểm Toán',
  rcsa:       'RCSA',
};

const GRCModule = ({ currentUser, departments, users, addToast }) => {
  const [grcPage, setGrcPage] = useState('grc_dashboard');

  // GRC data states
  const [riskCategories,         setRiskCategories]         = useState([]);
  const [riskEvents,             setRiskEvents]             = useState([]);
  const [businessErrors,         setBusinessErrors]         = useState([]);
  const [complianceRequirements, setComplianceRequirements] = useState([]);
  const [complianceAssessments,  setComplianceAssessments]  = useState([]);
  const [auditPlans,             setAuditPlans]             = useState([]);
  const [auditFindings,          setAuditFindings]          = useState([]);
  const [actionPlans,            setActionPlans]            = useState([]);
  const [rcsaSessions,           setRcsaSessions]           = useState([]);
  const [rcsaItems,              setRcsaItems]              = useState([]);
  const [loading,                setLoading]                = useState(true);

  const loadGRCData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        catRes, evtRes, beRes, crRes, caRes,
        apRes, afRes, aplRes, rsRes, riRes,
      ] = await Promise.all([
        supabase.from('risk_categories').select('*').order('code'),
        supabase.from('risk_events').select('*').order('created_at', { ascending: false }),
        supabase.from('business_errors').select('*').order('created_at', { ascending: false }),
        supabase.from('compliance_requirements').select('*').order('code'),
        supabase.from('compliance_assessments').select('*').order('assessed_at', { ascending: false }),
        supabase.from('audit_plans').select('*').order('created_at', { ascending: false }),
        supabase.from('audit_findings').select('*').order('created_at', { ascending: false }),
        supabase.from('action_plans').select('*').order('due_date'),
        supabase.from('rcsa_sessions').select('*').order('created_at', { ascending: false }),
        supabase.from('rcsa_items').select('*'),
      ]);
      setRiskCategories(catRes.data || []);
      setRiskEvents(evtRes.data || []);
      setBusinessErrors(beRes.data || []);
      setComplianceRequirements(crRes.data || []);
      setComplianceAssessments(caRes.data || []);
      setAuditPlans(apRes.data || []);
      setAuditFindings(afRes.data || []);
      setActionPlans(aplRes.data || []);
      setRcsaSessions(rsRes.data || []);
      setRcsaItems(riRes.data || []);
    } catch (err) {
      addToast('Lỗi tải dữ liệu GRC: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadGRCData(); }, [loadGRCData]);

  // Badge counts for navigation
  const badgeCounts = {
    risk_events:    riskEvents.filter(e => ['declared','under_review'].includes(e.status)).length,
    audit_findings: auditFindings.filter(f => f.status === 'open').length,
    action_plans:   actionPlans.filter(a => a.status === 'overdue').length,
  };

  const commonProps = {
    currentUser, departments, users, addToast,
    riskCategories, reload: loadGRCData,
  };

  const groups = [...new Set(GRC_NAV.map(n => n.group))];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
          <span className="text-gray-500 text-sm font-medium">Đang tải dữ liệu GRC...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* GRC Sub-Sidebar */}
      <div className="w-52 bg-slate-800 text-white flex flex-col flex-shrink-0 overflow-y-auto">
        <div className="px-4 py-4 border-b border-slate-600">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <div>
              <div className="font-bold text-sm text-white">GRC System</div>
              <div className="text-xs text-slate-400">Quản Lý Rủi Ro & Tuân Thủ</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-4">
          {groups.map(group => {
            const items = GRC_NAV.filter(n => n.group === group);
            return (
              <div key={group}>
                <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {GROUP_LABELS[group]}
                </div>
                <div className="space-y-0.5">
                  {items.map(item => (
                    <button key={item.id}
                      onClick={() => setGrcPage(item.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all
                        ${grcPage === item.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                      <span>{item.icon}</span>
                      <span className="flex-1 text-left">{item.label}</span>
                      {badgeCounts[item.id] > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold">
                          {badgeCounts[item.id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* GRC Main Content */}
      <div className="flex-1 overflow-hidden">
        {grcPage === 'grc_dashboard' && (
          <GRCDashboard
            {...commonProps}
            riskEvents={riskEvents}
            businessErrors={businessErrors}
            complianceRequirements={complianceRequirements}
            complianceAssessments={complianceAssessments}
            auditFindings={auditFindings}
            actionPlans={actionPlans}
            rcsaSessions={rcsaSessions}
            onNavigate={setGrcPage}
          />
        )}
        {grcPage === 'risk_categories' && (
          <RiskCategories {...commonProps} />
        )}
        {grcPage === 'risk_events' && (
          <RiskEvents
            {...commonProps}
            riskEvents={riskEvents}
            setRiskEvents={setRiskEvents}
          />
        )}
        {grcPage === 'business_errors' && (
          <BusinessErrors
            {...commonProps}
            businessErrors={businessErrors}
            setBusinessErrors={setBusinessErrors}
            riskEvents={riskEvents}
          />
        )}
        {grcPage === 'compliance_requirements' && (
          <ComplianceRequirements
            {...commonProps}
            complianceRequirements={complianceRequirements}
            setComplianceRequirements={setComplianceRequirements}
          />
        )}
        {grcPage === 'compliance_assessments' && (
          <ComplianceAssessments
            {...commonProps}
            complianceAssessments={complianceAssessments}
            setComplianceAssessments={setComplianceAssessments}
            complianceRequirements={complianceRequirements}
          />
        )}
        {grcPage === 'audit_plans' && (
          <AuditPlans
            {...commonProps}
            auditPlans={auditPlans}
            setAuditPlans={setAuditPlans}
          />
        )}
        {grcPage === 'audit_findings' && (
          <AuditFindings
            {...commonProps}
            auditFindings={auditFindings}
            setAuditFindings={setAuditFindings}
            auditPlans={auditPlans}
            actionPlans={actionPlans}
            setActionPlans={setActionPlans}
          />
        )}
        {grcPage === 'action_plans' && (
          <ActionPlans
            {...commonProps}
            actionPlans={actionPlans}
            setActionPlans={setActionPlans}
            riskEvents={riskEvents}
            auditFindings={auditFindings}
            complianceAssessments={complianceAssessments}
          />
        )}
        {grcPage === 'rcsa' && (
          <RCSAModule
            {...commonProps}
            rcsaSessions={rcsaSessions}
            setRcsaSessions={setRcsaSessions}
            rcsaItems={rcsaItems}
            setRcsaItems={setRcsaItems}
            actionPlans={actionPlans}
            setActionPlans={setActionPlans}
          />
        )}
      </div>
    </div>
  );
};

export default GRCModule;
