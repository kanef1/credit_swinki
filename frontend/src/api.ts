import { Application, Company, CreditProduct, PipelineStats } from './types';

const BASE_URL = '/api/v1';

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Healthcheck failed');
  return res.json();
}

export async function fetchProducts(): Promise<CreditProduct[]> {
  const res = await fetch(`${BASE_URL}/products`);
  if (!res.ok) throw new Error('Ошибка загрузки продуктов');
  return res.json();
}

export async function fetchDemoCompanies(): Promise<Company[]> {
  const res = await fetch(`${BASE_URL}/demo/companies`);
  if (!res.ok) throw new Error('Ошибка загрузки демо-компаний');
  return res.json();
}

export async function seedDemoData(): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/demo/seed`, { method: 'POST' });
  if (!res.ok) throw new Error('Ошибка наполнения демо-данными');
  return res.json();
}

export async function lookupCompany(inn: string): Promise<Company> {
  const res = await fetch(`${BASE_URL}/companies/lookup?inn=${encodeURIComponent(inn)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Компания не найдена');
  }
  return res.json();
}

export async function createApplication(payload: {
  inn: string;
  product_id: string;
  requested_amount: number;
  requested_term_months: number;
  financing_goal: string;
  repayment_type?: string;
}): Promise<Application> {
  const res = await fetch(`${BASE_URL}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Ошибка создания заявки');
  }
  return res.json();
}

export async function submitApplication(id: string): Promise<Application> {
  const res = await fetch(`${BASE_URL}/applications/${id}/submit`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Ошибка отправки в конвейер');
  }
  return res.json();
}

export async function fetchApplication(id: string): Promise<Application> {
  const res = await fetch(`${BASE_URL}/applications/${id}`);
  if (!res.ok) throw new Error('Заявка не найдена');
  return res.json();
}

export async function fetchApplications(status?: string): Promise<Application[]> {
  const url = status ? `${BASE_URL}/applications?status=${encodeURIComponent(status)}` : `${BASE_URL}/applications`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Ошибка загрузки списка заявок');
  return res.json();
}

export async function signOffer(id: string, smsCode: string): Promise<Application> {
  const res = await fetch(`${BASE_URL}/applications/${id}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sms_code: smsCode }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Ошибка подписания договора');
  }
  return res.json();
}

export async function underwriterApprove(
  id: string,
  payload: { approved_amount: number; approved_term_months: number; approved_rate: number; notes: string }
): Promise<Application> {
  const res = await fetch(`${BASE_URL}/underwriter/applications/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Ошибка согласования заявки');
  }
  return res.json();
}

export async function underwriterReject(id: string, reason: string): Promise<Application> {
  const res = await fetch(`${BASE_URL}/underwriter/applications/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Ошибка отклонения заявки');
  }
  return res.json();
}

export async function fetchStats(): Promise<PipelineStats> {
  const res = await fetch(`${BASE_URL}/underwriter/stats`);
  if (!res.ok) throw new Error('Ошибка получения метрик');
  return res.json();
}
