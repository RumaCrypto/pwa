export type InterpolationValues = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

export function interpolate(template: string, values: InterpolationValues = {}): string {
  return template.replace(PLACEHOLDER, (marker, name: string) =>
    name in values ? String(values[name]) : marker
  );
}

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

export function pluralSuffix(locale: string, count: number): PluralCategory {
  return new Intl.PluralRules(locale).select(count) as PluralCategory;
}
