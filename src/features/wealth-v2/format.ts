import { Decimal, type Money } from "@/domain/core";

export function formatMoney(money: Money | null, locale = "it-IT", digits = 2): string {
  if (!money) return "—";

  const exact = money.amount.toFixed(digits, "half-even");
  const negative = exact.startsWith("-");
  const unsigned = negative ? exact.slice(1) : exact;
  const [integerPart, fractionPart = ""] = unsigned.split(".");
  const currency = money.currency.toString();

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    const group =
      formatter.formatToParts(10000).find((part) => part.type === "group")?.value ?? ".";
    const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
    const template = formatter.formatToParts(negative ? -1 : 1);
    let integerWritten = false;

    return template
      .map((part) => {
        if (part.type === "integer") {
          if (integerWritten) return "";
          integerWritten = true;
          return groupedInteger;
        }
        if (part.type === "fraction") return fractionPart;
        return part.value;
      })
      .join("");
  } catch {
    return `${currency} ${exact}`;
  }
}

export function formatQuantity(value: string, maxDigits = 8, locale = "it-IT"): string {
  const decimal = Decimal.parse(value);
  const exact = decimal.toFixed(Math.min(decimal.scale, maxDigits), "half-even");
  try {
    const separator =
      new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")
        ?.value ?? ".";
    return exact.replace(".", separator);
  } catch {
    return exact;
  }
}

export function formatDateTime(value: string, locale = "it-IT"): string {
  const date = new Date(value);
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      date,
    );
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
}

export function humanize(value: string): string {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
