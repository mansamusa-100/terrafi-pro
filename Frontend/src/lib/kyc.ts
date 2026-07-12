export const KYC_DOCS = [
  { key: 'nationalId', label: 'National ID card', required: true, multiPage: false },
  { key: 'businessPermit', label: 'Business permit', required: true, multiPage: false },
  {
    key: 'agentAgreement',
    label: 'Signed agent agreement',
    required: true,
    multiPage: true
  }
] as const;

export type KycDocType = (typeof KYC_DOCS)[number]['key'];

export const MULTI_PAGE_KYC_TYPES = new Set(
  KYC_DOCS.filter((d) => d.multiPage).map((d) => d.key)
);

export function isMultiPageKycDoc(docType: string) {
  return MULTI_PAGE_KYC_TYPES.has(docType as KycDocType);
}

export const KYC_DOC_LABELS: Record<string, string> = Object.fromEntries(
  KYC_DOCS.map((d) => [d.key, d.label])
);
