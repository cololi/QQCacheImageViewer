import path from 'path';

let allowedRoots: string[] = [];

export function setAllowedRoots(roots: string[]): void {
  allowedRoots = roots
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .map((r) => path.resolve(r));
}

export function addAllowedRoot(root: string): void {
  if (typeof root !== 'string' || root.length === 0) return;
  const resolved = path.resolve(root);
  if (!allowedRoots.includes(resolved)) {
    allowedRoots.push(resolved);
  }
}

export function getAllowedRoots(): readonly string[] {
  return allowedRoots;
}

function normalize(p: string): string {
  return process.platform === 'win32' ? p.toLowerCase() : p;
}

function isWithin(target: string, root: string): boolean {
  const t = normalize(target);
  // Strip trailing separator from root so we don't double-up when appending one
  const rRaw = normalize(root);
  const r =
    rRaw.length > 1 && (rRaw.endsWith(path.sep) || rRaw.endsWith('/')) ? rRaw.slice(0, -1) : rRaw;
  if (t === r) return true;
  if (t === rRaw) return true;
  return t.startsWith(r + path.sep) || t.startsWith(r + '/');
}

export function assertSafePath(target: unknown): string {
  if (typeof target !== 'string' || target.length === 0) {
    throw new Error('PATH_INVALID');
  }
  // Reject obvious injection patterns even before resolve
  if (target.includes('\0')) {
    throw new Error('PATH_INVALID');
  }
  const resolved = path.resolve(target);
  if (allowedRoots.length === 0) {
    // Fail closed — without allowlist, reject everything
    throw new Error('PATH_GUARD_NOT_INITIALIZED');
  }
  const ok = allowedRoots.some((root) => isWithin(resolved, root));
  if (!ok) {
    throw new Error(`PATH_NOT_ALLOWED:${target}`);
  }
  return resolved;
}

export function isSafePath(target: unknown): boolean {
  try {
    assertSafePath(target);
    return true;
  } catch {
    return false;
  }
}
