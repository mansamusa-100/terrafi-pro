import { isPlatformRole } from './audit.js';

export const PLATFORM_BRANDING = {
  title: 'Terrafi Pro',
  subtitle: 'Agent Network Management',
  logo_url: '/icons/terrafi-logo.svg'
};

export const COMPANY_SUBTITLE = 'Agent Network';

export function companyLogoUrl(logoPath) {
  return logoPath ? `/uploads/${logoPath}` : null;
}

export function resolveBranding(role, company) {
  if (isPlatformRole(role)) {
    return { ...PLATFORM_BRANDING };
  }
  return {
    title: company?.name || 'Terrafi Pro',
    subtitle: COMPANY_SUBTITLE,
    logo_url: companyLogoUrl(company?.logoPath ?? null)
  };
}
