export const KYC_DOC_TYPES = [
  'nationalId',
  'businessPermit',
  'tinCertificate',
  'agentAgreement'
];

export const KYC_DOC_LABELS = {
  nationalId: 'Identification Document',
  businessPermit: 'Business Registration Certificate',
  tinCertificate: 'TIN Certificate',
  agentAgreement: 'Signed agent agreement'
};

/** Parse filename like APW-0001-nationalId.pdf */
export function parseKycFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const match = base.match(
    /^(.+)-(nationalId|businessPermit|tinCertificate|agentAgreement)$/i
  );
  if (!match) return null;
  return { agentId: match[1], docType: match[2] };
}
