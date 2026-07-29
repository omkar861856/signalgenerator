use crate::indicators::{Candle, Indicators};
use rayon::prelude::*;
use rhai::{Engine, Scope, AST};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolData {
    pub symbol: String,
    pub token: u32,
    pub ltp: f64,
    pub change: f64,
    pub volume: f64,
    pub candles: Vec<Candle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanMatch {
    pub symbol: String,
    pub token: u32,
    pub ltp: f64,
    pub change: f64,
    pub volume: f64,
    pub rsi: f64,
    pub ema50: f64,
}

pub struct ScannerEngine {
    engine: Engine,
}

impl ScannerEngine {
    pub fn new() -> Self {
        let mut engine = Engine::new();
        engine.set_max_expr_depths(50, 50);
        Self { engine }
    }

    pub fn compile_expression(&self, expr: &str) -> Result<AST, String> {
        self.engine.compile(expr).map_err(|e| e.to_string())
    }

    pub fn evaluate_parallel(&self, ast: &AST, dataset: &[SymbolData]) -> Vec<ScanMatch> {
        dataset
            .par_iter()
            .filter_map(|item| {
                if item.candles.is_empty() {
                    return None;
                }
                let closes: Vec<f64> = item.candles.iter().map(|c| c.close).collect();
                let rsi_arr = Indicators::calculate_rsi(&closes, 14);
                let ema50_arr = Indicators::calculate_ema(&closes, 50);

                let current_rsi = rsi_arr.last().cloned().unwrap_or(50.0);
                let current_ema50 = ema50_arr.last().cloned().unwrap_or(item.ltp);

                let mut scope = Scope::new();
                scope.push("ltp", item.ltp);
                scope.push("change", item.change);
                scope.push("volume", item.volume);
                scope.push("rsi", current_rsi);
                scope.push("ema50", current_ema50);

                let matched: Result<bool, _> = self.engine.eval_ast_with_scope(&mut scope, ast);
                if matched.unwrap_or(false) {
                    Some(ScanMatch {
                        symbol: item.symbol.clone(),
                        token: item.token,
                        ltp: item.ltp,
                        change: item.change,
                        volume: item.volume,
                        rsi: current_rsi,
                        ema50: current_ema50,
                    })
                } else {
                    None
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parallel_scanner() {
        let scanner = ScannerEngine::new();
        let ast = scanner.compile_expression("ltp > 100.0 && rsi > 40.0").unwrap();

        let candles: Vec<Candle> = (0..20)
            .map(|i| Candle {
                timestamp: i,
                open: 100.0 + i as f64,
                high: 105.0 + i as f64,
                low: 95.0 + i as f64,
                close: 102.0 + i as f64,
                volume: 1000.0,
            })
            .collect();

        let dataset = vec![
            SymbolData {
                symbol: "RELIANCE".into(),
                token: 1,
                ltp: 150.0,
                change: 2.5,
                volume: 50000.0,
                candles: candles.clone(),
            },
            SymbolData {
                symbol: "TCS".into(),
                token: 2,
                ltp: 50.0,
                change: -1.0,
                volume: 20000.0,
                candles: candles,
            },
        ];

        let matches = scanner.evaluate_parallel(&ast, &dataset);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].symbol, "RELIANCE");
    }
}
