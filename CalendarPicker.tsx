import React, { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/dist/style.css'; // This might need custom override
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarPickerProps {
  selectedDate: Date;
  onSelect: (date: Date | undefined) => void;
}

export function CalendarPicker({ selectedDate, onSelect }: CalendarPickerProps) {
  return (
    <div className="glass border border-glass-border rounded-xl p-4 bg-bg-deep pointer-events-auto">
      <DayPicker
        mode="single"
        selected={selectedDate}
        onSelect={onSelect}
        showOutsideDays
        className="text-primary"
        classNames={{
          day_selected: "bg-accent text-white font-bold rounded-lg",
          day_today: "text-accent font-bold",
          head_cell: "text-faint text-xs font-bold uppercase",
          button: "hover:bg-accent/20 rounded-lg",
          nav_button: "hover:bg-accent/20 rounded-lg p-1",
        }}
      />
    </div>
  );
}
