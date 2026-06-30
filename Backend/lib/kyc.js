export const KYC_DOC_TYPES = [
  'nationalId',
  'businessPermit',
  'agentAgreement'
];

export const KYC_DOC_LABELS = {
  nationalId: 'National ID card',
  businessPermit: 'Business permit',
  agentAgreement: 'Signed agent agreement'
};

/** Parse filename like APW-0001-nationalId.pdf */
export function parseKycFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const match = base.match(/^(.+)-(nationalId|businessPermit|agentAgreement)$/i);
  if (!match) return null;
  return { agentId: match[1], docType: match[2] };
}
