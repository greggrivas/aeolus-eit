"use client";

import Image from "next/image";
import Link from "next/link";

export default function SplashPage() {
  return (
    <div className="relative min-h-screen bg-background-dark flex flex-col items-center justify-center overflow-hidden">

      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(#1152d4 1px, transparent 1px), linear-gradient(90deg, #1152d4 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow behind logo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-10 px-6 text-center">

        {/* Logo */}
        <Image
          src="/aeolus-logo.jpeg"
          alt="Aeolus AI"
          width={280}
          height={280}
          className="rounded-3xl shadow-2xl shadow-primary/30"
          priority
        />

        {/* Title */}
        <div className="flex flex-col gap-3">
          <h1 className="text-7xl font-black tracking-tight text-slate-100">
            Aeolus <span className="text-primary">AI</span>
          </h1>
          <p className="text-slate-400 text-2xl font-medium">
            Wind Turbine Predictive Maintenance
          </p>
          <p className="text-slate-600 text-base max-w-lg mx-auto mt-1">
            Isolation Forest · CARE Benchmark · Tool-calling AI Agent · Wind Farm A
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/fleet"
          className="group flex items-center gap-3 bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105"
        >
          <span className="material-symbols-outlined text-2xl">dashboard</span>
          Launch Dashboard
          <span className="material-symbols-outlined text-2xl transition-transform group-hover:translate-x-1">arrow_forward</span>
        </Link>

        {/* Stat pills */}
        <div className="flex items-center gap-4 flex-wrap justify-center mt-2">
          {[
            { icon: "wind_power", label: "Wind Farm A" },
            { icon: "radar", label: "Anomaly Detection" },
            { icon: "smart_toy", label: "AI Agent" },
            { icon: "query_stats", label: "CARE Benchmark" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2 bg-panel-dark border border-border-dark rounded-full px-4 py-2 text-sm text-slate-400">
              <span className="material-symbols-outlined text-primary text-base">{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
