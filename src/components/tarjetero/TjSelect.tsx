"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
}

/** Select that matches the app's glass/violet design (wraps the Base UI primitive). */
export function TjSelect({ value, onChange, options, placeholder }: Props) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger className="h-auto w-full justify-between rounded-[13px] border-[#c7c0e6] bg-white/70 px-[13px] py-[11px] text-[14px] font-semibold text-[#26233a] shadow-none focus-visible:border-[#6d5ef6] focus-visible:ring-[#6d5ef6]/20 data-[popup-open]:border-[#6d5ef6]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        className="rounded-2xl border border-white/70 bg-white/95 p-1.5 shadow-[0_22px_55px_rgba(60,50,120,0.28)] backdrop-blur-xl"
      >
        {options.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            className="cursor-pointer rounded-[10px] px-2.5 py-2 text-[13.5px] font-semibold text-[#26233a] focus:bg-[#6d5ef6]/12 focus:text-[#4a3fd0] data-[selected]:text-[#4a3fd0]"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
