import React from 'react';
import { CreditProduct, Company } from '../../types';
import { Briefcase, Zap, Factory, TrendingUp, HelpCircle, Calculator } from 'lucide-react';

interface ProductSelectorProps {
  products: CreditProduct[];
  selectedProductId: string;
  setSelectedProductId: (id: string) => void;
  amount: number;
  setAmount: (amount: number) => void;
  termMonths: number;
  setTermMonths: (term: number) => void;
  goal: string;
  setGoal: (goal: string) => void;
  repaymentType: string;
  setRepaymentType: (type: string) => void;
  company: Company | null;
  onSubmit: () => void;
  submitting: boolean;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  products,
  selectedProductId,
  setSelectedProductId,
  amount,
  setAmount,
  termMonths,
  setTermMonths,
  goal,
  setGoal,
  repaymentType,
  setRepaymentType,
  company,
  onSubmit,
  submitting,
}) => {
  const currentProduct = products.find((p) => p.id === selectedProductId) || products[0];

  // Иконка для каждого продукта
  const getProductIcon = (id: string) => {
    switch (id) {
      case 'working-capital':
        return Briefcase;
      case 'overdraft':
        return Zap;
      case 'equipment-investment':
        return Factory;
      default:
        return TrendingUp;
    }
  };

  // Расчет примерного платежа для витрины
  const calculateEstimate = () => {
    if (!currentProduct || amount <= 0 || termMonths <= 0) return 0;
    let rate = currentProduct.base_interest_rate;
    if (company?.has_account_in_alfa) {
      rate -= 0.5; // Скидка за РКО в Альфа-Банке
    }
    const monthlyRate = rate / 12 / 100;
    const factor = Math.pow(1 + monthlyRate, termMonths);
    const payment = amount * (monthlyRate * factor) / (factor - 1);
    return Math.round(payment);
  };

  const estimatedPayment = calculateEstimate();

  // Динамические кнопки срока в зависимости от выбранного продукта
  const getDynamicTermPresets = (minTerm: number, maxTerm: number): number[] => {
    let list: number[] = [];
    if (maxTerm <= 12) {
      list = [3, 6, 9, 12];
    } else if (maxTerm <= 24) {
      list = [6, 12, 18, 24];
    } else if (maxTerm <= 36) {
      list = [6, 12, 24, 36];
    } else {
      list = [12, 24, 36, 48, 60];
    }
    const filtered = list.filter((t) => t >= minTerm && t <= maxTerm);
    if (!filtered.includes(minTerm)) filtered.unshift(minTerm);
    if (!filtered.includes(maxTerm)) filtered.push(maxTerm);
    return Array.from(new Set(filtered)).sort((a, b) => a - b);
  };

  // Динамические кнопки сумм в зависимости от лимитов продукта
  const getDynamicAmountPresets = (minVal: number, maxVal: number): number[] => {
    const candidates = [
      300_000, 500_000, 1_000_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000, 15_000_000, 25_000_000, 50_000_000
    ];
    let filtered = candidates.filter((a) => a >= minVal && a <= maxVal);
    if (filtered.length > 5) {
      const step = Math.floor(filtered.length / 4);
      filtered = [filtered[0], filtered[step], filtered[step * 2], filtered[step * 3], filtered[filtered.length - 1]];
    }
    if (!filtered.includes(minVal)) filtered.unshift(minVal);
    if (!filtered.includes(maxVal) && filtered.length < 6) filtered.push(maxVal);
    return Array.from(new Set(filtered)).sort((a, b) => a - b);
  };

  const termPresets = getDynamicTermPresets(
    currentProduct?.min_term_months || 3,
    currentProduct?.max_term_months || 60
  );

  const amountPresets = getDynamicAmountPresets(
    currentProduct?.min_amount || 100_000,
    currentProduct?.max_amount || 50_000_000
  );

  const formatAmountPreset = (val: number) => {
    if (val >= 1_000_000) {
      const millions = val / 1_000_000;
      return millions % 1 === 0 ? `${millions} млн ₽` : `${millions.toFixed(1)} млн ₽`;
    }
    return `${Math.round(val / 1000)} тыс. ₽`;
  };

  const goals = [
    { id: 'Пополнение оборотных средств', label: 'Пополнение оборотных средств' },
    { id: 'Закупка товаров и сырья', label: 'Закупка товаров и сырья' },
    { id: 'Покупка оборудования или транспорта', label: 'Покупка оборудования или транспорта' },
    { id: 'Закрытие кассового разрыва', label: 'Закрытие кассового разрыва' },
    { id: 'Масштабирование и открытие точек', label: 'Масштабирование и открытие точек' },
  ];

  return (
    <div className="space-y-6">
      {/* Выбор кредитного продукта */}
      <div>
        <label className="block text-sm font-bold text-slate-900 mb-3">
          1. Выберите подходящий кредитный продукт
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {products.map((p) => {
            const Icon = getProductIcon(p.id);
            const isSelected = p.id === selectedProductId;
            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProductId(p.id);
                  // Корректируем сумму/срок под границы продукта
                  if (amount < p.min_amount) setAmount(p.min_amount);
                  if (amount > p.max_amount) setAmount(p.max_amount);
                  if (termMonths < p.min_term_months) setTermMonths(p.min_term_months);
                  if (termMonths > p.max_term_months) setTermMonths(p.max_term_months);
                }}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#EF3124] bg-red-50/30 ring-2 ring-red-500/20 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-xl ${isSelected ? 'bg-[#EF3124] text-white' : 'bg-slate-100 text-slate-700'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">
                      от {p.base_interest_rate}%
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1 line-clamp-1">{p.name}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">{p.description}</p>
                </div>

                <div className="text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100 flex justify-between">
                  <span>До {(p.max_amount / 1_000_000).toFixed(0)} млн ₽</span>
                  <span>До {p.max_term_months} мес.</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Настройка суммы и срока */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-900">
          2. Параметры кредитования и цель финансирования
        </h3>

        {/* Сумма кредита */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-600 uppercase">Сумма кредита</span>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={amount}
                min={currentProduct?.min_amount || 100_000}
                max={currentProduct?.max_amount || 50_000_000}
                step={100_000}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-40 text-right font-extrabold text-xl text-slate-900 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#EF3124]"
              />
              <span className="font-bold text-slate-700 text-lg">₽</span>
            </div>
          </div>

          <input
            type="range"
            min={currentProduct?.min_amount || 100_000}
            max={currentProduct?.max_amount || 50_000_000}
            step={100_000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-[#EF3124] cursor-pointer"
          />

          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>{(currentProduct?.min_amount / 1_000_000).toFixed(1)} млн ₽</span>
            <span>{(currentProduct?.max_amount / 1_000_000).toFixed(0)} млн ₽</span>
          </div>

          <div className="flex gap-2 mt-2">
            {amountPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                  amount === preset
                    ? 'bg-red-50 text-[#EF3124] border-red-200 font-semibold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {formatAmountPreset(preset)}
              </button>
            ))}
          </div>
        </div>

        {/* Срок кредита */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-600 uppercase">Срок финансирования</span>
            <div className="flex items-center space-x-1">
              <span className="font-extrabold text-xl text-slate-900">{termMonths}</span>
              <span className="font-bold text-slate-700 text-sm">месяцев</span>
            </div>
          </div>

          <input
            type="range"
            min={currentProduct?.min_term_months || 3}
            max={currentProduct?.max_term_months || 60}
            step={1}
            value={termMonths}
            onChange={(e) => setTermMonths(Number(e.target.value))}
            className="w-full accent-[#EF3124] cursor-pointer"
          />

          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>{currentProduct?.min_term_months || 3} мес.</span>
            <span>{currentProduct?.max_term_months || 60} мес.</span>
          </div>

          <div className="flex gap-2 mt-2">
            {termPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTermMonths(preset)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                  termMonths === preset
                    ? 'bg-red-50 text-[#EF3124] border-red-200 font-semibold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {preset} мес.
              </button>
            ))}
          </div>
        </div>

        {/* Цель и схема погашения */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Цель кредита
            </label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#EF3124]"
            >
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              График погашения
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRepaymentType('ANNUITY')}
                className={`text-xs py-2 px-3 rounded-xl border text-center font-medium transition-all ${
                  repaymentType === 'ANNUITY'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Аннуитетный
              </button>
              <button
                type="button"
                onClick={() => setRepaymentType('DIFFERENTIATED')}
                className={`text-xs py-2 px-3 rounded-xl border text-center font-medium transition-all ${
                  repaymentType === 'DIFFERENTIATED'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Дифференцированный
              </button>
            </div>
          </div>
        </div>

        {/* Информационная плашка с расчетом платежа и кнопка отправки */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Calculator className="w-6 h-6 text-[#EF3124]" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Ориентировочный платеж:</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-extrabold">{estimatedPayment.toLocaleString('ru-RU')}</span>
                <span className="text-sm font-semibold text-slate-300">₽ / месяц</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Базовая ставка от {currentProduct?.base_interest_rate}% годовых
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={!company || submitting}
            onClick={onSubmit}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#EF3124] hover:bg-[#D92015] text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <span>{submitting ? 'Запуск конвейера...' : 'Отправить заявку в конвейер'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
