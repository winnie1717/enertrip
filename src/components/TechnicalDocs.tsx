
import React from 'react';

const TechnicalDocs: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-10 bg-white rounded-3xl shadow-sm border border-slate-100 my-8">
      <h1 className="text-4xl font-extrabold text-slate-800 mb-8 pb-4 border-b border-slate-100">
        旅遊行程規劃系統技術文件
      </h1>
      
      <section className="space-y-8 text-slate-600 leading-relaxed">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 mb-4">
            <span className="w-2 h-8 bg-indigo-500 rounded-full"></span>
            前端視覺化邏輯
          </h2>
          <ul className="list-disc ml-8 space-y-4">
            <li>
              <strong className="text-slate-700">偏好度：</strong>
              主圓環上半圓，由 9 點鐘方向向 3 點鐘方向順時針增長。反映用戶歷史偏好與景點類型的契合度。
            </li>
            <li>
              <strong className="text-slate-700">負荷度：</strong>
              主圓環下半圓雙層結構。內層（橘色）代表<span className="italic">生理負荷</span>（步行量、階梯等）；外層（紅色）代表<span className="italic">心理負荷</span>（人潮擁擠度、資訊密度等）。
            </li>
            <li>
              <strong className="text-slate-700">星級評分：</strong>
              中心區五角星。使用 SVG 線性漸層驅動，支持小數點等級精確填色（例如 4.6 顆星）。
            </li>
            <li>
              <strong className="text-slate-700">價格分析：</strong>
              中心圓圈背景，由底部向上填充。預設以 $500 為 100% 填滿參考值。
            </li>
            <li>
              <strong className="text-slate-700">環境衛星圖示：</strong>
              圍繞主圓環的五個動態標籤（步行、空間、天氣、人潮、資訊）。所有圖示均具備水位填色效果，顏色與主指標連動。
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 mb-4">
            <span className="w-2 h-8 bg-indigo-500 rounded-full"></span>
            系統架構與交互
          </h2>
          <p>
            本系統採用 <span className="font-mono text-indigo-600 font-bold">React 18</span> 進行狀態管理，
            並封裝高性能 <span className="font-mono text-indigo-600 font-bold">D3.js</span> 繪圖邏輯。
            透過 <code>useEffect</code> 監聽狀態變更並觸發局部 SVG 渲染，確保流暢的交互體驗。
          </p>
        </div>
      </section>
    </div>
  );
};

export default TechnicalDocs;
