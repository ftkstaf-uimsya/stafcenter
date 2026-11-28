"use client";

import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { matchesFlexibleQuery } from "@/lib/search-normalize";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  searchable?: boolean;
  allowCustomValue?: boolean;
  placeholder?: string;
  emptyText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options,
      error,
      id,
      name,
      value,
      defaultValue,
      onChange,
      onBlur,
      disabled = false,
      required = false,
      searchable = true,
      allowCustomValue = false,
      placeholder,
      emptyText = "Tidak ada pilihan yang cocok",
      className = "",
      "aria-label": ariaLabel,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const listboxId = `${selectId}-listbox`;

    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const justFocusedRef = useRef(false);

    const [mounted, setMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({
      position: "fixed",
      top: -9999,
      left: -9999,
      visibility: "hidden",
      zIndex: 70,
    });

    useEffect(() => {
      setMounted(true);
    }, []);

    const currentValue =
      value !== undefined
        ? String(value)
        : defaultValue !== undefined
        ? String(defaultValue)
        : "";

    const selectedOption = useMemo(
      () => options.find((opt) => opt.value === currentValue) || null,
      [options, currentValue]
    );

    const emptyOption = useMemo(
      () => options.find((opt) => opt.value === "") || null,
      [options]
    );

    const closedDisplayText = useMemo(() => {
      if (selectedOption) {
        return selectedOption.value === "" ? "" : selectedOption.label;
      }
      if (allowCustomValue) {
        return currentValue;
      }
      return "";
    }, [allowCustomValue, currentValue, selectedOption]);

    const resolvedPlaceholder =
      placeholder ||
      emptyOption?.label ||
      (searchable ? "Ketik untuk mencari atau pilih..." : "Pilih...");

    const filteredOptions = useMemo(() => {
      if (!isFiltering || !query.trim()) {
        return options;
      }
      return options.filter((opt) =>
        matchesFlexibleQuery(`${opt.label} ${opt.value}`, query)
      );
    }, [isFiltering, options, query]);

    useEffect(() => {
      if (!isOpen) {
        setQuery(closedDisplayText);
        setIsFiltering(false);
      }
    }, [closedDisplayText, isOpen]);

    useLayoutEffect(() => {
      if (!isOpen) {
        setMenuStyle({
          position: "fixed",
          top: -9999,
          left: -9999,
          visibility: "hidden",
          zIndex: 70,
        });
        return;
      }
      const updatePosition = () => {
        if (!wrapperRef.current) return;
        const rect = wrapperRef.current.getBoundingClientRect();
        const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 10);
        const spaceAbove = Math.max(0, rect.top - 10);
        const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
        const width = Math.min(
          window.innerWidth - 16,
          Math.max(rect.width, 220)
        );
        const left = Math.max(
          8,
          Math.min(rect.left, window.innerWidth - width - 8)
        );

        if (openAbove) {
          const safeMaxHeight = Math.max(
            140,
            Math.min(264, Math.min(spaceAbove, window.innerHeight - 16))
          );
          const safeBottom = Math.max(
            8,
            Math.min(
              window.innerHeight - rect.top + 4,
              window.innerHeight - safeMaxHeight - 8
            )
          );
          setMenuStyle({
            position: "fixed",
            left,
            bottom: safeBottom,
            width,
            maxHeight: safeMaxHeight,
            visibility: "visible",
            zIndex: 70,
          });
        } else {
          const safeMaxHeight = Math.max(
            140,
            Math.min(264, spaceBelow, window.innerHeight - 16)
          );
          const safeTop = Math.max(
            8,
            Math.min(rect.bottom + 4, window.innerHeight - safeMaxHeight - 8)
          );
          setMenuStyle({
            position: "fixed",
            left,
            top: safeTop,
            width,
            maxHeight: safeMaxHeight,
            visibility: "visible",
            zIndex: 70,
          });
        }
      };

      const handleExternalScroll = (event: Event) => {
        if (
          dropdownRef.current &&
          event.target instanceof Node &&
          dropdownRef.current.contains(event.target)
        ) {
          return;
        }
        updatePosition();
      };

      updatePosition();
      window.addEventListener("scroll", handleExternalScroll, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", handleExternalScroll, true);
        window.removeEventListener("resize", updatePosition);
      };
    }, [isOpen, filteredOptions.length]);

    useEffect(() => {
      if (!isOpen) return;
      const handleOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          wrapperRef.current?.contains(target) ||
          dropdownRef.current?.contains(target)
        ) {
          return;
        }
        setIsOpen(false);
        setIsFiltering(false);
        setQuery(closedDisplayText);
      };
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }, [closedDisplayText, isOpen]);

    useEffect(() => {
      if (!isOpen) return;
      const container = dropdownRef.current;
      const activeEl = container?.querySelector(
        `[data-option-index="${activeIndex}"]`
      ) as HTMLElement | null;
      if (!container || !activeEl) return;

      // Scroll hanya pada kontainer listbox sendiri tanpa scrollIntoView agar window tidak melompat
      const itemTop = activeEl.offsetTop;
      const itemBottom = itemTop + activeEl.offsetHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      if (itemTop < viewTop) {
        container.scrollTop = itemTop;
      } else if (itemBottom > viewBottom) {
        container.scrollTop = itemBottom - container.clientHeight;
      }
    }, [activeIndex, isOpen]);

    const emitValueChange = (nextVal: string) => {
      if (!onChange) return;
      const syntheticEvent = {
        target: { value: nextVal, name: name || "" },
        currentTarget: { value: nextVal, name: name || "" },
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    };

    if (!searchable) {
      return (
        <div className="w-full space-y-1.5">
          {label ? (
            <label
              htmlFor={selectId}
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              {label}
            </label>
          ) : null}
          <select
            id={selectId}
            ref={ref}
            name={name}
            value={value}
            defaultValue={defaultValue}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            required={required}
            aria-label={ariaLabel}
            className={`w-full min-h-[44px] px-3.5 py-2 text-sm rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border ${
              error
                ? "border-red-600 dark:border-red-500"
                : "border-slate-400 dark:border-slate-600"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 ${className}`}
            aria-invalid={Boolean(error)}
            {...rest}
          >
            {options.map((opt) => (
              <option key={`${opt.value}-${opt.label}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {error ? (
            <p
              role="alert"
              className="text-xs font-medium text-red-700 dark:text-red-400"
            >
              {error}
            </p>
          ) : null}
        </div>
      );
    }

    const openDropdown = () => {
      if (disabled) return;
      setIsOpen(true);
      setIsFiltering(false);
      setQuery(closedDisplayText);
      const selectedIdx = options.findIndex((o) => o.value === currentValue);
      setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
    };

    const commitOption = (opt: SelectOption) => {
      const displayVal = opt.value === "" ? "" : opt.label;
      setIsOpen(false);
      setIsFiltering(false);
      setQuery(displayVal);
      emitValueChange(opt.value);
    };

    const handleClearOrReset = () => {
      if (disabled) return;
      if (emptyOption || allowCustomValue) {
        emitValueChange("");
        setQuery("");
        setIsFiltering(false);
        setIsOpen(true);
        setActiveIndex(0);
      } else {
        setQuery("");
        setIsFiltering(true);
        setIsOpen(true);
        setActiveIndex(0);
      }
      inputRef.current?.focus();
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!isOpen) {
          openDropdown();
          return;
        }
        setActiveIndex((prev) =>
          filteredOptions.length === 0
            ? 0
            : (prev + 1) % filteredOptions.length
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen) {
          openDropdown();
          return;
        }
        setActiveIndex((prev) =>
          filteredOptions.length === 0
            ? 0
            : (prev - 1 + filteredOptions.length) % filteredOptions.length
        );
      } else if (e.key === "Enter") {
        if (!isOpen) {
          openDropdown();
          e.preventDefault();
          return;
        }
        const chosen = filteredOptions[activeIndex];
        if (chosen) {
          e.preventDefault();
          commitOption(chosen);
        } else if (allowCustomValue) {
          setIsOpen(false);
          setIsFiltering(false);
        }
      } else if (e.key === "Escape") {
        if (isOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
          setIsFiltering(false);
          setQuery(closedDisplayText);
        }
      } else if (e.key === "Tab") {
        setIsOpen(false);
        setIsFiltering(false);
        if (!allowCustomValue) {
          setQuery(closedDisplayText);
        }
      }
    };

    const canShowClear =
      !disabled &&
      (Boolean(query) ||
        (isOpen && !allowCustomValue && options.length > 1));

    const displayedValue = isOpen ? query : closedDisplayText;

    return (
      <div className="w-full space-y-1.5">
        {label ? (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-slate-900 dark:text-slate-100"
          >
            {label}
          </label>
        ) : null}

        <div ref={wrapperRef} className="relative w-full">
          <input
            ref={inputRef}
            id={selectId}
            name={name}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              isOpen && filteredOptions[activeIndex]
                ? `${listboxId}-opt-${activeIndex}`
                : undefined
            }
            aria-label={ariaLabel || label || placeholder || "Pilihan"}
            aria-invalid={Boolean(error)}
            autoComplete="off"
            disabled={disabled}
            required={required}
            value={displayedValue}
            placeholder={resolvedPlaceholder}
            onFocus={(e) => {
              justFocusedRef.current = true;
              openDropdown();
              if (e.currentTarget.value && !allowCustomValue) {
                e.currentTarget.select();
              }
            }}
            onMouseUp={(e) => {
              if (justFocusedRef.current) {
                justFocusedRef.current = false;
                if (
                  e.currentTarget.value &&
                  !allowCustomValue &&
                  e.currentTarget.selectionStart === e.currentTarget.selectionEnd
                ) {
                  e.preventDefault();
                  e.currentTarget.select();
                }
              }
            }}
            onClick={() => {
              if (!isOpen) openDropdown();
            }}
            onChange={(e) => {
              const nextText = e.target.value;
              setIsOpen(true);
              setIsFiltering(true);
              setQuery(nextText);
              setActiveIndex(0);
              if (allowCustomValue) {
                emitValueChange(nextText);
              }
            }}
            onBlur={(e) => {
              const related = e.relatedTarget as Node | null;
              if (related && dropdownRef.current?.contains(related)) return;
              if (!allowCustomValue) {
                setQuery(closedDisplayText);
              }
              if (onBlur) {
                onBlur(e as unknown as React.FocusEvent<HTMLSelectElement>);
              }
            }}
            onKeyDown={handleInputKeyDown}
            className={`w-full min-h-[44px] pl-3.5 pr-16 py-2 text-sm rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 border ${
              error
                ? "border-red-600 dark:border-red-500"
                : isOpen
                ? "border-[#1E3A5F] dark:border-sky-400 ring-2 ring-[#1E3A5F]/20 dark:ring-sky-400/20"
                : "border-slate-400 dark:border-slate-600"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
          />

          <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
            {canShowClear ? (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClearOrReset}
                aria-label="Bersihkan pencarian pilihan"
                title="Bersihkan teks pencarian"
                className="w-7 h-7 inline-flex items-center justify-center rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (isOpen) {
                  setIsOpen(false);
                  setIsFiltering(false);
                  setQuery(closedDisplayText);
                } else {
                  inputRef.current?.focus();
                  openDropdown();
                }
              }}
              aria-label={isOpen ? "Tutup daftar pilihan" : "Buka daftar pilihan"}
              className="w-8 h-8 inline-flex items-center justify-center rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {isOpen && mounted
          ? createPortal(
              <div
                ref={dropdownRef}
                id={listboxId}
                role="listbox"
                aria-label={label || ariaLabel || "Daftar pilihan"}
                style={menuStyle}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto py-1"
              >
                {filteredOptions.length === 0 ? (
                  <div className="px-3.5 py-3 text-xs text-slate-600 dark:text-slate-400">
                    {allowCustomValue && query.trim()
                      ? `Menggunakan teks manual: "${query.trim()}"`
                      : emptyText}
                  </div>
                ) : (
                  filteredOptions.map((opt, idx) => {
                    const isSelected = opt.value === currentValue;
                    const isActive = idx === activeIndex;
                    return (
                      <div
                        key={`${opt.value}-${idx}`}
                        id={`${listboxId}-opt-${idx}`}
                        data-option-index={idx}
                        role="option"
                        aria-selected={isSelected}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => commitOption(opt)}
                        className={`px-3.5 py-2.5 min-h-[40px] flex items-center justify-between gap-2 text-xs sm:text-sm cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#1E3A5F]/10 text-[#1E3A5F] dark:bg-sky-500/20 dark:text-sky-300 font-bold"
                            : isActive
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected ? (
                          <Check
                            className="w-4 h-4 shrink-0 text-[#1E3A5F] dark:text-sky-400"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>,
              document.body
            )
          : null}

        {error ? (
          <p
            role="alert"
            className="text-xs font-medium text-red-700 dark:text-red-400"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";
