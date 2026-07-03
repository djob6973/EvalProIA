import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toTitleCase(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}
