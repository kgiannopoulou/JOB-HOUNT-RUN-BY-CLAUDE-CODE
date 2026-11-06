/** Display details for attribution, which provider terms usually require. */
export const providerDetails: Record<string, { name: string; url: string }> = {
  remotive: { name: "Remotive", url: "https://remotive.com" },
};

export function providerName(id: string) {
  return providerDetails[id]?.name ?? id;
}
