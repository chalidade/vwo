import { accountKey } from "./account";

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
  /** Profile photo as a small JPEG data URL, shown to HR with applications. */
  photo?: string;
}

const KEY = "vwo:jobseeker";
const key = () => accountKey(KEY);

export const EMPTY_PROFILE: SeekerProfile = { name: "", headline: "", email: "", phone: "", city: "", education: "", skills: "", cvUrl: "" };

export function loadProfile(): SeekerProfile {
  try {
    const raw = localStorage.getItem(key());
    return raw ? { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<SeekerProfile>) } : { ...EMPTY_PROFILE };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function saveProfile(p: SeekerProfile) {
  try {
    localStorage.setItem(key(), JSON.stringify(p));
  } catch {
    // Private mode or blocked storage: the profile just isn't remembered.
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(key());
  } catch {
    // Nothing to clear.
  }
}
