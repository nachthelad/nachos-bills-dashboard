"use client";

import type React from "react";

import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays } from "lucide-react";
import { es } from "date-fns/locale";
import { DayPicker } from "react-day-picker";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isoToDate,
  maskDisplayDateInput,
  parseDisplayDate,
  toDisplayDate,
  toIsoDate,
} from "@/lib/date-picker";
import { cn } from "@/lib/utils";

type DatePickerPopoverProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "size"
> & {
  value?: string | null;
  onChange: (value: string) => void;
  inputClassName?: string;
  buttonClassName?: string;
  popoverClassName?: string;
};

export function DatePickerPopover({
  value,
  onChange,
  className,
  inputClassName,
  buttonClassName,
  popoverClassName,
  disabled,
  onBlur,
  onFocus,
  onClick,
  onKeyDown,
  placeholder = "DD/MM/YYYY",
  ...props
}: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const selectedDate = isoToDate(value);
  const [month, setMonth] = useState<Date>(selectedDate ?? new Date());
  const [displayValue, setDisplayValue] = useState(() =>
    toDisplayDate(selectedDate)
  );

  useEffect(() => {
    const nextSelectedDate = isoToDate(value);
    setDisplayValue(toDisplayDate(nextSelectedDate));
    setInvalid(false);

    if (nextSelectedDate) {
      setMonth(nextSelectedDate);
    }
  }, [value]);

  const commitDisplayValue = (nextDisplayValue: string) => {
    if (!nextDisplayValue) {
      setDisplayValue("");
      setInvalid(false);
      onChange("");
      return true;
    }

    const parsedDate = parseDisplayDate(nextDisplayValue);
    if (!parsedDate) {
      setInvalid(true);
      return false;
    }

    const nextIsoDate = toIsoDate(parsedDate);
    setDisplayValue(toDisplayDate(parsedDate));
    setMonth(parsedDate);
    setInvalid(false);
    onChange(nextIsoDate);
    return true;
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDisplayValue = maskDisplayDateInput(event.target.value);
    setDisplayValue(nextDisplayValue);
    setInvalid(false);

    if (nextDisplayValue.length === 10) {
      commitDisplayValue(nextDisplayValue);
    } else if (!nextDisplayValue) {
      onChange("");
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const didCommit = commitDisplayValue(displayValue);
    if (!didCommit) {
      setDisplayValue(toDisplayDate(selectedDate));
      setInvalid(false);
    }

    onBlur?.(event);
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    if (!disabled) {
      setOpen(true);
    }
    onFocus?.(event);
  };

  const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    if (!disabled) {
      setOpen(true);
    }
    onClick?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commitDisplayValue(displayValue);
    }

    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !disabled) {
      setOpen(true);
    }

    onKeyDown?.(event);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className={cn("relative", className)}>
          <Input
            {...props}
            type="text"
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            inputMode="numeric"
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={invalid}
            className={cn("pr-10", inputClassName)}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((currentOpen) => !currentOpen)}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "absolute right-1 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground",
              buttonClassName
            )}
          >
            <CalendarDays className="size-4" />
            <span className="sr-only">Abrir calendario</span>
          </button>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className={cn(
            "z-50 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl outline-none",
            popoverClassName
          )}
        >
          <DayPicker
            mode="single"
            locale={es}
            weekStartsOn={1}
            navLayout="around"
            month={month}
            onMonthChange={setMonth}
            selected={selectedDate ?? undefined}
            onSelect={(date) => {
              if (!date) return;

              setMonth(date);
              setDisplayValue(toDisplayDate(date));
              setInvalid(false);
              onChange(toIsoDate(date));
              setOpen(false);
            }}
            classNames={{
              months: "flex flex-col gap-4",
              month: "flex flex-col gap-4",
              month_caption: "flex items-center justify-center px-8 pt-1 relative",
              caption_label: "text-sm font-semibold",
              nav: "flex items-center gap-1",
              button_previous: cn(
                buttonVariants({ variant: "outline", size: "icon-sm" }),
                "absolute left-0 top-0 h-7 w-7 bg-transparent"
              ),
              button_next: cn(
                buttonVariants({ variant: "outline", size: "icon-sm" }),
                "absolute right-0 top-0 h-7 w-7 bg-transparent"
              ),
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday:
                "w-9 rounded-md text-[0.8rem] font-normal text-muted-foreground",
              weeks: "w-full",
              week: "mt-2 flex w-full",
              day: "h-9 w-9 text-center text-sm p-0 relative",
              day_button: cn(
                buttonVariants({ variant: "ghost" }),
                "h-9 w-9 p-0 font-normal"
              ),
              selected:
                "rounded-md bg-emerald-500 text-slate-950 [&>button]:bg-emerald-500 [&>button]:text-slate-950 [&>button:hover]:bg-emerald-500 [&>button:hover]:text-slate-950",
              today:
                "rounded-md bg-accent text-accent-foreground [&>button]:bg-accent [&>button]:text-accent-foreground",
              outside: "text-muted-foreground opacity-50",
              disabled: "text-muted-foreground opacity-50",
              hidden: "invisible",
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
