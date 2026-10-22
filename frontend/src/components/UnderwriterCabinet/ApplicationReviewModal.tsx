import React, { useState } from 'react';
import { Application } from '../../types';
import { underwriterApprove, underwriterReject } from '../../api';
import {
  ShieldAlert,
  Building,
  UserCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Scale,
  CreditCard,
  FileText,
} from 'lucide-react';

interface ApplicationReviewModalProps {
  application: Application;
  onClose: () => void;
  onUpdated: () => void;
}

export const ApplicationReviewModal: React.FC<ApplicationReviewModalProps> = ({
  application,
  onClose,
  onUpdated,
}) => {
  const company = application.company;
  const scoring = application.scoring_result;

  const [approvedAmount, setApprovedAmount] = useState<number>(
    application.approved_amount || application.requested_amount
  );
  const [approvedTerm, setApprovedTerm] = useState<number>(
    application.approved_term_months || application.requested_term_months
  );
  const [approvedRate, setApprovedRate] = useState<number>(
    application.approved_rate || application.product?.base_interest_rate || 14.5
  );
  const [notes, setNotes] = useState<string>('Проведена верификация контрагентов и налоговой отчетности.');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    try {
      setLoading(true);
      setError(null);
      await underwriterApprove(application.id, {
        approved_amount: Number(approvedAmount),
        approved_term_months: Number(approvedTerm),
        approved_rate: Number(approvedRate),
        notes,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('Укажите причину отказа для протокола');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await underwriterReject(application.id, rejectReason);
      onUpdated();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                Карточка андеррайтера
              </span>
              <span className="font-mono text-xs text-slate-400">ID: {application.id.slice(0, 8)}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              Рассмотрение заявки {application.application_number}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1">
            ✕
          </button>
        </div>

        {/* Данные о компании */}
        {company && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{company.name}</h4>
                <p className="text-xs text-slate-500">ИНН: {company.inn} • {company.legal_form} • Директор: {company.director_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{company.address}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                  {company.okved}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">{company.okved_description}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-xs">
              <div>
                <span className="text-slate-400 block">Выручка:</span>
                <span className="font-bold text-slate-800">{(company.annual_revenue / 1_000_000).toFixed(1)} млн ₽</span>
              </div>
              <div>
                <span className="text-slate-400 block">Чистая прибыль:</span>
                <span className={`font-bold ${company.net_profit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {(company.net_profit / 1_000_000).toFixed(1)} млн ₽
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Рейтинг БКИ:</span>
                <span className="font-bold text-slate-800">{company.bki_score} / 850</span>
              </div>
              <div>
                <span className="text-slate-400 block">Суды / Налоги:</span>
                <span className="font-bold text-slate-800">
                  {company.has_tax_arrears ? `Долг ФНС ${(company.tax_arrears_amount / 1000).toFixed(0)} тыс.` : 'ФНС чисто'}
                  {company.court_cases_count > 0 ? `, ${company.court_cases_count} дел` : ''}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Скоринговый паспорт */}
        {scoring && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Скоринг-паспорт заявки
              </span>
              <span className="text-xs font-bold text-slate-900">
                Итоговый балл: <span className="text-[#EF3124]">{scoring.total_score}</span> / 1000 (Риск: {scoring.risk_level}, DTI: {scoring.dti}%)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {scoring.factors?.map((f, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-800">{f.name}</span>
                    <span className="text-[11px] text-slate-500 block">{f.value} — {f.description}</span>
                  </div>
                  <span className={`font-bold font-mono px-2 py-0.5 rounded text-[11px] ${
                    f.is_positive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {f.score_impact > 0 ? `+${f.score_impact}` : f.score_impact}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Форма принятия ручного решения */}
        {!isRejecting ? (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Параметры согласования (одобрение)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Сумма лимита (₽)</label>
                <input
                  type="number"
                  step={50_000}
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Срок (месяцев)</label>
                <input
                  type="number"
                  value={approvedTerm}
                  onChange={(e) => setApprovedTerm(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Ставка (% годовых)</label>
                <input
                  type="number"
                  step={0.1}
                  value={approvedRate}
                  onChange={(e) => setApprovedRate(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Заключение андеррайтера</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Комментарий для кредитного комитета"
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setIsRejecting(true)}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold"
              >
                Отклонить заявку
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleApprove}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {loading ? 'Сохранение...' : 'Одобрить условия'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 space-y-3">
            <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
              Отклонение заявки андеррайтером
            </h4>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Причина отказа (для клиента)</label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Например: Несоответствие критериям финансовой устойчивости при проверке"
                className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setIsRejecting(false)}
                className="text-xs text-slate-600 hover:text-slate-800 font-bold"
              >
                ← Назад к согласованию
              </button>

              <button
                type="button"
                disabled={loading || !rejectReason}
                onClick={handleReject}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-500/20 disabled:opacity-50"
              >
                {loading ? 'Отклонение...' : 'Подтвердить отказ'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
