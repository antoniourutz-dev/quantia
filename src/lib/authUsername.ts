export const FALLBACK_EMAIL_DOMAINS = ['oposik.app', 'quantia.app'] as const;

export const buildLegacyInternalEmails = (usernameInput: string) => {
  const normalized = usernameInput.trim().toLowerCase();
  if (!normalized) return [];
  if (normalized.includes('@')) return [normalized];
  return Array.from(new Set(FALLBACK_EMAIL_DOMAINS.map((domain) => `${normalized}@${domain}`)));
};
