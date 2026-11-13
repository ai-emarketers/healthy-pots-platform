/** Map links: use the customer's pasted link when there is one, otherwise a Google Maps search for the address. */
// Link to open an address in a map
export function mapUrl(a: { line1?: string; landmark?: string | null; city?: string; pincode?: string | null; mapLink?: string | null }): string {
  // Prefer the link the customer pasted
  if (a.mapLink) return a.mapLink;
  // Otherwise build a text query from the address parts
  const q = [a.line1, a.landmark, a.city, a.pincode].filter(Boolean).join(', ');
  // Google Maps search link for that text
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
