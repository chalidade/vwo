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
  /** Campus or school, for the campus leaderboard. */
  campus?: string;
  /** Profile photo as a small JPEG data URL, shown to HR with applications. */
  photo?: string;
  /**
   * "Boleh dihubungi perusahaan untuk lowongan lain". Unset until they choose; sending the first
   * application turns it on (they can switch it off). On: companies they applied to may offer other
   * vacancies, and any company may find them in "Kandidat cocok" (without contact details until they
   * apply). Off: only the companies they applied to see them, for those applications.
   */
  contactable?: boolean;
}

const KEY = "vwo:jobseeker";
/** Fired on window when the server's copy of the profile replaced this browser's. */
export const PROFILE_EVENT = "vwo:profile-synced";
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
