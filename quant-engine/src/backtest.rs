use crate::indicators::{Candle, Indicators};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestParams {
    pub initial_capital: f64,
    pub stop_loss_pct: Option<f64>,
    pub take_profit_pct: Option<f64>,
    pub rsi_buy_threshold: f64,
    pub rsi_sell_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub entry_time: i64,
    pub exit_time: i64,
    pub entry_price: f64,
    pub exit_price: f64,
    pub side: String,
    pub profit_loss: f64,
    pub return_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestResult {
    pub initial_capital: f64,
    pub final_equity: f64,
    pub total_return_pct: f64,
    pub total_trades: usize,
    pub win_rate: f64,
    pub max_drawdown_pct: f64,
    pub profit_factor: f64,
    pub trades: Vec<Trade>,
    pub equity_curve: Vec<f64>,
}

pub struct BacktestEngine;

impl BacktestEngine {
    pub fn run(candles: &[Candle], params: &BacktestParams) -> BacktestResult {
        if candles.len() < 15 {
            return BacktestResult {
                initial_capital: params.initial_capital,
                final_equity: params.initial_capital,
                total_return_pct: 0.0,
                total_trades: 0,
                win_rate: 0.0,
                max_drawdown_pct: 0.0,
                profit_factor: 0.0,
                trades: vec![],
                equity_curve: vec![params.initial_capital],
            };
        }

        let closes: Vec<f64> = candles.iter().map(|c| c.close).collect();
        let rsi = Indicators::calculate_rsi(&closes, 14);

        let mut capital = params.initial_capital;
        let mut equity_curve = Vec::with_capacity(candles.len());
        let mut trades = Vec::new();
        let mut position: Option<(i64, f64)> = None; // (entry_time, entry_price)

        let mut peak_equity = capital;
        let mut max_drawdown = 0.0;

        let mut gross_profit = 0.0;
        let mut gross_loss = 0.0;
        let mut winning_trades = 0;

        for i in 14..candles.len() {
            let candle = &candles[i];
            let current_rsi = rsi[i];

            if let Some((entry_time, entry_price)) = position {
                let current_price = candle.close;
                let return_pct = (current_price - entry_price) / entry_price * 100.0;

                let sl_hit = params.stop_loss_pct.map_or(false, |sl| return_pct <= -sl);
                let tp_hit = params.take_profit_pct.map_or(false, |tp| return_pct >= tp);
                let signal_exit = current_rsi >= params.rsi_sell_threshold;

                if sl_hit || tp_hit || signal_exit || i == candles.len() - 1 {
                    let pnl = (current_price - entry_price) * (capital / entry_price);
                    capital += pnl;

                    if pnl > 0.0 {
                        gross_profit += pnl;
                        winning_trades += 1;
                    } else {
                        gross_loss += pnl.abs();
                    }

                    trades.push(Trade {
                        entry_time,
                        exit_time: candle.timestamp,
                        entry_price,
                        exit_price: current_price,
                        side: "LONG".into(),
                        profit_loss: pnl,
                        return_pct,
                    });

                    position = None;
                }
            } else if current_rsi <= params.rsi_buy_threshold && i < candles.len() - 1 {
                position = Some((candle.timestamp, candle.close));
            }

            equity_curve.push(capital);
            if capital > peak_equity {
                peak_equity = capital;
            }
            let dd = (peak_equity - capital) / peak_equity * 100.0;
            if dd > max_drawdown {
                max_drawdown = dd;
            }
        }

        let total_trades = trades.len();
        let win_rate = if total_trades > 0 {
            (winning_trades as f64 / total_trades as f64) * 100.0
        } else {
            0.0
        };

        let profit_factor = if gross_loss > 0.0 {
            gross_profit / gross_loss
        } else if gross_profit > 0.0 {
            999.0
        } else {
            0.0
        };

        let total_return_pct = (capital - params.initial_capital) / params.initial_capital * 100.0;

        BacktestResult {
            initial_capital: params.initial_capital,
            final_equity: capital,
            total_return_pct,
            total_trades,
            win_rate,
            max_drawdown_pct: max_drawdown,
            profit_factor,
            trades,
            equity_curve,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backtest_execution() {
        let candles: Vec<Candle> = (0..50)
            .map(|i| Candle {
                timestamp: i,
                open: 100.0 + (i as f64 % 5.0),
                high: 105.0,
                low: 95.0,
                close: 100.0 + if i % 2 == 0 { 5.0 } else { -5.0 },
                volume: 1000.0,
            })
            .collect();

        let params = BacktestParams {
            initial_capital: 100000.0,
            stop_loss_pct: Some(2.0),
            take_profit_pct: Some(5.0),
            rsi_buy_threshold: 45.0,
            rsi_sell_threshold: 65.0,
        };

        let res = BacktestEngine::run(&candles, &params);
        assert_eq!(res.initial_capital, 100000.0);
        assert!(!res.equity_curve.is_empty());
    }
}
