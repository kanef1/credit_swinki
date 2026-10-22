import React, { useState } from 'react';
import { Sparkles, CheckCircle, RefreshCcw, ArrowRight, ShieldCheck, AlertCircle, FileClock, XCircle } from 'lucide-react';
import { seedDemoData } from '../api';

interface DemoPanelProps {
  onSelectScenario: (inn: string, productId: string, amount: number, term: number, goal: string) => void;
  onRefreshStats: () => void;
}

export const DemoPanel: React.FC<DemoPanelProps> = ({ onSelectScenario, onRefreshStats }) => {
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const scenarios = [
    {
      id: 1,
      title: 'Сценарий №1: Автоодобрение за 3 секунды',
      badge: 'Fast Track (Auto-Approve)',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: ShieldCheck,
      iconColor: 'text-emerald-500',
      companyName: 'ООО "Вектор Роста"',
      inn: '7701234567',
      params: 'Запрос: 5 000 000 ₽ на 24 мес. (Оборотный кредит)',
      description: 'Компания работает 4+ года, годовая выручка 58 млн ₽, рейтинг БКИ 820/850, счет в Альфа-Банке. Отсутствие долгов и судов.',
      outcome: 'Результат: Мгновенное одобрение 100% суммы под 14.0% годовых со скидкой за РКО.',
      productId: 'working-capital',
      amount: 5000000,
      term: 24,
      goal: 'Пополнение оборотных средств',
    },
    {
      id: 2,
      title: 'Сценарий №2: Встречное предложение (Counter-Offer)',
      badge: 'Контр-оффер (DTI limit)',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: AlertCircle,
      iconColor: 'text-amber-500',
      companyName: 'ИП Смирнов Алексей Владимирович',
      inn: '7809876543',
      params: 'Запрос: 6 000 000 ₽ на 12 мес.',
      description: 'Компания молодая (1.8 года), выручка 18.5 млн ₽, имеются текущие кредиты с платежом 190 тыс. ₽/мес. Запрошенная сумма создает DTI 47.4%.',
      outcome: 'Результат: Банк не отказывает, а предлагает альтернативу — безопасный лимит до 4.7 млн ₽ или увеличение срока.',
      productId: 'working-capital',
      amount: 6000000,
      term: 12,
      goal: 'Закупка сезонного товара',
    },
    {
      id: 3,
      title: 'Сценарий №3: Передача андеррайтеру (Manual Review)',
      badge: 'Эскалация в бэк-офис',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: FileClock,
      iconColor: 'text-blue-500',
      companyName: 'ООО "ТехноПром Инжиниринг"',
      inn: '5001122334',
      params: 'Запрос: 4 000 000 ₽ на 36 мес. (Оборудование)',
      description: 'Бизнес прибыльный, но в ФНС числится небольшая текущая задолженность 48 тыс. ₽ и 2 арбитражных спора с контрагентами.',
      outcome: 'Результат: Заявка переходит в статус MANUAL_REVIEW. В кабинете банка риск-офицер может изучить детали и согласовать.',
      productId: 'equipment-investment',
      amount: 4000000,
      term: 36,
      goal: 'Приобретение станка ЧПУ',
    },
    {
      id: 4,
      title: 'Сценарий №4: Отказ + «Кредитный доктор»',
      badge: 'Стоп-факторы & Рекомендации',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      icon: XCircle,
      iconColor: 'text-rose-500',
      companyName: 'ООО "СтройГрупп Риск"',
      inn: '9705544332',
      params: 'Запрос: 3 000 000 ₽ на 18 мес.',
      description: 'Компании всего 3 месяца (порог от 6 мес.), убыток -420 тыс. ₽, задолженность перед ФНС 410 тыс. ₽, дефолты в БКИ (415/850).',
      outcome: 'Результат: Отказ с прозрачным объяснением причин и списком персональных рекомендаций по оздоровлению кредитного профиля.',
      productId: 'working-capital',
      amount: 3000000,
      term: 18,
      goal: 'Пополнение оборотных средств',
    },
  ];

  const handleSeed = async () => {
    try {
      setSeeding(true);
      await seedDemoData();
      setSeedSuccess(true);
      onRefreshStats();
      setTimeout(() => setSeedSuccess(false), 4000);
    } catch (e) {
      alert('Ошибка при наполнении базы: ' + String(e));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Верхний баннер для жюри */}
      <div className="bg-gradient-to-r from-red-600 to-rose-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Панель для экспертов и жюри Alfa Hack 2026</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Сквозные сценарии проверки кредитного конвейера</h2>
            <p className="text-red-100 text-sm mt-1 max-w-2xl">
              Нажмите «Запустить сценарий», чтобы мгновенно предзаполнить заявку эталонной компанией и протестировать работу риск-модели, стоп-факторов и конвейера.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center space-x-2 bg-white text-slate-900 font-semibold px-4 py-2.5 rounded-xl shadow-md hover:bg-slate-50 transition-all text-sm disabled:opacity-50"
            >
              <RefreshCcw className={`w-4 h-4 text-[#EF3124] ${seeding ? 'animate-spin' : ''}`} />
              <span>{seeding ? 'Наполнение...' : 'Сбросить и засеять БД'}</span>
            </button>
          </div>
        </div>

        {seedSuccess && (
          <div className="mt-4 bg-emerald-500/90 text-white text-xs font-medium px-4 py-2 rounded-xl flex items-center space-x-2 backdrop-blur-sm animate-fade-in">
            <CheckCircle className="w-4 h-4" />
            <span>База данных успешно наполнена синтетическими заявками по всем 4 сценариям!</span>
          </div>
        )}
      </div>

      {/* Сетка сценариев */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {scenarios.map((sc) => {
          const IconComponent = sc.icon;
          return (
            <div
              key={sc.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${sc.badgeColor}`}>
                    {sc.badge}
                  </span>
                  <div className="p-2 rounded-xl bg-slate-50">
                    <IconComponent className={`w-5 h-5 ${sc.iconColor}`} />
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-base mb-1">{sc.title}</h3>
                <div className="text-xs text-slate-500 font-mono mb-3">
                  ИНН: <span className="font-semibold text-slate-700">{sc.inn}</span> • {sc.companyName}
                </div>

                <p className="text-xs text-slate-600 mb-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {sc.description}
                </p>

                <div className="text-xs font-medium text-slate-800 bg-red-50/50 p-2.5 rounded-lg border border-red-100/60 mb-4">
                  {sc.outcome}
                </div>
              </div>

              <button
                onClick={() => onSelectScenario(sc.inn, sc.productId, sc.amount, sc.term, sc.goal)}
                className="w-full inline-flex items-center justify-center space-x-2 bg-slate-900 text-white hover:bg-[#EF3124] text-sm font-semibold py-2.5 px-4 rounded-xl transition-all group"
              >
                <span>Запустить этот сценарий</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
