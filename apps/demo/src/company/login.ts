// Demo sign-in for the company portal: which company this browser is signed in as.

const LOGIN_KEY = "vwo:company-login";

/** The company signed in on this browser, if any. */
export function signedInCompany(): string | null {
  try {
    return localStorage.getItem(LOGIN_KEY);
  } catch {
    return null;
  }
}

export function sessionLogin(boothId: string | null) {
  try {
    if (boothId) localStorage.setItem(LOGIN_KEY, boothId);
    else localStorage.removeItem(LOGIN_KEY);
  } catch {
    // Private mode: the portal asks for the PIN again.
  }
}
