import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isValid, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeFormat(dateStr: any, formatStr: string = 'dd-MMM-yy') {
  if (!dateStr || typeof dateStr !== 'string') return '—';
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, formatStr);
  } catch {
    return dateStr;
  }
}
