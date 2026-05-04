import pkg from "../../package.json";

export const APP_VERSION = pkg.version as string;

/**
 * Tag curta exibida no footer e em logs. Inclui a versão semver e, se
 * disponível, o SHA do commit (Vercel injeta via `VERCEL_GIT_COMMIT_SHA`).
 */
export const APP_BUILD_TAG = (() => {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return sha ? `${APP_VERSION}+${sha}` : APP_VERSION;
})();
