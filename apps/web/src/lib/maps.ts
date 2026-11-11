/** Map links: use the customer's pasted link when there is one, otherwise a Google Maps search for the address. */
export function mapUrl(a: { line1?: string; landmark?: string | null; city?: string; pincode?: string | null; mapLink?: string | null }): string {
  if (a.mapLink) return a.mapLink;
  const q = [a.line1, a.landmark, a.city, a.pincode].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
