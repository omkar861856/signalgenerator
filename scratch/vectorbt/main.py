from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
import vectorbt as vbt
from prometheus_client import make_asgi_app, Counter, Histogram
import time

app = FastAPI(title="VectorBT Backtesting Service")

# Create ASGI metrics app and mount it
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "http_status"]
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"]
)

@app.middleware("http")
async def add_prometheus_metrics(request, call_next):
    method = request.method
    endpoint = request.url.path
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    status_code = str(response.status_code)
    
    if endpoint != "/metrics":
        HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, http_status=status_code).inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=endpoint).observe(duration)
        
    return response

class CandleInput(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float

class StrategyInput(BaseModel):
    indicators: Dict[str, Any]
    buy_signal: str
    sell_signal: str

class BacktestRequest(BaseModel):
    symbol: str
    interval: str
    candles: List[CandleInput]
    strategy: StrategyInput
    capital: float
    leverage: float
    marginPercentage: float
    allowShorting: bool

# ─── Technical Indicator Mathematical Helpers ───
def calculate_sma(prices, period):
    sma = [None] * len(prices)
    if len(prices) < period:
        return sma
    let_sum = 0.0
    for i in range(period):
        let_sum += prices[i]
    sma[period - 1] = let_sum / period
    for i in range(period, len(prices)):
        let_sum += prices[i] - prices[i - period]
        sma[i] = let_sum / period
    return sma

def calculate_ema(prices, period):
    ema = [None] * len(prices)
    if len(prices) < period:
        return ema
    k = 2.0 / (period + 1)
    sma = sum(prices[:period]) / period
    ema[period - 1] = sma
    current_ema = sma
    for i in range(period, len(prices)):
        current_ema = prices[i] * k + current_ema * (1.0 - k)
        ema[i] = current_ema
    return ema

def calculate_rsi(prices, period=14):
    rsi = [None] * len(prices)
    if len(prices) <= period:
        return rsi
    avg_gain = 0.0
    avg_loss = 0.0
    for i in range(1, period + 1):
        diff = prices[i] - prices[i - 1]
        if diff > 0:
            avg_gain += diff
        else:
            avg_loss -= diff
    avg_gain /= period
    avg_loss /= period
    rsi[period] = 100.0 if avg_loss == 0.0 else 100.0 - (100.0 / (1.0 + (avg_gain / avg_loss)))
    for i in range(period + 1, len(prices)):
        diff = prices[i] - prices[i - 1]
        gain = diff if diff > 0 else 0.0
        loss = -diff if diff < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        rsi[i] = 100.0 if avg_loss == 0.0 else 100.0 - (100.0 / (1.0 + (avg_gain / avg_loss)))
    return rsi

def calculate_atr(candles, period=14):
    atr = [None] * len(candles)
    if len(candles) <= period:
        return atr
    tr = [0.0] * len(candles)
    for i in range(1, len(candles)):
        h = candles[i]['high']
        l = candles[i]['low']
        pc = candles[i - 1]['close']
        tr[i] = max(h - l, abs(h - pc), abs(l - pc))
    sum_tr = sum(tr[1:period + 1])
    current_atr = sum_tr / period
    atr[period] = current_atr
    for i in range(period + 1, len(candles)):
        current_atr = (current_atr * (period - 1) + tr[i]) / period
        atr[i] = current_atr
    return atr

def calculate_bollinger_bands(prices, period=20, std_dev_multiplier=2):
    middle = calculate_sma(prices, period)
    upper = [None] * len(prices)
    lower = [None] * len(prices)
    for i in range(period - 1, len(prices)):
        slice_prices = prices[i - period + 1 : i + 1]
        mean = middle[i]
        variance = sum((x - mean) ** 2 for x in slice_prices) / period
        std_dev = variance ** 0.5
        upper[i] = mean + std_dev_multiplier * std_dev
        lower[i] = mean - std_dev_multiplier * std_dev
    return {"middle": middle, "upper": upper, "lower": lower}

def calculate_macd(prices, fast_period=12, slow_period=26, signal_period=9):
    macd_line = [None] * len(prices)
    signal_line = [None] * len(prices)
    histogram = [None] * len(prices)
    fast_ema = calculate_ema(prices, fast_period)
    slow_ema = calculate_ema(prices, slow_period)
    for i in range(len(prices)):
        if fast_ema[i] is not None and slow_ema[i] is not None:
            macd_line[i] = fast_ema[i] - slow_ema[i]
            
    valid_macd_start = next((idx for idx, val in enumerate(macd_line) if val is not None), -1)
    if valid_macd_start != -1:
        valid_macd_sub = macd_line[valid_macd_start:]
        signal_sub = calculate_ema(valid_macd_sub, signal_period)
        for i in range(len(signal_sub)):
            signal_line[valid_macd_start + i] = signal_sub[i]
            if macd_line[valid_macd_start + i] is not None and signal_sub[i] is not None:
                histogram[valid_macd_start + i] = macd_line[valid_macd_start + i] - signal_sub[i]
    return {
        "macdLine": macd_line,
        "signalLine": signal_line,
        "histogram": histogram
    }

@app.post("/backtest")
async def backtest(req: BacktestRequest):
    try:
        # 1. Load candles into DataFrame
        candles_dict = [c.dict() for c in req.candles]
        df = pd.DataFrame(candles_dict)
        df['open'] = df['open'].astype(float)
        df['high'] = df['high'].astype(float)
        df['low'] = df['low'].astype(float)
        df['close'] = df['close'].astype(float)
        df['volume'] = df['volume'].astype(float)
        
        # 2. Calculate Indicators
        close_prices = df['close'].tolist()
        indicator_arrays = {}
        
        indicator_definitions = req.strategy.indicators
        for key, defs in indicator_definitions.items():
            type_ = defs.get('type', '').upper()
            period = int(defs.get('period', 14))
            
            if type_ == 'EMA':
                indicator_arrays[key] = calculate_ema(close_prices, period)
            elif type_ == 'SMA':
                indicator_arrays[key] = calculate_sma(close_prices, period)
            elif type_ == 'RSI':
                indicator_arrays[key] = calculate_rsi(close_prices, period)
            elif type_ == 'ATR':
                indicator_arrays[key] = calculate_atr(candles_dict, period)
            elif type_ == 'MACD':
                fast = int(defs.get('fastPeriod', 12))
                slow = int(defs.get('slowPeriod', 26))
                signal = int(defs.get('signalPeriod', 9))
                macd_res = calculate_macd(close_prices, fast, slow, signal)
                indicator_arrays[key] = macd_res['macdLine']
                indicator_arrays[f"{key}_signal"] = macd_res['signalLine']
                indicator_arrays[f"{key}_hist"] = macd_res['histogram']
            elif type_ in ['BOLLINGER', 'BB']:
                dev = float(defs.get('stdDevMultiplier', 2))
                bb_res = calculate_bollinger_bands(close_prices, period, dev)
                indicator_arrays[f"{key}_middle"] = bb_res['middle']
                indicator_arrays[f"{key}_upper"] = bb_res['upper']
                indicator_arrays[f"{key}_lower"] = bb_res['lower']
                
        indicator_arrays['atr'] = calculate_atr(candles_dict, 14)
        
        # Add indicators to df
        for k, v in indicator_arrays.items():
            df[k] = v
            
        # 3. Normalize expression syntax
        def normalize_expr(expr):
            if not expr:
                return "False"
            return expr.replace(" and ", " & ").replace(" or ", " | ").replace(" AND ", " & ").replace(" OR ", " | ")

        buy_expr = normalize_expr(req.strategy.buy_signal)
        sell_expr = normalize_expr(req.strategy.sell_signal)
        
        # Warmup mask: skip evaluation on any rows containing nulls in calculated indicators
        valid_mask = pd.Series(True, index=df.index)
        for col in indicator_arrays.keys():
            valid_mask = valid_mask & df[col].notnull()
            
        buy_signals = pd.Series(False, index=df.index)
        sell_signals = pd.Series(False, index=df.index)
        
        if valid_mask.any():
            try:
                buy_signals[valid_mask] = df.loc[valid_mask].eval(buy_expr)
            except Exception as e:
                print(f"[VectorBT Service] Buy eval error: {e}")
            try:
                sell_signals[valid_mask] = df.loc[valid_mask].eval(sell_expr)
            except Exception as e:
                print(f"[VectorBT Service] Sell eval error: {e}")

        # 4. ATR Stop percentage arrays
        atr_s = df['atr']
        close_s = df['close']
        
        sl_stop = ((1.5 * atr_s) / close_s).fillna(0.0).values
        tp_stop = ((3.0 * atr_s) / close_s).fillna(0.0).values
        
        # 5. Run vectorbt Portfolio simulation
        pf = vbt.Portfolio.from_signals(
            close=df['close'],
            entries=buy_signals,
            exits=sell_signals,
            short_entries=sell_signals if req.allowShorting else None,
            short_exits=buy_signals if req.allowShorting else None,
            sl_stop=sl_stop,
            tp_stop=tp_stop,
            init_cash=req.capital,
            leverage=req.leverage,
            fees=0.0005,
            freq=req.interval
        )
        
        # 6. Parse executed trades
        trades_list = []
        try:
            records = pf.trades.records_arr
            for rec in records:
                entry_idx = int(rec['entry_idx'])
                exit_idx = int(rec['exit_idx'])
                
                entry_candle = req.candles[entry_idx]
                exit_candle = req.candles[exit_idx]
                
                direction = "LONG" if int(rec['direction']) == 0 else "SHORT"
                charges = float(rec['entry_fees']) + float(rec['exit_fees'])
                gross_pnl = float(rec['pnl']) + charges
                net_pnl = float(rec['pnl'])
                
                # Check exit reason based on target prices
                entry_price = float(rec['entry_price'])
                atr_at_entry = df.loc[entry_idx, 'atr'] or (entry_price * 0.01)
                
                reason = "SIGNAL_EXIT"
                if direction == "LONG":
                    expected_sl = entry_price - (atr_at_entry * 1.5)
                    expected_tp = entry_price + (atr_at_entry * 3.0)
                    if abs(float(rec['exit_price']) - expected_sl) < (entry_price * 0.001):
                        reason = "STOP_LOSS"
                    elif abs(float(rec['exit_price']) - expected_tp) < (entry_price * 0.001):
                        reason = "TAKE_PROFIT"
                else:
                    expected_sl = entry_price + (atr_at_entry * 1.5)
                    expected_tp = entry_price - (atr_at_entry * 3.0)
                    if abs(float(rec['exit_price']) - expected_sl) < (entry_price * 0.001):
                        reason = "STOP_LOSS"
                    elif abs(float(rec['exit_price']) - expected_tp) < (entry_price * 0.001):
                        reason = "TAKE_PROFIT"
                        
                if exit_idx == len(req.candles) - 1:
                    reason = "FORCE_CLOSE_END"
                    
                trades_list.append({
                    "symbol": req.symbol,
                    "direction": direction,
                    "entryTime": entry_candle.timestamp,
                    "entryPrice": entry_price,
                    "exitTime": exit_candle.timestamp,
                    "exitPrice": float(rec['exit_price']),
                    "quantity": float(rec['size']),
                    "grossPnl": gross_pnl,
                    "charges": charges,
                    "pnl": net_pnl,
                    "pnlPct": (net_pnl / (entry_price * float(rec['size']))) * 100,
                    "reason": reason
                })
        except Exception as e:
            print(f"[VectorBT Service] Trades parsing fallback due to: {e}")
            df_trades = pf.trades.to_df()
            for _, row in df_trades.iterrows():
                entry_idx = int(row.get('Entry Index', 0))
                exit_idx = int(row.get('Exit Index', 0))
                entry_candle = req.candles[entry_idx]
                exit_candle = req.candles[exit_idx]
                
                direction = str(row.get('Direction', 'LONG')).upper()
                pnl = float(row.get('PnL', 0.0))
                entry_price = float(row.get('Entry Price', 1.0))
                size = float(row.get('Size', 0.0))
                exit_price = float(row.get('Exit Price', 1.0))
                
                trades_list.append({
                    "symbol": req.symbol,
                    "direction": direction,
                    "entryTime": entry_candle.timestamp,
                    "entryPrice": entry_price,
                    "exitTime": exit_candle.timestamp,
                    "exitPrice": exit_price,
                    "quantity": size,
                    "grossPnl": pnl + (entry_price * size * 0.001),
                    "charges": entry_price * size * 0.001,
                    "pnl": pnl,
                    "pnlPct": (pnl / (entry_price * size)) * 100 if size > 0 else 0.0,
                    "reason": "SIGNAL_EXIT"
                })

        # 7. Aggregate performance metrics
        initial_capital = float(pf.init_cash)
        final_capital = float(pf.final_value())
        total_return_pct = float(pf.total_return() * 100)
        total_trades = len(trades_list)
        wins = sum(1 for t in trades_list if t['pnl'] > 0)
        losses = total_trades - wins
        win_rate = (wins / total_trades * 100) if total_trades > 0 else 0.0
        
        gross_profit = sum(t['pnl'] for t in trades_list if t['pnl'] > 0)
        gross_loss = sum(abs(t['pnl']) for t in trades_list if t['pnl'] < 0)
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else (gross_profit if gross_profit > 0 else 1.0)
        
        max_drawdown_pct = float(pf.max_drawdown() * 100)
        
        try:
            sharpe_ratio = float(pf.sharpe_ratio())
            if np.isnan(sharpe_ratio) or np.isinf(sharpe_ratio):
                sharpe_ratio = 0.0
        except Exception:
            sharpe_ratio = 0.0
            
        return {
            "success": True,
            "symbol": req.symbol,
            "interval": req.interval,
            "candleCount": len(req.candles),
            "results": {
                "initialCapital": initial_capital,
                "finalCapital": final_capital,
                "totalReturnPct": total_return_pct,
                "totalTrades": total_trades,
                "wins": wins,
                "losses": losses,
                "winRate": win_rate,
                "profitFactor": profit_factor,
                "maxDrawdownPct": max_drawdown_pct,
                "sharpeRatio": sharpe_ratio,
                "trades": trades_list
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
