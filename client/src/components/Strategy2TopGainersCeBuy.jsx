import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  ChevronDown, 
  ChevronRight, 
  RefreshCw, 
  Search, 
  Sliders, 
  CheckCircle2, 
  Zap, 
  Layers, 
  ArrowUpDown, 
  Trash2, 
  Activity, 
  Info,
  Calendar,
  Sparkles,
  ShieldAlert,
  ArrowUpRight,
  Power,
  Clock,
  Target,
  ArrowLeft,
  Play
} from 'lucide-react';

export default function Strategy2TopGainersCeBuy({ onBack, userMargin = 41734.05 }) {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [engineRunning, setEngineRunning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);

  // Strategy Configuration State
  const [strategyEnabled, setStrategyEnabled] = useState(false);
  const [optionSelectionMode, setOptionSelectionMode] = useState('ATM');
  const [startTime, setStartTime] = useState('09:15');
  const [endTime, setEndTime] = useState('09:20');

  // Collapsible section states
  const [collapsedSections, setCollapsedSections] = useState({
    controls: false,
    gainersTable: false,
    trades: false,
    rules: false
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

  // Fetch Strategy 2 Config
  const fetchStrategyConfig = async () => {
    try {
      const data = await safeFetchJson('/api/strategy2/config');
      if (data.success && data.config) {
        setStrategyEnabled(!!data.config.enabled);
        setOptionSelectionMode(data.config.optionSelectionMode || 'ATM');
        if (data.config.startTime) setStartTime(data.config.startTime);
        if (data.config.endTime) setEndTime(data.config.endTime);
      }
    } catch (e) {
      console.error('Failed to fetch Strategy 2 config:', e);
    }
  };

  const handleSaveTimeWindow = async (newStart, newEnd) => {
    try {
      const data = await safeFetchJson('/api/strategy2/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: newStart, endTime: newEnd })
      });
      if (data.success) {
        setStartTime(newStart);
        setEndTime(newEnd);
        showToast(`Time window updated to ${newStart} - ${newEnd} IST`, 'success');
      }
    } catch (err) {
      showToast(`Failed to update window: ${err.message}`, 'error');
    }
  };

  // Fetch F&O Daily Gainers Table
  const fetchDailyTable = async () => {
    setLoading(true);
    try {
      const data = await safeFetchJson(`/api/fno/fibonacci-daily-table?date=${selectedDate}`);
      if (data.success && Array.isArray(data.results)) {
        // Sort descending by % change (Top Gainers first)
        const sorted = [...data.results].sort((a, b) => (b.changePct || 0) - (a.changePct || 0));
        setDailyRecords(sorted);
      } else {
        setDailyRecords([]);
      }
    } catch (err) {
      showToast(`Error fetching gainers: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Strategy 2 Executed Trades
  const fetchTrades = async () => {
    try {
      const data = await safeFetchJson(`/api/strategy2/trades?date=${selectedDate}`);
      if (data.success && Array.isArray(data.trades)) {
        setTrades(data.trades);
      } else {
        setTrades([]);
      }
    } catch (err) {
      console.error('Failed to fetch Strategy 2 trades:', err);
    }
  };

  useEffect(() => {
    fetchStrategyConfig();
    fetchDailyTable();
    fetchTrades();

    // Polling interval for live updates
    const interval = setInterval(() => {
      fetchTrades();
      fetchStrategyConfig();
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // Toggle Strategy 2 State
  const handleToggleStrategy = async () => {
    const targetState = !strategyEnabled;
    try {
      const data = await safeFetchJson('/api/strategy2/toggle', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetState })
      });
      if (data.success) {
        setStrategyEnabled(Boolean(data.enabled));
        showToast(`Strategy 2 is now ${data.enabled ? 'ENABLED (ON)' : 'DISABLED (OFF)'}`, data.enabled ? 'success' : 'warning');
      }
    } catch (err) {
      showToast(`Toggle failed: ${err.message}`, 'error');
    }
  };

  // Run Strategy 2 Decision Engine manually (force run)
  const handleRunEngine = async () => {
    setEngineRunning(true);
    try {
      const data = await safeFetchJson('/api/strategy2/run-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, forceRun: true })
      });
      if (data.success) {
        showToast(`Engine evaluated ${data.actionsCount || 0} BUY orders taken, ${data.skippedCount || 0} skipped due to margin.`, 'success');
        fetchTrades();
      } else {
        showToast(`Engine notice: ${data.message}`, 'warning');
      }
    } catch (err) {
      showToast(`Engine execution error: ${err.message}`, 'error');
    } finally {
      setEngineRunning(false);
    }
  };

  // Purge Strategy 2 Today's Trades
  const handlePurgeTrades = async () => {
    if (!window.confirm(`Are you sure you want to clear Strategy 2 records for ${selectedDate}?`)) return;
    try {
      const data = await safeFetchJson('/api/strategy2/trades', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
      });
      if (data.success) {
        showToast(data.message, 'success');
        fetchTrades();
      }
    } catch (err) {
      showToast(`Failed to purge trades: ${err.message}`, 'error');
    }
  };

  // Search Filter
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return dailyRecords;
    const q = searchQuery.toLowerCase().trim();
    return dailyRecords.filter(r => 
      (r.symbol && r.symbol.toLowerCase().includes(q)) ||
      (r.derivative?.tradingsymbol && r.derivative.tradingsymbol.toLowerCase().includes(q))
    );
  }, [dailyRecords, searchQuery]);

  // Set of bought symbols for badge indicator
  const boughtSymbolsSet = useMemo(() => {
    return new Set(trades.map(t => (t.symbol || '').toUpperCase()));
  }, [trades]);

  return (
    <div className="flex flex-col gap-6 w-full text-slate-200 animate-in fade-in duration-300 font-sans pb-12">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-3 ${
          toast.type === 'error' ? 'bg-rose-950/90 border-rose-500/50 text-rose-200' :
          toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' :
          toast.type === 'warning' ? 'bg-amber-950/90 border-amber-500/50 text-amber-200' :
          'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
        }`}>
          <Sparkles className="h-4 w-4 flex-shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Strategy Navigation Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700 cursor-pointer"
            title="Back to Strategy Hub"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/20">
                STRATEGY #2 • SEMI-AUTOMATIC CE BUYER
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                strategyEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {strategyEnabled ? '● ACTIVE (09:15 - 09:30 AM)' : '○ OFF'}
              </span>
            </div>
            <h1 className="text-xl font-display font-bold text-white mt-1 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
              F&amp;O Top Gainers CE Buyer (9:15 - 9:30 AM Window)
            </h1>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleStrategy}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border shadow-lg ${
              strategyEnabled 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40 shadow-emerald-900/30' 
                : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400/40 shadow-rose-900/30'
            }`}
          >
            <Power className="h-4 w-4" />
            {strategyEnabled ? 'STRATEGY ON' : 'STRATEGY OFF'}
          </button>

          <button
            onClick={handleRunEngine}
            disabled={engineRunning}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/30 cursor-pointer transition-all flex items-center gap-2 border border-cyan-400/30 disabled:opacity-50"
          >
            <Play className={`h-3.5 w-3.5 ${engineRunning ? 'animate-spin' : ''}`} />
            {engineRunning ? 'Scanning...' : 'Test Run Engine 🚀'}
          </button>
        </div>
      </div>

      {/* Rules & Strategy Specification Banner */}
      <div className="glass-panel p-5 border-cyan-500/30 bg-slate-900/90 rounded-2xl flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
            <Info className="h-4 w-4 text-cyan-400" />
            <span>Strategy #2 Execution Rules &amp; Configurable Time Window</span>
          </div>

          {/* Time Window Settings Control */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-slate-400 font-mono">Active Window:</span>
            <input 
              type="text" 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center font-mono font-bold text-white text-xs"
              placeholder="09:15"
            />
            <span className="text-slate-500">-</span>
            <input 
              type="text" 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center font-mono font-bold text-white text-xs"
              placeholder="09:20"
            />
            <button
              onClick={() => handleSaveTimeWindow(startTime, endTime)}
              className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] font-mono transition-all cursor-pointer"
            >
              SAVE WINDOW
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-slate-300">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              <span>1. Configurable Time Window</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Active between <strong>{startTime} to {endTime} IST</strong>. At <strong>{endTime}</strong> sharp, Strategy 2 automatically switches <strong>OFF</strong>.
            </p>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <ArrowUpDown className="h-3.5 w-3.5 text-cyan-400" />
              <span>2. Accumulated Top Gainers</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Gets unique options-chain-enabled (F&amp;O) stocks arranged in <strong>descending order of % change</strong>.
            </p>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <Target className="h-3.5 w-3.5 text-cyan-400" />
              <span>3. CE Option Sizing</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Selects appropriate <strong>ATM CE Option</strong> contract and buys exactly <strong>1 lot per stock</strong>.
            </p>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
              <span>4. Margin &amp; No Repeat Lots</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Checks available account margin before each buy. <strong>Never repeats lots</strong> for the same stock on the same day. Semi-automatic (Buy only, no exit conditions set).
            </p>
          </div>
        </div>

        {/* 📌 NITTY-GRITTY APP CONTROL & GTT EXECUTION DETAILS */}
        <div className="mt-2 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <Power className="h-3.5 w-3.5 text-cyan-400" />
              <span>APP CONTROL Master Impact</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong>APP CONTROL: ON</strong> enables automatic strategy evaluations during window. Switching <strong>OFF</strong> immediately halts polling and cancels open orders/GTT triggers.
            </p>
          </div>

          <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
              <span>GTT Exit Conditions</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong>NO EXIT GTTs:</strong> Strategy 2 is semi-automatic (Buy only). No stop-loss or profit target exit GTT triggers are attached on execution.
            </p>
          </div>

          <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span>Global Test Mode (GTT Only)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              If <strong>Test Mode (GTT Only)</strong> is ON globally, the BUY entry itself is formatted as a GTT Buy trigger or simulation entry rather than an instant market buy.
            </p>
          </div>
        </div>
      </div>

      {/* Account Available Margin Info Bar */}
      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono">Available Account Margin:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              ₹{userMargin.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono">Positions Taken Today:</span>
            <span className="font-mono font-bold text-cyan-400 text-sm">{trades.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchDailyTable} 
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Table
          </button>

          {trades.length > 0 && (
            <button 
              onClick={handlePurgeTrades}
              className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all border border-rose-800/60 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Strategy Trades
            </button>
          )}
        </div>
      </div>

      {/* Executed Strategy 2 Trades Table */}
      <div className="glass-panel border-slate-800 bg-slate-900/80 rounded-2xl overflow-hidden shadow-xl">
        <div 
          onClick={() => toggleSection('trades')}
          className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 font-bold text-xs text-white">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span>Strategy 2 Today's Executed Trades ({trades.length})</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>{collapsedSections.trades ? 'Expand ❯' : 'Collapse 🔽'}</span>
            {collapsedSections.trades ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {!collapsedSections.trades && (
          <div className="overflow-x-auto">
            {trades.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                No Strategy 2 positions taken today yet. Trades taken during the 09:15 - 09:30 AM window will appear here.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Symbol</th>
                    <th className="p-3">CE Option Contract</th>
                    <th className="p-3">Strike</th>
                    <th className="p-3 text-center">Lots / Qty</th>
                    <th className="p-3 text-right">Entry Premium</th>
                    <th className="p-3 text-right">Margin Allocated</th>
                    <th className="p-3">Entry Time</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {trades.map((trade, idx) => (
                    <tr key={trade.tradeId || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        {trade.symbol}
                      </td>
                      <td className="p-3 font-mono font-bold text-cyan-300">
                        {trade.optionSymbol}
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        ₹{trade.strike} CE
                      </td>
                      <td className="p-3 text-center font-mono font-semibold">
                        <span className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded">
                          {trade.lots} Lot ({trade.quantity} Qty)
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">
                        ₹{Number(trade.entryPrice || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-white">
                        ₹{Number(trade.marginAllocated || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {trade.entryTime ? new Date(trade.entryTime).toLocaleTimeString('en-IN') : '-'}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                          {trade.status || 'ENTERED'} (BUY ONLY)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* F&O Top Gainers Sorted Table */}
      <div className="glass-panel border-slate-800 bg-slate-900/80 rounded-2xl overflow-hidden shadow-xl">
        <div 
          onClick={() => toggleSection('gainersTable')}
          className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 font-bold text-xs text-white">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            <span>F&amp;O Accumulated Unique Top Gainers (% Change Descending) - ({filteredRecords.length} Stocks)</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>{collapsedSections.gainersTable ? 'Expand ❯' : 'Collapse 🔽'}</span>
            {collapsedSections.gainersTable ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {!collapsedSections.gainersTable && (
          <div className="p-4 flex flex-col gap-4">
            {/* Search Input Bar */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="relative max-w-sm w-full">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text"
                  placeholder="Filter stock symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="text-[11px] text-slate-400 font-mono">
                Sorted by: <strong>Highest % Change to Lowest</strong>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Rank</th>
                    <th className="p-3">Stock Symbol</th>
                    <th className="p-3 text-right">% Change</th>
                    <th className="p-3 text-right">Spot Price</th>
                    <th className="p-3">Target ATM CE Option</th>
                    <th className="p-3 text-center">Lot Size</th>
                    <th className="p-3 text-right">Est. Margin (1 Lot)</th>
                    <th className="p-3 text-center">Strategy Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-500 font-mono text-xs">
                        {loading ? 'Scanning market quotes for top gainers...' : 'No F&O stocks found matching criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((item, index) => {
                      const sym = (item.symbol || '').toUpperCase();
                      const isBought = boughtSymbolsSet.has(sym);
                      const changePct = Number(item.changePct || 0);
                      const closePrice = Number(item.close || item.ltp || 0);
                      const deriv = item.derivative || {};
                      const estPrem = Number(deriv.estimatedPremium || 20);
                      const lotSize = Number(deriv.lotSize || 100);
                      const marginReq = estPrem * lotSize;
                      const hasMargin = userMargin >= marginReq;

                      return (
                        <tr key={sym || index} className={`hover:bg-slate-800/40 transition-colors ${isBought ? 'bg-emerald-950/10' : ''}`}>
                          <td className="p-3 font-mono font-bold text-slate-400">
                            #{index + 1}
                          </td>
                          <td className="p-3 font-mono font-bold text-white flex items-center gap-2">
                            <span>{sym}</span>
                            {isBought && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                                BOUGHT
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                            +{changePct.toFixed(2)}%
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-slate-200">
                            ₹{closePrice.toFixed(2)}
                          </td>
                          <td className="p-3 font-mono text-cyan-300 font-semibold">
                            {deriv.tradingsymbol || `${sym} ATM CE`}
                          </td>
                          <td className="p-3 text-center font-mono font-semibold text-slate-300">
                            {lotSize}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-white">
                            ₹{marginReq.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center font-mono text-[11px]">
                            {isBought ? (
                              <span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Lot Executed
                              </span>
                            ) : !hasMargin ? (
                              <span className="text-rose-400 font-semibold">
                                Insufficient Margin
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                Ready for 09:15 Scan
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
