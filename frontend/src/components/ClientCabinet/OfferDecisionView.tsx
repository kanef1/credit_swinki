import React, { useState } from 'react';
import { Application } from '../../types';
import { signOffer } from '../../api';
import {
  CheckCircle,
  AlertTriangle,
  FileCheck2,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Info,
  Clock,
  XCircle,
  HelpCircle,
  PartyPopper,
  ShieldCheck,
  Percent,
  Calendar,
  Lock,
} from 'lucide-react';

interface OfferDecisionViewProps {
  application: Application;
  onRefresh: () => void;
  onSwitchToUnderwriter: () => void;
}

export const OfferDecisionView: React.FC<OfferDecisionViewProps> = ({
  application,
  onRefresh,
  onSwitchToUnderwriter,
}) => {
  const [showSignModal, setShowSignModal] = useState(false);
  const [smsInput, setSmsInput] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const scoring = application.scoring_result;

  const handleSign = async () => {
    try {
      setSigning(true);
      setSignError(null);
      await signOffer(application.id, smsInput);
      setShowSignModal(false);
      onRefresh();
    } catch (err) {
      setSignError(String(err));
    } finally {
      setSigning(false);
    }
  };

  // 1. Экран выданного кредита (DISBURSED / SIGNED)
  if (application.status === 'DISBURSED' || application.status === 'SIGNED') {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden animate-fade-in">
        <div className="relative z-10 max-w-2xl">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-4">
            <PartyPopper className="w-8 h-8 text-amber-300" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
            Кредит успешно выдан
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight mt-3">
            {application.approved_amount.toLocaleString('ru-RU')} ₽ зачислены на счет!
          </h2>
          <p className="text-emerald-100 text-sm mt-2">
            Договор №{application.application_number} подписан простой электронной подписью (ПЭП). Средства доступны для использования на расчетном счете компании.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/20">
            <div>
              <span className="text-xs text-emerald-200 block">Ставка</span>
              <span className="text-xl font-bold">{application.approved_rate}% годовых</span>
            </div>
            <div>
              <span className="text-xs text-emerald-200 block">Срок</span>
              <span className="text-xl font-bold">{application.approved_term_months} месяцев</span>
            </div>
            <div>
              <span className="text-xs text-emerald-200 block">Ежемесячный платеж</span>
              <span className="text-xl font-bold">{application.monthly_payment.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Экран ручного андеррайтинга (MANUAL_REVIEW)
  if (application.status === 'MANUAL_REVIEW') {
    return (
      <div className="bg-white rounded-3xl p-8 border border-blue-200 shadow-sm space-y-5 animate-fade-in">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
          <div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              На индивидуальном рассмотрении
            </span>
            <h3 className="text-xl font-bold text-slate-900 mt-2">
              Заявка направлена кредитному андеррайтеру
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Скоринговая модель выявила специфические факторы (например, активные арбитражные дела или сверку с ФНС), требующие верификации риск-офицером банка.
            </p>
          </div>
        </div>

        <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-blue-800">
            <span className="font-bold">Для проверки жюри:</span> Вы можете переключиться во вкладку «Кабинет банка» в шапке страницы и одобрить либо скорректировать заявку вручную.
          </div>
          <button
            onClick={onSwitchToUnderwriter}
            className="whitespace-nowrap px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            Перейти в кабинет андеррайтера
          </button>
        </div>
      </div>
    );
  }

  // 3. Экран отказа (REJECTED) + Кредитный доктор
  if (application.status === 'REJECTED') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white rounded-3xl p-8 border border-rose-200 shadow-sm">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
                Отказ в финансировании
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-2">
                Заявка отклонена риск-моделью
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Причина: <span className="font-semibold text-rose-700">{application.rejection_reason || 'Несоответствие критериям кредитной политики банка'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Сервис "Кредитный доктор" */}
        {scoring?.recommendations && scoring.recommendations.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-7 text-white shadow-lg space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-[#EF3124]">
                <Sparkles className="w-5 h-5 text-[#EF3124]" />
              </div>
              <div>
                <h4 className="font-bold text-base">Кредитный доктор Альфа-Банка</h4>
                <p className="text-xs text-slate-400">
                  Рекомендации, которые помогут компании получить одобрение при повторной подаче
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {scoring.recommendations.map((rec, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-red-500/20 text-[#EF3124] flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. Экран готового предложения (OFFER_READY) — Одобрение либо Встречное предложение
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Баннер Counter-Offer или Чистого одобрения */}
      {application.is_counter_offer ? (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-amber-900 shadow-sm">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-200/60 px-2.5 py-0.5 rounded-full">
                Встречное предложение банка (Counter-Offer)
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                Мы подобрали для вашей компании безопасные условия
              </h3>
              <p className="text-xs text-slate-700 mt-1">
                {application.counter_offer_reason ||
                  `Запрошенная сумма (${application.requested_amount.toLocaleString('ru-RU')} ₽) создавала повышенную нагрузку на оборотные средства. Банк предлагает скорректированный лимит.`}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-emerald-900 shadow-sm">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 flex-shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-200/60 px-2.5 py-0.5 rounded-full">
                Заявка полностью одобрена
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                Поздравляем! Вам одобрена запрашиваемая сумма
              </h3>
              <p className="text-xs text-slate-700 mt-1">
                Условия согласованы автоматическим конвейером на основании высокого рейтинга вашей организации.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Карточки условий предложения */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-400 block mb-1">Сумма кредита</span>
            <span className="text-2xl font-extrabold text-slate-900">
              {application.approved_amount.toLocaleString('ru-RU')} ₽
            </span>
            {application.is_counter_offer && (
              <span className="text-[11px] text-amber-600 font-medium block mt-1 line-through">
                запрос: {application.requested_amount.toLocaleString('ru-RU')} ₽
              </span>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-400 block mb-1">Процентная ставка</span>
            <span className="text-2xl font-extrabold text-[#EF3124]">
              {application.approved_rate}%
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">годовых</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-400 block mb-1">Срок кредитования</span>
            <span className="text-2xl font-extrabold text-slate-900">
              {application.approved_term_months} мес.
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">до {application.approved_term_months} месяцев</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-400 block mb-1">Ежемесячный платеж</span>
            <span className="text-2xl font-extrabold text-slate-900">
              {application.monthly_payment.toLocaleString('ru-RU')} ₽
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">аннуитет</span>
          </div>
        </div>

        {/* Explainable Scoring: Раскладка факторов для предпринимателя */}
        {scoring && scoring.factors && scoring.factors.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                  Прозрачность скоринга (Explainable AI / Scoring)
                </span>
                <span className="text-xs text-slate-500">
                  Балл благонадежности: <strong className="text-slate-900">{scoring.total_score} из 1000</strong> • Уровень риска:{' '}
                  <span className={`font-bold ${scoring.risk_level === 'LOW' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {scoring.risk_level}
                  </span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {scoring.factors.map((f, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800 block">{f.name}: {f.value}</span>
                    <span className="text-[11px] text-slate-500">{f.description}</span>
                  </div>
                  <span
                    className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg whitespace-nowrap ml-2 ${
                      f.is_positive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {f.score_impact > 0 ? `+${f.score_impact}` : f.score_impact}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Кнопка подписания */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => setShowSignModal(true)}
            className="w-full sm:w-auto px-8 py-4 bg-[#EF3124] hover:bg-[#D92015] text-white font-extrabold rounded-2xl shadow-lg shadow-red-500/20 text-base transition-all flex items-center justify-center space-x-2"
          >
            <span>Принять условия и подписать договор (ПЭП)</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Модальное окно симулятора подписания ПЭП */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-red-50 text-[#EF3124]">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Подписание кредитного договора</h3>
              </div>
              <button
                onClick={() => setShowSignModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex justify-between">
                <span>Заемщик:</span>
                <span className="font-semibold text-slate-900">{application.company?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Кредитор:</span>
                <span className="font-semibold text-slate-900">АО «АЛЬФА-БАНК»</span>
              </div>
              <div className="flex justify-between">
                <span>Сумма кредита:</span>
                <span className="font-bold text-[#EF3124]">{application.approved_amount.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between">
                <span>Процентная ставка:</span>
                <span className="font-bold text-slate-900">{application.approved_rate}% годовых</span>
              </div>
            </div>

            {/* In-App симуляция СМС-кода (строго в рамках правил без внешних сервисов) */}
            <div className="p-3.5 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-white text-xs space-y-1">
              <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
                <Lock className="w-3.5 h-3.5" />
                <span>Демо-СМС (внутрипродуктовая симуляция):</span>
              </div>
              <p className="text-slate-300">
                Ваш одноразовый код для подтверждения договора: <strong className="text-white text-sm tracking-widest bg-white/20 px-2 py-0.5 rounded">{application.sms_code || '0000'}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Введите код из СМС
              </label>
              <input
                type="text"
                value={smsInput}
                maxLength={6}
                onChange={(e) => setSmsInput(e.target.value)}
                placeholder="4 цифры (или универсальный 0000)"
                className="w-full text-center font-mono text-xl tracking-widest py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EF3124]"
              />
            </div>

            {signError && (
              <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{signError}</span>
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowSignModal(false)}
                className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Отмена
              </button>
              <button
                onClick={handleSign}
                disabled={signing || !smsInput}
                className="flex-1 py-3 text-xs font-bold text-white bg-[#EF3124] hover:bg-[#D92015] rounded-xl transition-all shadow-md shadow-red-500/20 disabled:opacity-50"
              >
                {signing ? 'Зачисление...' : 'Подписать и получить деньги'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
