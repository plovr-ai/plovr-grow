"use client";

import { Input } from "@/components/ui/input";
import type { BusinessHoursMap } from "@/types/merchant";

interface BusinessHoursEditorProps {
  value: BusinessHoursMap;
  onChange: (value: BusinessHoursMap) => void;
  disabled?: boolean;
}

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

export function BusinessHoursEditor({
  value,
  onChange,
  disabled,
}: BusinessHoursEditorProps) {
  const handleDayChange = (
    day: string,
    field: "open" | "close" | "closed",
    newValue: string | boolean
  ) => {
    const currentDay = value[day] || { open: "09:00", close: "21:00" };

    if (field === "closed") {
      onChange({
        ...value,
        [day]: {
          ...currentDay,
          closed: newValue as boolean,
        },
      });
    } else {
      onChange({
        ...value,
        [day]: {
          ...currentDay,
          [field]: newValue as string,
        },
      });
    }
  };

  return (
    <div className="space-y-3">
      {DAYS.map(({ key, label }) => {
        const dayHours = value[key] || { open: "09:00", close: "21:00" };
        const isClosed = dayHours.closed ?? false;

        return (
          <div
            key={key}
            className="grid grid-cols-[120px_1fr] items-center gap-4"
          >
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isClosed}
                  onChange={(e) =>
                    handleDayChange(key, "closed", e.target.checked)
                  }
                  disabled={disabled}
                  className="h-4 w-4 rounded border-gray-300 text-theme-primary focus:ring-theme-primary"
                />
                <span className="text-sm text-gray-500">Closed</span>
              </label>

              {!isClosed && (
                <>
                  <Input
                    type="time"
                    value={dayHours.open}
                    onChange={(e) =>
                      handleDayChange(key, "open", e.target.value)
                    }
                    disabled={disabled}
                    className="w-32"
                  />
                  <span className="text-gray-400">to</span>
                  <Input
                    type="time"
                    value={dayHours.close}
                    onChange={(e) =>
                      handleDayChange(key, "close", e.target.value)
                    }
                    disabled={disabled}
                    className="w-32"
                  />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
