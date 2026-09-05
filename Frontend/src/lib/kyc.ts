export const KYC_DOCS = [
  { key: 'nationalId', label: 'Identification Document', required: true, multiPage: false },
  {
    key: 'businessPermit',
    label: 'Business Registration Certificate',
    required: true,
    multiPage: false
  },
  { key: 'tinCertificate', label: 'TIN Certificate', required: true, multiPage: false },
  {
    key: 'agentAgreement',
    label: 'Signed agent agreement',
    required: true,
    multiPage: true
  }
] as const;

export type KycDocType = (typeof KYC_DOCS)[number]['key'];

export const MULTI_PAGE_KYC_TYPES = new Set<string>(
  KYC_DOCS.filter((d) => d.multiPage).map((d) => d.key)
);

export function isMultiPageKycDoc(docType: string) {
  return MULTI_PAGE_KYC_TYPES.has(docType);
}

export const KYC_DOC_LABELS: Record<string, string> = Object.fromEntries(
  KYC_DOCS.map((d) => [d.key, d.label])
);
