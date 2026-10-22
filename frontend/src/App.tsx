import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DemoPanel } from './components/DemoPanel';
import { CompanyLookup } from './components/ClientCabinet/CompanyLookup';
import { ProductSelector } from './components/ClientCabinet/ProductSelector';
import { ConveyorTimeline } from './components/ClientCabinet/ConveyorTimeline';
import { OfferDecisionView } from './components/ClientCabinet/OfferDecisionView';
import { UnderwriterDashboard } from './components/UnderwriterCabinet/UnderwriterDashboard';
import {
  fetchProducts,
  createApplication,
  submitApplication,
  fetchApplication,
  fetchStats,
} from './api';
import { CreditProduct, Company, Application } from './types';
import { PlusCircle, RefreshCw, ArrowLeft } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'client' | 'underwriter' | 'demo'>('client');
  const [products, setProducts] = useState<CreditProduct[]>([]);
  const [reviewCount, setReviewCount] = useState<number>(0);

  // Состояние формы клиента
  const [inn, setInn] = useState<string>('7701234567'); // По умолчанию идеальный заемщик
  const [company, setCompany] = useState<Company | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('working-capital');
  const [amount, setAmount] = useState<number>(5_000_000);
  const [termMonths, setTermMonths] = useState<number>(24);
  const [goal, setGoal] = useState<string>('Пополнение оборотных средств');
  const [repaymentType, setRepaymentType] = useState<string>('ANNUITY');

  // Активная заявка в обработке
  const [currentApp, setCurrentApp] = useState<Application | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loadingApp, setLoadingApp] = useState<boolean>(false);

  // Загрузка начальных данных (продукты и статистика)
  const refreshGlobal = async () => {
    try {
      const [prods, stats] = await Promise.all([fetchProducts(), fetchStats()]);
      setProducts(prods);
      setReviewCount(stats.review_count);
    } catch (e) {
      console.error('Ошибка инициализации данных:', e);
    }
  };

  useEffect(() => {
    refreshGlobal();
  }, []);

  // Отправка заявки в конвейер
  const handleSubmitApplication = async () => {
    try {
      setSubmitting(true);
      // 1. Создаем заявку (DRAFT)
      const draft = await createApplication({
        inn,
        product_id: selectedProductId,
        requested_amount: amount,
        requested_term_months: termMonths,
        financing_goal: goal,
        repayment_type: repaymentType,
      });

      // 2. Отправляем в конвейер (Обогащение -> Скоринг -> Решение)
      const processed = await submitApplication(draft.id);
      setCurrentApp(processed);
      refreshGlobal();
    } catch (err) {
      alert('Ошибка при отправке заявки: ' + String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Перезагрузка статуса текущей заявки
  const handleRefreshCurrentApp = async () => {
    if (!currentApp) return;
    try {
      setLoadingApp(true);
      const app = await fetchApplication(currentApp.id);
      setCurrentApp(app);
      refreshGlobal();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingApp(false);
    }
  };

  // Выбор сценария из демо-панели жюри
  const handleSelectScenario = async (
    sInn: string,
    sProduct: string,
    sAmount: number,
    sTerm: number,
    sGoal: string
  ) => {
    setInn(sInn);
    setSelectedProductId(sProduct);
    setAmount(sAmount);
    setTermMonths(sTerm);
    setGoal(sGoal);
    setCurrentApp(null);
    setActiveTab('client');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col">
      {/* Шапка с переключателем режимов */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        reviewCount={reviewCount}
      />

      {/* Основной контент */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ВКЛАДКА 1: ДЕМО-СЦЕНАРИИ ДЛЯ ЖЮРИ */}
        {activeTab === 'demo' && (
          <DemoPanel
            onSelectScenario={handleSelectScenario}
            onRefreshStats={refreshGlobal}
          />
        )}

        {/* ВКЛАДКА 2: КАБИНЕТ АНДЕРРАЙТЕРА */}
        {activeTab === 'underwriter' && (
          <UnderwriterDashboard onRefreshGlobalStats={refreshGlobal} />
        )}

        {/* ВКЛАДКА 3: ЛИЧНЫЙ КАБИНЕТ КЛИЕНТА */}
        {activeTab === 'client' && (
          <div className="space-y-6">
            {/* Если заявка уже отправлена в конвейер — показываем таймлайн и решение */}
            {currentApp ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setCurrentApp(null)}
                    className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 text-[#EF3124]" />
                    <span>Подать другую заявку</span>
                  </button>

                  <button
                    onClick={handleRefreshCurrentApp}
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingApp ? 'animate-spin' : ''}`} />
                    <span>Обновить статус</span>
                  </button>
                </div>

                {/* Живой таймлайн этапов конвейера */}
                <ConveyorTimeline application={currentApp} />

                {/* Карточка решения / Одобрения / Контр-оффера / Подписания */}
                <OfferDecisionView
                  application={currentApp}
                  onRefresh={handleRefreshCurrentApp}
                  onSwitchToUnderwriter={() => setActiveTab('underwriter')}
                />
              </div>
            ) : (
              /* Визард оформления новой заявки */
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Оформление кредита для бизнеса
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Цифровое экспресс-кредитование без визита в отделение. Введите ИНН для автоматической проверки.
                  </p>
                </div>

                {/* Поиск и верификация по ИНН */}
                <CompanyLookup
                  inn={inn}
                  setInn={setInn}
                  onCompanyLoaded={(comp) => setCompany(comp)}
                />

                {/* Выбор продукта, параметров и калькулятор */}
                <ProductSelector
                  products={products}
                  selectedProductId={selectedProductId}
                  setSelectedProductId={setSelectedProductId}
                  amount={amount}
                  setAmount={setAmount}
                  termMonths={termMonths}
                  setTermMonths={setTermMonths}
                  goal={goal}
                  setGoal={setGoal}
                  repaymentType={repaymentType}
                  setRepaymentType={setRepaymentType}
                  company={company}
                  onSubmit={handleSubmitApplication}
                  submitting={submitting}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Подвал */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Альфа Хак 2026 • Кейс «Умный кредитный кабинет предпринимателя»</span>
          <span className="font-mono text-slate-400">Версия решения: 1.0.0 (Cloud-native / Docker)</span>
        </div>
      </footer>
    </div>
  );
};
