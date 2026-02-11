
import React from 'react';
import { type Metrics } from '../types';
import { COLORS } from '../constants';

interface MetricCardsProps {
  metrics: Metrics;
}

const MetricCards: React.FC<MetricCardsProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 mb-6">
      <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col items-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">偏好</span>
        <div className="text-3xl font-black" style={{ color: COLORS.preference }}>
          {Math.round(metrics.preference)} <span className="text-sm font-normal text-slate-300">/ 10</span>
        </div>
      </div>
      <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col items-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">生理疲勞</span>
        <div className="text-3xl font-black" style={{ color: COLORS.physical }}>
          {Math.round(metrics.physical)} <span className="text-sm font-normal text-slate-300">/ 10</span>
        </div>
      </div>
      <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col items-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">心理疲勞</span>
        <div className="text-3xl font-black" style={{ color: COLORS.mental }}>
          {Math.round(metrics.mental)} <span className="text-sm font-normal text-slate-300">/ 10</span>
        </div>
      </div>
    </div>
  );
};

export default MetricCards;
