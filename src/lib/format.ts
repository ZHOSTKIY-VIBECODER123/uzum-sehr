const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tashkent",
});
const dateOnly = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Tashkent" });

export const formatDateTime = (value: string | null | undefined) => (value ? dateTime.format(new Date(value)) : "—");
export const formatDate = (value: string | null | undefined) => (value ? dateOnly.format(new Date(value)) : "—");

export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const ageLabel = (age: number) => `${age} ${plural(age, "год", "года", "лет")}`;

export const STATUS_LABEL = { free: "Свободно", booked: "Забронировано", fulfilled: "Подарок передан" } as const;
