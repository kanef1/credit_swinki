import React, { useState, useEffect } from 'react';
import { Application, PipelineStats } from '../../types';
import { fetchApplications, fetchStats } from '../../api';
import { ApplicationReviewModal } from './ApplicationReviewModal';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertOctagon,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface UnderwriterDashboardProps {
  onRefreshGlobalStats: () => void;
}

export const UnderwriterDashboard: React.FC<UnderwriterDashboardProps> = ({
  onRefreshGlobalStats,
}) => {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, appsData] = await Promise.all([
        fetchStats(),
        fetchApplications(statusFilter),
      ]);
      setStats(statsData);
      setApplications(appsData);
      onRefreshGlobalStats();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      {/* Аналитические метрики конвейера */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Всего заявок</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {stats?.total_applications || 0}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-sm">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Ручной андеррайтинг</span>
          <span className="text-2xl font-extrabold text-blue-700 mt-1 block">
            {stats?.review_count || 0}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Одобрено</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
            {(stats?.approved_count || 0) + (stats?.disbursed_count || 0)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Отказов</span>
          <span className="text-2xl font-extrabold text-rose-700 mt-1 block">
            {stats?.rejected_count || 0}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Объем выдач</span>
          <span className="text-2xl font-extrabold text-[#EF3124] mt-1 block">
            {((stats?.total_disbursed_volume || 0) / 1_000_000).toFixed(1)} млн ₽
          </span>
        </div>
      </div>

      {/* Очередь заявок */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Очередь кредитного конвейера
            </h3>
            <p className="text-xs text-slate-500">
              Управление потоком заявок, ручной андеррайтинг и аудит принятых решений
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
              title="Обновить"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Фильтры по статусам */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: '', label: 'Все заявки' },
            { id: 'MANUAL_REVIEW', label: 'Требуют решения (MANUAL_REVIEW)' },
            { id: 'OFFER_READY', label: 'Предложение готово' },
            { id: 'DISBURSED', label: 'Выданы' },
            { id: 'REJECTED', label: 'Отказано' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all border ${
                statusFilter === f.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Таблица заявок */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-2">№ Заявки</th>
                <th className="py-3 px-2">Компания / ИНН</th>
                <th className="py-3 px-2">Запрос / Одобрено</th>
                <th className="py-3 px-2">Скоринг</th>
                <th className="py-3 px-2">Статус</th>
                <th className="py-3 px-2 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Заявок с выбранным фильтром не найдено
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-2 font-mono font-bold text-slate-900">
                      {app.application_number}
                      <span className="block text-[10px] text-slate-400 font-sans font-normal">
                        {new Date(app.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </td>

                    <td className="py-3 px-2">
                      <span className="font-bold text-slate-900 block">{app.company?.name || '—'}</span>
                      <span className="text-[11px] text-slate-400 font-mono">ИНН: {app.company?.inn}</span>
                    </td>

                    <td className="py-3 px-2">
                      <span className="font-bold text-slate-800 block">
                        {(app.approved_amount || app.requested_amount).toLocaleString('ru-RU')} ₽
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {app.approved_term_months || app.requested_term_months} мес. • {app.approved_rate || 14.5}%
                      </span>
                    </td>

                    <td className="py-3 px-2">
                      {app.scoring_result ? (
                        <div>
                          <span className={`font-mono font-bold text-xs ${
                            app.scoring_result.total_score >= 700
                              ? 'text-emerald-600'
                              : app.scoring_result.total_score >= 550
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}>
                            {app.scoring_result.total_score}
                          </span>
                          <span className="text-[10px] text-slate-400 block uppercase">
                            {app.scoring_result.risk_level}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        app.status === 'OFFER_READY' || app.status === 'SIGNED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : app.status === 'DISBURSED'
                          ? 'bg-teal-50 text-teal-700 border-teal-200'
                          : app.status === 'MANUAL_REVIEW'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                          : app.status === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {app.status === 'MANUAL_REVIEW' && 'Ручной андеррайтинг'}
                        {app.status === 'OFFER_READY' && 'Оффер готов'}
                        {app.status === 'DISBURSED' && 'Выдано'}
                        {app.status === 'SIGNED' && 'Подписано'}
                        {app.status === 'REJECTED' && 'Отказано'}
                        {app.status === 'DRAFT' && 'Черновик'}
                        {app.status === 'SUBMITTED' && 'Отправлено'}
                        {app.status === 'ENRICHING' && 'Обогащение'}
                        {app.status === 'SCORING' && 'Скоринг'}
                      </span>
                    </td>

                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#EF3124] text-white text-xs font-semibold transition-all inline-flex items-center space-x-1"
                      >
                        <span>Детали</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальное окно рассмотрения */}
      {selectedApp && (
        <ApplicationReviewModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
};
