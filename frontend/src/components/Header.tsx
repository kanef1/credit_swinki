import React from 'react';
import { Building2, UserCog, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: 'client' | 'underwriter' | 'demo';
  setActiveTab: (tab: 'client' | 'underwriter' | 'demo') => void;
  reviewCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, reviewCount }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Бренд Альфа-Банка */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#EF3124] flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-red-200">
              А
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">Альфа-Банк</span>
                <span className="bg-red-50 text-[#EF3124] text-xs font-semibold px-2 py-0.5 rounded-full border border-red-100">
                  МСП Кредит
                </span>
              </div>
              <p className="text-xs text-slate-500">Умный кредитный кабинет предпринимателя</p>
            </div>
          </div>

          {/* Переключатель режимов */}
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('client')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'client'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Building2 className="w-4 h-4 text-[#EF3124]" />
              <span>Личный кабинет</span>
            </button>

            <button
              onClick={() => setActiveTab('underwriter')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${
                activeTab === 'underwriter'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <UserCog className="w-4 h-4 text-blue-600" />
              <span>Кабинет банка</span>
              {reviewCount > 0 && (
                <span className="bg-[#EF3124] text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                  {reviewCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('demo')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'demo'
                  ? 'bg-red-50 text-[#EF3124] border border-red-200 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Демо-сценарии жюри</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
