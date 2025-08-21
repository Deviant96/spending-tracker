"use client";

import AnalyticsCharts from "@/components/AnalyticsCharts";
import InsightsBox from "@/components/InsightsBox";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Dashboard</h1>
      <InsightsBox />
      <div style={{ marginTop: "2rem" }}>
        <AnalyticsCharts />
      </div>
    </main>
  );
}
