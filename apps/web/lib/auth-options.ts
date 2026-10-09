import "server-only";

/**
 * Email + password accounts. The live site signs in with Google only (Google has already checked
 * the address, so no fake sign-ups); PASSWORD_LOGIN=1 turns the old form back on, e.g. for local tests.
 */
export function passwordLogin() {
  return process.env.PASSWORD_LOGIN === "1";
}
