import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Info, Search, ListFilter, Sliders } from 'lucide-react';

export default function BacktestPlatform({ candles, symbol, interval }) {
  // Filters state
  const [filterType, setFilterType] = useState('all'); // 'all' | 'bullish' | 'bearish'
  const [minVolume, setMinVolume] = useState('');
  const [dateSearch, setDateSearch] = useState('');

  // 1. Filter the raw data
  const filteredCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    
    return candles.filter(c => {
      // 1. Bullish/Bearish filter
      if (filterType === 'bullish' && c.close <= c.open) return false;
      if (filterType === 'bearish' && c.close >= c.open) return false;
      
      // 2. Minimum volume filter
      if (minVolume && c.volume < parseInt(minVolume, 10)) return false;
      
      // 3. Date query filter
      if (dateSearch) {
        const dStr = new Date(c.time).toLocaleDateString().toLowerCase();
        const isoStr = new Date(c.time).toISOString().toLowerCase();
        const searchVal = dateSearch.toLowerCase();
        if (!dStr.includes(searchVal) && !isoStr.includes(searchVal)) return false;
      }
      
      return true;
    });
  }, [candles, filterType, minVolume, dateSearch]);

  // 2. Compute statistics over the filtered dataset
  const stats = useMemo(() => {
    const dataset = filteredCandles;
    if (dataset.length === 0) {
      return {
        total: 0,
        bullish: 0,
        bearish: 0,
        bullishPct: 0,
        bearishPct: 0,
        maxHigh: 0,
        minLow: 0,
        avgChangePct: 0
      };
    }

    const total = dataset.length;
    let bullish = 0;
    let bearish = 0;
    let maxHigh = -Infinity;
    let minLow = Infinity;
    let totalChangePct = 0;

    dataset.forEach(c => {
      if (c.close > c.open) bullish++;
      if (c.close < c.open) bearish++;
      if (c.high > maxHigh) maxHigh = c.high;
      if (c.low < minLow) minLow = c.low;
      
      const changePct = ((c.close - c.open) / c.open) * 100;
      totalChangePct += changePct;
    });

    return {
      total,
      bullish,
      bearish,
      bullishPct: (bullish / total) * 100,
      bearishPct: (bearish / total) * 100,
      maxHigh,
      minLow,
      avgChangePct: totalChangePct / total
    };
  }, [filteredCandles]);

  if (!candles || candles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-80 rounded-2xl border border-white/5 bg-[#0f1524]/40 backdrop-blur-md text-slate-400">
        <Info className="w-10 h-10 text-slate-600 mb-3 animate-pulse" />
        <span className="text-sm font-semibold">No historical data records loaded.</span>
        <span className="text-xs text-slate-500 mt-1">Select a database cached symbol and range to execute a backtest query.</span>
      </div>
    );
  }

  // Format Dates nicely
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full h-full text-slate-200">
      
      {/* 1. Metrics Cards Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Periods */}
        <div className="glass-panel border-0 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Filtered Periods</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-white">{stats.total}</span>
            <span className="text-xs text-slate-500 font-medium">candles</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Out of {candles.length} total records</span>
        </div>

        {/* Bullish Periods */}
        <div className="glass-panel border-0 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            Bullish Periods (Close &gt; Open)
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-emerald-400">{stats.bullish}</span>
            <span className="text-xs text-emerald-500/80 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/10">
              {stats.bullishPct.toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Periods with net price gains</span>
        </div>

        {/* Bearish Periods */}
        <div className="glass-panel border-0 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-rose-400" />
            Bearish Periods (Close &lt; Open)
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-rose-400">{stats.bearish}</span>
            <span className="text-xs text-rose-500/80 font-bold bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/10">
              {stats.bearishPct.toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Periods with net price drops</span>
        </div>

        {/* Analytics High/Low & Avg Gain */}
        <div className="glass-panel border-0 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Analysis Stats</span>
          <div className="flex flex-col gap-1 mt-2 text-xs font-semibold">
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Avg Gain:</span>
              <span className={stats.avgChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {stats.avgChangePct >= 0 ? '+' : ''}{stats.avgChangePct.toFixed(3)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Max High:</span>
              <span className="text-white">₹{stats.maxHigh === -Infinity ? '0.00' : stats.maxHigh.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Min Low:</span>
              <span className="text-white">₹{stats.minLow === Infinity ? '0.00' : stats.minLow.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Search & Filters Panel */}
      <div className="glass-panel border-0 p-5 rounded-2xl flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs uppercase font-bold tracking-wider text-indigo-300 font-display">Data Filter Engine</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Price Direction Filter */}
          <div className="flex flex-col gap-1.5 text-xs font-semibold">
            <label className="text-slate-400">Price Direction (Close vs. Open)</label>
            <div className="flex bg-black/40 border border-white/5 rounded-xl p-0.5">
              <button
                onClick={() => setFilterType('all')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterType === 'all' ? 'bg-indigo-600/80 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Show All
              </button>
              <button
                onClick={() => setFilterType('bullish')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterType === 'bullish' ? 'bg-emerald-600/80 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bullish Only
              </button>
              <button
                onClick={() => setFilterType('bearish')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterType === 'bearish' ? 'bg-rose-600/80 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bearish Only
              </button>
            </div>
          </div>

          {/* Volume Threshold */}
          <div className="flex flex-col gap-1.5 text-xs font-semibold">
            <label className="text-slate-400">Min Volume Threshold</label>
            <div className="relative">
              <input
                type="number"
                placeholder="e.g. 500000"
                value={minVolume}
                onChange={(e) => setMinVolume(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500/50 text-white placeholder-slate-600"
              />
              <ListFilter className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-500" />
            </div>
          </div>

          {/* Date Search */}
          <div className="flex flex-col gap-1.5 text-xs font-semibold">
            <label className="text-slate-400">Search Date / Timestamp</label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Jun 22, 2026 or YYYY-MM"
                value={dateSearch}
                onChange={(e) => setDateSearch(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500/50 text-white placeholder-slate-600"
              />
              <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-500" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Detailed Data Table */}
      <div className="glass-panel border-0 rounded-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-white/5 bg-white/[0.01]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Historical Candles Database</h3>
        </div>
        
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#121826] border-b border-white/10 z-10 text-slate-400 font-semibold">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3 text-right">Open</th>
                <th className="px-5 py-3 text-right">High</th>
                <th className="px-5 py-3 text-right">Low</th>
                <th className="px-5 py-3 text-right">Close</th>
                <th className="px-5 py-3 text-right">Volume</th>
                <th className="px-5 py-3 text-right">Change (₹ / %)</th>
                <th className="px-5 py-3 text-center">Direction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredCandles.map((c, idx) => {
                const diffPrice = c.close - c.open;
                const diffPct = (diffPrice / c.open) * 100;
                const isGreen = c.close >= c.open;

                return (
                  <tr 
                    key={idx} 
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5 text-slate-300 font-sans font-medium">
                      {formatDate(c.time)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-400">
                      ₹{c.open.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-400">
                      ₹{c.high.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-400">
                      ₹{c.low.toFixed(2)}
                    </td>
                    <td className={`px-5 py-3.5 text-right font-bold ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ₹{c.close.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-300">
                      {c.volume.toLocaleString('en-IN')}
                    </td>
                    <td className={`px-5 py-3.5 text-right font-semibold ${diffPrice >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {diffPrice >= 0 ? '+' : ''}{diffPrice.toFixed(2)} ({diffPrice >= 0 ? '+' : ''}{diffPct.toFixed(2)}%)
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-sans ${
                        isGreen 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                      }`}>
                        {isGreen ? 'Bullish' : 'Bearish'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
