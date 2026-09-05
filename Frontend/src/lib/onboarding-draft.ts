/** Persist onboarding wizard state (incl. photo blobs) across Android camera process kills. */

const DB_NAME = 'field-pro-onboarding';
const DB_VERSION = 1;
const STORE = 'drafts';
const DRAFT_ID = 'active';
const SESSION_FLAG = 'fp_onboarding_active';

export type OnboardingDraftFields = {
  step: number;
  outletName: string;
  name: string;
  phone: string;
  personalPhone: string;
  nationalId: string;
  gender: string;
  businessType: string;
  businessTypeOther: string;
  zone: string;
  subTerritory: string;
  townVillage: string;
  officerId: string;
  coords: { lat: number; lng: number } | null;
  competitors: string[];
  branding: string[];
};

type StoredFile = {
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
};

export type OnboardingDraft = OnboardingDraftFields & {
  version: 1;
  updatedAt: string;
  userId: string | null;
  docs: Record<string, StoredFile>;
  agreementPages: StoredFile[];
  locationPhoto: StoredFile | null;
};

export type OnboardingDraftPayload = OnboardingDraftFields & {
  userId: string | null;
  docs: Record<string, File | null>;
  agreementPages: File[];
  locationPhoto: File | null;
};

export type RestoredOnboardingDraft = OnboardingDraftFields & {
  docs: Record<string, File | null>;
  agreementPages: File[];
  locationPhoto: File | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

async function fileToStored(file: File): Promise<StoredFile> {
  return {
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    blob: file
  };
}

function storedToFile(stored: StoredFile): File {
  return new File([stored.blob], stored.name, {
    type: stored.type || 'application/octet-stream',
    lastModified: stored.lastModified || Date.now()
  });
}

export function markOnboardingSessionActive() {
  try {
    sessionStorage.setItem(SESSION_FLAG, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearOnboardingSessionActive() {
  try {
    sessionStorage.removeItem(SESSION_FLAG);
  } catch {
    /* ignore */
  }
}

export function isOnboardingSessionActive(): boolean {
  try {
    return sessionStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

export async function saveOnboardingDraft(payload: OnboardingDraftPayload): Promise<void> {
  const docs: Record<string, StoredFile> = {};
  for (const [key, file] of Object.entries(payload.docs)) {
    if (file) docs[key] = await fileToStored(file);
  }
  const agreementPages = await Promise.all(payload.agreementPages.map(fileToStored));
  const locationPhoto = payload.locationPhoto
    ? await fileToStored(payload.locationPhoto)
    : null;

  const draft: OnboardingDraft = {
    version: 1,
    updatedAt: new Date().toISOString(),
    userId: payload.userId,
    step: payload.step,
    outletName: payload.outletName,
    name: payload.name,
    phone: payload.phone,
    personalPhone: payload.personalPhone,
    nationalId: payload.nationalId,
    gender: payload.gender,
    businessType: payload.businessType,
    businessTypeOther: payload.businessTypeOther,
    zone: payload.zone,
    subTerritory: payload.subTerritory,
    townVillage: payload.townVillage,
    officerId: payload.officerId,
    coords: payload.coords,
    competitors: payload.competitors,
    branding: payload.branding,
    docs,
    agreementPages,
    locationPhoto
  };

  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await idbRequest(tx.objectStore(STORE).put(draft, DRAFT_ID));
  } finally {
    db.close();
  }
  markOnboardingSessionActive();
}

export async function loadOnboardingDraft(
  userId?: string | null
): Promise<RestoredOnboardingDraft | null> {
  try {
    const db = await openDb();
    let raw: OnboardingDraft | undefined;
    try {
      const tx = db.transaction(STORE, 'readonly');
      raw = await idbRequest(tx.objectStore(STORE).get(DRAFT_ID));
    } finally {
      db.close();
    }
    if (!raw || raw.version !== 1) return null;
    if (userId && raw.userId && raw.userId !== userId) return null;

    const docs: Record<string, File | null> = {};
    for (const [key, stored] of Object.entries(raw.docs || {})) {
      docs[key] = storedToFile(stored);
    }

    return {
      step: raw.step ?? 0,
      outletName: raw.outletName ?? '',
      name: raw.name ?? '',
      phone: raw.phone ?? '+220 ',
      personalPhone: raw.personalPhone ?? '+220 ',
      nationalId: raw.nationalId ?? '',
      gender: raw.gender ?? '',
      businessType: raw.businessType ?? '',
      businessTypeOther: raw.businessTypeOther ?? '',
      zone: raw.zone ?? '',
      subTerritory: raw.subTerritory ?? '',
      townVillage: raw.townVillage ?? '',
      officerId: raw.officerId ?? '',
      coords: raw.coords ?? null,
      competitors: Array.isArray(raw.competitors) ? raw.competitors : [],
      branding: Array.isArray(raw.branding) ? raw.branding : [],
      docs,
      agreementPages: (raw.agreementPages || []).map(storedToFile),
      locationPhoto: raw.locationPhoto ? storedToFile(raw.locationPhoto) : null
    };
  } catch {
    return null;
  }
}

export async function clearOnboardingDraft(): Promise<void> {
  clearOnboardingSessionActive();
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, 'readwrite');
      await idbRequest(tx.objectStore(STORE).delete(DRAFT_ID));
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
}

export function draftHasProgress(draft: RestoredOnboardingDraft | null): boolean {
  if (!draft) return false;
  if (draft.step > 0) return true;
  if (draft.outletName.trim() || draft.name.trim()) return true;
  if (draft.nationalId.trim() || draft.zone || draft.townVillage.trim()) return true;
  if (Object.values(draft.docs).some(Boolean)) return true;
  if (draft.agreementPages.length > 0 || draft.locationPhoto) return true;
  if (draft.coords || draft.competitors.length > 0 || draft.branding.length > 0) {
    return true;
  }
  return false;
}

export async function hasOnboardingDraft(userId?: string | null): Promise<boolean> {
  if (!isOnboardingSessionActive()) return false;
  const draft = await loadOnboardingDraft(userId);
  return draftHasProgress(draft);
}
