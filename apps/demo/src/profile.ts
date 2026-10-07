// The job seeker's profile in the demo: kept in localStorage and used to prefill applications.

export interface SeekerProfile {
  name: string;
  headline: string;
  email: string;
  phone: string;
  city: string;
  education: string;
  skills: string;
  cvUrl: string;
}

const KEY = "vwo:jobseeker";

export const EMPTY_PROFILE: SeekerProfile = { name: "", headline: "", email: "", phone: "", city: "", education: "", skills: "", cvUrl: "" };

export function loadProfile(): SeekerProfile {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<SeekerProfile>) } : { ...EMPTY_PROFILE };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function saveProfile(p: SeekerProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode or blocked storage: the profile just isn't remembered.
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
