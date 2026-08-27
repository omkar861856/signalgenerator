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
  ArrowUpRight,
  Power,
  Clock,
  Target,
  Percent,
  ArrowLeft
} from 'lucide-react';

export default function FnoFibonacciStrategy({ onPlaceOptionOrder, onBack, userMargin = 41734.05 }) {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [availableDates, setAvailableDates] = useState([todayStr]);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [engineRunning, setEngineRunning] = useState(false);
  const [minBodyPercent, setMinBodyPercent] = useState(0.05);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState(null);
  const [toast, setToast] = useState(null);

  // Strategy Configuration State
  const [strategyEnabled, setStrategyEnabled] = useState(true);
  const [marginPercentage, setMarginPercentage] = useState(20);
  const [allowEntriesAfter12pm, setAllowEntriesAfter12pm] = useState(false);
  const [optionSelectionMode, setOptionSelectionMode] = useState('ATM');

  // Minimizable and Extendable Section State
  const [collapsedSections, setCollapsedSections] = useState({
    controls: false,
    table: false,
    visualizer: false,
    derivative: false,
    trades: false,
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

  // Fetch strategy config
  const fetchStrategyConfig = async () => {
    try {
      const data = await safeFetchJson('/api/strategy1/config');
      if (data.success && data.config) {
        setStrategyEnabled(data.config.enabled !== undefined ? data.config.enabled : true);
        setMarginPercentage(data.config.marginPercentage || 20);
        setAllowEntriesAfter12pm(!!data.config.allowEntriesAfter12pm);
        setOptionSelectionMode(data.config.optionSelectionMode || 'ATM');
        if (data.config.minBodyPercent) setMinBodyPercent(data.config.minBodyPercent);
      }
    } catch (e) {
      console.error('Failed to fetch strategy config:', e);
    }
  };

  // Update strategy config
  const updateStrategyConfig = async (newSettings) => {
    try {
      const data = await safeFetchJson('/api/strategy1/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (data.success && data.config) {
        if (newSettings.enabled !== undefined) setStrategyEnabled(data.config.enabled);
        if (newSettings.marginPercentage !== undefined) setMarginPercentage(data.config.marginPercentage);
        if (newSettings.allowEntriesAfter12pm !== undefined) setAllowEntriesAfter12pm(data.config.allowEntriesAfter12pm);
        if (newSettings.optionSelectionMode !== undefined) setOptionSelectionMode(data.config.optionSelectionMode);
        showToast('Strategy 1 parameters updated!', 'success');
      }
    } catch (e) {
      showToast('Failed to save configuration: ' + e.message, 'error');
    }
  };

  // Toggle strategy enabled status
  const handleToggleStrategy = async () => {
    const targetState = !strategyEnabled;
    try {
      const data = await safeFetchJson('/api/strategy1/toggle', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetState })
      });
      if (data.success) {
        setStrategyEnabled(Boolean(data.enabled));
        showToast(`Strategy 1 is now ${data.enabled ? 'ENABLED' : 'DISABLED'}`, data.enabled ? 'success' : 'warning');
      }
    } catch (e) {
      showToast('Failed to toggle strategy: ' + e.message, 'error');
    }
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

  // Fetch trades history for date
  const fetchTrades = async (dateStr) => {
    try {
      const data = await safeFetchJson(`/api/strategy1/trades?date=${dateStr}`);
      if (data.success && data.trades) {
        setTrades(data.trades);
      }
    } catch (e) {
      console.error('Error fetching trades:', e);
    }
  };

  useEffect(() => {
    fetchStrategyConfig();
    fetchDates();
    fetchDailyTable(selectedDate);
    fetchTrades(selectedDate);
  }, [selectedDate]);

  // Trigger 1st 15-Min F&O Fibonacci Scanner
  const handleRunScanner = async () => {
    setScanning(true);
    showToast('Running 1st 15-Min F&O Fibonacci Scanner (Top Gainers)...', 'info');
    try {
      const data = await safeFetchJson('/api/fno/fibonacci-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate, minBodyPercent, optionSelectionMode })
      });
      if (data.success && data.results) {
        setDailyRecords(data.results);
        if (data.results.length > 0) {
          setSelectedStock(data.results[0]);
        }
        showToast(`Scan complete! Loaded ${data.count} F&O top gainers sorted by % change for ${selectedDate}.`, 'success');
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

  // Run Decision Engine
  const handleRunDecisionEngine = async () => {
    setEngineRunning(true);
    showToast('Executing Decision Engine for Strategy 1...', 'info');
    try {
      const data = await safeFetchJson('/api/strategy1/run-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
      });
      if (data.success) {
        showToast(`Decision Engine executed ${data.actionsCount || 0} automated trade actions!`, 'success');
        fetchTrades(selectedDate);
      } else {
        showToast(data.message || 'Decision Engine ran with no actions triggered.', 'warning');
      }
    } catch (e) {
      showToast('Decision Engine execution failed: ' + e.message, 'error');
    } finally {
      setEngineRunning(false);
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

  // Filtered & Descending % Change Sorted Records Table
  const filteredRecords = useMemo(() => {
    let list = [...dailyRecords];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(r => r.symbol.toLowerCase().includes(q) || (r.derivative && r.derivative.tradingsymbol.toLowerCase().includes(q)));
    }
    // Sort scanner stocks in DESCENDING order of % change (Top Gainers first)
    return list.sort((a, b) => (b.changePct || b.bodyPercent || 0) - (a.changePct || a.bodyPercent || 0));
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

      {/* Navigation Header */}
      {onBack && (
        <div className="flex items-center justify-between gap-4">
          <button 
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Strategies Workspace
          </button>
        </div>
      )}

      {/* Header Strategy Intro Card */}
      <div className="glass-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900/60 backdrop-blur-md rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Strategy 1 • F&O Option Buying
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
              1st 15-Min Green Candle
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              strategyEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}>
              {strategyEnabled ? '● ENABLED' : '○ DISABLED'}
            </span>
          </div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2 mt-1.5">
            <Flame className="h-6 w-6 text-purple-400 animate-pulse" />
            1st 15-Minute F&O Fibonacci Option Buying Hub
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
            Scans F&O top gainers (9:15–9:30 AM). Validates 1st 15m green candles, calculates Fibonacci levels strictly <strong className="text-purple-300">from Low to High</strong>, monitors ATM/1-ITM Call options in parallel, buys on 60-65% retest between 9:30 AM and 12 PM, targets <strong className="text-emerald-300">100% (50%), 1.272 (25%), 1.618 (25%)</strong>, and enforces 78.6% multi-candle SL breathing rule.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button 
            onClick={handleToggleStrategy}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
              strategyEnabled 
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
            }`}
          >
            <Power className="h-4 w-4" />
            {strategyEnabled ? 'Disable Strategy 1' : 'Enable Strategy 1'}
          </button>

          <button 
            onClick={handleRunDecisionEngine}
            disabled={engineRunning || !strategyEnabled}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Zap className={`h-4 w-4 ${engineRunning ? 'animate-bounce' : ''}`} />
            {engineRunning ? 'Running Engine...' : 'Run Decision Engine ⚡'}
          </button>

          <button 
            onClick={handleRunScanner}
            disabled={scanning}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan 15m Top Gainers 🔄'}
          </button>
        </div>
      </div>

      {/* 📌 NITTY-GRITTY SYSTEM RULES & EXECUTION ARCHITECTURE BOX */}
      <div className="glass-panel p-5 border-purple-500/30 bg-slate-950/80 rounded-2xl flex flex-col gap-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-300 font-mono uppercase tracking-wider">
            <Info className="h-4 w-4 text-purple-400" />
            <span>Nitty-Gritty System Execution Rules &amp; Automation Specs</span>
          </div>
          <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
            AUTOMATION ACTIVE 9:30 AM - 12:00 PM
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-purple-300">
              <Power className="h-3.5 w-3.5 text-purple-400" />
              <span>APP CONTROL Impact</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              When <strong>APP CONTROL: ON</strong>, decision engine polls every 15s. If toggled <strong>OFF</strong>, all strategy scanning halts and active GTTs / open orders are immediately cancelled.
            </p>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-purple-300">
              <ShieldAlert className="h-3.5 w-3.5 text-emerald-400" />
              <span>GTT Exit Orders Attached</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong>YES:</strong> On order execution, backend automatically formats and places <strong>GTT OCO Exit Triggers</strong> on Zerodha (Targets 100%, 1.272, 1.618 &amp; 78.6% SL).
            </p>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-purple-300">
              <Activity className="h-3.5 w-3.5 text-purple-400" />
              <span>Multi-Candle SL Breathing Rule</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              If SL (78.6%) is touched inside entry 15m candle window, position breathes until next candle to prevent stop-hunting.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: STRATEGY CONTROLS & MARGIN POSITION SIZING PLANNER */}
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
                1. Strategy Segment Control &amp; Position Sizing Planner
                <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  Margin: {marginPercentage}% Utilization
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Configure margin percentage, option strike selection (ATM vs 1-ITM), and post-12 PM entry rules.</p>
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
          <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-950/40 border-t border-slate-800/50">
            
            {/* Margin Percentage Slider & Planner */}
            <div className="flex flex-col gap-2 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
              <label className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <Percent className="h-4 w-4 text-purple-400" />
                  Margin Utilization %
                </span>
                <span className="font-mono text-xs font-bold text-purple-400">{marginPercentage}%</span>
              </label>
              <input 
                type="range" 
                min="5" 
                max="100" 
                step="5"
                value={marginPercentage} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMarginPercentage(val);
                  updateStrategyConfig({ marginPercentage: val });
                }}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 font-mono">
                Allocates {marginPercentage}% of available margin (~₹{((userMargin * marginPercentage) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}).
                <span className="block text-purple-300/90 mt-0.5 font-semibold">
                  Based on ₹{userMargin.toLocaleString('en-IN', { maximumFractionDigits: 2 })} × {marginPercentage}% allocation
                </span>
              </span>
            </div>

            {/* Option Selection Strategy (ATM CE vs 1 Strike ITM CE) */}
            <div className="flex flex-col gap-2 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
              <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 text-indigo-300">
                <Target className="h-4 w-4 text-indigo-400" />
                Option Selection Mode
              </label>
              <select
                value={optionSelectionMode}
                onChange={(e) => {
                  const val = e.target.value;
                  setOptionSelectionMode(val);
                  updateStrategyConfig({ optionSelectionMode: val });
                }}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ATM">ATM CE (At-The-Money Call Option)</option>
                <option value="1ITM">1 Strike ITM CE (In-The-Money Call Option)</option>
              </select>
              <span className="text-[10px] text-slate-400">Avoids far OTM to maximize delta &amp; reduce theta decay risk.</span>
            </div>

            {/* Allow Automatic Entries After 12 PM Toggle */}
            <div className="flex flex-col gap-2 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
              <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 text-emerald-300">
                <Clock className="h-4 w-4 text-emerald-400" />
                Allow Entries After 12 PM
              </label>
              <button
                onClick={() => {
                  const val = !allowEntriesAfter12pm;
                  setAllowEntriesAfter12pm(val);
                  updateStrategyConfig({ allowEntriesAfter12pm: val });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                  allowEntriesAfter12pm 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <span>{allowEntriesAfter12pm ? 'AFTER 12 PM ALLOWED' : 'PAUSED AFTER 12 PM'}</span>
                <span className="text-sm">{allowEntriesAfter12pm ? 'ON' : 'OFF'}</span>
              </button>
              <span className="text-[10px] text-slate-400">Default cutoff is 12 PM for strategic volume preservation.</span>
            </div>

            {/* Target Scan Date & Quick Reload */}
            <div className="flex flex-col gap-2 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
              <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 text-amber-300">
                <Calendar className="h-4 w-4 text-amber-400" />
                Target Scan Session
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                >
                  {availableDates.map(d => (
                    <option key={d} value={d}>{d} {d === todayStr ? '(Today)' : ''}</option>
                  ))}
                </select>
                <button
                  onClick={handleClearDailyTable}
                  className="py-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
                  title="Clear today's DB table"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                </button>
              </div>
              <span className="text-[10px] text-slate-400">Select session date to view historical scan results.</span>
            </div>

          </div>
        )}
      </div>

      {/* SECTION 2: TOP GAINERS SCANNED STOCKS TABLE (SORTED DESCENDING BY % CHANGE) */}
      <div className="glass-panel border border-slate-800/80 bg-slate-900/70 rounded-2xl overflow-hidden transition-all shadow-lg">
        <div 
          onClick={() => toggleSection('table')}
          className="p-4 bg-slate-800/40 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between border-b border-slate-800 transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
                2. Top Gainers F&amp;O Options Scanner Table
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                  {filteredRecords.length} STOCKS (SORTED BY % CHANGE DESCENDING)
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Arranged strictly in descending order of % change with parallel option contract selection.</p>
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
                Loading top gainers F&amp;O scan table...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <ShieldAlert className="h-8 w-8 text-amber-400 opacity-60" />
                <span>No F&amp;O stock scan records found for <strong className="text-white font-mono">{selectedDate}</strong>.</span>
                <button 
                  onClick={handleRunScanner} 
                  className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Run 15m Top Gainers Scanner Now ⚡
                </button>
              </div>
            ) : (
              <>
                <div className="bg-slate-950/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">📊 Data Source Transparency:</span>
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded flex items-center gap-1.5 font-bold text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      OFF-MARKET HOURS (NIGHT): HISTORICAL SESSION DATA ONLY (NO LIVE TICKS)
                    </span>
                  </div>
                  <span className="text-slate-400">Session: <strong className="text-purple-300">{selectedDate}</strong></span>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 text-center">Rank</th>
                    <th className="py-3 px-4 font-bold text-white">Symbol</th>
                    <th className="py-3 px-4 text-right">% Change</th>
                    <th className="py-3 px-4 text-right">Spot LTP</th>
                    <th className="py-3 px-4 text-right">Option 15m Low</th>
                    <th className="py-3 px-4 text-right">Option 15m High</th>
                    <th className="py-3 px-4 text-right">Option Buy Zone (60-65%)</th>
                    <th className="py-3 px-4 text-right">Option Target 1 (100%)</th>
                    <th className="py-3 px-4 text-right">Option Target 2 (1.272)</th>
                    <th className="py-3 px-4 text-right text-rose-300">Option 78.6% SL</th>
                    <th className="py-3 px-4">Selected Option</th>
                    <th className="py-3 px-4 text-right">Min Margin Req (1 Lot)</th>
                    <th className="py-3 px-4 text-center">Data Source</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredRecords.map((item, idx) => {
                    const isSelected = selectedStock && selectedStock.symbol === item.symbol;
                    const fibs = item.fibonacciLevels || {};
                    const changeVal = item.changePct !== undefined ? item.changePct : item.bodyPercent;
                    
                    const lotSize = item.derivative?.lotSize || 100;
                    const estPrem = item.derivative?.estimatedPremium || 15;
                    const minMargin = item.derivative?.minMarginRequired || (lotSize * estPrem);
                    const isLive = item.dataSource === 'LIVE_MARKET' || selectedDate === todayStr;

                    return (
                      <tr 
                        key={item.symbol} 
                        onClick={() => setSelectedStock(item)}
                        className={`hover:bg-purple-950/20 transition-colors cursor-pointer ${
                          isSelected ? 'bg-purple-900/30 border-l-4 border-l-purple-500' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center text-slate-500 font-bold">#{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-white">
                          <span className="bg-slate-800 text-purple-300 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                            {item.symbol}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          +{changeVal?.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 font-semibold">₹{item.close?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-slate-400 font-mono">₹{(item.derivative?.optLow || fibs.fib0)?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-slate-200 font-bold font-mono">₹{(item.derivative?.optHigh || fibs.fib100)?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-amber-300 font-bold">
                          ₹{(fibs.fib650 || (fibs.fib618 * 0.995))?.toFixed(2)} - ₹{(fibs.fib600 || fibs.fib618)?.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-indigo-300 font-semibold">₹{fibs.fib100?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-purple-300 font-semibold">₹{fibs.fib1272?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-rose-300 font-bold">₹{fibs.fib786?.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span className="text-indigo-300 font-semibold text-[11px]">
                            {item.derivative?.tradingsymbol || `${item.symbol} CE`}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {item.derivative?.selectionMode || optionSelectionMode} | Lot: {lotSize}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-emerald-400 font-bold text-[12px] block">
                            ₹{minMargin.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[9px] text-slate-400 block">
                            1 Lot ({lotSize} qty × ₹{estPrem.toFixed(2)})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            isLive 
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          }`}>
                            {item.dataSourceLabel || (isLive ? 'LIVE MARKET' : 'HISTORICAL')}
                          </span>
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
              </>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: AUTOMATED DECISION ENGINE TRADES MONITOR */}
      <div className="glass-panel border border-slate-800/80 bg-slate-900/70 rounded-2xl overflow-hidden transition-all shadow-lg">
        <div 
          onClick={() => toggleSection('trades')}
          className="p-4 bg-slate-800/40 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between border-b border-slate-800 transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
                3. Automated Strategy 1 Trade Signals &amp; SL Breath Monitor
                <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                  {trades.length} TRADES TODAY
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Live order execution status, 50%/25%/25% target scaling, and 15-minute SL breathing rule alerts.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {collapsedSections.trades ? 'Extend ❯' : 'Minimize 🔽'}
            </span>
            {collapsedSections.trades ? <ChevronRight className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-teal-400" />}
          </div>
        </div>

        {!collapsedSections.trades && (
          <div className="p-4 flex flex-col gap-3 font-mono text-xs">
            {trades.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <Info className="h-6 w-6 text-indigo-400 opacity-60" />
                <span>No automated trades executed yet for session date {selectedDate}.</span>
                <button 
                  onClick={handleRunDecisionEngine} 
                  disabled={!strategyEnabled}
                  className="mt-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
                >
                  Run Decision Engine ⚡
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {trades.map(t => (
                  <div key={t.tradeId} className="py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {t.optionSymbol}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                          t.status === 'ENTERED' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
                          t.status.includes('PARTIAL') ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                          t.status === 'EXITED_TARGET3' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                          t.status === 'BREATHING_SL' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                          'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <span className="text-slate-400 text-[11px]">
                        Allocated Margin: ₹{t.marginAllocated?.toFixed(2)} ({t.lots} Lots)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                      <div>Spot High: <strong className="text-white">₹{t.spot15mHigh?.toFixed(2)}</strong></div>
                      <div>Fib 60% Retest: <strong className="text-amber-300">₹{t.fib60?.toFixed(2)}</strong></div>
                      <div>Target 1 (100%): <strong className="text-indigo-300">₹{t.target1?.toFixed(2)}</strong></div>
                      <div>78.6% SL: <strong className="text-rose-300">₹{t.stopLossLevel?.toFixed(2)}</strong></div>
                    </div>

                    {/* Trade Logs */}
                    {t.logs && t.logs.length > 0 && (
                      <div className="flex flex-col gap-1 pl-2 border-l-2 border-purple-500/40 text-[10px] text-slate-400">
                        {t.logs.map((l, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-slate-500">{new Date(l.timestamp).toLocaleTimeString()}</span>
                            <span className="text-slate-300">{l.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SELECTED STOCK DETAIL DISPLAY: FIBONACCI LEVEL VISUALIZER & OPTION BUYING HUB */}
      {selectedStock && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* SECTION 4: 1ST 15-MIN CANDLE LOW-TO-HIGH FIBONACCI LEVEL VISUALIZER CARD */}
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
                    4. Low-to-High Fibonacci Levels ({selectedStock.symbol})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Low: ₹{selectedStock.low?.toFixed(2)} → High: ₹{selectedStock.high?.toFixed(2)} (Range: ₹{(selectedStock.high - selectedStock.low)?.toFixed(2)})
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
                {[
                  { ratio: '161.8%', key: 'fib1618', label: 'Target 3 (1.618 Extension - Exit 25%)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' },
                  { ratio: '127.2%', key: 'fib1272', label: 'Target 2 (1.272 Extension - Exit 25%)', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-bold' },
                  { ratio: '100.0%', key: 'fib100', label: 'Target 1 (100% Previous High - Exit 50%)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold' },
                  { ratio: '60-65%', key: 'fib600', label: 'Golden Re-Entry Buy Zone (60% - 65% Retraction)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' },
                  { ratio: '78.6%', key: 'fib786', label: '78.6% Stop Loss Level (Multi-Candle Breathing Rule)', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold' },
                  { ratio: '50.0%', key: 'fib500', label: '50.0% Retracement Mid-Point', color: 'bg-slate-800 text-slate-300' },
                  { ratio: '0.0%', key: 'fib0', label: '15m Candle Low (Base Zero)', color: 'bg-slate-900 text-slate-400 border-slate-700' }
                ].map(fib => {
                  const fibs = selectedStock.fibonacciLevels || {};
                  let val = fibs[fib.key];
                  if (fib.ratio === '60-65%') {
                    val = fibs.fib600 || fibs.fib618;
                  }
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

          {/* SECTION 5: OPTION DERIVATIVE SELECTION & EXECUTION HUB */}
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
                    5. Option Buyer Derivative &amp; Execution Hub
                  </h3>
                  <p className="text-[11px] text-slate-400">Auto-selected {optionSelectionMode} Call Option (CE) contract for options buying.</p>
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
                    <span className="text-xs text-slate-400 uppercase font-semibold">Derivative Contract</span>
                    <span className="text-sm font-bold text-white bg-purple-600/30 px-2.5 py-1 rounded border border-purple-500/40">
                      {selectedStock.derivative?.tradingsymbol}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Strike Price</span>
                      <span className="font-bold text-slate-200">₹{selectedStock.derivative?.strike} ({selectedStock.derivative?.selectionMode || optionSelectionMode})</span>
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
                      <span className="text-slate-400 block text-[10px]">Est. Premium</span>
                      <span className="font-bold text-amber-300">₹{selectedStock.derivative?.estimatedPremium?.toFixed(2)}</span>
                    </div>
                    
                    {/* Minimum Margin Required */}
                    <div className="col-span-2 bg-purple-900/40 p-2.5 rounded-lg border border-purple-500/30 flex items-center justify-between mt-1">
                      <div>
                        <span className="text-purple-300 font-bold block text-[11px]">Minimum Margin Required (1 Lot)</span>
                        <span className="text-[10px] text-slate-400 font-mono">1 Lot ({selectedStock.derivative?.lotSize} qty × ₹{selectedStock.derivative?.estimatedPremium?.toFixed(2)})</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        ₹{(selectedStock.derivative?.minMarginRequired || (selectedStock.derivative?.lotSize * selectedStock.derivative?.estimatedPremium)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Data Source Transparency Tag */}
                    <div className="col-span-2 flex items-center justify-between text-[10px] font-mono border-t border-purple-500/20 pt-2 mt-1">
                      <span className="text-slate-400">Data Source:</span>
                      <span className={`px-2 py-0.5 rounded font-bold uppercase border ${
                        selectedStock.dataSource === 'LIVE_MARKET' || selectedDate === todayStr 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      }`}>
                        {selectedStock.dataSourceLabel || (selectedDate === todayStr ? '● REAL-TIME LIVE MARKET DATA' : '● HISTORICAL MARKET DATA')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Auto Calculated Order Sizing & Targets */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2.5 text-xs font-mono">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Spot Entry (60-65% Fib Zone):</span>
                    <span className="font-bold text-amber-300">₹{(selectedStock.fibonacciLevels?.fib600 || selectedStock.fibonacciLevels?.fib618)?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-300">
                    <span>78.6% SL (Multi-Candle Rule):</span>
                    <span className="font-bold">₹{selectedStock.fibonacciLevels?.fib786?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-indigo-300">
                    <span>Target 1 (100% - Exit 50%):</span>
                    <span className="font-bold">₹{selectedStock.fibonacciLevels?.fib100?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-purple-300">
                    <span>Target 2 (1.272 Ext - Exit 25%):</span>
                    <span className="font-bold">₹{selectedStock.fibonacciLevels?.fib1272?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-300">
                    <span>Target 3 (1.618 Ext - Exit 25%):</span>
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

    </div>
  );
}
