"use client";

interface Step {
  label: string;
  status: "done" | "active" | "pending";
}

interface ProgressStepsProps {
  steps: Step[];
}

export function ProgressSteps({ steps }: ProgressStepsProps) {
  return (
    <div className="space-y-4">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {step.status === "done" && (
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {step.status === "active" && (
              <div className="w-6 h-6 rounded-full border-2 border-blue-500 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              </div>
            )}
            {step.status === "pending" && (
              <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
            )}
          </div>
          <span className={
            step.status === "done" ? "text-gray-900"
              : step.status === "active" ? "text-blue-600 font-medium"
                : "text-gray-400"
          }>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}
