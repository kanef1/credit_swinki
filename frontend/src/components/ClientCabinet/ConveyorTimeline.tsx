import React from 'react';
import { Application, ApplicationStatus } from '../../types';
import { Check, Loader2, Clock, AlertCircle, FileCheck, ShieldAlert } from 'lucide-react';

interface ConveyorTimelineProps {
  application: Application;
}

export const ConveyorTimeline: React.FC<ConveyorTimelineProps> = ({ application }) => {
  const steps: { key: string; label: string; desc: string; statuses: ApplicationStatus[] }[] = [
    {
      key: 'submitted',
      label: 'Прием заявки',
      desc: 'Валидация реквизитов',
      statuses: ['SUBMITTED', 'ENRICHING', 'SCORING', 'MANUAL_REVIEW', 'OFFER_READY', 'SIGNED', 'DISBURSED', 'REJECTED'],
    },
    {
      key: 'enriching',
      label: 'Обогащение данных',
      desc: 'Запросы в ФНС и БКИ',
      statuses: ['ENRICHING', 'SCORING', 'MANUAL_REVIEW', 'OFFER_READY', 'SIGNED', 'DISBURSED', 'REJECTED'],
    },
    {
      key: 'scoring',
      label: 'Оценка риска (Скоринг)',
      desc: 'Расчет баллов и DTI',
      statuses: ['SCORING', 'MANUAL_REVIEW', 'OFFER_READY', 'SIGNED', 'DISBURSED', 'REJECTED'],
    },
    {
      key: 'decision',
      label: 'Кредитное решение',
      desc: 'Формирование условий',
      statuses: ['MANUAL_REVIEW', 'OFFER_READY', 'SIGNED', 'DISBURSED', 'REJECTED'],
    },
  ];

  // Определяем статус каждого шага
  const getStepState = (stepIndex: number) => {
    const currentStatus = application.status;

    if (currentStatus === 'DRAFT') {
      return 'pending';
    }

    if (stepIndex === 0) return 'completed';

    if (stepIndex === 1) {
      if (currentStatus === 'SUBMITTED') return 'active';
      return 'completed';
    }

    if (stepIndex === 2) {
      if (currentStatus === 'SUBMITTED' || currentStatus === 'ENRICHING') return 'pending';
      if (currentStatus === 'SCORING') return 'active';
      return 'completed';
    }

    if (stepIndex === 3) {
      if (['MANUAL_REVIEW', 'OFFER_READY', 'SIGNED', 'DISBURSED', 'REJECTED'].includes(currentStatus)) {
        if (currentStatus === 'REJECTED') return 'rejected';
        if (currentStatus === 'MANUAL_REVIEW') return 'review';
        return 'completed';
      }
      return 'pending';
    }

    return 'pending';
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Заявка</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{application.application_number}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Компания: <span className="font-semibold text-slate-800">{application.company?.name}</span> (ИНН: {application.company?.inn})
          </p>
        </div>

        <div>
          <span className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
            application.status === 'OFFER_READY' || application.status === 'DISBURSED' || application.status === 'SIGNED'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : application.status === 'MANUAL_REVIEW'
              ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
              : application.status === 'REJECTED'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <span>Статус:</span>
            <span>
              {application.status === 'DRAFT' && 'Черновик'}
              {application.status === 'SUBMITTED' && 'Отправлена'}
              {application.status === 'ENRICHING' && 'Обогащение данными...'}
              {application.status === 'SCORING' && 'Скоринг...'}
              {application.status === 'MANUAL_REVIEW' && 'Ручной андеррайтинг'}
              {application.status === 'OFFER_READY' && 'Предложение готово'}
              {application.status === 'SIGNED' && 'Договор подписан'}
              {application.status === 'DISBURSED' && 'Деньги выданы'}
              {application.status === 'REJECTED' && 'Отказано'}
            </span>
          </span>
        </div>
      </div>

      {/* Таймлайн этапов */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {steps.map((step, idx) => {
          const state = getStepState(idx);
          return (
            <div key={step.key} className="flex flex-col items-center text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-all ${
                state === 'completed'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                  : state === 'active'
                  ? 'bg-[#EF3124] text-white shadow-md shadow-red-200 animate-pulse'
                  : state === 'review'
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                  : state === 'rejected'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-200'
                  : 'bg-slate-200 text-slate-500'
              }`}>
                {state === 'completed' && <Check className="w-5 h-5 stroke-[2.5]" />}
                {state === 'active' && <Loader2 className="w-5 h-5 animate-spin" />}
                {state === 'review' && <Clock className="w-5 h-5" />}
                {state === 'rejected' && <ShieldAlert className="w-5 h-5" />}
                {state === 'pending' && <span>{idx + 1}</span>}
              </div>

              <span className="text-xs font-bold text-slate-800">{step.label}</span>
              <span className="text-[11px] text-slate-400 mt-0.5">{step.desc}</span>
            </div>
          );
        })}
      </div>

      {/* Журнал аудита конвейера (Audit Log) */}
      {application.audit_logs && application.audit_logs.length > 0 && (
        <div className="pt-4 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
            История движения заявки по конвейеру (Audit Trail)
          </span>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {application.audit_logs.map((log) => (
              <div key={log.id} className="text-xs flex items-start space-x-2.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap mt-0.5">
                  {new Date(log.created_at).toLocaleTimeString('ru-RU')}
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  log.actor_role === 'SYSTEM'
                    ? 'bg-purple-100 text-purple-700'
                    : log.actor_role === 'UNDERWRITER'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {log.actor_role}
                </span>
                <span className="text-slate-700 font-medium">{log.comment}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
