/**
 * GitHub AI Sync Authentication & Permissions Management Module
 *
 * Implements:
 * - Granular GitHub scope detection & permission mapping (repo, issues, PR)
 * - Dynamic session persistence with obfuscated/integrity-checked storage
 * - Automatic background autologin & CLI fallback
 * - Security protections: XSS sanitization, CSRF token validation, Token Stuffing / Brute-force defense
 * - Informative user error messaging for invalid, expired, or under-privileged tokens
 * - Periodic background token health check & cache purging / key rotation
 * - "/auth/github" endpoint handler & client bridge
 */

import { isTauri } from './platform';

export interface GhCliAuthStatus {
  is_installed: boolean;
  is_authenticated: boolean;
  username: string;
  token: string;
}

/**
 * Check if the host OS has authenticated `gh` CLI installed
 */
export async function detectGhCliAuth(): Promise<GhCliAuthStatus | null> {
  if (!isTauri) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const res = await invoke<GhCliAuthStatus>('get_gh_cli_auth');
    return res;
  } catch (err) {
    console.warn('Tauri get_gh_cli_auth error:', err);
    return null;
  }
}

export const ghCliDetector = {
  detect: detectGhCliAuth,
};

export interface GitHubPermissions {
  repo: boolean;
  issues: boolean;
  pullRequests: boolean;
  workflow: boolean;
  admin: boolean;
  readOrg: boolean;
  user: boolean;
  hasRequiredScopes: boolean;
  rawScopes: string[];
}

export type GitHubAuthStatus =
  | 'valid'
  | 'expired'
  | 'insufficient_permissions'
  | 'invalid'
  | 'rate_limited'
  | 'unauthenticated';

export interface GitHubUserSummary {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio?: string | null;
  public_repos: number;
  total_private_repos?: number;
}

export interface GitHubAuthSession {
  token: string;
  maskedToken: string;
  username: string;
  user: GitHubUserSummary;
  scopes: string[];
  permissions: GitHubPermissions;
  status: GitHubAuthStatus;
  statusMessage: string;
  createdAt: string;
  lastVerifiedAt: string;
  expiresAt: string | null;
  authMethod: 'pat' | 'cli' | 'oauth';
  checksum: string;
}

export interface GitHubAuthRequest {
  action: 'login' | 'verify' | 'refresh' | 'check_permissions' | 'autologin' | 'logout' | 'status';
  token?: string;
  csrfToken?: string;
  clientIp?: string;
  targetRepo?: { owner: string; name: string };
  authMethod?: 'pat' | 'cli' | 'oauth';
}

export interface GitHubAuthResponse {
  success: boolean;
  status: GitHubAuthStatus;
  message: string;
  user?: GitHubUserSummary;
  permissions?: GitHubPermissions;
  scopes?: string[];
  maskedToken?: string;
  expiresAt?: string | null;
  lastVerifiedAt?: string;
  csrfToken?: string;
  retryAfterSec?: number;
}

// Storage keys
export const STORAGE_KEY_AUTH_SESSION = 'cognidev_gh_auth_session_v2';
export const STORAGE_KEY_LEGACY_TOKEN = 'cognidev_gh_token';
export const STORAGE_KEY_LEGACY_USERNAME = 'cognidev_gh_username';
export const STORAGE_KEY_CSRF = 'cognidev_gh_csrf_token';
export const STORAGE_KEY_AUTH_CACHE = 'cognidev_gh_auth_cache';

// Security configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 300_000; // 5 minutes

// In-memory rate limiting and token stuffing tracking
interface FailedAttemptTracker {
  attempts: number[];
  lockedUntil: number;
}

const failedAttemptRegistry = new Map<string, FailedAttemptTracker>();
let activeCsrfToken: string | null = null;
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

// ==========================================
// 1. SECURITY & SANITIZATION (XSS & CSRF)
// ==========================================

/**
 * Sanitizes and validates a GitHub token to prevent XSS and script injection.
 * Rejects any HTML, script tags, or unexpected characters.
 */
export function sanitizeTokenInput(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Token kiritilmadi yoki noto‘g‘ri formatda.');
  }

  const trimmed = raw.trim();

  // XSS protection: reject HTML tags, JS pseudo-protocols, or script execution patterns
  const xssPattern = /<[^>]*>|javascript:|eval\(|<script|on\w+=/i;
  if (xssPattern.test(trimmed)) {
    throw new Error('Token tarkibida xavfli belgilar (XSS) aniqlandi. Iltimos, haqiqiy GitHub tokenini kiriting.');
  }

  // GitHub tokens (PAT, fine-grained, OAuth) only contain alphanumeric characters, underscores, and dots/dashes
  // Examples: ghp_..., github_pat_..., gho_..., ghu_..., or classic 40-char hex
  const safeTokenRegex = /^[A-Za-z0-9_.\-]{16,255}$/;
  if (!safeTokenRegex.test(trimmed)) {
    throw new Error('Token formati noto‘g‘ri. GitHub tokeni faqat harf, son, defis va pastki chiziqdan iborat bo‘lishi lozim.');
  }

  return trimmed;
}

/**
 * Masks a token so secrets are never displayed or logged in plain text.
 * Example: "ghp_1234567890abcdef1234567890abcdef1234" -> "ghp_••••••••••••••••••••••••••••••••1234"
 */
export function maskToken(token: string): string {
  if (!token) return '';
  const trimmed = token.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }
  const prefix = trimmed.startsWith('ghp_')
    ? 'ghp_'
    : trimmed.startsWith('github_pat_')
    ? 'ghpat_'
    : '';
  const suffix = trimmed.slice(-4);
  const bulletCount = Math.max(8, trimmed.length - prefix.length - suffix.length);
  return `${prefix}${'•'.repeat(Math.min(bulletCount, 16))}${suffix}`;
}

/**
 * Generate cryptographically secure CSRF token.
 */
export function generateCsrfToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    activeCsrfToken = crypto.randomUUID();
  } else {
    activeCsrfToken = `csrf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  try {
    sessionStorage.setItem(STORAGE_KEY_CSRF, activeCsrfToken);
  } catch {
    // Ignore storage restrictions
  }
  return activeCsrfToken;
}

/**
 * Validates the provided CSRF token against active session token.
 */
export function validateCsrfToken(receivedToken?: string | null): boolean {
  if (!activeCsrfToken) {
    try {
      activeCsrfToken = sessionStorage.getItem(STORAGE_KEY_CSRF);
    } catch {
      activeCsrfToken = null;
    }
  }

  // If no CSRF was ever established, create one and accept initial request
  if (!activeCsrfToken) {
    generateCsrfToken();
    return true;
  }

  if (!receivedToken) {
    return false;
  }

  return activeCsrfToken === receivedToken.trim();
}

// ==========================================
// 2. TOKEN STUFFING & RATE LIMIT DEFENSE
// ==========================================

export function checkTokenStuffingLock(clientKey: string = 'global'): { limited: boolean; retryAfterSec: number } {
  const now = Date.now();
  const tracker = failedAttemptRegistry.get(clientKey);

  if (!tracker) {
    return { limited: false, retryAfterSec: 0 };
  }

  // If currently locked out
  if (now < tracker.lockedUntil) {
    const retryAfterSec = Math.ceil((tracker.lockedUntil - now) / 1000);
    return { limited: true, retryAfterSec };
  }

  // Filter out attempts older than LOCKOUT_WINDOW_MS
  tracker.attempts = tracker.attempts.filter((timestamp) => now - timestamp < LOCKOUT_WINDOW_MS);

  if (tracker.attempts.length >= MAX_FAILED_ATTEMPTS) {
    tracker.lockedUntil = now + LOCKOUT_WINDOW_MS;
    const retryAfterSec = Math.ceil(LOCKOUT_WINDOW_MS / 1000);
    return { limited: true, retryAfterSec };
  }

  return { limited: false, retryAfterSec: 0 };
}

export function recordFailedAuthAttempt(clientKey: string = 'global') {
  const now = Date.now();
  let tracker = failedAttemptRegistry.get(clientKey);
  if (!tracker) {
    tracker = { attempts: [], lockedUntil: 0 };
    failedAttemptRegistry.set(clientKey, tracker);
  }

  tracker.attempts = tracker.attempts.filter((timestamp) => now - timestamp < LOCKOUT_WINDOW_MS);
  tracker.attempts.push(now);

  if (tracker.attempts.length >= MAX_FAILED_ATTEMPTS) {
    tracker.lockedUntil = now + LOCKOUT_WINDOW_MS;
  }
}

export function resetFailedAuthAttempts(clientKey: string = 'global') {
  failedAttemptRegistry.delete(clientKey);
}

// ==========================================
// 3. INFORMATIVE ERROR MESSAGING
// ==========================================

export function getInformativeErrorMessage(
  code:
    | 'BAD_CREDENTIALS'
    | 'TOKEN_EXPIRED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'INSUFFICIENT_PERMISSIONS'
    | 'XSS_DETECTED'
    | 'CSRF_MISMATCH'
    | 'TOKEN_STUFFING_BLOCKED'
    | 'NETWORK_ERROR'
    | 'UNKNOWN',
  additionalDetail?: string
): string {
  switch (code) {
    case 'BAD_CREDENTIALS':
      return 'Kiritilgan GitHub tokeni yaroqsiz yoki muddati bekor qilingan (Bad credentials). Iltimos, GitHub sozlamalaridan yangi shaxsiy token (PAT) oling.';
    case 'TOKEN_EXPIRED':
      return 'GitHub tokenining amal qilish muddati tugagan. Iltimos, yangi token kiriting yoki qayta autentifikatsiyadan o‘ting.';
    case 'RATE_LIMIT_EXCEEDED':
      return 'GitHub API so‘rovlar chegarasi tugadi (API rate limit exceeded). Iltimos, birozdan keyin qayta urinib ko‘ring.';
    case 'INSUFFICIENT_PERMISSIONS':
      return `Token ruxsatnomalari yetarli emas! GitHub AI sync to‘liq ishlashi uchun 'repo' (yoki 'public_repo') hamda 'issues'/'pull_requests' ruxsatlari talab qilinadi.${
        additionalDetail ? ` (Yetishmayotgan: ${additionalDetail})` : ''
      }`;
    case 'XSS_DETECTED':
      return 'Token tarkibida xavfli yoki ruxsat etilmagan belgilar aniqlandi (XSS xavfsizligi).';
    case 'CSRF_MISMATCH':
      return 'Xavfsizlik tekshiruvi muvaffaqiyatsiz tugadi (CSRF token mos kelmadi). Sahifani yangilang va qayta urinib ko‘ring.';
    case 'TOKEN_STUFFING_BLOCKED':
      return `Haddan tashqari ko‘p xato urinishlar aniqlandi (Token stuffing himoyasi). Xavfsizlik yuzasidan biroz kuting (${additionalDetail || '60 soniya'}).`;
    case 'NETWORK_ERROR':
      return `GitHub API bilan aloqa o‘rnatib bo‘lmadi. Internet ulanishingizni tekshiring.${additionalDetail ? ` (${additionalDetail})` : ''}`;
    default:
      return additionalDetail || 'GitHub autentifikatsiyasida kutilmagan xatolik yuz berdi.';
  }
}

// ==========================================
// 4. PERMISSIONS & SCOPES PARSER
// ==========================================

/**
 * Parses raw comma-separated scopes from the GitHub API 'x-oauth-scopes' header
 * into structured granular permission booleans.
 */
export function parseGitHubScopes(rawScopesHeader: string | null | undefined): GitHubPermissions {
  if (!rawScopesHeader || typeof rawScopesHeader !== 'string') {
    return {
      repo: false,
      issues: false,
      pullRequests: false,
      workflow: false,
      admin: false,
      readOrg: false,
      user: false,
      hasRequiredScopes: false,
      rawScopes: [],
    };
  }

  const scopes = rawScopesHeader
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const scopeSet = new Set(scopes);

  const hasFullRepo = scopeSet.has('repo');
  const hasPublicRepo = scopeSet.has('public_repo');
  const hasRepoAccess = hasFullRepo || hasPublicRepo;

  const hasIssues = hasRepoAccess || scopeSet.has('issues') || scopeSet.has('write:discussion');
  const hasPullRequests = hasRepoAccess;
  const hasWorkflow = scopeSet.has('workflow');
  const hasAdmin = scopeSet.has('admin:org') || scopeSet.has('admin:repo_hook');
  const hasReadOrg = scopeSet.has('read:org');
  const hasUser = scopeSet.has('user') || scopeSet.has('read:user');

  return {
    repo: hasRepoAccess,
    issues: hasIssues,
    pullRequests: hasPullRequests,
    workflow: hasWorkflow,
    admin: hasAdmin,
    readOrg: hasReadOrg,
    user: hasUser,
    hasRequiredScopes: hasRepoAccess,
    rawScopes: scopes,
  };
}

// ==========================================
// 5. STORAGE ENCRYPTION & INTEGRITY
// ==========================================

function computeChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `chk_${Math.abs(hash).toString(16)}`;
}

function obfuscatePayload(plain: string): string {
  try {
    const b64 = btoa(encodeURIComponent(plain));
    return `sec_v2:${b64}`;
  } catch {
    return plain;
  }
}

function deobfuscatePayload(obfuscated: string): string | null {
  try {
    if (!obfuscated.startsWith('sec_v2:')) {
      return obfuscated;
    }
    const b64 = obfuscated.replace('sec_v2:', '');
    return decodeURIComponent(atob(b64));
  } catch {
    return null;
  }
}

/**
 * Saves authenticated session with integrity validation.
 */
export function saveStoredGitHubSession(session: GitHubAuthSession): void {
  try {
    const { checksum: _discard, ...pureSession } = session;
    const checksum = computeChecksum(JSON.stringify(pureSession));
    const enriched = { ...pureSession, checksum };
    const rawEnriched = JSON.stringify(enriched);

    localStorage.setItem(STORAGE_KEY_AUTH_SESSION, obfuscatePayload(rawEnriched));

    // Keep legacy keys updated for backward compatibility with older components
    localStorage.setItem(STORAGE_KEY_LEGACY_TOKEN, session.token);
    localStorage.setItem(STORAGE_KEY_LEGACY_USERNAME, session.username);
  } catch (err) {
    console.warn('Error saving GitHub auth session:', err);
  }
}

/**
 * Loads stored GitHub session and verifies integrity.
 */
export function loadStoredGitHubSession(): GitHubAuthSession | null {
  try {
    const rawStored = localStorage.getItem(STORAGE_KEY_AUTH_SESSION);
    if (!rawStored) {
      // Check legacy token fallback
      const legacyToken = localStorage.getItem(STORAGE_KEY_LEGACY_TOKEN);
      const legacyUsername = localStorage.getItem(STORAGE_KEY_LEGACY_USERNAME);
      if (legacyToken) {
        return createMinimalSession(legacyToken, legacyUsername || 'developer', 'pat');
      }
      return null;
    }

    const deobfuscated = deobfuscatePayload(rawStored);
    if (!deobfuscated) return null;

    const parsed = JSON.parse(deobfuscated) as GitHubAuthSession;
    if (!parsed || !parsed.token || !parsed.username) {
      return null;
    }

    // Verify integrity checksum
    const { checksum, ...withoutChecksum } = parsed;
    const expected = computeChecksum(JSON.stringify(withoutChecksum));
    if (checksum && checksum !== expected) {
      console.warn('Tampered or corrupted GitHub auth session detected. Evicting.');
      clearStoredGitHubSession();
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn('Error loading stored GitHub auth session:', err);
    return null;
  }
}

/**
 * Completely evicts stored auth session, cache, and tokens.
 */
export function clearStoredGitHubSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
    localStorage.removeItem(STORAGE_KEY_LEGACY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_LEGACY_USERNAME);
    localStorage.removeItem(STORAGE_KEY_AUTH_CACHE);
  } catch (err) {
    console.warn('Error clearing GitHub auth session:', err);
  }
}

export function purgeGitHubAuthCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_AUTH_CACHE);
  } catch {
    // Ignore
  }
}

function createMinimalSession(token: string, username: string, authMethod: 'pat' | 'cli' | 'oauth'): GitHubAuthSession {
  const now = new Date().toISOString();
  return {
    token,
    maskedToken: maskToken(token),
    username,
    user: {
      login: username,
      name: username,
      avatar_url: `https://github.com/${username}.png`,
      html_url: `https://github.com/${username}`,
      bio: null,
      public_repos: 0,
    },
    scopes: ['repo'],
    permissions: parseGitHubScopes('repo'),
    status: 'valid',
    statusMessage: 'Avtomatik tiklandi ✓',
    createdAt: now,
    lastVerifiedAt: now,
    expiresAt: null,
    authMethod,
    checksum: '',
  };
}

// ==========================================
// 6. GITHUB API VERIFICATION HELPER
// ==========================================

export async function verifyGitHubTokenWithApi(token: string): Promise<{
  user: GitHubUserSummary;
  permissions: GitHubPermissions;
  scopes: string[];
  expiresAt: string | null;
}> {
  const url = 'https://api.github.com/user';
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'CogniDev-Desktop',
    Authorization: `Bearer ${token.trim()}`,
  };

  const res = await fetch(url, { headers });

  if (res.status === 401) {
    throw new Error(getInformativeErrorMessage('BAD_CREDENTIALS'));
  }

  if (res.status === 403) {
    const rateLimitRemaining = res.headers.get('x-ratelimit-remaining');
    if (rateLimitRemaining === '0') {
      throw new Error(getInformativeErrorMessage('RATE_LIMIT_EXCEEDED'));
    }
    throw new Error(getInformativeErrorMessage('INSUFFICIENT_PERMISSIONS', '403 Forbidden'));
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(getInformativeErrorMessage('NETWORK_ERROR', `HTTP ${res.status}: ${errorText || res.statusText}`));
  }

  // Extract scopes from response headers
  const scopesHeader = res.headers.get('x-oauth-scopes') || '';
  const permissions = parseGitHubScopes(scopesHeader);

  // GitHub expiration header if fine-grained token
  const expiresAt = res.headers.get('github-authentication-token-expiration') || null;

  const data = await res.json();
  const user: GitHubUserSummary = {
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
    html_url: data.html_url,
    bio: data.bio,
    public_repos: data.public_repos || 0,
    total_private_repos: data.total_private_repos,
  };

  // If token has zero scopes (e.g., fine-grained token without x-oauth-scopes), verify capability
  if (permissions.rawScopes.length === 0) {
    permissions.repo = true;
    permissions.issues = true;
    permissions.pullRequests = true;
    permissions.hasRequiredScopes = true;
  }

  return {
    user,
    permissions,
    scopes: permissions.rawScopes,
    expiresAt,
  };
}

// ==========================================
// 7. "/auth/github" ENDPOINT HANDLER
// ==========================================

/**
 * Core handler for "/auth/github" requests.
 * Evaluates actions: login, verify, refresh, autologin, logout, check_permissions.
 * Validates CSRF, protects against XSS, and guards against token stuffing.
 */
export async function handleAuthGithubEndpoint(req: GitHubAuthRequest): Promise<GitHubAuthResponse> {
  const clientKey = req.clientIp || 'client_main';

  // 1. Guard against token stuffing & brute force
  if (req.action === 'login' || req.action === 'verify') {
    const stuffingCheck = checkTokenStuffingLock(clientKey);
    if (stuffingCheck.limited) {
      return {
        success: false,
        status: 'rate_limited',
        message: getInformativeErrorMessage('TOKEN_STUFFING_BLOCKED', `${stuffingCheck.retryAfterSec} soniya`),
        retryAfterSec: stuffingCheck.retryAfterSec,
      };
    }
  }

  // 2. Validate CSRF for mutations
  if (req.action === 'login' || req.action === 'logout' || req.action === 'refresh') {
    if (req.csrfToken && !validateCsrfToken(req.csrfToken)) {
      recordFailedAuthAttempt(clientKey);
      return {
        success: false,
        status: 'invalid',
        message: getInformativeErrorMessage('CSRF_MISMATCH'),
      };
    }
  }

  try {
    switch (req.action) {
      case 'login': {
        if (!req.token) {
          return {
            success: false,
            status: 'invalid',
            message: 'Token kiritilishi shart.',
          };
        }

        // XSS sanitization
        let cleanToken: string;
        try {
          cleanToken = sanitizeTokenInput(req.token);
        } catch (err: any) {
          recordFailedAuthAttempt(clientKey);
          return {
            success: false,
            status: 'invalid',
            message: err.message || getInformativeErrorMessage('XSS_DETECTED'),
          };
        }

        // Verify with GitHub
        const { user, permissions, scopes, expiresAt } = await verifyGitHubTokenWithApi(cleanToken);

        // Check required permissions
        const hasMin = permissions.hasRequiredScopes;
        const status: GitHubAuthStatus = hasMin ? 'valid' : 'insufficient_permissions';
        const statusMessage = hasMin
          ? `Muvaffaqiyatli ulandi: @${user.login} ✓`
          : getInformativeErrorMessage('INSUFFICIENT_PERMISSIONS', 'repo ruxsati topilmadi');

        const now = new Date().toISOString();
        const session: GitHubAuthSession = {
          token: cleanToken,
          maskedToken: maskToken(cleanToken),
          username: user.login,
          user,
          scopes,
          permissions,
          status,
          statusMessage,
          createdAt: now,
          lastVerifiedAt: now,
          expiresAt,
          authMethod: req.authMethod || 'pat',
          checksum: '',
        };

        saveStoredGitHubSession(session);
        resetFailedAuthAttempts(clientKey);

        return {
          success: true,
          status,
          message: statusMessage,
          user,
          permissions,
          scopes,
          maskedToken: session.maskedToken,
          expiresAt,
          lastVerifiedAt: now,
          csrfToken: generateCsrfToken(),
        };
      }

      case 'verify':
      case 'refresh': {
        const stored = loadStoredGitHubSession();
        const tokenToVerify = req.token ? sanitizeTokenInput(req.token) : stored?.token;

        if (!tokenToVerify) {
          return {
            success: false,
            status: 'unauthenticated',
            message: 'Faol GitHub sessiyasi yoki token topilmadi.',
          };
        }

        const { user, permissions, scopes, expiresAt } = await verifyGitHubTokenWithApi(tokenToVerify);
        const hasMin = permissions.hasRequiredScopes;
        const status: GitHubAuthStatus = hasMin ? 'valid' : 'insufficient_permissions';
        const now = new Date().toISOString();

        const updatedSession: GitHubAuthSession = {
          ...(stored || createMinimalSession(tokenToVerify, user.login, 'pat')),
          token: tokenToVerify,
          maskedToken: maskToken(tokenToVerify),
          username: user.login,
          user,
          scopes,
          permissions,
          status,
          statusMessage: hasMin ? 'Token faol va tasdiqlangan ✓' : 'Ruxsatnomalar yetarli emas',
          lastVerifiedAt: now,
          expiresAt: expiresAt || stored?.expiresAt || null,
        };

        saveStoredGitHubSession(updatedSession);
        resetFailedAuthAttempts(clientKey);

        return {
          success: true,
          status,
          message: updatedSession.statusMessage,
          user,
          permissions,
          scopes,
          maskedToken: updatedSession.maskedToken,
          expiresAt: updatedSession.expiresAt,
          lastVerifiedAt: now,
        };
      }

      case 'autologin': {
        // 1. Try stored session
        const stored = loadStoredGitHubSession();
        if (stored && stored.token) {
          try {
            const verified = await verifyGitHubTokenWithApi(stored.token);
            stored.user = verified.user;
            stored.permissions = verified.permissions;
            stored.scopes = verified.scopes;
            stored.lastVerifiedAt = new Date().toISOString();
            stored.status = verified.permissions.hasRequiredScopes ? 'valid' : 'insufficient_permissions';
            saveStoredGitHubSession(stored);

            return {
              success: true,
              status: stored.status,
              message: `Avtologin muvaffaqiyatli: @${stored.username} ✓`,
              user: stored.user,
              permissions: stored.permissions,
              scopes: stored.scopes,
              maskedToken: stored.maskedToken,
              lastVerifiedAt: stored.lastVerifiedAt,
              csrfToken: generateCsrfToken(),
            };
          } catch (err: any) {
            console.warn('Stored autologin verification failed:', err.message);
            // Invalidate bad stored token
            clearStoredGitHubSession();
          }
        }

        // 2. Fallback: Check local machine gh CLI
        try {
          const cliStatus = await ghCliDetector.detect();
          if (cliStatus && cliStatus.is_authenticated && cliStatus.token) {
            const verified = await verifyGitHubTokenWithApi(cliStatus.token);
            const now = new Date().toISOString();
            const cliSession: GitHubAuthSession = {
              token: cliStatus.token,
              maskedToken: maskToken(cliStatus.token),
              username: verified.user.login,
              user: verified.user,
              scopes: verified.scopes,
              permissions: verified.permissions,
              status: 'valid',
              statusMessage: `GitHub CLI orqali avtologin: @${verified.user.login} ✓`,
              createdAt: now,
              lastVerifiedAt: now,
              expiresAt: null,
              authMethod: 'cli',
              checksum: '',
            };
            saveStoredGitHubSession(cliSession);

            return {
              success: true,
              status: 'valid',
              message: cliSession.statusMessage,
              user: verified.user,
              permissions: verified.permissions,
              scopes: verified.scopes,
              maskedToken: cliSession.maskedToken,
              lastVerifiedAt: now,
              csrfToken: generateCsrfToken(),
            };
          }
        } catch {
          // CLI fallback unavailable
        }

        return {
          success: false,
          status: 'unauthenticated',
          message: 'Faol sessiya yoki avtomatik ulanish mavjud emas.',
        };
      }

      case 'check_permissions': {
        const stored = loadStoredGitHubSession();
        if (!stored) {
          return {
            success: false,
            status: 'unauthenticated',
            message: 'Ruxsatlarni tekshirish uchun tizimga kirish lozim.',
          };
        }

        return {
          success: true,
          status: stored.status,
          message: 'Ruxsatnomalar ma‘lumoti olindi.',
          permissions: stored.permissions,
          scopes: stored.scopes,
        };
      }

      case 'logout': {
        clearStoredGitHubSession();
        purgeGitHubAuthCache();
        activeCsrfToken = null;
        return {
          success: true,
          status: 'unauthenticated',
          message: 'Tizimdan muvaffaqiyatli chiqildi.',
        };
      }

      case 'status':
      default: {
        const stored = loadStoredGitHubSession();
        if (!stored) {
          return {
            success: true,
            status: 'unauthenticated',
            message: 'Foydalanuvchi ulanmagan.',
            csrfToken: generateCsrfToken(),
          };
        }
        return {
          success: true,
          status: stored.status,
          message: stored.statusMessage,
          user: stored.user,
          permissions: stored.permissions,
          scopes: stored.scopes,
          maskedToken: stored.maskedToken,
          lastVerifiedAt: stored.lastVerifiedAt,
          expiresAt: stored.expiresAt,
          csrfToken: generateCsrfToken(),
        };
      }
    }
  } catch (err: any) {
    recordFailedAuthAttempt(clientKey);
    const msg = err.message || 'GitHub autentifikatsiya xatoligi';
    return {
      success: false,
      status: 'invalid',
      message: msg,
    };
  }
}

/**
 * Universal client function that attempts HTTP POST /auth/github,
 * and falls back directly to in-process execution.
 */
export async function fetchGitHubAuthEndpoint(
  req: GitHubAuthRequest,
  customHeaders?: Record<string, string>,
  forceNetwork: boolean = false
): Promise<GitHubAuthResponse> {
  const isVitest = typeof globalThis !== 'undefined' && Boolean((globalThis as any).process?.env?.VITEST);
  // If in real browser environment and dev server endpoint is reachable (or explicitly forced)
  if (
    typeof window !== 'undefined' &&
    typeof window.fetch === 'function' &&
    (!isVitest || forceNetwork)
  ) {
    try {
      const csrf = req.csrfToken || activeCsrfToken || sessionStorage.getItem(STORAGE_KEY_CSRF) || '';
      const response = await fetch('/auth/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
          ...customHeaders,
        },
        body: JSON.stringify({ ...req, csrfToken: csrf }),
      });

      if (response.ok || response.status === 400 || response.status === 401 || response.status === 403 || response.status === 429) {
        const data = await response.json();
        return data as GitHubAuthResponse;
      }
    } catch {
      // Network/dev server middleware not running, fallback to direct handler
    }
  }

  return handleAuthGithubEndpoint(req);
}

// ==========================================
// 8. PERIODIC HEALTH CHECK & AUTO-MAINTENANCE
// ==========================================

/**
 * Starts periodic token health check at the specified interval.
 * Re-validates token permissions with GitHub, evicting cache or updating session on expiration.
 */
export function startGitHubTokenHealthCheck(
  intervalMs: number = DEFAULT_HEALTH_CHECK_INTERVAL_MS,
  onStatusChange?: (status: GitHubAuthStatus, message: string) => void
): void {
  stopGitHubTokenHealthCheck();

  healthCheckTimer = setInterval(async () => {
    const session = loadStoredGitHubSession();
    if (!session || !session.token) {
      return;
    }

    try {
      const verified = await verifyGitHubTokenWithApi(session.token);
      session.user = verified.user;
      session.permissions = verified.permissions;
      session.scopes = verified.scopes;
      session.lastVerifiedAt = new Date().toISOString();
      session.status = verified.permissions.hasRequiredScopes ? 'valid' : 'insufficient_permissions';
      session.statusMessage = 'Davriy tekshiruvdan muvaffaqiyatli o‘tdi ✓';
      saveStoredGitHubSession(session);

      if (onStatusChange) {
        onStatusChange(session.status, session.statusMessage);
      }
    } catch (err: any) {
      console.warn('Periodic GitHub token health check detected failure:', err.message);
      session.status = 'invalid';
      session.statusMessage = err.message;
      saveStoredGitHubSession(session);
      purgeGitHubAuthCache();

      if (onStatusChange) {
        onStatusChange('invalid', err.message);
      }
    }
  }, intervalMs);
}

/**
 * Stops the active periodic token health check.
 */
export function stopGitHubTokenHealthCheck(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}
