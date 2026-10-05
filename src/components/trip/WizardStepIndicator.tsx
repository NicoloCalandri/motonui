import { Plane, Users, Check } from 'lucide-react';

// ─── Wizard Step Indicator ────────────────────────────────────────────────────

export default function StepIndicator({ current, total }: { current: number; total: number }) {
  const steps = [
    { label: 'Dettagli', icon: Plane },
    { label: 'Compagno', icon: Users },
    { label: 'Finito', icon: Check },
  ];

  return (
    <div className="flex items-center justify-between mb-12 relative">
      <div className="absolute top-5 left-0 w-full h-0.5 bg-neutral-100 -z-10" />
      <div 
        className="absolute top-5 left-0 h-0.5 bg-neutral-900 transition-all duration-500 -z-10" 
        style={{ width: `${(current / (total - 1)) * 100}%` }}
      />
      
      {steps.map((s, i) => {
        const Icon = s.icon;
        const isActive = i <= current;
        const isCurrent = i === current;

        return (
          <div key={i} className="flex flex-col items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                isActive 
                  ? 'bg-neutral-900 border-neutral-900 text-white' 
                  : 'bg-white border-neutral-200 text-neutral-400'
              } ${isCurrent ? 'ring-4 ring-neutral-100 scale-110' : ''}`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
              isActive ? 'text-neutral-900' : 'text-neutral-400'
            }`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

