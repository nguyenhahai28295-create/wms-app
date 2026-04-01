-- ============================================================
-- GRC Risk Management System - Supabase Migration Script
-- Chạy script này trong Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (nếu chưa có)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. DANH MỤC RỦI RO (Risk Categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES risk_categories(id) ON DELETE SET NULL,
  level int NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
  description text,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_categories_parent ON risk_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_risk_categories_level ON risk_categories(level);

-- ============================================================
-- 2. SỰ KIỆN RỦI RO - SKKR (Risk Events)
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  discovery_date date,
  category_id uuid REFERENCES risk_categories(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  reporter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','declared','under_review','closed','rejected')),
  severity text NOT NULL DEFAULT 'low'
    CHECK (severity IN ('low','medium','high','critical')),
  financial_impact numeric(18,2),
  root_cause text,
  corrective_action text,
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  closed_at timestamptz,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_events_status ON risk_events(status);
CREATE INDEX IF NOT EXISTS idx_risk_events_department ON risk_events(department_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_reporter ON risk_events(reporter_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_category ON risk_events(category_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_event_date ON risk_events(event_date);

-- Lịch sử thay đổi SKKR
CREATE TABLE IF NOT EXISTS risk_event_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES risk_events(id) ON DELETE CASCADE,
  action text NOT NULL,
  comment text,
  performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_event_logs_event ON risk_event_logs(event_id);

-- ============================================================
-- 3. LỖI NGHIỆP VỤ (Business Errors)
-- ============================================================
CREATE TABLE IF NOT EXISTS business_errors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  error_date date NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  reporter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  risk_event_id uuid REFERENCES risk_events(id) ON DELETE SET NULL,
  error_type text NOT NULL DEFAULT 'manual'
    CHECK (error_type IN ('manual','system','process','external')),
  severity text NOT NULL DEFAULT 'low'
    CHECK (severity IN ('low','medium','high')),
  impact_amount numeric(18,2),
  root_cause text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed')),
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_errors_status ON business_errors(status);
CREATE INDEX IF NOT EXISTS idx_business_errors_department ON business_errors(department_id);
CREATE INDEX IF NOT EXISTS idx_business_errors_risk_event ON business_errors(risk_event_id);

-- ============================================================
-- 4. YÊU CẦU TUÂN THỦ (Compliance Requirements)
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_requirements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  regulation_source text,
  regulation_number text,
  effective_date date,
  expiry_date date,
  category text NOT NULL DEFAULT 'regulatory'
    CHECK (category IN ('regulatory','internal','international')),
  applicable_departments jsonb DEFAULT '[]'::jsonb,
  responsible_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','pending','expired','superseded')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high','medium','low')),
  review_frequency text DEFAULT 'annually'
    CHECK (review_frequency IN ('monthly','quarterly','annually')),
  next_review_date date,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_req_status ON compliance_requirements(status);
CREATE INDEX IF NOT EXISTS idx_compliance_req_category ON compliance_requirements(category);

-- Đánh giá tuân thủ
CREATE TABLE IF NOT EXISTS compliance_assessments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  period text NOT NULL,
  assessor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  compliance_level text NOT NULL DEFAULT 'compliant'
    CHECK (compliance_level IN ('compliant','partial','non_compliant')),
  score int CHECK (score BETWEEN 0 AND 100),
  evidence text,
  gaps text,
  action_required bool DEFAULT false,
  assessed_at timestamptz,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved'))
);

CREATE INDEX IF NOT EXISTS idx_compliance_assess_requirement ON compliance_assessments(requirement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_assess_status ON compliance_assessments(status);
CREATE INDEX IF NOT EXISTS idx_compliance_assess_period ON compliance_assessments(period);

-- ============================================================
-- 5. KẾ HOẠCH KIỂM TRA / KIỂM TOÁN (Audit Plans)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  audit_type text NOT NULL DEFAULT 'internal'
    CHECK (audit_type IN ('internal','external','regulatory','self_assessment')),
  scope text,
  department_ids jsonb DEFAULT '[]'::jsonb,
  start_date date,
  end_date date,
  lead_auditor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team_members jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','in_progress','completed','cancelled')),
  objectives text,
  methodology text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_plans_status ON audit_plans(status);
CREATE INDEX IF NOT EXISTS idx_audit_plans_audit_type ON audit_plans(audit_type);

-- Findings kiểm toán
CREATE TABLE IF NOT EXISTS audit_findings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  audit_plan_id uuid NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  finding_type text NOT NULL DEFAULT 'minor'
    CHECK (finding_type IN ('major','minor','observation','best_practice')),
  risk_category_id uuid REFERENCES risk_categories(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  root_cause text,
  recommendation text,
  management_response text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','closed','deferred')),
  severity text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('critical','high','medium','low')),
  target_date date,
  closed_date date,
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  verified_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_findings_plan ON audit_findings(audit_plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_status ON audit_findings(status);
CREATE INDEX IF NOT EXISTS idx_audit_findings_department ON audit_findings(department_id);

-- ============================================================
-- 6. ACTION PLAN
-- ============================================================
CREATE TABLE IF NOT EXISTS action_plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  source_type text NOT NULL DEFAULT 'finding'
    CHECK (source_type IN ('finding','risk_event','compliance','rcsa')),
  source_id uuid,
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('critical','high','medium','low')),
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  actual_completion_date date,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','completed','overdue','cancelled')),
  completion_pct int NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  progress_notes text,
  verified_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_plans_status ON action_plans(status);
CREATE INDEX IF NOT EXISTS idx_action_plans_source ON action_plans(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_due_date ON action_plans(due_date);
CREATE INDEX IF NOT EXISTS idx_action_plans_owner ON action_plans(owner_id);

-- Lịch sử cập nhật tiến độ
CREATE TABLE IF NOT EXISTS action_plan_updates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  update_note text NOT NULL,
  completion_pct int CHECK (completion_pct BETWEEN 0 AND 100),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_plan_updates_plan ON action_plan_updates(action_plan_id);

-- ============================================================
-- 7. RCSA (Risk & Control Self-Assessment)
-- ============================================================
CREATE TABLE IF NOT EXISTS rcsa_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  period text NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_progress','submitted','reviewed','approved')),
  assessor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rcsa_sessions_status ON rcsa_sessions(status);
CREATE INDEX IF NOT EXISTS idx_rcsa_sessions_department ON rcsa_sessions(department_id);
CREATE INDEX IF NOT EXISTS idx_rcsa_sessions_period ON rcsa_sessions(period);

CREATE TABLE IF NOT EXISTS rcsa_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES rcsa_sessions(id) ON DELETE CASCADE,
  risk_category_id uuid REFERENCES risk_categories(id) ON DELETE SET NULL,
  risk_description text NOT NULL,
  inherent_likelihood int CHECK (inherent_likelihood BETWEEN 1 AND 5),
  inherent_impact int CHECK (inherent_impact BETWEEN 1 AND 5),
  inherent_score int,
  control_description text,
  control_effectiveness text DEFAULT 'partial'
    CHECK (control_effectiveness IN ('adequate','partial','inadequate')),
  residual_likelihood int CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact int CHECK (residual_impact BETWEEN 1 AND 5),
  residual_score int,
  risk_level text DEFAULT 'medium'
    CHECK (risk_level IN ('low','medium','high','critical')),
  action_required bool DEFAULT false,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_rcsa_items_session ON rcsa_items(session_id);
CREATE INDEX IF NOT EXISTS idx_rcsa_items_risk_level ON rcsa_items(risk_level);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE risk_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plan_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rcsa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rcsa_items ENABLE ROW LEVEL SECURITY;

-- Cho phép authenticated users đọc/ghi (phân quyền xử lý ở application level)
CREATE POLICY "authenticated_all" ON risk_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON risk_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON risk_event_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON business_errors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON compliance_requirements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON compliance_assessments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON audit_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON audit_findings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON action_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON action_plan_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rcsa_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rcsa_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA: Danh mục rủi ro Basel II/III cơ bản
-- ============================================================
-- Cấp 1: Nhóm rủi ro chính
INSERT INTO risk_categories (id, code, name, level, description) VALUES
  ('11111111-0001-0001-0001-000000000001', 'OR', 'Rủi ro hoạt động', 1, 'Rủi ro tổn thất do quy trình, con người, hệ thống nội bộ hoặc các sự kiện bên ngoài'),
  ('11111111-0001-0001-0001-000000000002', 'CR', 'Rủi ro tín dụng', 1, 'Rủi ro tổn thất do khách hàng/đối tác không thực hiện nghĩa vụ tài chính'),
  ('11111111-0001-0001-0001-000000000003', 'MR', 'Rủi ro thị trường', 1, 'Rủi ro tổn thất do biến động giá thị trường'),
  ('11111111-0001-0001-0001-000000000004', 'LR', 'Rủi ro thanh khoản', 1, 'Rủi ro không có khả năng đáp ứng nghĩa vụ tài chính'),
  ('11111111-0001-0001-0001-000000000005', 'RR', 'Rủi ro tuân thủ/pháp lý', 1, 'Rủi ro do vi phạm quy định pháp luật, quy chế nội bộ')
ON CONFLICT (code) DO NOTHING;

-- Cấp 2: Rủi ro hoạt động - chi tiết
INSERT INTO risk_categories (id, code, name, parent_id, level, description) VALUES
  ('22222222-0002-0002-0002-000000000001', 'OR-01', 'Gian lận nội bộ', '11111111-0001-0001-0001-000000000001', 2, 'Hành vi gian lận từ nhân viên nội bộ'),
  ('22222222-0002-0002-0002-000000000002', 'OR-02', 'Gian lận bên ngoài', '11111111-0001-0001-0001-000000000001', 2, 'Hành vi gian lận từ khách hàng, đối tác bên ngoài'),
  ('22222222-0002-0002-0002-000000000003', 'OR-03', 'Lỗi quy trình', '11111111-0001-0001-0001-000000000001', 2, 'Sai sót trong quy trình nghiệp vụ'),
  ('22222222-0002-0002-0002-000000000004', 'OR-04', 'Sự cố hệ thống CNTT', '11111111-0001-0001-0001-000000000001', 2, 'Lỗi hệ thống, mất dữ liệu, tấn công mạng'),
  ('22222222-0002-0002-0002-000000000005', 'OR-05', 'Rủi ro con người', '11111111-0001-0001-0001-000000000001', 2, 'Thiếu nhân lực, năng lực yếu, lỗi con người'),
  ('22222222-0002-0002-0002-000000000006', 'OR-06', 'Thiên tai/Sự kiện bất khả kháng', '11111111-0001-0001-0001-000000000001', 2, 'Thiên tai, dịch bệnh, biến động chính trị')
ON CONFLICT (code) DO NOTHING;
