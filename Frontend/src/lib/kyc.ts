export const KYC_DOCS = [
  { key: 'nationalId', label: 'National ID card', required: true },
  { key: 'businessPermit', label: 'Business permit', required: true },
  { key: 'agentAgreement', label: 'Signed agent agreement', required: true }
] as const;

export type KycDocType = (typeof KYC_DOCS)[number]['key'];

export const KYC_DOC_LABELS: Record<string, string> = Object.fromEntries(
  KYC_DOCS.map((d) => [d.key, d.label])
);
