import { Exchange } from "@/components/exchange";
import { RateChart, type RatePoint } from "@/components/rate-chart";

export const metadata = { title: "The exchange" };

const POINTS = 97; // one every quarter-hour, across the last 24 hours

/** The market moves of its own accord — this is how it has been. */
function recentHistory(): RatePoint[] {
  const now = Date.now();
  const stepMs = ((24 * 60) / (POINTS - 1)) * 60_000;
  let rate = 0.9 + (Math.random() - 0.5) * 0.3;
  const points: RatePoint[] = [];
  for (let i = 0; i < POINTS; i++) {
    rate += (Math.random() - 0.5) * 0.07;
    rate = Math.max(0.25, Math.min(1.75, rate));
    points.push({ t: now - (POINTS - 1 - i) * stepMs, rate });
  }
  return points;
}

export default function ExchangePage() {
  const history = recentHistory();

  return (
    <div>
      <h1 className="font-serif text-3xl">The exchange</h1>
      <p className="sc mt-1 text-muted">moose bucks ⇄ pounds sterling</p>

      <div className="mt-8">
        <Exchange />
      </div>

      <div className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="sc">The going rate</h2>
          <span className="text-xs text-muted">£ per Moose Buck, the last 24 hours</span>
        </div>
        <div className="mt-4">
          <RateChart points={history} />
        </div>
      </div>

      <p className="mt-8 text-xs text-muted">
        The exchange sets its own rate. It is marked anew whenever an amount is
        entered, and the market keeps its own counsel.
      </p>
    </div>
  );
}