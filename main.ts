// btc-cent-forecast-01 entry: a four-hour damped mean-reversion forecaster for BTC/USDC.
//
// Each case holds 4,320 one-minute closes: the 72 hours ending at the case's checkpoint `at`. The
// program forecasts the close 240 minutes after `at`, using only prices at or before `at`:
//
//   move   = last - close240       the change over the four hours before the checkpoint
//   damped = clip(0.02 * move, -40, +40)
//   guess  = last - damped
//
// The term is mean reversion: the model gives back two percent of the last four hours, capped at
// 40 dollars, so a fast move only pulls the guess part of the way. On the union of the kit's
// practice cases the rule beats the persistence baseline that holds the last close. The model is
// deterministic: no network, no clock and no randomness, exactly one output row per input case, on
// the price grid's five decimals and inside the scorer's price bounds.
//
// The grader runs one case at a time with /input and /output. Outside it, MAKEFUN_INPUT_DIR and
// MAKEFUN_OUTPUT_DIR stand in for those directories:
//   mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The smallest positive price on the grid: one unit of its 5 decimals (0.00001). */
const MIN_PRICE = 0.00001;
/** The largest grid price under the scorer's exclusive 10,000,000-dollar cap. */
const MAX_PRICE = 9_999_999.99999;
/** The forecast horizon: 240 minutes, four hours after the checkpoint. */
const HORIZON_MINUTES = 240;
/** The share of a four-hour move the model expects to give back: two percent. */
const REVERSION = 0.02;
/** The most the damped term ever pulls a price, in dollars (40). */
const MAX_PULL = 40;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

/** The mean-reversion guess of one market: the last close pulled toward its four-hour anchor. */
function forecast(m: CaseMarket): number {
  if (!Array.isArray(m.prices) || m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  const i = m.prices.length - 1;
  const x = m.prices[i] as number;
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error(`market ${m.id}'s last price is not a finite number`);
  const j = i - HORIZON_MINUTES;
  const ref = j >= 0 ? (m.prices[j] as number) : x;
  const move = Number.isFinite(ref) ? x - ref : 0;
  const damped = Math.max(-MAX_PULL, Math.min(MAX_PULL, REVERSION * move));
  return price5(x - damped);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (!Array.isArray(c.markets) || c.markets.length !== 1) throw new Error(`${file} does not hold exactly one market`);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast(c.markets[0] as CaseMarket) }] })}\n`);
}
// Built for btc-cent-forecast-01: deterministic, offline, standard library only.
