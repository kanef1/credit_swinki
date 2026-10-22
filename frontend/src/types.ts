export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ENRICHING'
  | 'SCORING'
  | 'MANUAL_REVIEW'
  | 'OFFER_READY'
  | 'SIGNED'
  | 'DISBURSED'
  | 'REJECTED';

export interface Company {
  id: string;
  inn: string;
  ogrn: string;
  name: string;
  legal_form: string;
  registration_date: string;
  director_name: string;
  address: string;
  okved: string;
  okved_description: string;
  annual_revenue: number;
  net_profit: number;
  employee_count: number;
  tax_system: string;
  has_tax_arrears: boolean;
  tax_arrears_amount: number;
  court_cases_count: number;
  court_cases_amount: number;
  bki_score: number;
  existing_debt: number;
  monthly_debt_payment: number;
  has_account_in_alfa: boolean;
}

export interface CreditProduct {
  id: string;
  name: string;
  description: string;
  target_audience: string;
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
  base_interest_rate: number;
  requires_collateral: boolean;
  grace_period_months: number;
  is_active: boolean;
}

export interface ScoringFactor {
  name: string;
  category: string;
  value: string;
  weight: number;
  score_impact: number;
  description: string;
  is_positive: boolean;
}

export interface ScoringResult {
  id: string;
  application_id: string;
  total_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommended_decision: 'APPROVE' | 'COUNTER_OFFER' | 'MANUAL_REVIEW' | 'REJECT';
  max_approved_amount: number;
  recommended_rate: number;
  dti: number;
  factors: ScoringFactor[];
  stop_factors: string[];
  recommendations: string[];
}

export interface AuditLog {
  id: string;
  application_id: string;
  from_status: ApplicationStatus;
  to_status: ApplicationStatus;
  actor_role: 'CLIENT' | 'SYSTEM' | 'UNDERWRITER';
  comment: string;
  created_at: string;
}

export interface Application {
  id: string;
  application_number: string;
  company_id: string;
  company?: Company;
  product_id: string;
  product?: CreditProduct;
  requested_amount: number;
  requested_term_months: number;
  financing_goal: string;
  repayment_type: string;
  status: ApplicationStatus;
  approved_amount: number;
  approved_term_months: number;
  approved_rate: number;
  monthly_payment: number;
  is_counter_offer: boolean;
  counter_offer_reason?: string;
  rejection_reason?: string;
  underwriter_notes?: string;
  sms_code?: string;
  signed_at?: string;
  disbursed_at?: string;
  scoring_result?: ScoringResult;
  audit_logs?: AuditLog[];
  created_at: string;
  updated_at: string;
}

export interface PipelineStats {
  total_applications: number;
  draft_count: number;
  review_count: number;
  approved_count: number;
  disbursed_count: number;
  rejected_count: number;
  total_disbursed_volume: number;
  average_score: number;
}
