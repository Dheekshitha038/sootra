import { useState, useMemo } from "react";

const MAX_POINTS = 10;

// If there are more than 10 events, sample evenly across the sorted list
// rather than truncating — this keeps the spread representative instead
// of only showing the earliest events.
function sampleEvents(events) {
  const sorted = [...events].sort((a, b) => {
    if (a.year_estimate == null && b.year_estimate == null) return 0;
    if (a.year_estimate == null) return 1; // undated events sort last
    if (b.year_estimate == null) return -1;
    return a.year_estimate - b.year_estimate;
  });
  if (sorted.length <= MAX_POINTS) return sorted;
  const step = (sorted.length - 1) / (MAX_POINTS - 1);
  return Array.from({ length: MAX_POINTS }, (_, i) => sorted[Math.round(i * step)]);
}

export default function TimelineSlider({ events }) {
  const points = useMemo(() => sampleEvents(events), [events]);
  const [activeIndex, setActiveIndex] = useState(points.length ? 0 : -1);

  if (points.length === 0) {
    return (
      <div className="jg-timeline-slider">
        <div className="jg-section-label">Timeline</div>
        <div className="jg-timeline-empty">No dated events recorded for this entity yet.</div>
      </div>
    );
  }

  const active = points[activeIndex];

  return (
    <div className="jg-timeline-slider">
      <div className="jg-section-label">
        Timeline {events.length > MAX_POINTS && `· showing ${MAX_POINTS} of ${events.length} events`}
      </div>

      <div className="jg-slider-track">
        <div className="jg-slider-line" />
        {points.map((pt, i) => (
          <button
            key={i}
            className={`jg-slider-dot ${i === activeIndex ? "jg-slider-dot--active" : ""}`}
            style={{ left: `${(i / (points.length - 1 || 1)) * 100}%` }}
            onClick={() => setActiveIndex(i)}
            aria-label={pt.label}
          />
        ))}
      </div>

      {active && (
        <div className="jg-slider-detail">
          <div className="jg-slider-era">{active.era}</div>
          <div className="jg-slider-label">{active.label}</div>
          {active.description && <div className="jg-slider-description">{active.description}</div>}
          <div className="jg-slider-meta">
            {active.source && <span>{active.source}</span>}
            {active.region && <span className="jg-slider-region">· {active.region}</span>}
          </div>
        </div>
      )}
    </div>
  );
}