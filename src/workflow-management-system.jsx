import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://cjebkjxkncxhfpgnahft.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqZWJranhrbmN4aGZwZ25haGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Nzc0OTMsImV4cCI6MjA4OTQ1MzQ5M30.YczMxKAbDK8Vk8cUoT7MVdNkMRWSs_onr2YRNXLLAQY'
);

/* ════════════════════════════════════════════════════════════
   RBAC — Phân quyền theo vai trò
════════════════════════════════════════════════════════════ */
const ROLES = {
  admin:    { label:'Quản Trị Viên', badge:'bg-purple-100 text-purple-800' },
  director: { label:'Giám Đốc/BGĐ',  badge:'bg-red-100 text-red-800'      },
  manager:  { label:'Quản Lý/TP',    badge:'bg-blue-100 text-blue-800'    },
  employee: { label:'Nhân Viên',     badge:'bg-gray-100 text-gray-700'    },
};

const getPermissions = (role) => ({
  canManageProcesses: role === 'admin',
  canPublishProcess:  role === 'admin',
  canManageOrg:       role === 'admin',
  canManageForms:     role === 'admin',
  canManageUsers:     role === 'admin',
  canSeeAllWorkItems: ['admin','director','manager'].includes(role),
  canEditProcess:     role === 'admin',
});

/* ════════════════════════════════════════════════════════════
   NORMALIZE — Chuyển snake_case (Supabase) → camelCase (UI)
════════════════════════════════════════════════════════════ */
const normWI   = (w) => w ? { id:w.id, title:w.title, processId:w.process_id, currentStepId:w.current_step_id, status:w.status, priority:w.priority, createdAt:w.created_at, dueDate:w.due_date, createdBy:w.created_by, formData:w.form_data||{}, logs:Array.isArray(w.logs)?w.logs:[] } : null;
const normDept = (d) => d ? { id:d.id, name:d.name, parentId:d.parent_id } : null;
const normPos  = (p) => p ? { id:p.id, name:p.name, deptId:p.dept_id, level:p.level, users:p.users||[] } : null;
const wiToDB   = (w) => ({ title:w.title, process_id:w.processId, current_step_id:w.currentStepId, status:w.status, priority:w.priority, due_date:w.dueDate, created_by:w.createdBy, form_data:w.formData||{}, logs:w.logs||[] });

/* ════════════════════════════════════════════════════════════
   HELPER COMPONENTS
════════════════════════════════════════════════════════════ */
const Modal = ({ open, title, onClose, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide?'max-w-2xl':'max-w-md'} max-h-screen overflow-auto`} onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-xl">&times;</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const m = { active:{bg:'bg-emerald-100',text:'text-emerald-800',label:'Hoạt Động'}, draft:{bg:'bg-gray-100',text:'text-gray-600',label:'Bản Nháp'}, in_progress:{bg:'bg-blue-100',text:'text-blue-800',label:'Đang Xử Lý'}, closed:{bg:'bg-emerald-100',text:'text-emerald-800',label:'Hoàn Thành'}, rejected:{bg:'bg-red-100',text:'text-red-700',label:'Từ Chối'} };
  const s = m[status] || m.draft;
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>{s.label}</span>;
};

const PriorityBadge = ({ priority }) => {
  const m = { urgent:{cls:'bg-red-100 text-red-700',label:'🔴 Khẩn'}, high:{cls:'bg-orange-100 text-orange-700',label:'🟠 Cao'}, normal:{cls:'bg-blue-50 text-blue-600',label:'🔵 TB'}, low:{cls:'bg-gray-100 text-gray-500',label:'⚪ Thấp'} };
  const p = m[priority] || m.normal;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.cls}`}>{p.label}</span>;
};

const RoleBadge = ({ role }) => {
  const r = ROLES[role] || ROLES.employee;
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${r.badge}`}>{r.label}</span>;
};

const Toast = ({ toasts, dismiss }) => (
  <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
    {toasts.map(t => (
      <div key={t.id} onClick={()=>dismiss(t.id)}
           className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-medium cursor-pointer min-w-72
             ${t.type==='success'?'bg-emerald-600':t.type==='error'?'bg-red-600':t.type==='warning'?'bg-amber-500':'bg-blue-600'}`}>
        <span>{t.type==='success'?'✅':t.type==='error'?'❌':t.type==='warning'?'⚠️':'ℹ️'}</span>
        <span className="flex-1">{t.message}</span>
        <span className="opacity-60 text-xs">✕</span>
      </div>
    ))}
  </div>
);

const LoadingScreen = ({ text = 'Đang tải...' }) => (
  <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-4 z-50">
    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    <div className="text-gray-500 font-medium">{text}</div>
  </div>
);

/* ════════════════════════════════════════════════════════════
   LOGIN PAGE
════════════════════════════════════════════════════════════ */
const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Vui lòng nhập đầy đủ thông tin'); return; }
    setLoading(true); setError('');
    try {
      // Username → email nội bộ: username@gmail.com
      const email = `${username.trim().toLowerCase()}@gmail.com`;
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) { setError('Tên đăng nhập hoặc mật khẩu không đúng'); return; }
      // Lấy profile
      const { data: profile, error: profErr } = await supabase
        .from('profiles').select('*').eq('id', data.user.id).single();
      if (profErr || !profile) { setError('Tài khoản chưa được cấu hình. Liên hệ Admin.'); await supabase.auth.signOut(); return; }
      if (!profile.is_active) { setError('Tài khoản đã bị vô hiệu hóa. Liên hệ Admin.'); await supabase.auth.signOut(); return; }
      onLogin(profile);
    } catch (err) {
      setError('Lỗi kết nối. Kiểm tra cấu hình Supabase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⬡</span>
          </div>
          <h1 className="text-2xl font-bold text-white">BPM Portal</h1>
          <p className="text-blue-200 text-sm mt-1">eOffice Workflow System</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-6 text-center">Đăng Nhập</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <span>⚠️</span><span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tên Đăng Nhập</label>
              <input value={username} onChange={e=>setUsername(e.target.value)}
                     placeholder="VD: admin, nvbinh..."
                     className="w-full border-2 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                     autoFocus autoComplete="username"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mật Khẩu</label>
              <div className="relative">
                <input value={password} onChange={e=>setPassword(e.target.value)}
                       type={showPass?'text':'password'} placeholder="••••••••"
                       className="w-full border-2 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors pr-12"
                       autoComplete="current-password"/>
                <button type="button" onClick={()=>setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm px-1">
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Đang xử lý...</> : 'Đăng Nhập'}
            </button>
          </form>
        </div>

        <p className="text-center text-blue-300 text-xs mt-6">© 2026 BPM Portal · Hệ Thống Quản Lý Quy Trình</p>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   OUTER APP — Xử lý xác thực
════════════════════════════════════════════════════════════ */
const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [appLoading, setAppLoading]   = useState(true);

  useEffect(() => {
    // Kiểm tra session đang tồn tại
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (profile && profile.is_active) setCurrentUser(profile);
        else await supabase.auth.signOut();
      }
      setAppLoading(false);
    });

    // Lắng nghe thay đổi auth (tab khác login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { setCurrentUser(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  if (appLoading) return <LoadingScreen text="Đang khởi động..." />;
  if (!currentUser) return <LoginPage onLogin={setCurrentUser} />;
  return <BPMApp currentUser={currentUser} onLogout={handleLogout} onUserUpdate={setCurrentUser} />;
};

/* ════════════════════════════════════════════════════════════
   MAIN BPM APP
════════════════════════════════════════════════════════════ */
const BPMApp = ({ currentUser, onLogout, onUserUpdate }) => {
  const can = getPermissions(currentUser.role);

  /* ── Navigation ── */
  const [page, setPage] = useState('dashboard');

  /* ── Data State (tải từ Supabase) ── */
  const [processes,   setProcesses]   = useState([]);
  const [workItems,   setWorkItems]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions,   setPositions]   = useState([]);
  const [forms,       setForms]       = useState([]);
  const [users,       setUsers]       = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  /* ── Toast ── */
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type='success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  /* ── Process Designer ── */
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [selectedNodeId,  setSelectedNodeId]  = useState(null);
  const [connectMode,     setConnectMode]     = useState(false);
  const [connectFrom,     setConnectFrom]     = useState(null);
  const [dragging,        setDragging]        = useState(null);
  const canvasRef = useRef(null);

  /* ── Work Items ── */
  const [selectedWorkItemId, setSelectedWorkItemId] = useState(null);
  const [wiTab,         setWiTab]         = useState('all');
  const [wiComment,     setWiComment]     = useState('');
  const [wiSearch,      setWiSearch]      = useState('');
  const [wiFormInputs,  setWiFormInputs]  = useState({});
  const [delegateModal, setDelegateModal] = useState(false);
  const [delegateUser,  setDelegateUser]  = useState('');

  /* ── Org Chart (state ở top level - tránh hooks violation) ── */
  const [orgModal,      setOrgModal]      = useState(null);
  const [orgLocalName,  setOrgLocalName]  = useState('');
  const [orgLocalDept,  setOrgLocalDept]  = useState('');
  const [orgLocalLevel, setOrgLocalLevel] = useState(3);

  /* ── Form Builder ── */
  const [selectedFormId,   setSelectedFormId]   = useState(null);
  const [editingFieldId,   setEditingFieldId]   = useState(null);
  const [formPreview,      setFormPreview]       = useState(false);
  const [newFormModal,     setNewFormModal]      = useState(false);
  const [newFormName,      setNewFormName]       = useState('');
  const [newFormCategory,  setNewFormCategory]   = useState('Chung');

  /* ── User Management (Admin) ── */
  const [editUserModal, setEditUserModal] = useState(null);
  const [editUserRole,  setEditUserRole]  = useState('employee');

  /* ════════════════════════════
     LOAD DATA FROM SUPABASE
  ════════════════════════════ */
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [procRes, wiRes, deptRes, posRes, formRes] = await Promise.all([
        supabase.from('processes').select('*').order('created_at'),
        supabase.from('work_items').select('*').order('created_at', { ascending: false }),
        supabase.from('departments').select('*'),
        supabase.from('positions').select('*'),
        supabase.from('forms').select('*'),
      ]);
      setProcesses(procRes.data || []);
      setWorkItems((wiRes.data || []).map(normWI).filter(Boolean));
      setDepartments((deptRes.data || []).map(normDept).filter(Boolean));
      setPositions((posRes.data || []).map(normPos).filter(Boolean));
      setForms(formRes.data || []);
      // Admin: tải danh sách user
      if (can.canManageUsers) {
        const { data: usersData } = await supabase.from('profiles').select('*').order('created_at');
        setUsers(usersData || []);
      }
    } catch (err) {
      addToast('Lỗi tải dữ liệu: ' + err.message, 'error');
    } finally {
      setDataLoading(false);
    }
  };

  /* ════════════════════════════
     COMPUTED HELPERS
  ════════════════════════════ */
  const getStepName = (proc, stepId) => proc?.steps?.find(s=>s.id===stepId)?.name || stepId;
  const getPosName  = (posId)  => positions.find(p=>p.id===posId)?.name || posId || '—';
  const getDeptName = (deptId) => departments.find(d=>d.id===deptId)?.name || '—';
  const selectedWorkItem = workItems.find(w=>w.id===selectedWorkItemId) || null;
  const selectedForm     = forms.find(f=>f.id===selectedFormId) || null;

  const getSLAInfo = (wi, step) => {
    if (!step || step.slaHours <= 0 || ['closed','rejected'].includes(wi.status)) return null;
    const last = wi.logs[wi.logs.length-1];
    const elapsed = (Date.now() - new Date(last?.performedAt||wi.createdAt).getTime()) / 3600000;
    const rem = step.slaHours - elapsed;
    if (rem < 0) return { label:`Quá ${(-rem).toFixed(0)}h`, cls:'text-red-600', bg:'bg-red-50 border-red-200' };
    if (rem < step.slaHours * 0.3) return { label:`Còn ${rem.toFixed(0)}h ⚠`, cls:'text-orange-600', bg:'bg-orange-50 border-orange-200' };
    return { label:`SLA: ${rem.toFixed(0)}h`, cls:'text-emerald-700', bg:'bg-emerald-50 border-emerald-200' };
  };

  // Lọc work items theo role
  const visibleWorkItems = workItems.filter(wi =>
    can.canSeeAllWorkItems ? true : wi.createdBy === currentUser.username
  );

  const filteredWorkItems = visibleWorkItems.filter(wi => {
    const matchTab = wiTab==='in_progress' ? wi.status==='in_progress' : wiTab==='closed' ? wi.status==='closed' : wiTab==='rejected' ? wi.status==='rejected' : true;
    const matchSearch = !wiSearch || wi.title.toLowerCase().includes(wiSearch.toLowerCase());
    return matchTab && matchSearch;
  });

  const stats = {
    activeProcesses: processes.filter(p=>p.status==='active').length,
    inProgress: visibleWorkItems.filter(w=>w.status==='in_progress').length,
    closed:     visibleWorkItems.filter(w=>w.status==='closed').length,
    rejected:   visibleWorkItems.filter(w=>w.status==='rejected').length,
    total:      visibleWorkItems.length,
    overdue:    visibleWorkItems.filter(w=>w.dueDate&&new Date(w.dueDate)<new Date()&&!['closed','rejected'].includes(w.status)).length,
    urgent:     visibleWorkItems.filter(w=>w.priority==='urgent'&&w.status==='in_progress').length,
  };

  /* ════════════════════════════
     PROCESS DESIGNER HANDLERS
  ════════════════════════════ */
  const updateProcess = useCallback(async (updated) => {
    setSelectedProcess(updated);
    setProcesses(prev => prev.map(p=>p.id===updated.id ? updated : p));
    const { error } = await supabase.from('processes').update({
      name: updated.name, status: updated.status, version: updated.version,
      steps: updated.steps, connections: updated.connections, updated_at: new Date().toISOString()
    }).eq('id', updated.id);
    if (error) addToast('Lỗi lưu quy trình: ' + error.message, 'error');
  }, [addToast]);

  const handleSaveNode = useCallback((stepId, updates) => {
    if (!selectedProcess) return;
    updateProcess({ ...selectedProcess, steps: selectedProcess.steps.map(s=>s.id===stepId?{...s,...updates}:s) });
  }, [selectedProcess, updateProcess]);

  const handleDeleteNode = useCallback((stepId) => {
    if (!selectedProcess) return;
    updateProcess({ ...selectedProcess, steps: selectedProcess.steps.filter(s=>s.id!==stepId), connections: selectedProcess.connections.filter(c=>c.from!==stepId&&c.to!==stepId) });
    setSelectedNodeId(null);
  }, [selectedProcess, updateProcess]);

  const handleDeleteConnection = useCallback((fromId, toId) => {
    if (!selectedProcess) return;
    updateProcess({ ...selectedProcess, connections: selectedProcess.connections.filter(c=>!(c.from===fromId&&c.to===toId)) });
  }, [selectedProcess, updateProcess]);

  const handleNodeMouseDown = useCallback((e, step) => {
    if (connectMode) {
      e.stopPropagation();
      if (!connectFrom) { setConnectFrom(step.id); }
      else if (connectFrom===step.id) { setConnectFrom(null); }
      else {
        const exists = selectedProcess.connections.some(c=>c.from===connectFrom&&c.to===step.id);
        if (!exists) {
          updateProcess({ ...selectedProcess, connections:[...selectedProcess.connections,{id:`c${Date.now()}`,from:connectFrom,to:step.id}] });
          addToast(`Đã kết nối "${getStepName(selectedProcess,connectFrom)}" → "${step.name}"`, 'info');
        }
        setConnectFrom(null);
      }
      return;
    }
    e.stopPropagation(); e.preventDefault();
    setSelectedNodeId(step.id);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({ stepId:step.id, offsetX:e.clientX-rect.left-step.x, offsetY:e.clientY-rect.top-step.y });
  }, [connectMode, connectFrom, selectedProcess, updateProcess, addToast]);

  const handleCanvasMouseMove = useCallback((e) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX-rect.left-dragging.offsetX);
    const y = Math.max(0, e.clientY-rect.top-dragging.offsetY);
    setSelectedProcess(prev => prev ? { ...prev, steps:prev.steps.map(s=>s.id===dragging.stepId?{...s,x,y}:s) } : prev);
  }, [dragging]);

  const handleCanvasMouseUp = useCallback(() => {
    if (dragging && selectedProcess) setProcesses(prev=>prev.map(p=>p.id===selectedProcess.id?selectedProcess:p));
    setDragging(null);
  }, [dragging, selectedProcess]);

  const handleCanvasDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType');
    if (!type || !canvasRef.current || !can.canEditProcess) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(10, e.clientX-rect.left-50);
    const y = Math.max(10, e.clientY-rect.top-25);
    const labels = {start:'Bắt Đầu',task:'Bước Mới',gateway:'Rẽ Nhánh',end:'Kết Thúc'};
    const newStep = { id:`s${Date.now()}`, type, name:labels[type]||'Bước', x, y, assignee:null, forms:[], slaHours:0, actions:[] };
    updateProcess({ ...selectedProcess, steps:[...selectedProcess.steps, newStep] });
    setSelectedNodeId(newStep.id);
  }, [selectedProcess, updateProcess, can.canEditProcess]);

  const handleValidatePublish = useCallback(async () => {
    const p = selectedProcess;
    if (!p || !can.canPublishProcess) return;
    const errors = [];
    if (!p.steps.some(s=>s.type==='start')) errors.push('• Thiếu nút "Bắt Đầu"');
    if (!p.steps.some(s=>s.type==='end'))   errors.push('• Thiếu nút "Kết Thúc"');
    if (p.steps.filter(s=>s.type==='task').some(s=>!s.assignee)) errors.push('• Có bước chưa có người phụ trách');
    if (p.steps.filter(s=>s.type==='task').some(s=>s.actions.length===0)) errors.push('• Có bước chưa có hành động');
    if (!p.steps.every(s=>p.connections.some(c=>c.from===s.id||c.to===s.id))) errors.push('• Có nút chưa kết nối');
    if (errors.length) { addToast('Không thể công bố:\n'+errors.join('\n'), 'error'); return; }
    const updated = { ...p, status:'active', version:p.version+1 };
    await updateProcess(updated);
    addToast(`✅ Đã công bố "${updated.name}" — Phiên bản ${updated.version}`, 'success');
  }, [selectedProcess, updateProcess, addToast, can.canPublishProcess]);

  const handleCreateNewProcess = useCallback(async () => {
    if (!can.canManageProcesses) return;
    const np = { name:'Quy Trình Mới', status:'draft', version:1,
      steps:[{id:'s1',type:'start',name:'Bắt Đầu',x:60,y:180,assignee:null,forms:[],slaHours:0,actions:[{id:'a1',label:'Tiếp theo',targetStepId:'s99',requireComment:false,color:'blue'}]},{id:'s99',type:'end',name:'Kết Thúc',x:400,y:180,assignee:null,forms:[],slaHours:0,actions:[]}],
      connections:[{id:'c1',from:'s1',to:'s99'}], created_by: currentUser.id };
    const { data, error } = await supabase.from('processes').insert([np]).select().single();
    if (error) { addToast('Lỗi tạo quy trình: '+error.message, 'error'); return; }
    setProcesses(prev=>[...prev, data]);
    setSelectedProcess(data);
    setPage('designer');
    addToast('Đã tạo quy trình mới', 'success');
  }, [can.canManageProcesses, currentUser.id, addToast]);

  /* ════════════════════════════
     EOFFICE HANDLERS
  ════════════════════════════ */
  const handleCreateWorkItem = useCallback(async (processId) => {
    const proc = processes.find(p=>p.id===processId);
    if (!proc) return;
    const firstTask = proc.steps.find(s=>s.type==='task');
    const now = new Date().toISOString();
    const due = new Date(Date.now()+3*86400000).toISOString();
    const startLog = { id:`l${Date.now()}`, fromStepId:proc.steps.find(s=>s.type==='start')?.id||'s1', toStepId:firstTask?.id||'s1', action:'Tạo phiếu', comment:'', performedBy:currentUser.full_name, performedAt:now };
    const newWI = { title:`Yêu cầu mới - ${proc.name}`, process_id:processId, current_step_id:firstTask?.id||'s1', status:'in_progress', priority:'normal', created_at:now, due_date:due, created_by:currentUser.username, created_by_uid:currentUser.id, form_data:{}, logs:[startLog] };
    const { data, error } = await supabase.from('work_items').insert([newWI]).select().single();
    if (error) { addToast('Lỗi tạo phiếu: '+error.message, 'error'); return; }
    const normalized = normWI(data);
    setWorkItems(prev=>[normalized,...prev]);
    setSelectedWorkItemId(normalized.id);
    setWiComment(''); setWiFormInputs({});
    addToast(`Đã tạo phiếu từ "${proc.name}"`, 'success');
  }, [processes, currentUser, addToast]);

  const handleWorkItemAction = useCallback(async (action) => {
    if (!selectedWorkItem) return;
    if (action.requireComment && !wiComment.trim()) { addToast('Hành động này yêu cầu nhập bình luận!', 'warning'); return; }
    const proc = processes.find(p=>p.id===selectedWorkItem.processId);
    const targetStep = proc?.steps.find(s=>s.id===action.targetStepId);
    const isEnd = targetStep?.type==='end';
    const newStatus = isEnd ? (action.label.toLowerCase().includes('từ chối')?'rejected':'closed') : 'in_progress';
    const newLog = { id:`l${Date.now()}`, fromStepId:selectedWorkItem.currentStepId, toStepId:action.targetStepId, action:action.label, comment:wiComment.trim(), performedBy:currentUser.full_name, performedAt:new Date().toISOString() };
    const updatedLogs = [...selectedWorkItem.logs, newLog];
    const updatedFormData = { ...selectedWorkItem.formData, ...wiFormInputs };

    // Optimistic update
    const updated = { ...selectedWorkItem, currentStepId:action.targetStepId, status:newStatus, formData:updatedFormData, logs:updatedLogs };
    setWorkItems(prev=>prev.map(w=>w.id===updated.id?updated:w));
    setWiComment(''); setWiFormInputs({});

    // Persist
    const { error } = await supabase.from('work_items').update({
      current_step_id: action.targetStepId, status: newStatus,
      form_data: updatedFormData, logs: updatedLogs
    }).eq('id', selectedWorkItem.id);
    if (error) { addToast('Lỗi lưu hành động: '+error.message, 'error'); loadData(); return; }

    const msg = newStatus==='closed' ? '✅ Phiếu hoàn thành!' : newStatus==='rejected' ? '❌ Phiếu bị từ chối' : `Đã chuyển: ${targetStep?.name}`;
    addToast(msg, newStatus==='closed'?'success':newStatus==='rejected'?'error':'info');
  }, [selectedWorkItem, wiComment, wiFormInputs, processes, currentUser, addToast, loadData]);

  const handleDelegate = useCallback(async () => {
    if (!selectedWorkItem || !delegateUser) return;
    const newLog = { id:`l${Date.now()}`, fromStepId:selectedWorkItem.currentStepId, toStepId:selectedWorkItem.currentStepId, action:`Ủy quyền → ${delegateUser}`, comment:`Ủy quyền cho ${delegateUser}`, performedBy:currentUser.full_name, performedAt:new Date().toISOString() };
    const updatedLogs = [...selectedWorkItem.logs, newLog];
    setWorkItems(prev=>prev.map(w=>w.id===selectedWorkItem.id?{...w,logs:updatedLogs}:w));
    await supabase.from('work_items').update({ logs:updatedLogs }).eq('id', selectedWorkItem.id);
    setDelegateModal(false); setDelegateUser('');
    addToast(`Đã ủy quyền cho "${delegateUser}"`, 'success');
  }, [selectedWorkItem, delegateUser, currentUser, addToast]);

  /* ════════════════════════════
     ORG CHART HANDLERS (FIXED)
  ════════════════════════════ */
  const openOrgModal = useCallback((type, data={}) => {
    setOrgLocalName(data.name||''); setOrgLocalDept(data.deptId||data.parentId||''); setOrgLocalLevel(data.level||3);
    setOrgModal({ type, data });
  }, []);

  const handleOrgSave = useCallback(async () => {
    if (!orgLocalName.trim()) { addToast('Vui lòng nhập tên', 'warning'); return; }
    if (orgModal.type==='dept') {
      const row = { name:orgLocalName, parent_id:orgLocalDept||null };
      if (orgModal.data?.id) {
        await supabase.from('departments').update(row).eq('id', orgModal.data.id);
        setDepartments(prev=>prev.map(d=>d.id===orgModal.data.id?{...d,name:orgLocalName,parentId:orgLocalDept||null}:d));
      } else {
        const { data } = await supabase.from('departments').insert([row]).select().single();
        if (data) setDepartments(prev=>[...prev, normDept(data)]);
      }
      addToast(`Đã lưu phòng ban "${orgLocalName}"`, 'success');
    } else {
      const row = { name:orgLocalName, dept_id:orgLocalDept, level:orgLocalLevel };
      if (orgModal.data?.id) {
        await supabase.from('positions').update(row).eq('id', orgModal.data.id);
        setPositions(prev=>prev.map(p=>p.id===orgModal.data.id?{...p,name:orgLocalName,deptId:orgLocalDept,level:orgLocalLevel}:p));
      } else {
        const { data } = await supabase.from('positions').insert([{...row,users:[]}]).select().single();
        if (data) setPositions(prev=>[...prev, normPos(data)]);
      }
      addToast(`Đã lưu chức danh "${orgLocalName}"`, 'success');
    }
    setOrgModal(null);
  }, [orgModal, orgLocalName, orgLocalDept, orgLocalLevel, addToast]);

  /* ════════════════════════════
     FORM BUILDER HELPERS
  ════════════════════════════ */
  const updateForm = useCallback(async (updatedForm) => {
    setForms(prev=>prev.map(f=>f.id===updatedForm.id?updatedForm:f));
    const { error } = await supabase.from('forms').update({ name:updatedForm.name, category:updatedForm.category, fields:updatedForm.fields }).eq('id', updatedForm.id);
    if (error) addToast('Lỗi lưu mẫu biểu: '+error.message, 'error');
  }, [addToast]);

  const moveField = useCallback((formId, idx, dir) => {
    const form = forms.find(f=>f.id===formId);
    if (!form) return;
    const fields = [...form.fields];
    const target = idx+dir;
    if (target<0||target>=fields.length) return;
    [fields[idx],fields[target]]=[fields[target],fields[idx]];
    updateForm({ ...form, fields });
  }, [forms, updateForm]);

  /* ════════════════════════════
     USER MANAGEMENT HANDLERS
  ════════════════════════════ */
  const handleUpdateUserRole = useCallback(async (userId, newRole) => {
    const { error } = await supabase.from('profiles').update({ role:newRole }).eq('id', userId);
    if (error) { addToast('Lỗi cập nhật role: '+error.message, 'error'); return; }
    setUsers(prev=>prev.map(u=>u.id===userId?{...u,role:newRole}:u));
    if (userId === currentUser.id) onUserUpdate({...currentUser, role:newRole});
    addToast('Đã cập nhật vai trò', 'success');
    setEditUserModal(null);
  }, [addToast, currentUser, onUserUpdate]);

  const handleToggleUserActive = useCallback(async (userId, isActive) => {
    const { error } = await supabase.from('profiles').update({ is_active:!isActive }).eq('id', userId);
    if (error) { addToast('Lỗi: '+error.message, 'error'); return; }
    setUsers(prev=>prev.map(u=>u.id===userId?{...u,is_active:!isActive}:u));
    addToast(isActive?'Đã vô hiệu hóa tài khoản':'Đã kích hoạt tài khoản', 'info');
  }, [addToast]);

  /* ════════════════════════════
     PERMISSION MATRIX STATE (Admin cấu hình)
  ════════════════════════════ */
  // Ma trận quyền module — Admin có thể điều chỉnh
  const DEFAULT_MODULE_PERMS = {
    dashboard:   { admin:true,  director:true,  manager:true,  employee:true  },
    processes:   { admin:true,  director:true,  manager:true,  employee:false },  // view-only for non-admin
    designer:    { admin:true,  director:false, manager:false, employee:false },
    workitems:   { admin:true,  director:true,  manager:true,  employee:true  },
    orgchart:    { admin:true,  director:true,  manager:true,  employee:false },
    formbuilder: { admin:true,  director:false, manager:false, employee:false },
    users:       { admin:true,  director:false, manager:false, employee:false },
    permissions: { admin:true,  director:false, manager:false, employee:false },
  };
  const [modulePerms, setModulePerms] = useState(DEFAULT_MODULE_PERMS);
  const [permsLoaded, setPermsLoaded] = useState(false);
  // permDraft: bản nháp trong Permission Matrix UI (top-level để tránh hooks violation)
  const [permDraft, setPermDraft] = useState(DEFAULT_MODULE_PERMS);

  // Tải cấu hình phân quyền từ Supabase
  useEffect(() => {
    supabase.from('settings').select('value').eq('key','module_permissions').single()
      .then(({ data }) => {
        if (data?.value) setModulePerms({ ...DEFAULT_MODULE_PERMS, ...data.value });
        setPermsLoaded(true);
      }).catch(() => setPermsLoaded(true));
  }, []);

  // Sync permDraft mỗi khi modulePerms thay đổi (sau khi tải từ Supabase)
  useEffect(() => { setPermDraft(modulePerms); }, [modulePerms]);

  const saveModulePerms = async (newPerms) => {
    setModulePerms(newPerms);
    await supabase.from('settings').upsert([{ key:'module_permissions', value:newPerms }]);
    addToast('Đã lưu cấu hình phân quyền', 'success');
  };

  // Kiểm tra quyền truy cập module cho user hiện tại
  const canAccessModule = useCallback((moduleId) => {
    return modulePerms[moduleId]?.[currentUser.role] ?? false;
  }, [modulePerms, currentUser.role]);

  /* ════════════════════════════════════════════
     RENDER: DASHBOARD
  ════════════════════════════════════════════ */
  const renderDashboard = () => {
    const completionRate = stats.total > 0 ? Math.round((stats.closed/stats.total)*100) : 0;
    const urgentItems = visibleWorkItems.filter(w=>w.priority==='urgent'&&w.status==='in_progress');
    const recentLogs  = visibleWorkItems.flatMap(wi=>wi.logs.map(l=>({...l,wiTitle:wi.title,wiId:wi.id}))).sort((a,b)=>new Date(b.performedAt)-new Date(a.performedAt)).slice(0,6);

    return (
      <div className="p-6 space-y-6 overflow-auto h-full bg-gray-50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Bảng Điều Khiển</h1>
            <p className="text-gray-500 text-sm mt-0.5">Xin chào, <strong>{currentUser.full_name}</strong> · <RoleBadge role={currentUser.role}/></p>
          </div>
          <div className="text-sm text-gray-400">{new Date().toLocaleDateString('vi-VN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {label:'Đang Xử Lý',val:stats.inProgress,icon:'⚡',color:'blue',   sub:`${stats.urgent} khẩn cấp`},
            {label:'Hoàn Thành', val:stats.closed,    icon:'✅',color:'emerald',sub:`${completionRate}% hoàn thành`},
            {label:'Từ Chối',    val:stats.rejected,  icon:'❌',color:'red',    sub:'phiếu bị từ chối'},
            {label:'Quá Hạn',   val:stats.overdue,   icon:'⏰',color:'orange', sub:'cần xử lý gấp'},
          ].map(s=>(
            <div key={s.label} className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className={`text-3xl font-bold text-${s.color}-600`}>{s.val}</div>
                  <div className="text-sm font-semibold text-gray-700 mt-1">{s.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
                </div>
                <span className="text-2xl">{s.icon}</span>
              </div>
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full bg-${s.color}-400 rounded-full`} style={{width:`${stats.total>0?Math.min(100,(s.val/stats.total)*100):0}%`}}/>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Phiếu khẩn */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Phiếu Khẩn ({urgentItems.length})
            </h2>
            {urgentItems.length===0 ? <div className="text-sm text-gray-400 py-4 text-center">Không có phiếu khẩn</div>
              : urgentItems.slice(0,4).map(wi=>{
                const proc=processes.find(p=>p.id===wi.processId);
                const step=proc?.steps?.find(s=>s.id===wi.currentStepId);
                return (
                  <div key={wi.id} onClick={()=>{setSelectedWorkItemId(wi.id);setPage('workitems');}}
                       className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 cursor-pointer mb-2">
                    <span className="text-red-500 mt-0.5">🔴</span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{wi.title}</div>
                      <div className="text-xs text-gray-500">{step?.name}</div>
                    </div>
                  </div>
                );
              })
            }
          </div>

          {/* Hoạt động gần đây */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-bold text-gray-700 mb-3">🕐 Hoạt Động Gần Đây</h2>
            <div className="space-y-2.5">
              {recentLogs.map((log,idx)=>(
                <div key={idx} onClick={()=>{setSelectedWorkItemId(log.wiId);setPage('workitems');}} className="flex gap-2.5 cursor-pointer hover:bg-gray-50 rounded-lg p-1 -mx-1">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0"/>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-700 truncate">{log.action}</div>
                    <div className="text-xs text-gray-400 truncate">{log.wiTitle}</div>
                    <div className="text-xs text-gray-400">{log.performedBy} · {new Date(log.performedAt).toLocaleString('vi-VN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
              ))}
              {recentLogs.length===0&&<div className="text-sm text-gray-400 text-center py-4">Chưa có hoạt động</div>}
            </div>
          </div>

          {/* Quy trình */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-bold text-gray-700 mb-3">⬡ Quy Trình ({processes.length})</h2>
            <div className="space-y-2 mb-4">
              {processes.slice(0,4).map(p=>{
                const wiCount=visibleWorkItems.filter(w=>w.processId===p.id&&w.status==='in_progress').length;
                return (
                  <div key={p.id} onClick={()=>{setSelectedProcess(p);setPage(can.canEditProcess?'designer':'processes');}}
                       className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-blue-50 cursor-pointer border border-transparent hover:border-blue-100 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.steps?.length||0} bước{wiCount>0?` · ${wiCount} phiếu`:''}</div>
                    </div>
                    <StatusBadge status={p.status}/>
                  </div>
                );
              })}
            </div>
            {can.canManageProcesses && (
              <button onClick={handleCreateNewProcess} className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">+ Tạo Quy Trình</button>
            )}
          </div>
        </div>

        {/* Phân bổ phiếu */}
        {stats.total > 0 && (
          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-bold text-gray-700 mb-3">📊 Phân Bổ Phiếu Công Tác ({stats.total})</h2>
            <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
              {stats.inProgress>0&&<div className="bg-blue-500 flex items-center justify-center text-white text-xs font-bold" style={{width:`${(stats.inProgress/stats.total)*100}%`}}>{stats.inProgress}</div>}
              {stats.closed>0&&<div className="bg-emerald-500 flex items-center justify-center text-white text-xs font-bold" style={{width:`${(stats.closed/stats.total)*100}%`}}>{stats.closed}</div>}
              {stats.rejected>0&&<div className="bg-red-500 flex items-center justify-center text-white text-xs font-bold" style={{width:`${(stats.rejected/stats.total)*100}%`}}>{stats.rejected}</div>}
            </div>
            <div className="flex gap-5 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"/>Đang xử lý ({stats.inProgress})</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/>Hoàn thành ({stats.closed})</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"/>Từ chối ({stats.rejected})</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ════════════════════════════════════════════
     RENDER: PROCESS LIST
  ════════════════════════════════════════════ */
  const renderProcessList = () => (
    <div className="p-6 overflow-auto h-full bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản Lý Quy Trình</h1>
          <p className="text-sm text-gray-500">Thiết kế và công bố quy trình nghiệp vụ</p>
        </div>
        {can.canManageProcesses && (
          <button onClick={handleCreateNewProcess} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-sm shadow-sm">+ Tạo Mới</button>
        )}
      </div>
      <div className="space-y-3">
        {processes.map(p=>{
          const wiRunning=visibleWorkItems.filter(w=>w.processId===p.id&&w.status==='in_progress').length;
          return (
            <div key={p.id} className="bg-white border rounded-xl p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800 text-lg">{p.name}</div>
                  <div className="text-sm text-gray-500 mt-1">{p.steps?.length||0} bước · {p.connections?.length||0} kết nối · Phiên bản {p.version}</div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {(p.steps||[]).filter(s=>s.type==='task').map(s=>(
                      <span key={s.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">{s.name}</span>
                    ))}
                  </div>
                  {wiRunning>0&&<div className="mt-2 text-xs text-emerald-600 font-medium">⚡ {wiRunning} phiếu đang chạy</div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={p.status}/>
                  <button onClick={()=>{setSelectedProcess(p);setSelectedNodeId(null);setConnectMode(false);setConnectFrom(null);setPage('designer');}}
                          className={`px-3 py-1.5 text-sm rounded-xl font-semibold ${can.canEditProcess?'bg-blue-600 text-white hover:bg-blue-700':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {can.canEditProcess?'✏ Thiết Kế':'👁 Xem'}
                  </button>
                  {can.canManageProcesses&&(
                    <button onClick={()=>{if(window.confirm('Xóa quy trình này?')){supabase.from('processes').delete().eq('id',p.id);setProcesses(prev=>prev.filter(x=>x.id!==p.id));addToast('Đã xóa','info');}}}
                            className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-xl hover:bg-red-50">Xóa</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {processes.length===0&&<div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">⬡</div><div className="font-medium">Chưa có quy trình nào</div>{can.canManageProcesses&&<button onClick={handleCreateNewProcess} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold">+ Tạo Quy Trình Đầu Tiên</button>}</div>}
      </div>
    </div>
  );

  /* ════════════════════════════════════════════
     RENDER: PROCESS DESIGNER
  ════════════════════════════════════════════ */
  const renderDesigner = () => {
    if (!selectedProcess) return <div className="p-6 text-gray-500">Chưa chọn quy trình.</div>;
    const selectedNode = selectedProcess.steps?.find(s=>s.id===selectedNodeId);
    const isReadOnly = !can.canEditProcess;

    const nodeStyle = (step) => {
      const isSel=step.id===selectedNodeId, isFrom=step.id===connectFrom;
      const base='absolute select-none flex items-center justify-center text-center shadow-md transition-all duration-150';
      const cursor=isReadOnly?'cursor-default':'cursor-pointer';
      if (step.type==='start') return `${base} ${cursor} w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white ${isSel?'ring-4 ring-emerald-300 scale-110':'hover:scale-105'}`;
      if (step.type==='end')   return `${base} ${cursor} w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white ${isSel?'ring-4 ring-red-300 scale-110':'hover:scale-105'}`;
      if (step.type==='gateway') return `${base} ${cursor} w-16 h-16 rotate-45 bg-gradient-to-br from-yellow-300 to-amber-500 text-yellow-900 ${isSel?'ring-4 ring-yellow-300':''}`;
      return `${base} ${cursor} w-32 min-h-14 rounded-xl bg-white border-2 px-2 py-2 flex-col gap-0.5 ${isFrom?'border-blue-500 bg-blue-50 ring-2 ring-blue-300':isSel?'border-blue-500 ring-2 ring-blue-200':'border-gray-300 hover:border-blue-400 hover:shadow-lg'}`;
    };

    return (
      <div className="flex flex-col h-full overflow-hidden bg-gray-100">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 bg-white border-b shadow-sm flex-shrink-0">
          <button onClick={()=>{setPage('processes');setSelectedNodeId(null);setConnectMode(false);setConnectFrom(null);}} className="text-gray-500 hover:text-blue-600 text-sm font-medium">← Quay Lại</button>
          <div className="w-px h-5 bg-gray-300"/>
          <input value={selectedProcess.name} disabled={isReadOnly}
                 onChange={e=>!isReadOnly&&updateProcess({...selectedProcess,name:e.target.value})}
                 className={`flex-1 font-bold text-gray-800 border-b-2 border-transparent focus:border-blue-400 focus:outline-none bg-transparent px-1 text-base ${isReadOnly?'cursor-default':''}`}/>
          <StatusBadge status={selectedProcess.status}/>
          <span className="text-xs text-gray-400">v{selectedProcess.version}</span>
          {isReadOnly && <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">👁 Chỉ Xem</span>}
          {!isReadOnly && (
            <div className="flex gap-2 ml-2">
              <button onClick={()=>{setConnectMode(!connectMode);setConnectFrom(null);}}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${connectMode?'bg-orange-500 text-white':'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-gray-200'}`}>
                🔗 {connectMode?'Đang Kết Nối (Tắt)':'Bật Kết Nối'}
              </button>
              <button onClick={handleValidatePublish} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700">✓ Công Bố</button>
            </div>
          )}
        </div>

        {connectMode&&!isReadOnly&&(
          <div className="px-5 py-2 bg-orange-50 border-b border-orange-200 text-sm text-orange-700 flex-shrink-0 flex items-center gap-2">
            🔗 {connectFrom?<span>Đã chọn <strong>"{selectedProcess.steps?.find(s=>s.id===connectFrom)?.name}"</strong> — Click nút đích</span>:<span>Click nút <strong>nguồn</strong> để bắt đầu kết nối</span>}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Palette (chỉ hiện khi admin) */}
          {!isReadOnly && (
            <div className="w-40 bg-white border-r p-3 flex-shrink-0 overflow-y-auto">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Phần Tử BPMN</div>
              {[{type:'start',label:'▶  Bắt Đầu',color:'bg-emerald-50 border-emerald-300 text-emerald-700'},{type:'task',label:'⬜  Bước Làm',color:'bg-blue-50 border-blue-300 text-blue-700'},{type:'gateway',label:'◈  Rẽ Nhánh',color:'bg-amber-50 border-amber-300 text-amber-700'},{type:'end',label:'⬛  Kết Thúc',color:'bg-red-50 border-red-300 text-red-700'}].map(item=>(
                <div key={item.type} draggable onDragStart={e=>e.dataTransfer.setData('nodeType',item.type)}
                     className={`p-2.5 border rounded-xl mb-2 cursor-grab text-xs font-semibold transition-all active:scale-95 ${item.color}`}>{item.label}</div>
              ))}
              <div className="mt-4 pt-3 border-t text-xs text-gray-500 space-y-1">
                <div>📦 {selectedProcess.steps?.length||0} nút</div>
                <div>🔗 {selectedProcess.connections?.length||0} kết nối</div>
              </div>
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 relative overflow-auto" ref={canvasRef}
               style={{backgroundImage:'radial-gradient(circle, #d1d5db 1px, transparent 1px)',backgroundSize:'24px 24px',backgroundPosition:'12px 12px'}}
               onMouseMove={!isReadOnly?handleCanvasMouseMove:undefined}
               onMouseUp={!isReadOnly?handleCanvasMouseUp:undefined}
               onMouseLeave={!isReadOnly?handleCanvasMouseUp:undefined}
               onDragOver={!isReadOnly?e=>e.preventDefault():undefined}
               onDrop={!isReadOnly?handleCanvasDrop:undefined}
               onClick={()=>{if(!connectMode)setSelectedNodeId(null);setConnectFrom(null);}}>

            <svg className="absolute inset-0 pointer-events-none" style={{width:'100%',height:'100%',minWidth:960,minHeight:520}}>
              <defs>
                <marker id="arrowBlue" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto">
                  <polygon points="0 0, 9 3.5, 0 7" fill="#3b82f6"/>
                </marker>
              </defs>
              {(selectedProcess.connections||[]).map(conn=>{
                const from=selectedProcess.steps?.find(s=>s.id===conn.from);
                const to  =selectedProcess.steps?.find(s=>s.id===conn.to);
                if (!from||!to) return null;
                const fw=from.type==='task'?128:64, fh=from.type==='task'?28:32, th=to.type==='task'?28:32;
                const fx=from.x+fw, fy=from.y+fh, tx=to.x, ty=to.y+th, mx=(fx+tx)/2;
                const path=`M${fx},${fy} C${mx},${fy} ${mx},${ty} ${tx},${ty}`;
                return (
                  <g key={conn.id} className={`pointer-events-auto ${!isReadOnly?'cursor-pointer':''}`}
                     onClick={e=>{e.stopPropagation();if(!isReadOnly&&window.confirm(`Xóa kết nối "${from.name}" → "${to.name}"?`))handleDeleteConnection(conn.from,conn.to);}}>
                    <path d={path} stroke="transparent" strokeWidth="12" fill="none"/>
                    <path d={path} stroke="#3b82f6" strokeWidth="2" fill="none" markerEnd="url(#arrowBlue)" opacity="0.8"/>
                  </g>
                );
              })}
            </svg>

            <div style={{position:'relative',minWidth:960,minHeight:520}}>
              {(selectedProcess.steps||[]).map(step=>(
                <div key={step.id} className={nodeStyle(step)}
                     style={{left:step.x,top:step.y,zIndex:dragging?.stepId===step.id?100:10,userSelect:'none'}}
                     onMouseDown={!isReadOnly?e=>handleNodeMouseDown(e,step):()=>setSelectedNodeId(step.id)}
                     onClick={e=>e.stopPropagation()}>
                  {step.type==='start'||step.type==='end' ? <span className="text-xl">{step.type==='start'?'▶':'⬛'}</span>
                   : step.type==='gateway' ? <span className="-rotate-45 text-xs font-bold">{step.name}</span>
                   : <>
                      <span className="text-xs font-semibold text-gray-800 leading-tight text-center px-1 block">{step.name}</span>
                      <span className="text-gray-400 font-normal block" style={{fontSize:9}}>{getPosName(step.assignee)}</span>
                      {step.slaHours>0&&<span className="text-blue-400 font-normal block" style={{fontSize:8}}>⏱ {step.slaHours}h</span>}
                      {!isReadOnly&&<span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold" style={{fontSize:9}}>{step.actions?.length||0}</span>}
                    </>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Property Panel */}
          {selectedNode && !isReadOnly && (
            <div className="w-72 bg-white border-l p-4 overflow-y-auto flex-shrink-0">
              <div className="flex justify-between items-center mb-4 pb-3 border-b">
                <span className="font-bold text-gray-800 text-sm">⚙ Cấu Hình Bước</span>
                <button onClick={()=>setSelectedNodeId(null)} className="text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100">✕</button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Tên Bước</label>
                  <input value={selectedNode.name} onChange={e=>handleSaveNode(selectedNode.id,{name:e.target.value})} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"/>
                </div>
                {selectedNode.type==='task'&&(
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Người Phụ Trách</label>
                      <select value={selectedNode.assignee||''} onChange={e=>handleSaveNode(selectedNode.id,{assignee:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300">
                        <option value="">— Chọn chức danh —</option>
                        {positions.map(pos=><option key={pos.id} value={pos.id}>{pos.name} · {getDeptName(pos.deptId)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Mẫu Biểu</label>
                      <select multiple value={selectedNode.forms||[]} onChange={e=>handleSaveNode(selectedNode.id,{forms:Array.from(e.target.selectedOptions,o=>o.value)})} className="w-full border rounded-lg px-3 py-2 text-sm" size={3}>
                        {forms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">SLA (Giờ)</label>
                      <input type="number" min="0" value={selectedNode.slaHours||0} onChange={e=>handleSaveNode(selectedNode.id,{slaHours:parseInt(e.target.value)||0})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300"/>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Hành Động</label>
                        <button onClick={()=>handleSaveNode(selectedNode.id,{actions:[...selectedNode.actions,{id:`a${Date.now()}`,label:'Hành Động Mới',targetStepId:'',requireComment:false,color:'blue'}]})} className="text-xs bg-blue-600 text-white px-2.5 py-0.5 rounded-full hover:bg-blue-700">+ Thêm</button>
                      </div>
                      {(selectedNode.actions||[]).map((action,idx)=>(
                        <div key={action.id} className="border rounded-xl p-3 mb-2 bg-gray-50 space-y-2">
                          <input value={action.label} onChange={e=>{const a=[...selectedNode.actions];a[idx]={...a[idx],label:e.target.value};handleSaveNode(selectedNode.id,{actions:a});}} className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-medium" placeholder="Nhãn nút"/>
                          <select value={action.targetStepId||''} onChange={e=>{const a=[...selectedNode.actions];a[idx]={...a[idx],targetStepId:e.target.value};handleSaveNode(selectedNode.id,{actions:a});}} className="w-full border rounded-lg px-2.5 py-1.5 text-xs">
                            <option value="">— Bước đích —</option>
                            {(selectedProcess.steps||[]).filter(s=>s.id!==selectedNode.id).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <select value={action.color||'blue'} onChange={e=>{const a=[...selectedNode.actions];a[idx]={...a[idx],color:e.target.value};handleSaveNode(selectedNode.id,{actions:a});}} className="flex-1 border rounded-lg px-2 py-1 text-xs">
                              <option value="blue">🔵 Xanh</option><option value="green">🟢 Duyệt</option><option value="yellow">🟡 Trả lại</option><option value="red">🔴 Từ chối</option>
                            </select>
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                              <input type="checkbox" checked={action.requireComment||false} onChange={e=>{const a=[...selectedNode.actions];a[idx]={...a[idx],requireComment:e.target.checked};handleSaveNode(selectedNode.id,{actions:a});}}/> Bắt buộc ghi chú
                            </label>
                          </div>
                          <button onClick={()=>handleSaveNode(selectedNode.id,{actions:selectedNode.actions.filter((_,i)=>i!==idx)})} className="w-full text-xs text-red-500 hover:text-red-700 py-1 hover:bg-red-50 rounded">✕ Xóa</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <button onClick={()=>{if(window.confirm('Xóa bước này?'))handleDeleteNode(selectedNode.id);}} className="w-full py-2 border border-red-200 text-red-600 text-sm rounded-xl hover:bg-red-50 mt-2 font-medium">🗑 Xóa Bước</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════
     RENDER: EOFFICE MANAGER
  ════════════════════════════════════════════ */
  const renderWorkItems = () => {
    const wi=selectedWorkItem, proc=wi?processes.find(p=>p.id===wi.processId):null;
    const currentStep=proc?proc.steps?.find(s=>s.id===wi.currentStepId):null;
    const isClosed=wi&&['closed','rejected'].includes(wi.status);
    const slaInfo=wi&&currentStep?getSLAInfo(wi,currentStep):null;
    const allUsers=positions.flatMap(p=>p.users);
    const colorMap={blue:'bg-blue-600 hover:bg-blue-700',green:'bg-emerald-600 hover:bg-emerald-700',yellow:'bg-amber-500 hover:bg-amber-600',red:'bg-red-600 hover:bg-red-700'};
    const priBorder={urgent:'border-l-red-500',high:'border-l-orange-400',normal:'border-l-blue-400',low:'border-l-gray-300'};

    return (
      <div className="flex h-full overflow-hidden">
        {/* LEFT: List */}
        <div className="w-80 flex flex-col bg-white border-r flex-shrink-0">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-gray-800">Phiếu Công Tác</h2>
              <select onChange={e=>{if(e.target.value){handleCreateWorkItem(e.target.value);e.target.value='';} }} className="text-xs border rounded-lg px-2 py-1.5 bg-blue-600 text-white cursor-pointer font-medium">
                <option value="">+ Tạo Phiếu</option>
                {processes.filter(p=>p.status==='active').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <input value={wiSearch} onChange={e=>setWiSearch(e.target.value)} placeholder="🔍 Tìm kiếm..." className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
            <div className="flex gap-1 mt-2.5 flex-wrap">
              {[['all','Tất Cả'],['in_progress','Đang XL'],['closed','Hoàn Thành'],['rejected','Từ Chối']].map(([val,label])=>(
                <button key={val} onClick={()=>setWiTab(val)} className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${wiTab===val?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
              ))}
            </div>
            {!can.canSeeAllWorkItems&&<div className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1">👁 Bạn chỉ xem được phiếu của mình</div>}
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredWorkItems.length===0&&<div className="p-8 text-center text-gray-400"><div className="text-4xl mb-2">📋</div><div className="text-sm">Không có phiếu nào</div></div>}
            {filteredWorkItems.map(item=>{
              const p=processes.find(x=>x.id===item.processId);
              const step=p?.steps?.find(s=>s.id===item.currentStepId);
              const isOver=item.dueDate&&new Date(item.dueDate)<new Date()&&!['closed','rejected'].includes(item.status);
              const sla=step?getSLAInfo(item,step):null;
              return (
                <div key={item.id} onClick={()=>{setSelectedWorkItemId(item.id);setWiComment('');setWiFormInputs({});}}
                     className={`p-3 border-b cursor-pointer transition-colors hover:bg-blue-50 border-l-4 ${priBorder[item.priority]||'border-l-gray-200'} ${selectedWorkItemId===item.id?'bg-blue-50':'bg-white'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">{item.title}</div>
                    <StatusBadge status={item.status}/>
                  </div>
                  <div className="text-xs text-gray-500">{p?.name}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <PriorityBadge priority={item.priority}/>
                    {step&&<span className="text-xs text-blue-600 font-medium">📍 {step.name}</span>}
                    {isOver&&<span className="text-xs text-red-600 font-semibold">⚠ Quá hạn</span>}
                    {sla&&<span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${sla.bg} ${sla.cls}`}>{sla.label}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Detail */}
        {wi ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
            <div className="px-6 py-4 bg-white border-b shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-800 text-lg leading-snug">{wi.title}</h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <StatusBadge status={wi.status}/><PriorityBadge priority={wi.priority}/>
                    <span className="text-xs text-gray-500">Bởi: {wi.createdBy}</span>
                    {wi.dueDate&&<span className={`text-xs font-medium ${new Date(wi.dueDate)<new Date()&&!isClosed?'text-red-600':'text-gray-500'}`}>📅 {new Date(wi.dueDate).toLocaleDateString('vi-VN')}</span>}
                    {slaInfo&&<span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${slaInfo.bg} ${slaInfo.cls}`}>{slaInfo.label}</span>}
                  </div>
                </div>
                {!isClosed&&(
                  <div className="flex gap-2 flex-shrink-0">
                    <select value={wi.priority} onChange={async e=>{const newPri=e.target.value;setWorkItems(prev=>prev.map(w=>w.id===wi.id?{...w,priority:newPri}:w));await supabase.from('work_items').update({priority:newPri}).eq('id',wi.id);}} className="text-xs border rounded-lg px-2 py-1.5">
                      <option value="low">⚪ Thấp</option><option value="normal">🔵 Thường</option><option value="high">🟠 Cao</option><option value="urgent">🔴 Khẩn</option>
                    </select>
                    <button onClick={()=>setDelegateModal(true)} className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-50 font-medium text-gray-600">👤 Ủy Quyền</button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Process Map */}
              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm">📍 Tiến Trình</h3>
                <div className="flex items-center gap-1 flex-wrap">
                  {proc?.steps?.map((step,idx)=>{
                    const isDone=wi.logs.some(l=>l.fromStepId===step.id), isCur=step.id===wi.currentStepId;
                    return (
                      <React.Fragment key={step.id}>
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isCur?'bg-blue-600 text-white border-blue-600 shadow-md':isDone&&!isCur?'bg-emerald-100 text-emerald-700 border-emerald-300':'bg-gray-100 text-gray-400 border-gray-200'}`}>
                          {isCur&&'⚡ '}{isDone&&!isCur&&'✓ '}{step.name}
                        </div>
                        {idx<proc.steps.length-1&&<span className="text-gray-300 font-bold">›</span>}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Current Step */}
              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-semibold text-gray-700 mb-2 text-sm">⚙ Bước Hiện Tại: {currentStep?.name}</h3>
                {currentStep?.type==='task'&&<div className="text-sm text-gray-600 flex flex-wrap gap-4">
                  <span><span className="text-gray-400">Người phụ trách:</span> <span className="font-medium text-blue-700">{getPosName(currentStep.assignee)}</span></span>
                  {currentStep.slaHours>0&&<span><span className="text-gray-400">SLA:</span> <span className="font-medium">{currentStep.slaHours} giờ</span></span>}
                </div>}
              </div>

              {/* Form Filling */}
              {!isClosed&&currentStep?.forms&&currentStep.forms.length>0&&(
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">📄 Điền Thông Tin</h3>
                  {currentStep.forms.map(fid=>{
                    const form=forms.find(f=>f.id===fid); if(!form)return null;
                    return (
                      <div key={fid} className="mb-4">
                        <div className="text-xs font-bold text-blue-600 mb-2 uppercase">{form.name}</div>
                        <div className="space-y-3">
                          {form.fields.map(field=>{
                            const key=`${fid}_${field.id}`;
                            const val=wiFormInputs[key]!==undefined?wiFormInputs[key]:(wi.formData[key]||'');
                            const onChange=v=>setWiFormInputs(prev=>({...prev,[key]:v}));
                            return (
                              <div key={field.id}>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{field.label}{field.required&&<span className="text-red-500 ml-0.5">*</span>}</label>
                                {field.type==='textarea'?<textarea value={val} onChange={e=>onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 resize-none" rows={2} placeholder={field.placeholder}/>
                                :field.type==='dropdown'?<select value={val} onChange={e=>onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300"><option value="">— Chọn —</option>{field.options.map(o=><option key={o}>{o}</option>)}</select>
                                :field.type==='date'?<input type="date" value={val} onChange={e=>onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300"/>
                                :<input type={field.type==='number'?'number':'text'} value={val} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300"/>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              {!isClosed&&currentStep?.actions&&currentStep.actions.length>0&&(
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">💬 Bình Luận & Hành Động</h3>
                  <textarea value={wiComment} onChange={e=>setWiComment(e.target.value)} placeholder="Nhập bình luận, ý kiến xử lý..." className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-300 resize-none mb-3" rows={3}/>
                  <div className="flex flex-wrap gap-2">
                    {currentStep.actions.map(action=>(
                      <button key={action.id} onClick={()=>handleWorkItemAction(action)}
                              className={`px-5 py-2 rounded-xl text-white font-semibold text-sm shadow-sm hover:shadow-md transition-all active:scale-95 ${colorMap[action.color]||colorMap.blue}`}>
                        {action.label}{action.requireComment&&<span className="ml-1 opacity-70 text-xs">*</span>}
                      </button>
                    ))}
                  </div>
                  {currentStep.actions.some(a=>a.requireComment)&&<p className="text-xs text-gray-400 mt-2">* Yêu cầu nhập bình luận</p>}
                </div>
              )}
              {isClosed&&(
                <div className={`rounded-xl border p-4 ${wi.status==='closed'?'bg-emerald-50 border-emerald-200':'bg-red-50 border-red-200'}`}>
                  <div className={`font-bold text-base ${wi.status==='closed'?'text-emerald-700':'text-red-700'}`}>{wi.status==='closed'?'✅ Phiếu đã hoàn thành':'❌ Phiếu đã bị từ chối'}</div>
                </div>
              )}

              {/* Audit Trail */}
              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-semibold text-gray-700 mb-4 text-sm">📋 Lịch Sử ({wi.logs.length} sự kiện)</h3>
                <div className="space-y-0">
                  {wi.logs.map((log,idx)=>(
                    <div key={log.id||idx} className="flex gap-3">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`w-3 h-3 rounded-full mt-0.5 border-2 border-white shadow ${idx===wi.logs.length-1?'bg-blue-500':'bg-emerald-500'}`}/>
                        {idx<wi.logs.length-1&&<div className="w-0.5 bg-gray-200 flex-1 min-h-4"/>}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-800">{log.action}</span>
                          <span className="text-xs text-gray-400">{new Date(log.performedAt).toLocaleString('vi-VN')}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {getStepName(proc,log.fromStepId)}{log.fromStepId!==log.toStepId&&<><span className="mx-1 text-gray-300">→</span><span className="text-blue-600 font-medium">{getStepName(proc,log.toStepId)}</span></>}
                          <span className="mx-2 text-gray-300">·</span><span className="font-medium">{log.performedBy}</span>
                        </div>
                        {log.comment&&<div className="mt-1 text-xs text-gray-600 bg-gray-50 border rounded-lg px-3 py-2 italic">"{log.comment}"</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-3 bg-gray-50">
            <div className="text-6xl">📋</div>
            <div className="text-lg font-semibold text-gray-500">Chọn phiếu để xem chi tiết</div>
          </div>
        )}

        {/* Delegate Modal */}
        <Modal open={delegateModal} title="👤 Ủy Quyền Xử Lý" onClose={()=>{setDelegateModal(false);setDelegateUser('');}}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Chuyển quyền xử lý cho người khác. Hành động này được ghi vào lịch sử.</p>
            <select value={delegateUser} onChange={e=>setDelegateUser(e.target.value)} className="w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-300">
              <option value="">— Chọn người dùng —</option>
              {allUsers.filter(u=>u!==currentUser.full_name).map(u=><option key={u} value={u}>{u}</option>)}
            </select>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={()=>{setDelegateModal(false);setDelegateUser('');}} className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
              <button onClick={handleDelegate} disabled={!delegateUser} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">Xác Nhận</button>
            </div>
          </div>
        </Modal>
      </div>
    );
  };

  /* ════════════════════════════════════════════
     RENDER: ORG CHART (FIXED - no hooks inside)
  ════════════════════════════════════════════ */
  const renderOrgChart = () => (
    <div className="p-6 overflow-auto h-full bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-2xl font-bold text-gray-800">Cơ Cấu Tổ Chức</h1><p className="text-sm text-gray-500">Phòng ban và chức danh</p></div>
        {can.canManageOrg&&(
          <div className="flex gap-2">
            <button onClick={()=>openOrgModal('dept')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-semibold shadow-sm">+ Thêm Phòng Ban</button>
            <button onClick={()=>openOrgModal('pos')}  className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700 font-semibold shadow-sm">+ Thêm Chức Danh</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-bold text-gray-700 mb-4">🏢 Phòng Ban ({departments.length})</h2>
          <div className="space-y-2">
            {departments.map(d=>{
              const posCount=positions.filter(p=>p.deptId===d.id).length;
              const parent=departments.find(x=>x.id===d.parentId);
              return (
                <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100">
                  <div>
                    <div className="font-semibold text-gray-800">{d.name}</div>
                    <div className="text-xs text-gray-500">{parent?`↳ ${parent.name}`:'🔝 Cấp cao nhất'} · {posCount} chức danh</div>
                  </div>
                  {can.canManageOrg&&(
                    <div className="flex gap-1">
                      <button onClick={()=>openOrgModal('dept',d)} className="text-xs text-blue-600 px-2 py-1 rounded hover:bg-blue-100">Sửa</button>
                      <button onClick={async()=>{if(window.confirm('Xóa?')){await supabase.from('departments').delete().eq('id',d.id);setDepartments(prev=>prev.filter(x=>x.id!==d.id));addToast('Đã xóa','info');}}} className="text-xs text-red-500 px-2 py-1 rounded hover:bg-red-50">Xóa</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-bold text-gray-700 mb-4">👤 Chức Danh ({positions.length})</h2>
          <div className="space-y-2">
            {positions.sort((a,b)=>a.level-b.level).map(pos=>(
              <div key={pos.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100">
                <div>
                  <div className="font-semibold text-gray-800 flex items-center gap-2">
                    {pos.name}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${pos.level===1?'bg-purple-100 text-purple-700':pos.level===2?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600'}`}>Cấp {pos.level}</span>
                  </div>
                  <div className="text-xs text-gray-500">{getDeptName(pos.deptId)} · {pos.users.length} người</div>
                  {pos.users.length>0&&<div className="flex gap-1 mt-1 flex-wrap">{pos.users.slice(0,3).map(u=><span key={u} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{u}</span>)}{pos.users.length>3&&<span className="text-xs text-gray-400">+{pos.users.length-3}</span>}</div>}
                </div>
                {can.canManageOrg&&(
                  <div className="flex gap-1">
                    <button onClick={()=>openOrgModal('pos',pos)} className="text-xs text-blue-600 px-2 py-1 rounded hover:bg-blue-100">Sửa</button>
                    <button onClick={async()=>{if(window.confirm('Xóa?')){await supabase.from('positions').delete().eq('id',pos.id);setPositions(prev=>prev.filter(x=>x.id!==pos.id));addToast('Đã xóa','info');}}} className="text-xs text-red-500 px-2 py-1 rounded hover:bg-red-50">Xóa</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Modal open={!!orgModal} title={orgModal?.type==='dept'?(orgModal?.data?.id?'Sửa Phòng Ban':'Thêm Phòng Ban'):(orgModal?.data?.id?'Sửa Chức Danh':'Thêm Chức Danh')} onClose={()=>setOrgModal(null)}>
        <div className="space-y-4">
          <div><label className="text-sm font-semibold text-gray-700 block mb-1.5">Tên *</label><input value={orgLocalName} onChange={e=>setOrgLocalName(e.target.value)} className="w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-300 text-sm" placeholder="Nhập tên..."/></div>
          {orgModal?.type==='dept'&&<div><label className="text-sm font-semibold text-gray-700 block mb-1.5">Phòng Ban Cha</label><select value={orgLocalDept} onChange={e=>setOrgLocalDept(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm"><option value="">— Cấp cao nhất —</option>{departments.filter(d=>d.id!==orgModal?.data?.id).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>}
          {orgModal?.type==='pos'&&<>
            <div><label className="text-sm font-semibold text-gray-700 block mb-1.5">Phòng Ban *</label><select value={orgLocalDept} onChange={e=>setOrgLocalDept(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm"><option value="">— Chọn —</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="text-sm font-semibold text-gray-700 block mb-1.5">Cấp Bậc</label><select value={orgLocalLevel} onChange={e=>setOrgLocalLevel(Number(e.target.value))} className="w-full border rounded-xl px-3 py-2 text-sm"><option value={1}>Cấp 1 — Lãnh đạo</option><option value={2}>Cấp 2 — Quản lý</option><option value={3}>Cấp 3 — Chuyên viên</option><option value={4}>Cấp 4 — Nhân viên</option></select></div>
          </>}
          <div className="flex justify-end gap-3 pt-2"><button onClick={()=>setOrgModal(null)} className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50 font-medium">Hủy</button><button onClick={handleOrgSave} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">Lưu</button></div>
        </div>
      </Modal>
    </div>
  );

  /* ════════════════════════════════════════════
     RENDER: FORM BUILDER (Admin only)
  ════════════════════════════════════════════ */
  const renderFormBuilder = () => {
    const form=selectedForm, editField=form?.fields.find(f=>f.id===editingFieldId);
    const FT=['text','number','date','textarea','dropdown','radio','checkbox','file','signature'];
    const FL={text:'Văn Bản',number:'Số',date:'Ngày',textarea:'Đoạn Văn',dropdown:'Dropdown',radio:'Lựa Chọn',checkbox:'Checkbox',file:'Tệp',signature:'Chữ Ký'};
    const FI={text:'T',number:'#',date:'📅',textarea:'¶',dropdown:'▾',radio:'◉',checkbox:'☑',file:'📎',signature:'✍'};
    const addField=type=>{if(!form)return;const nf={id:`fld${Date.now()}`,type,label:FL[type],placeholder:'',required:false,options:[]};updateForm({...form,fields:[...form.fields,nf]});setEditingFieldId(nf.id);};
    const delField=fid=>{if(!form)return;updateForm({...form,fields:form.fields.filter(f=>f.id!==fid)});if(editingFieldId===fid)setEditingFieldId(null);};
    const updEF=updates=>{if(!form||!editField)return;updateForm({...form,fields:form.fields.map(f=>f.id===editField.id?{...f,...updates}:f)});};
    const renderFP=(field)=>{const base='w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed';if(field.type==='textarea')return <textarea disabled className={`${base} resize-none`} rows={2} placeholder={field.placeholder}/>;if(field.type==='dropdown')return <select disabled className={base}><option>{field.options?.[0]||'— Chọn —'}</option></select>;if(field.type==='date')return <input disabled type="date" className={base}/>;if(field.type==='radio')return <div className="flex gap-3">{(field.options?.length?field.options:['Có','Không']).map(o=><label key={o} className="flex items-center gap-1 text-xs text-gray-400"><input type="radio" disabled/>{o}</label>)}</div>;if(field.type==='checkbox')return <div className="flex gap-3 flex-wrap">{(field.options?.length?field.options:['Mục 1']).map(o=><label key={o} className="flex items-center gap-1 text-xs text-gray-400"><input type="checkbox" disabled/>{o}</label>)}</div>;if(field.type==='file')return <div className="border-2 border-dashed border-gray-300 rounded-xl p-3 text-center text-gray-400 text-sm">📎 Kéo thả hoặc chọn tệp</div>;if(field.type==='signature')return <div className="border-2 border-dashed border-gray-300 rounded-xl h-14 flex items-center justify-center text-gray-400 text-sm">✍ Vùng ký tên</div>;return <input disabled type={field.type==='number'?'number':'text'} className={base} placeholder={field.placeholder||`Nhập ${field.label.toLowerCase()}...`}/>;};

    return (
      <div className="flex h-full overflow-hidden">
        <div className="w-56 bg-white border-r flex flex-col flex-shrink-0">
          <div className="p-4 border-b bg-gray-50"><div className="font-bold text-gray-800 mb-3">Mẫu Biểu</div><button onClick={()=>{setNewFormName('');setNewFormCategory('Chung');setNewFormModal(true);}} className="w-full text-sm bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 font-semibold">+ Tạo Mẫu Biểu</button></div>
          <div className="overflow-y-auto flex-1 p-2">{forms.map(f=><div key={f.id} onClick={()=>{setSelectedFormId(f.id);setEditingFieldId(null);setFormPreview(false);}} className={`p-3 rounded-xl cursor-pointer mb-1.5 transition-all ${selectedFormId===f.id?'bg-blue-50 border border-blue-300':'hover:bg-gray-50 border border-transparent'}`}><div className="text-sm font-semibold text-gray-800">{f.name}</div><div className="text-xs text-gray-400">{f.fields.length} trường · {f.category}</div></div>)}</div>
        </div>
        {form&&<div className="w-36 bg-gray-50 border-r p-3 flex-shrink-0 overflow-y-auto"><div className="text-xs font-bold text-gray-400 uppercase mb-3">Loại Field</div>{FT.map(t=><button key={t} onClick={()=>addField(t)} className="w-full text-left p-2 text-xs bg-white border rounded-xl mb-1.5 hover:bg-blue-50 hover:border-blue-300 font-semibold text-gray-700 transition-all flex items-center gap-1.5"><span className="w-4 text-center">{FI[t]}</span>{FL[t]}</button>)}</div>}
        {form?(
          <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
            <div className="max-w-xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                <div><h2 className="text-lg font-bold text-gray-800">{form.name}</h2><div className="text-xs text-gray-400">{form.category} · {form.fields.length} trường</div></div>
                <div className="flex gap-2">
                  <button onClick={()=>setFormPreview(!formPreview)} className={`px-3 py-1.5 text-sm rounded-xl font-medium ${formPreview?'bg-blue-600 text-white':'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{formPreview?'✏ Sửa':'👁 Xem'}</button>
                  <button onClick={async()=>{if(window.confirm('Xóa mẫu biểu?')){await supabase.from('forms').delete().eq('id',form.id);setForms(prev=>prev.filter(f=>f.id!==form.id));setSelectedFormId(null);addToast('Đã xóa','info');}}} className="px-3 py-1.5 text-sm rounded-xl border border-red-200 text-red-600 hover:bg-red-50">🗑 Xóa</button>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b"><h3 className="font-bold text-gray-800">{form.name}</h3><p className="text-xs text-gray-500 mt-0.5">{form.category} · {form.fields.length} trường</p></div>
                <div className="p-6 space-y-4">
                  {form.fields.length===0&&<div className="text-center py-12 text-gray-400"><div className="text-5xl mb-3">📝</div><div className="text-sm">Chọn loại field từ bảng bên trái để thêm</div></div>}
                  {form.fields.map((field,idx)=>(
                    <div key={field.id} onClick={()=>!formPreview&&setEditingFieldId(field.id)} className={`rounded-xl transition-all p-3 ${!formPreview?'cursor-pointer':''} ${editingFieldId===field.id&&!formPreview?'ring-2 ring-blue-400 bg-blue-50':'hover:bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm font-semibold text-gray-700">{FI[field.type]} {field.label}{field.required&&<span className="text-red-500 ml-1">*</span>}</label>
                        {!formPreview&&<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();moveField(form.id,idx,-1);}} className="w-6 h-6 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded flex items-center justify-center">↑</button><button onClick={e=>{e.stopPropagation();moveField(form.id,idx,1);}} className="w-6 h-6 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded flex items-center justify-center">↓</button><button onClick={e=>{e.stopPropagation();delField(field.id);}} className="w-6 h-6 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex items-center justify-center">✕</button></div>}
                      </div>
                      {renderFP(field)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ):<div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-3 bg-gray-100"><div className="text-6xl">📝</div><div>Chọn mẫu biểu hoặc tạo mới</div></div>}
        {editField&&!formPreview&&(
          <div className="w-64 bg-white border-l p-4 overflow-y-auto flex-shrink-0">
            <div className="flex justify-between items-center mb-4 pb-3 border-b"><span className="font-bold text-gray-800 text-sm">⚙ Thuộc Tính</span><button onClick={()=>setEditingFieldId(null)} className="text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100">✕</button></div>
            <div className="space-y-3 text-sm">
              <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Loại</label><select value={editField.type} onChange={e=>updEF({type:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm">{FT.map(t=><option key={t} value={t}>{FI[t]} {FL[t]}</option>)}</select></div>
              <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Nhãn</label><input value={editField.label} onChange={e=>updEF({label:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200"/></div>
              {['text','number','textarea'].includes(editField.type)&&<div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Placeholder</label><input value={editField.placeholder} onChange={e=>updEF({placeholder:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200"/></div>}
              {['dropdown','radio','checkbox'].includes(editField.type)&&<div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Tùy Chọn (mỗi dòng 1)</label><textarea value={(editField.options||[]).join('\n')} onChange={e=>updEF({options:e.target.value.split('\n').filter(Boolean)})} className="w-full border rounded-xl px-3 py-2 text-xs resize-none focus:ring-2 focus:ring-blue-200" rows={5} placeholder={'Có\nKhông\nKhác'}/></div>}
              <label className="flex items-center gap-2 cursor-pointer py-1"><input type="checkbox" checked={editField.required} onChange={e=>updEF({required:e.target.checked})} className="w-4 h-4"/><span className="text-sm font-medium">Bắt buộc nhập</span></label>
            </div>
          </div>
        )}
        <Modal open={newFormModal} title="📝 Tạo Mẫu Biểu Mới" onClose={()=>setNewFormModal(false)}>
          <div className="space-y-4">
            <div><label className="text-sm font-semibold text-gray-700 block mb-1.5">Tên Mẫu Biểu *</label><input value={newFormName} onChange={e=>setNewFormName(e.target.value)} className="w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-300 text-sm" placeholder="VD: Đơn xin nghỉ phép"/></div>
            <div><label className="text-sm font-semibold text-gray-700 block mb-1.5">Danh Mục</label><select value={newFormCategory} onChange={e=>setNewFormCategory(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm"><option>Chung</option><option>Nhân sự</option><option>Tài chính</option><option>Hành chính</option><option>Kỹ thuật</option></select></div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={()=>setNewFormModal(false)} className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button>
              <button onClick={async()=>{if(!newFormName.trim()){addToast('Nhập tên mẫu biểu','warning');return;}const row={name:newFormName.trim(),category:newFormCategory,fields:[]};const{data,error}=await supabase.from('forms').insert([row]).select().single();if(error){addToast('Lỗi: '+error.message,'error');return;}setForms(prev=>[...prev,data]);setSelectedFormId(data.id);setNewFormModal(false);addToast(`Đã tạo "${data.name}"`, 'success');}} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">Tạo Mẫu Biểu</button>
            </div>
          </div>
        </Modal>
      </div>
    );
  };

  /* ════════════════════════════════════════════
     RENDER: USER MANAGEMENT (Admin only)
  ════════════════════════════════════════════ */
  const renderUserManagement = () => (
    <div className="p-6 overflow-auto h-full bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-2xl font-bold text-gray-800">Quản Lý Người Dùng</h1><p className="text-sm text-gray-500">{users.length} tài khoản trong hệ thống</p></div>
        <div className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-xl">
          ℹ Tạo tài khoản mới qua Supabase Dashboard → Auth → Add User<br/>Email: <strong>tenđăng nhập@bpmportal.vn</strong>
        </div>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>{['Tên Đăng Nhập','Họ Tên','Vai Trò','Chức Danh','Trạng Thái','Hành Động'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u=>(
              <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.is_active?'opacity-50':''}`}>
                <td className="px-4 py-3 font-mono text-sm text-gray-700">{u.username}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{u.full_name}</td>
                <td className="px-4 py-3"><RoleBadge role={u.role}/></td>
                <td className="px-4 py-3 text-sm text-gray-600">{getPosName(u.position_id)}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.is_active?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-500'}`}>{u.is_active?'Hoạt Động':'Vô Hiệu'}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={()=>{setEditUserModal(u);setEditUserRole(u.role);}} className="text-xs text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 font-medium">Sửa Role</button>
                    {u.id!==currentUser.id&&<button onClick={()=>handleToggleUserActive(u.id,u.is_active)} className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${u.is_active?'text-amber-600 border-amber-200 hover:bg-amber-50':'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>{u.is_active?'Vô Hiệu Hóa':'Kích Hoạt'}</button>}
                  </div>
                </td>
              </tr>
            ))}
            {users.length===0&&<tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Chưa có người dùng nào</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={!!editUserModal} title={`Sửa Vai Trò: ${editUserModal?.full_name}`} onClose={()=>setEditUserModal(null)}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Thay đổi vai trò sẽ ảnh hưởng đến quyền truy cập của người dùng này.</p>
          <div><label className="text-sm font-semibold text-gray-700 block mb-1.5">Vai Trò Mới</label>
            <select value={editUserRole} onChange={e=>setEditUserRole(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm">
              {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={()=>setEditUserModal(null)} className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50">Hủy</button><button onClick={()=>handleUpdateUserRole(editUserModal.id,editUserRole)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">Lưu Thay Đổi</button></div>
        </div>
      </Modal>
    </div>
  );

  /* ════════════════════════════════════════════
     RENDER: PERMISSION MATRIX (Admin only)
  ════════════════════════════════════════════ */
  const renderPermissions = () => {
    const MODULES = [
      {id:'dashboard',   label:'🏠 Bảng Điều Khiển'},
      {id:'processes',   label:'⬡ Xem Quy Trình'},
      {id:'designer',    label:'✏ Thiết Kế Quy Trình'},
      {id:'workitems',   label:'📋 eOffice / Phiếu'},
      {id:'orgchart',    label:'🏢 Cơ Cấu Tổ Chức'},
      {id:'formbuilder', label:'📝 Mẫu Biểu'},
      {id:'users',       label:'👥 Quản Lý Users'},
      {id:'permissions', label:'🔐 Phân Quyền'},
    ];
    const ROLE_KEYS = ['admin','director','manager','employee'];

    const toggle = (moduleId, role) => {
      if (role==='admin') return; // Admin luôn có quyền tất cả
      setPermDraft(prev=>({...prev, [moduleId]:{...prev[moduleId],[role]:!prev[moduleId]?.[role]}}));
    };

    return (
      <div className="p-6 overflow-auto h-full bg-gray-50">
        <div className="flex justify-between items-center mb-6">
          <div><h1 className="text-2xl font-bold text-gray-800">Ma Trận Phân Quyền</h1><p className="text-sm text-gray-500">Cấu hình quyền truy cập từng module theo vai trò</p></div>
          <button onClick={()=>saveModulePerms(permDraft)} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm">💾 Lưu Cấu Hình</button>
        </div>
        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-5 py-3 text-left text-sm font-bold text-gray-700 w-64">Module / Tính Năng</th>
                {ROLE_KEYS.map(role=>(
                  <th key={role} className="px-4 py-3 text-center">
                    <RoleBadge role={role}/>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {MODULES.map(mod=>(
                <tr key={mod.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-gray-800 text-sm">{mod.label}</td>
                  {ROLE_KEYS.map(role=>{
                    const isAdmin=role==='admin';
                    const checked=isAdmin?true:(permDraft[mod.id]?.[role]??false);
                    return (
                      <td key={role} className="px-4 py-4 text-center">
                        <button onClick={()=>toggle(mod.id,role)} disabled={isAdmin}
                                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center mx-auto transition-all text-sm font-bold
                                  ${checked
                                    ? isAdmin?'bg-purple-500 border-purple-500 text-white cursor-not-allowed':'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600'
                                    : 'border-gray-300 text-gray-300 hover:border-gray-400'}`}>
                          {checked ? '✓' : '—'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <strong>⚠ Lưu ý:</strong> Admin luôn có toàn quyền và không thể thay đổi. Thay đổi phân quyền có hiệu lực ngay sau khi lưu và áp dụng cho tất cả người dùng có vai trò tương ứng.
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════
     NAV + MAIN RETURN
  ════════════════════════════════════════════ */
  if (dataLoading) return <LoadingScreen text="Đang tải dữ liệu..." />;

  const navItems = [
    { id:'dashboard',   label:'Bảng Điều Khiển', icon:'⊞', module:'dashboard'   },
    { id:'processes',   label:'Quy Trình',        icon:'⬡', module:'processes'   },
    { id:'workitems',   label:'eOffice',           icon:'📋', module:'workitems'   },
    { id:'orgchart',    label:'Tổ Chức',           icon:'🏢', module:'orgchart'    },
    { id:'formbuilder', label:'Mẫu Biểu',          icon:'📝', module:'formbuilder' },
    { id:'users',       label:'Người Dùng',        icon:'👥', module:'users'       },
    { id:'permissions', label:'Phân Quyền',        icon:'🔐', module:'permissions' },
  ].filter(item => canAccessModule(item.module));

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 bg-gray-900 text-white flex flex-col flex-shrink-0 shadow-xl">
        <div className="px-5 py-5 border-b border-gray-700">
          <div className="font-bold text-lg text-white tracking-tight">BPM Portal</div>
          <div className="text-xs text-gray-400 mt-0.5">eOffice Workflow System</div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item=>(
            <button key={item.id}
                    onClick={()=>{setPage(item.id);setSelectedNodeId(null);setConnectMode(false);setConnectFrom(null);}}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${page===item.id||(page==='designer'&&item.id==='processes')?'bg-blue-600 text-white shadow-sm':'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
              {item.id==='workitems'&&stats.inProgress>0&&<span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{stats.inProgress}</span>}
            </button>
          ))}
        </nav>
        {/* User info + logout */}
        <div className="p-3 border-t border-gray-700">
          <div className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-gray-800 cursor-pointer group" onClick={onLogout}>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {currentUser.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-200 truncate">{currentUser.full_name}</div>
              <div className="text-xs text-gray-500">{ROLES[currentUser.role]?.label}</div>
            </div>
            <span className="text-gray-500 group-hover:text-red-400 text-xs">⏻</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {page==='dashboard'   && renderDashboard()}
        {page==='processes'   && renderProcessList()}
        {page==='designer'    && renderDesigner()}
        {page==='workitems'   && renderWorkItems()}
        {page==='orgchart'    && renderOrgChart()}
        {page==='formbuilder' && renderFormBuilder()}
        {page==='users'       && renderUserManagement()}
        {page==='permissions' && renderPermissions()}
      </main>

      <Toast toasts={toasts} dismiss={dismissToast}/>
    </div>
  );
};

export default App;
