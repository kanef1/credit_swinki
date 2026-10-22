import React, { useState, useEffect } from 'react';
import { Search, Building, ShieldCheck, AlertTriangle, Scale, Check, CreditCard } from 'lucide-react';
import { Company } from '../../types';
import { lookupCompany } from '../../api';

interface CompanyLookupProps {
  inn: string;
  setInn: (inn: string) => void;
  onCompanyLoaded: (company: Company | null) => void;
}

export const CompanyLookup: React.FC<CompanyLookupProps> = ({ inn, setInn, onCompanyLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);

  const demoPresets = [
    { label: 'ООО "Вектор Роста" (Идеальный)', inn: '7701234567' },
    { label: 'ИП Смирнов (Контр-оффер)', inn: '7809876543' },
    { label: 'ООО "ТехноПром" (Андеррайтер)', inn: '5001122334' },
    { label: 'ООО "СтройГрупп" (Отказ)', inn: '9705544332' },
  ];

  const handleLookup = async (innToSearch: string) => {
    if (!innToSearch || (innToSearch.length !== 10 && innToSearch.length !== 12)) {
      setCompany(null);
      onCompanyLoaded(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await lookupCompany(innToSearch);
      setCompany(data);
      onCompanyLoaded(data);
    } catch (err) {
      setError(String(err));
      setCompany(null);
      onCompanyLoaded(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inn.length === 10 || inn.length === 12) {
      handleLookup(inn);
    }
  }, [inn]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-bold text-slate-900">
            ИНН компании или индивидуального предпринимателя
          </label>
          <span className="text-xs text-slate-400">10 или 12 цифр</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Данные организации будут автоматически загружены и проверены по базам ФНС, ЕГРЮЛ и БКИ.
        </p>

        {/* Инпут поиска */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={inn}
            onChange={(e) => setInn(e.target.value.replace(/\D/g, '').slice(0, 12))}
            placeholder="Введите ИНН (например, 7701234567)"
            className="block w-full pl-11 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EF3124] focus:border-transparent transition-all"
          />
          {loading && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 font-medium">
              Обогащение...
            </div>
          )}
        </div>

        {/* Быстрые демо-кнопки */}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Демо-ИНН:</span>
          {demoPresets.map((p) => (
            <button
              key={p.inn}
              type="button"
              onClick={() => {
                setInn(p.inn);
                handleLookup(p.inn);
              }}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                inn === p.inn
                  ? 'bg-red-50 text-[#EF3124] border-red-200 font-semibold'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Карточка обогащенных данных компании */}
      {company && (
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/60 border border-slate-200/80 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <Building className="w-4 h-4 text-[#EF3124]" />
                <h4 className="font-bold text-slate-900 text-sm">{company.name}</h4>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                  {company.legal_form}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ОГРН: {company.ogrn} • Руководитель: {company.director_name}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {company.has_account_in_alfa ? (
                <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-100 text-[#EF3124] border border-red-200">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Клиент Альфа-Банка (-0.5%)</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                  <span>РКО в другом банке</span>
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-1">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
              <span className="text-[11px] text-slate-400 block">Выручка за год</span>
              <span className="text-xs font-bold text-slate-900">
                {(company.annual_revenue / 1_000_000).toFixed(1)} млн ₽
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
              <span className="text-[11px] text-slate-400 block">Чистая прибыль</span>
              <span className={`text-xs font-bold ${company.net_profit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {(company.net_profit / 1_000_000).toFixed(1)} млн ₽
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
              <span className="text-[11px] text-slate-400 block">Рейтинг БКИ</span>
              <span className={`text-xs font-bold ${
                company.bki_score >= 750 ? 'text-emerald-600' : company.bki_score >= 600 ? 'text-amber-600' : 'text-rose-600'
              }`}>
                {company.bki_score} / 850
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
              <span className="text-[11px] text-slate-400 block">ФНС и Арбитраж</span>
              <span className="text-xs font-bold text-slate-900 flex items-center space-x-1">
                {company.has_tax_arrears ? (
                  <span className="text-amber-600">Долг {(company.tax_arrears_amount / 1000).toFixed(0)} тыс. ₽</span>
                ) : company.court_cases_count > 0 ? (
                  <span className="text-amber-600">{company.court_cases_count} дел</span>
                ) : (
                  <span className="text-emerald-600 flex items-center">
                    <Check className="w-3.5 h-3.5 mr-0.5" /> Чисто
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
