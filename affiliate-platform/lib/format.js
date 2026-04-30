export function formatIdr(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatShortDate(isoDate) {
  return new Date(isoDate).toLocaleDateString("id-ID");
}
