const aliases: Record<string, string> = {
  usa: "United States",
  us: "United States",
  "u.s.": "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "great britain": "United Kingdom",
  anywhere: "Worldwide",
  global: "Worldwide",
  remote: "Worldwide",
  eu: "Europe",
};

const europeanCountries = new Set(
  [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark",
    "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland",
    "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
    "Norway", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain",
    "Sweden", "Switzerland", "United Kingdom",
  ],
);

/** One spelling per place, so filters match however a provider writes it. */
export function canonicalLocation(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const alias = aliases[trimmed.toLowerCase()];
  if (alias) return alias;
  return trimmed.replace(/(^|[\s-])(\p{L})/gu, (match) => match.toUpperCase());
}

/**
 * Providers often list a region rather than a country, so someone searching
 * for Greece also needs to see jobs open to Europe, EMEA and the whole world.
 */
export function expandLocation(value: string): string[] {
  const location = canonicalLocation(value);
  const expanded = new Set([location, "Worldwide"]);
  if (europeanCountries.has(location)) {
    expanded.add("Europe");
    expanded.add("Emea");
    expanded.add("EMEA");
  }
  return [...expanded];
}
