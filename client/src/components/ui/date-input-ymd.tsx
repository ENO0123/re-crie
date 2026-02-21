"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** YYYY-MM-DD または部分入力（YYYY, YYYY-MM）を [年, 月, 日] に分解 */
function parseYMD(value: string): [string, string, string] {
  if (!value || typeof value !== "string") return ["", "", ""];
  const s = value.trim();
  if (!s) return ["", "", ""];
  const parts = s.split("-");
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

/** 数値のみに正規化（最大桁数で打ち切り） */
function digitsOnly(v: string, maxLen: number): string {
  return v.replace(/\D/g, "").slice(0, maxLen);
}

/** [年, 月, 日] を YYYY-MM-DD に結合。年が4桁のときのみ有効な日付を返す */
function formatYMD(y: string, m: string, d: string): string {
  const yy = digitsOnly(y, 4);
  if (yy.length < 4) return "";
  const mm = m ? digitsOnly(m, 2).padStart(2, "0").slice(-2) : "01";
  const dd = d ? digitsOnly(d, 2).padStart(2, "0").slice(-2) : "01";
  return `${yy}-${mm}-${dd}`;
}

export interface DateInputYMDProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}

/**
 * 年月日を別々に入力する日付フィールド。
 * - 年: 4桁で打ち切りのうえ、そのまま月へフォーカス
 * - 月: 2桁で打ち切りのうえ、そのまま日へフォーカス
 * - 日: 2桁で打ち切り
 * value / onChange は "YYYY-MM-DD" 形式。
 */
export function DateInputYMD({
  value,
  onChange,
  id,
  className,
  disabled,
  "aria-invalid": ariaInvalid,
}: DateInputYMDProps) {
  const parsed = parseYMD(value);
  const [local, setLocal] = React.useState<[string, string, string]>(parsed);
  const [dirty, setDirty] = React.useState(false);
  const yearRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLInputElement>(null);
  const dayRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (value === "") {
      setLocal(["", "", ""]);
      setDirty(false);
      return;
    }
    if (dirty) return;
    setLocal(parseYMD(value));
    setDirty(false);
  }, [value]);

  const [y, m, d] = dirty ? local : parseYMD(value);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = digitsOnly(e.target.value, 4);
    setDirty(true);
    const nextLocal: [string, string, string] = [v, local[1], local[2]];
    setLocal(nextLocal);
    const next = formatYMD(v, local[1], local[2]);
    if (next) onChange(next);
    if (v.length >= 4) monthRef.current?.focus();
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = digitsOnly(e.target.value, 2);
    setDirty(true);
    const nextLocal: [string, string, string] = [local[0], v, local[2]];
    setLocal(nextLocal);
    const next = formatYMD(local[0], v, local[2]);
    if (next) onChange(next);
    if (v.length >= 2) dayRef.current?.focus();
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = digitsOnly(e.target.value, 2);
    setDirty(true);
    const nextLocal: [string, string, string] = [local[0], local[1], v];
    setLocal(nextLocal);
    const next = formatYMD(local[0], local[1], v);
    if (next) onChange(next);
  };

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="group"
      aria-label="日付"
    >
      <Input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        placeholder="YYYY"
        value={y}
        onChange={handleYearChange}
        id={id}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-label="年"
        className="w-14 text-center tabular-nums"
      />
      <span className="text-muted-foreground shrink-0">/</span>
      <Input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        placeholder="MM"
        value={m}
        onChange={handleMonthChange}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-label="月"
        className="w-10 text-center tabular-nums"
      />
      <span className="text-muted-foreground shrink-0">/</span>
      <Input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        placeholder="DD"
        value={d}
        onChange={handleDayChange}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-label="日"
        className="w-10 text-center tabular-nums"
      />
    </div>
  );
}

/** YYYY-MM-DD を Date に（無効な場合は undefined） */
function parseDate(value: string): Date | undefined {
  if (!value || value.length < 10) return undefined;
  const d = new Date(value + "T00:00:00");
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export interface DateInputWithCalendarProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}

/**
 * 年4桁・月2桁・日2桁のみ入力可能。右端のカレンダーアイコンをクリックでカレンダーを表示。
 * value / onChange は "YYYY-MM-DD" 形式。
 */
export function DateInputWithCalendar({
  value,
  onChange,
  id,
  className,
  disabled,
  "aria-invalid": ariaInvalid,
}: DateInputWithCalendarProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseYMD(value);
  const [local, setLocal] = React.useState<[string, string, string]>(parsed);
  const [dirty, setDirty] = React.useState(false);
  const yearRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLInputElement>(null);
  const dayRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (value === "") {
      setLocal(["", "", ""]);
      setDirty(false);
      return;
    }
    if (dirty) return;
    setLocal(parseYMD(value));
    setDirty(false);
  }, [value]);

  const [y, m, d] = dirty ? local : parseYMD(value);
  const selectedDate = parseDate(value);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = digitsOnly(e.target.value, 4);
    setDirty(true);
    const nextLocal: [string, string, string] = [v, local[1], local[2]];
    setLocal(nextLocal);
    const next = formatYMD(v, local[1], local[2]);
    if (next) onChange(next);
    if (v.length >= 4) monthRef.current?.focus();
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = digitsOnly(e.target.value, 2);
    setDirty(true);
    const nextLocal: [string, string, string] = [local[0], v, local[2]];
    setLocal(nextLocal);
    const next = formatYMD(local[0], v, local[2]);
    if (next) onChange(next);
    if (v.length >= 2) dayRef.current?.focus();
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = digitsOnly(e.target.value, 2);
    setDirty(true);
    const nextLocal: [string, string, string] = [local[0], local[1], v];
    setLocal(nextLocal);
    const next = formatYMD(local[0], local[1], v);
    if (next) onChange(next);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const str = date.toISOString().split("T")[0];
    onChange(str);
    setLocal(parseYMD(str));
    setDirty(false);
    setOpen(false);
  };

  const inputClass = "border-0 shadow-none bg-transparent focus-visible:ring-0 h-8 px-1";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "flex items-center gap-1 border border-input rounded-md h-9 w-full min-w-0 px-2 shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
          "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
          "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
          disabled && "pointer-events-none opacity-50",
          className
        )}
        role="group"
        aria-label="日付"
        aria-invalid={ariaInvalid}
      >
        <div className="flex flex-1 min-w-0 items-center gap-0.5">
          <Input
            ref={yearRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="YYYY"
            value={y}
            onChange={handleYearChange}
            id={id}
            disabled={disabled}
            aria-label="年"
            className={cn("w-12 text-center tabular-nums", inputClass)}
          />
          <span className="text-muted-foreground text-sm shrink-0">/</span>
          <Input
            ref={monthRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            placeholder="MM"
            value={m}
            onChange={handleMonthChange}
            disabled={disabled}
            aria-label="月"
            className={cn("w-8 text-center tabular-nums", inputClass)}
          />
          <span className="text-muted-foreground text-sm shrink-0">/</span>
          <Input
            ref={dayRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            placeholder="DD"
            value={d}
            onChange={handleDayChange}
            disabled={disabled}
            aria-label="日"
            className={cn("w-8 text-center tabular-nums", inputClass)}
          />
        </div>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded"
            disabled={disabled}
            aria-label="カレンダーを開く"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleCalendarSelect}
        />
      </PopoverContent>
    </Popover>
  );
}
