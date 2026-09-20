"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export function nextSelectOptionIndex(
  currentIndex: number,
  options: SelectOption[],
  key: "ArrowDown" | "ArrowUp" | "Home" | "End",
) {
  const enabledIndexes = options.flatMap((option, index) => (option.disabled ? [] : [index]));
  if (enabledIndexes.length === 0) return -1;
  if (key === "Home") return enabledIndexes[0];
  if (key === "End") return enabledIndexes.at(-1) ?? -1;

  const position = enabledIndexes.indexOf(currentIndex);
  if (key === "ArrowDown") return enabledIndexes[(position + 1 + enabledIndexes.length) % enabledIndexes.length];
  return enabledIndexes[(position - 1 + enabledIndexes.length) % enabledIndexes.length];
}

type SelectProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value" | "defaultValue"> & {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  name?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  wrapperClassName?: string;
};

export function Select({
  options,
  value,
  defaultValue,
  name,
  onValueChange,
  placeholder = "Select an option",
  wrapperClassName = "",
  className = "",
  disabled = false,
  id,
  onKeyDown: onButtonKeyDown,
  ...buttonProps
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const selectedValue = value ?? uncontrolledValue;
  const selectedOption = options.find((option) => option.value === selectedValue);
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selectValue = (nextValue: string) => {
    if (value === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
  };

  const openWithActiveOption = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : nextSelectOptionIndex(-1, options, "ArrowDown"));
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onButtonKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openWithActiveOption();
        return;
      }
      setActiveIndex(nextSelectOptionIndex(activeIndex, options, event.key));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) openWithActiveOption();
      setActiveIndex(nextSelectOptionIndex(activeIndex, options, event.key));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openWithActiveOption();
      } else if (activeIndex >= 0) {
        const activeOption = options[activeIndex];
        if (activeOption && !activeOption.disabled) selectValue(activeOption.value);
      }
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative w-full ${wrapperClassName}`}>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <button
        {...buttonProps}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => (open ? setOpen(false) : openWithActiveOption())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5 text-left text-sm text-stone-900 shadow-sm outline-none transition hover:border-stone-300 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}>
        <span className="min-w-0 truncate">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown aria-hidden="true" size={16} className={`shrink-0 text-stone-500 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
          {options.map((option, index) => {
            const selected = option.value === selectedValue;
            return (
              <button
                key={option.value}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectValue(option.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  selected ? "bg-stone-100 font-medium text-stone-900" : "text-stone-700 hover:bg-stone-50"
                } ${activeIndex === index ? "ring-1 ring-stone-200" : ""} disabled:cursor-not-allowed disabled:opacity-50`}>
                <Check aria-hidden="true" size={15} className={selected ? "opacity-100" : "opacity-0"} />
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
