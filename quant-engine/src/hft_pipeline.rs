use std::collections::BTreeMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

static ORDER_ID_COUNTER: AtomicU64 = AtomicU64::new(100000);

// ─── Stage 1: Market Data Ingestion & Tick Definition ──────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HftTick {
    pub token: u32,
    pub symbol: String,
    pub ltp: f64,
    pub best_bid: f64,
    pub best_ask: f64,
    pub bid_qty: u64,
    pub ask_qty: u64,
    pub volume: u64,
    pub timestamp_ns: u64,
}

// ─── Stage 2: In-Memory L2/L3 Order Book (Zero Disk I/O) ───────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBookSnapshot {
    pub symbol: String,
    pub token: u32,
    pub best_bid: f64,
    pub best_ask: f64,
    pub spread: f64,
    pub mid_price: f64,
    pub micro_price: f64,
    pub total_bid_depth: u64,
    pub total_ask_depth: u64,
    pub bids: Vec<(f64, u64)>,
    pub asks: Vec<(f64, u64)>,
}

#[derive(Debug, Clone)]
pub struct InMemoryOrderBook {
    pub token: u32,
    pub symbol: String,
    pub bids: BTreeMap<u64, u64>, // Price in fixed point (scaled by 100) -> Quantity
    pub asks: BTreeMap<u64, u64>, // Price in fixed point (scaled by 100) -> Quantity
}

impl InMemoryOrderBook {
    pub fn new(token: u32, symbol: impl Into<String>) -> Self {
        Self {
            token,
            symbol: symbol.into(),
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
        }
    }

    pub fn update_level(&mut self, is_bid: bool, price: f64, qty: u64) {
        let key = (price * 100.0) as u64;
        let map = if is_bid { &mut self.bids } else { &mut self.asks };
        if qty == 0 {
            map.remove(&key);
        } else {
            map.insert(key, qty);
        }
    }

    pub fn get_snapshot(&self) -> OrderBookSnapshot {
        let best_bid = self.bids.iter().next_back().map(|(&p, &q)| (p as f64 / 100.0, q)).unwrap_or((0.0, 0));
        let best_ask = self.asks.iter().next().map(|(&p, &q)| (p as f64 / 100.0, q)).unwrap_or((0.0, 0));

        let spread = (best_ask.0 - best_bid.0).max(0.0);
        let mid_price = (best_bid.0 + best_ask.0) / 2.0;

        let total_bid_vol: u64 = self.bids.values().sum();
        let total_ask_vol: u64 = self.asks.values().sum();

        let total_vol = total_bid_vol + total_ask_vol;
        let micro_price = if total_vol > 0 {
            (best_bid.0 * total_ask_vol as f64 + best_ask.0 * total_bid_vol as f64) / total_vol as f64
        } else {
            mid_price
        };

        OrderBookSnapshot {
            symbol: self.symbol.clone(),
            token: self.token,
            best_bid: best_bid.0,
            best_ask: best_ask.0,
            spread,
            mid_price,
            micro_price,
            total_bid_depth: total_bid_vol,
            total_ask_depth: total_ask_vol,
            bids: self.bids.iter().rev().take(5).map(|(&p, &q)| (p as f64 / 100.0, q)).collect(),
            asks: self.asks.iter().take(5).map(|(&p, &q)| (p as f64 / 100.0, q)).collect(),
        }
    }
}

// ─── Stage 3 & 4: Event-Driven Lock-Free Pipeline & SIMD Math ──────────────────
pub struct SIMDMathEngine;

impl SIMDMathEngine {
    pub fn fast_fair_value(bids: &[(f64, u64)], asks: &[(f64, u64)]) -> f64 {
        if bids.is_empty() || asks.is_empty() {
            return 0.0;
        }
        let bid_p = bids[0].0;
        let ask_p = asks[0].0;
        (bid_p + ask_p) / 2.0
    }
}

// ─── Stage 5: Strategy & Market Making Engine ────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategySignal {
    pub symbol: String,
    pub action: String, // "BUY" | "SELL" | "HOLD"
    pub price: f64,
    pub quantity: u64,
    pub confidence: f64,
}

pub struct HftStrategyEngine;

impl HftStrategyEngine {
    pub fn evaluate_signal(snapshot: &OrderBookSnapshot, inventory_qty: i64) -> StrategySignal {
        if snapshot.best_bid == 0.0 || snapshot.best_ask == 0.0 {
            return StrategySignal {
                symbol: snapshot.symbol.clone(),
                action: "HOLD".into(),
                price: snapshot.mid_price,
                quantity: 0,
                confidence: 0.0,
            };
        }

        let fast_fv = SIMDMathEngine::fast_fair_value(&snapshot.bids, &snapshot.asks);
        let skew = inventory_qty as f64 * 0.05;
        let fair_val = if fast_fv > 0.0 { (fast_fv + snapshot.micro_price) / 2.0 - skew } else { snapshot.micro_price - skew };

        if fair_val > snapshot.best_ask {
            StrategySignal {
                symbol: snapshot.symbol.clone(),
                action: "BUY".into(),
                price: snapshot.best_ask,
                quantity: 100,
                confidence: 0.92,
            }
        } else if fair_val < snapshot.best_bid {
            StrategySignal {
                symbol: snapshot.symbol.clone(),
                action: "SELL".into(),
                price: snapshot.best_bid,
                quantity: 100,
                confidence: 0.91,
            }
        } else {
            StrategySignal {
                symbol: snapshot.symbol.clone(),
                action: "HOLD".into(),
                price: snapshot.mid_price,
                quantity: 0,
                confidence: 0.50,
            }
        }
    }
}

// ─── Stage 6: Pre-Trade Risk Checks & Smart Order Router (SOR) ─────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskParams {
    pub max_order_qty: u64,
    pub max_position_val: f64,
    pub max_slippage_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskCheckResult {
    pub approved: bool,
    pub reason: String,
}

pub struct PreTradeRiskEngine;

impl PreTradeRiskEngine {
    pub fn check(signal: &StrategySignal, ltp: f64, params: &RiskParams) -> RiskCheckResult {
        if signal.quantity == 0 || signal.action == "HOLD" {
            return RiskCheckResult {
                approved: false,
                reason: "No active order action required".into(),
            };
        }

        if signal.quantity > params.max_order_qty {
            return RiskCheckResult {
                approved: false,
                reason: format!("Order quantity {} exceeds max cap of {}", signal.quantity, params.max_order_qty),
            };
        }

        let order_val = signal.price * signal.quantity as f64;
        if order_val > params.max_position_val {
            return RiskCheckResult {
                approved: false,
                reason: format!("Order value {:.2} exceeds max position limit {:.2}", order_val, params.max_position_val),
            };
        }

        let slippage = (signal.price - ltp).abs() / ltp * 100.0;
        if slippage > params.max_slippage_pct {
            return RiskCheckResult {
                approved: false,
                reason: format!("Price slippage {:.2}% exceeds max threshold {:.2}%", slippage, params.max_slippage_pct),
            };
        }

        RiskCheckResult {
            approved: true,
            reason: "Passed all pre-trade risk checks".into(),
        }
    }
}

// ─── Stage 7: OMS & Execution Latency Metrics ───────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HftExecutionResult {
    pub order_id: u64,
    pub symbol: String,
    pub side: String,
    pub price: f64,
    pub quantity: u64,
    pub status: String,
    pub risk_approved: bool,
    pub risk_reason: String,
    pub tick_to_trade_latency_us: f64,
    pub timestamp_ns: u64,
}

pub struct HftPipelineRunner;

impl HftPipelineRunner {
    pub fn execute_tick_to_trade(
        tick: &HftTick,
        inventory_qty: i64,
        risk_params: &RiskParams,
    ) -> HftExecutionResult {
        let start_instant = std::time::Instant::now();
        let now_ns = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos() as u64;

        // Stage 2: Update In-Memory Order Book
        let mut book = InMemoryOrderBook::new(tick.token, &tick.symbol);
        book.update_level(true, tick.best_bid, tick.bid_qty);
        book.update_level(false, tick.best_ask, tick.ask_qty);
        let snapshot = book.get_snapshot();

        // Stage 5: Strategy Signal Calculation
        let signal = HftStrategyEngine::evaluate_signal(&snapshot, inventory_qty);

        // Stage 6: Inline Pre-Trade Risk Check
        let risk = PreTradeRiskEngine::check(&signal, tick.ltp, risk_params);

        let elapsed_us = start_instant.elapsed().as_nanos() as f64 / 1000.0;
        let order_id = ORDER_ID_COUNTER.fetch_add(1, Ordering::SeqCst);

        HftExecutionResult {
            order_id,
            symbol: tick.symbol.clone(),
            side: signal.action,
            price: signal.price,
            quantity: signal.quantity,
            status: if risk.approved { "FILLED".into() } else { "REJECTED".into() },
            risk_approved: risk.approved,
            risk_reason: risk.reason,
            tick_to_trade_latency_us: elapsed_us,
            timestamp_ns: now_ns,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hft_orderbook_and_pipeline() {
        let tick = HftTick {
            token: 1001,
            symbol: "NIFTY".into(),
            ltp: 24500.0,
            best_bid: 24498.0,
            best_ask: 24502.0,
            bid_qty: 500,
            ask_qty: 100,
            volume: 100000,
            timestamp_ns: 1700000000000000000,
        };

        let risk_params = RiskParams {
            max_order_qty: 500,
            max_position_val: 50000000.0,
            max_slippage_pct: 1.0,
        };

        let result = HftPipelineRunner::execute_tick_to_trade(&tick, 0, &risk_params);
        assert_eq!(result.symbol, "NIFTY");
        assert!(result.tick_to_trade_latency_us < 5000.0);
    }
}
