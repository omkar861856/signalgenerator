import React, { useState, useEffect, useMemo } from 'react';
import { 
  Flame, 
  ChevronDown, 
  ChevronRight, 
  RefreshCw, 
  Search, 
  Sliders, 
  TrendingUp, 
  CheckCircle2, 
  Zap, 
  Layers, 
  ArrowUpDown, 
  Trash2, 
  Download, 
  BarChart2, 
  Activity, 
  Info,
  Calendar,
  Sparkles,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';

export default function FnoFibonacciStrategy({ onPlaceOptionOrder }) {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [availableDates, setAvailableDates] = useState([todayStr]);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [minBodyPercent, setMinBodyPercent] = useState(0.05);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState(null);
  const [toast, setToast] = useState(null);

  // Minimizable and Extendable Section State (Default Minimized: true)
  const [collapsedSections, setCollapsedSections] = useState({
    controls: true,
    table: true,
    visualizer: true,
    derivative: true,
    history: true
  });

  const toggleSection = (sectionKey) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const safeFetchJson = async (url, options = {}) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      const snippet = text.replace(/<[^>]*>?/gm, '').trim().substring(0, 120);
      throw new Error(`Server returned non-JSON (${res.status}): ${snippet || 'Unknown response'}`);
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  };

  // Fetch available dates
  const fetchDates = async () => {
    try {
      const data = await safeFetchJson('/api/fno/fibonacci-dates');
      if (data.success && data.dates && data.dates.length > 0) {
        setAvailableDates(data.dates);
      }
    } catch (e) {
      console.error('Failed to fetch scan dates:', e);
    }
  };

  // Fetch daily scanned stocks table
  const fetchDailyTable = async (dateStr) => {
    setLoading(true);
    try {
      const data = await safeFetchJson(`/api/fno/fibonacci-daily-table?date=${dateStr}`);
      if (data.success && data.results) {
        setDailyRecords(data.results);
        if (data.results.length > 0 && !selectedStock) {
          setSelectedStock(data.results[0]);
        }
      } else {
        setDailyRecords([]);
      }
    } catch (e) {
      showToast('Error loading daily F&O scan table: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDates();
    fetchDailyTable(selectedDate);
  }, [selectedDate]);

  // Trigger 1st 15-Min F&O Fibonacci Scanner
  const handleRunScanner = async () => {
    setScanning(true);
    showToast('Running 1st 15-Min F&O Fibonacci Scanner...', 'info');
    try {
      const data = await safeFetchJson('/api/fno/fibonacci-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate, minBodyPercent })
      });
      if (data.success && data.results) {
        setDailyRecords(data.results);
        if (data.results.length > 0) {
          setSelectedStock(data.results[0]);
        }
        showToast(`Scan complete! Appended ${data.count} unique F&O stocks sorted in ascending order for ${selectedDate}.`, 'success');
        fetchDates();
      } else {
        showToast('Scanner completed with 0 results matching criteria.', 'warning');
      }
    } catch (e) {
      showToast('Scanner failed: ' + e.message, 'error');
    } finally {
      setScanning(false);
    }
  };

  // Purge daily table for selected date
  const handleClearDailyTable = async () => {
    if (!window.confirm(`Are you sure you want to clear today's table for ${selectedDate}?`)) return;
    try {
      const data = await safeFetchJson(`/api/fno/fibonacci-daily-table?date=${selectedDate}`, { method: 'DELETE' });
      if (data.success) {
        setDailyRecords([]);
        setSelectedStock(null);
        showToast(`Purged table records for ${selectedDate}`, 'info');
      }
    } catch (e) {
      showToast('Failed to clear table: ' + e.message, 'error');
    }
  };

  // Filtered & Ascending Sorted Records Table
  const filteredRecords = useMemo(() => {
    let list = [...dailyRecords];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(r => r.symbol.toLowerCase().includes(q) || (r.derivative && r.derivative.tradingsymbol.toLowerCase().includes(q)));
    }
    // Always enforce ascending order A-Z by symbol
    return list.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [dailyRecords, searchQuery]);

  return (
    <div className="flex flex-col gap-6 w-full text-slate-200 animate-in fade-in duration-300">
      
      {/* Toast Notification Banner */}
      {toast && (
        <div className={`p-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-lg animate-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' :
          toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
          'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 flex-shrink-0 animate-spin" />
            <span>{toast.msg}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white cursor-pointer ml-4">✕</button>
        </div>
      )}

      {/* Header Strategy Intro Card */}
      <div className="glass-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900/60 backdrop-blur-md rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              F&O Options Buying Strategy
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
              1st 15-Min Candle
            </span>
          </div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2 mt-1.5">
            <Flame className="h-6 w-6 text-purple-400 animate-pulse" />
            1st 15-Minute F&O Fibonacci Options Buying Hub
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
            Scans F&O enabled stocks during the first 15 minutes of trading (9:15 – 9:30 AM). Identifies green candle breakouts, calculates Fibonacci retracements &amp; extensions directly from <strong className="text-purple-300">Open till Close</strong>, selects optimal Call Options (CE) contracts, and appends unique stocks to a daily MongoDB table arranged in <strong className="text-emerald-300">Ascending Order (A-Z)</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleRunScanner}
            disabled={scanning}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning F&O Universe...' : 'Run 1st 15-Min Scan ⚡'}
          </button>
        </div>
      </div>

      {/* SECTION 1: STRATEGY CONTROLS & PARAMETER TOOLBAR (MINIMIZABLE & EXTENDABLE) */}
      <div className="glass-panel border border-slate-800/80 bg-slate-900/70 rounded-2xl overflow-hidden transition-all shadow-lg">
        <div 
          onClick={() => toggleSection('controls')}
          className="p-4 bg-slate-800/40 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between border-b border-slate-800 transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
                1. Scanner Controls &amp; Fibonacci Parameters
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {collapsedSections.controls ? 'Collapsed' : 'Active'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Configure target date, candle body length filter, and execution parameters.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {collapsedSections.controls ? 'Extend ❯' : 'Minimize 🔽'}
            </span>
            {collapsedSections.controls ? <ChevronRight className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-purple-400" />}
          </div>
        </div>

        {!collapsedSections.controls && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/40 border-t border-slate-800/50">
            {/* Target Date Picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-purple-400" />
                Target Scan Date
              </label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
              >
                {availableDates.map(d => (
                  <option key={d} value={d}>{d} {d === todayStr ? '(Today)' : ''}</option>
                ))}
              </select>
            </div>

            {/* Min Body Length Percentage */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  Min Body Length %
                </span>
                <span className="font-mono text-emerald-400">{minBodyPercent}%</span>
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="5"
                value={minBodyPercent}
                onChange={(e) => setMinBodyPercent(parseFloat(e.target.value) || 0)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Search Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-indigo-400" />
                Live Stock Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter F&O symbol (e.g. INFY)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-2">
              <button
                onClick={() => fetchDailyTable(selectedDate)}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
                Reload DB
              </button>
              <button
                onClick={handleClearDailyTable}
                className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/30 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="Clear today's DB table"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                Purge
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: DAILY AGGREGATED F&O SCANNED STOCKS TABLE (MINIMIZABLE & EXTENDABLE) */}
      <div className="glass-panel border border-slate-800/80 bg-slate-900/70 rounded-2xl overflow-hidden transition-all shadow-lg">
        <div 
          onClick={() => toggleSection('table')}
          className="p-4 bg-slate-800/40 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between border-b border-slate-800 transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
                2. Daily Aggregated F&amp;O Scanned Stocks Table
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                  {filteredRecords.length} UNIQUE STOCKS (ASCENDING A-Z)
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Stores deduplicated F&amp;O stocks scanned for {selectedDate}, sorted strictly in ascending order.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {collapsedSections.table ? 'Extend ❯' : 'Minimize 🔽'}
            </span>
            {collapsedSections.table ? <ChevronRight className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-emerald-400" />}
          </div>
        </div>

        {!collapsedSections.table && (
          <div className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-purple-400" />
                Loading daily aggregated F&amp;O scan records from database...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <ShieldAlert className="h-8 w-8 text-amber-400 opacity-60" />
                <span>No F&amp;O stock scan records found for date <strong className="text-white font-mono">{selectedDate}</strong>.</span>
                <button 
                  onClick={handleRunScanner} 
                  className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Run 1st 15-Min Scanner Now ⚡
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 text-center">#</th>
                    <th className="py-3 px-4 font-bold text-white flex items-center gap-1">
                      Symbol <ArrowUpDown className="h-3 w-3 text-purple-400" />
                    </th>
                    <th className="py-3 px-4 text-right">15m Open</th>
                    <th className="py-3 px-4 text-right">15m High</th>
                    <th className="py-3 px-4 text-right">15m Low</th>
                    <th className="py-3 px-4 text-right">15m Close</th>
                    <th className="py-3 px-4 text-right">Body Length</th>
                    <th className="py-3 px-4 text-center">Candle Color</th>
                    <th className="py-3 px-4">Selected CE Option</th>
                    <th className="py-3 px-4 text-right">Est. Premium</th>
                    <th className="py-3 px-4 text-right">Fib 161.8% Target</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredRecords.map((item, idx) => {
                    const isSelected = selectedStock && selectedStock.symbol === item.symbol;
                    const fib161 = item.fibonacciLevels?.fib1618 || 0;
                    
                    return (
                      <tr 
                        key={item.symbol} 
                        onClick={() => setSelectedStock(item)}
                        className={`hover:bg-purple-950/20 transition-colors cursor-pointer ${
                          isSelected ? 'bg-purple-900/30 border-l-4 border-l-purple-500' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center text-slate-500 font-semibold">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          <span className="bg-slate-800 text-purple-300 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                            {item.symbol}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">₹{item.open?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-slate-400">₹{item.high?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-slate-400">₹{item.low?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-bold">₹{item.close?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-emerald-400 font-semibold">+₹{item.bodyLength?.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 block">({item.bodyPercent?.toFixed(2)}%)</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            GREEN
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-indigo-300 font-semibold text-[11px]">
                            {item.derivative?.tradingsymbol || `${item.symbol} CE`}
                          </span>
                          <span className="text-[10px] text-slate-400 block">Lot: {item.derivative?.lotSize}</span>
                        </td>
                        <td className="py-3 px-4 text-right text-amber-300 font-semibold">
                          ₹{item.derivative?.estimatedPremium?.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-purple-300 font-bold">
                          ₹{fib161?.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStock(item);
                              if (onPlaceOptionOrder) {
                                onPlaceOptionOrder(item);
                              } else {
                                showToast(`Selected ${item.derivative?.tradingsymbol} for Options Order!`, 'success');
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[11px] font-bold cursor-pointer shadow transition-all flex items-center gap-1 mx-auto"
                          >
                            Buy CE <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* SELECTED STOCK DETAIL DISPLAY: FIBONACCI LEVEL VISUALIZER & OPTION BUYING HUB */}
      {selectedStock && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* SECTION 3: 1ST 15-MIN CANDLE & FIBONACCI LEVEL VISUALIZER CARD (MINIMIZABLE & EXTENDABLE) */}
          <div className="glass-panel border border-slate-800/80 bg-slate-900/70 rounded-2xl overflow-hidden transition-all shadow-lg">
            <div 
              onClick={() => toggleSection('visualizer')}
              className="p-4 bg-slate-800/40 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between border-b border-slate-800 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <BarChart2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
                    3. Fibonacci Open-to-Close Levels ({selectedStock.symbol})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Open: ₹{selectedStock.open?.toFixed(2)} → Close: ₹{selectedStock.close?.toFixed(2)} (Body: +{selectedStock.bodyPercent?.toFixed(2)}%)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">
                  {collapsedSections.visualizer ? 'Extend ❯' : 'Minimize 🔽'}
                </span>
                {collapsedSections.visualizer ? <ChevronRight className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-purple-400" />}
              </div>
            </div>

            {!collapsedSections.visualizer && (
              <div className="p-5 flex flex-col gap-3 font-mono">
                {/* Fib Level Visual Rows */}
                {[
                  { ratio: '261.8%', key: 'fib2618', label: 'Max Extension Target 4', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                  { ratio: '200.0%', key: 'fib2000', label: 'Extension Target 3', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                  { ratio: '161.8%', key: 'fib1618', label: 'Core Target 2 (Fib 1.618)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold' },
                  { ratio: '127.2%', key: 'fib1272', label: 'First Target 1', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
                  { ratio: '100.0%', key: 'fib100', label: '15m Candle Close (Breakout High)', color: 'bg-slate-700 text-white font-bold' },
                  { ratio: '78.6%', key: 'fib786', label: 'Deep Retracement Support', color: 'bg-slate-800 text-slate-300' },
                  { ratio: '61.8%', key: 'fib618', label: 'Golden Ratio Re-Entry Zone', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                  { ratio: '50.0%', key: 'fib500', label: 'Mid-Point Stop-Loss Support', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
                  { ratio: '38.2%', key: 'fib382', label: 'Shallow Retracement', color: 'bg-slate-800 text-slate-400' },
                  { ratio: '23.6%', key: 'fib236', label: 'Base Retracement', color: 'bg-slate-800 text-slate-400' },
                  { ratio: '0.0%', key: 'fib0', label: '15m Candle Open (Base Zero)', color: 'bg-slate-900 text-slate-400 border-slate-700' }
                ].map(fib => {
                  const val = selectedStock.fibonacciLevels ? selectedStock.fibonacciLevels[fib.key] : null;
                  return (
                    <div 
                      key={fib.ratio} 
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${fib.color}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold w-16 text-right font-mono">{fib.ratio}</span>
                        <span className="text-[11px] text-slate-300">{fib.label}</span>
                      </div>
                      <span className="font-bold text-sm">
                        ₹{val ? val.toFixed(2) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 4: OPTION DERIVATIVE SELECTION & TRADE EXECUTION HUB (MINIMIZABLE & EXTENDABLE) */}
          <div className="glass-panel border border-slate-800/80 bg-slate-900/70 rounded-2xl overflow-hidden transition-all shadow-lg">
            <div 
              onClick={() => toggleSection('derivative')}
              className="p-4 bg-slate-800/40 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between border-b border-slate-800 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
                    4. Option Buyer Derivative &amp; Execution Hub
                  </h3>
                  <p className="text-[11px] text-slate-400">Auto-selected ATM/ITM Call Option (CE) contract for options buying.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">
                  {collapsedSections.derivative ? 'Extend ❯' : 'Minimize 🔽'}
                </span>
                {collapsedSections.derivative ? <ChevronRight className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-indigo-400" />}
              </div>
            </div>

            {!collapsedSections.derivative && (
              <div className="p-5 flex flex-col gap-4">
                
                {/* Derivative Spec Card */}
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/20 flex flex-col gap-3 font-mono">
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Derivative Symbol</span>
                    <span className="text-sm font-bold text-white bg-purple-600/30 px-2.5 py-1 rounded border border-purple-500/40">
                      {selectedStock.derivative?.tradingsymbol}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Strike Price</span>
                      <span className="font-bold text-slate-200">₹{selectedStock.derivative?.strike}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Option Type</span>
                      <span className="font-bold text-emerald-400">{selectedStock.derivative?.optionType || 'CE'} (Call Option)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Lot Size</span>
                      <span className="font-bold text-slate-200">{selectedStock.derivative?.lotSize} shares</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Estimated Premium</span>
                      <span className="font-bold text-amber-300">₹{selectedStock.derivative?.estimatedPremium?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Auto Calculated Order Sizing & Targets */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2.5 text-xs font-mono">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Spot Entry (15m Close):</span>
                    <span className="font-bold text-white">₹{selectedStock.close?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-300">
                    <span>Suggested SL (50% Fib):</span>
                    <span className="font-bold">₹{selectedStock.fibonacciLevels?.fib500?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-purple-300">
                    <span>Target 1 (127.2% Fib):</span>
                    <span className="font-bold">₹{selectedStock.fibonacciLevels?.fib1272?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-300">
                    <span>Target 2 (161.8% Fib):</span>
                    <span className="font-bold">₹{selectedStock.fibonacciLevels?.fib1618?.toFixed(2)}</span>
                  </div>
                </div>

                {/* Single Click Buy Option Button */}
                <button
                  onClick={() => {
                    if (onPlaceOptionOrder) {
                      onPlaceOptionOrder(selectedStock);
                    } else {
                      showToast(`Order Triggered: BUY 1 Lot ${selectedStock.derivative?.tradingsymbol} at est. ₹${selectedStock.derivative?.estimatedPremium}!`, 'success');
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-purple-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-display font-bold text-sm shadow-xl shadow-purple-600/20 cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="h-4 w-4 text-amber-300 fill-amber-300 animate-bounce" />
                  Place Options Buy Order ({selectedStock.derivative?.tradingsymbol}) 🚀
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: HISTORICAL DAILY DATABASE SCANS INSPECTOR (MINIMIZABLE & EXTENDABLE) */}
      <div className="glass-panel border border-slate-800/80 bg-slate-900/70 rounded-2xl overflow-hidden transition-all shadow-lg">
        <div 
          onClick={() => toggleSection('history')}
          className="p-4 bg-slate-800/40 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between border-b border-slate-800 transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-700 text-slate-300 border border-slate-600">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
                5. Database Scan History &amp; Archived Days Inspector
              </h3>
              <p className="text-[11px] text-slate-400">Browse historical 1st 15-min F&amp;O scan results saved across previous trading sessions in MongoDB.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {collapsedSections.history ? 'Extend ❯' : 'Minimize 🔽'}
            </span>
            {collapsedSections.history ? <ChevronRight className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
          </div>
        </div>

        {!collapsedSections.history && (
          <div className="p-5 flex flex-wrap gap-2 bg-slate-950/40">
            {availableDates.map(dateStr => (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all cursor-pointer ${
                  selectedDate === dateStr
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                📅 {dateStr}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
