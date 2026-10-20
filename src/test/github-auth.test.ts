/**
 * Unit tests for GitHub AI Auth & Permissions System
 * Covers:
 * - XSS sanitization and token masking
 * - CSRF token generation and validation
 * - Token stuffing / brute-force rate-limiting
 * - Granular permissions and scope parsing (repo, issues, PR)
 * - Informative user error messages for defective tokens
 * - Storage integrity and tamper detection
 * - /auth/github endpoint handler for all actions (login, verify, refresh, autologin, logout, check_permissions, status)
 * - Periodic token health check & cache purging
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sanitizeTokenInput,
  maskToken,
  generateCsrfToken,
  validateCsrfToken,
  checkTokenStuffingLock,
  recordFailedAuthAttempt,
  resetFailedAuthAttempts,
  getInformativeErrorMessage,
  parseGitHubScopes,
  saveStoredGitHubSession,
  loadStoredGitHubSession,
  clearStoredGitHubSession,
  purgeGitHubAuthCache,
  verifyGitHubTokenWithApi,
  handleAuthGithubEndpoint,
  fetchGitHubAuthEndpoint,
  startGitHubTokenHealthCheck,
  stopGitHubTokenHealthCheck,
  ghCliDetector,
  STORAGE_KEY_AUTH_SESSION,
  STORAGE_KEY_LEGACY_TOKEN,
  STORAGE_KEY_LEGACY_USERNAME,
  type GitHubAuthSession,
} from '../lib/githubAuth';

describe('GitHub AI Auth — XSS & Sanitization', () => {
  it('toza GitHub PAT tokenini qabul qiladi', () => {
    const validPat = 'ghp_1234567890abcdef1234567890abcdef1234';
    expect(sanitizeTokenInput(validPat)).toBe(validPat);
  });

  it('fine-grained GitHub tokenini qabul qiladi', () => {
    const fineGrained = 'github_pat_11ABCDEF1234567890_abcdefghijklmnopqrstuvwxyz1234567890';
    expect(sanitizeTokenInput(fineGrained)).toBe(fineGrained);
  });

  it('XSS script teglari bor tokenni rad etadi va xatolik beradi', () => {
    expect(() => sanitizeTokenInput('<script>alert("xss")</script>ghp_test')).toThrowError(/XSS/i);
    expect(() => sanitizeTokenInput('javascript:fetch("evil.com")')).toThrowError(/XSS/i);
    expect(() => sanitizeTokenInput('ghp_test<img src=x onerror=alert(1)>')).toThrowError(/XSS/i);
  });

  it('noto‘g‘ri yoki qisqa formatli tokenni rad etadi', () => {
    expect(() => sanitizeTokenInput('')).toThrowError();
    expect(() => sanitizeTokenInput('short')).toThrowError();
    expect(() => sanitizeTokenInput('ghp_token with spaces')).toThrowError();
    expect(() => sanitizeTokenInput(null as any)).toThrowError();
  });

  it('maskToken tokenni yashiradi va faqat prefiks/suffiksni qoldiradi', () => {
    const token = 'ghp_1234567890abcdef1234567890abcdef1234';
    const masked = maskToken(token);
    expect(masked.startsWith('ghp_')).toBe(true);
    expect(masked.endsWith('1234')).toBe(true);
    expect(masked).toContain('••••');
    expect(masked).not.toBe(token);

    expect(maskToken('short')).toBe('••••••••');
    expect(maskToken('')).toBe('');
  });
});

describe('GitHub AI Auth — CSRF Himoyasi', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('CSRF token yaratadi va tasdiqlaydi', () => {
    const token = generateCsrfToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
    expect(validateCsrfToken(token)).toBe(true);
  });

  it('noto‘g‘ri CSRF tokenni rad etadi', () => {
    generateCsrfToken();
    expect(validateCsrfToken('not-valid-token')).toBe(false);
    expect(validateCsrfToken(null)).toBe(false);
    expect(validateCsrfToken('')).toBe(false);
  });
});

describe('GitHub AI Auth — Token Stuffing & Brute-Force Himoyasi', () => {
  const clientKey = 'test_ip_1';

  beforeEach(() => {
    resetFailedAuthAttempts(clientKey);
  });

  it('normal urinishlarda bloklamaydi', () => {
    expect(checkTokenStuffingLock(clientKey).limited).toBe(false);
    recordFailedAuthAttempt(clientKey);
    expect(checkTokenStuffingLock(clientKey).limited).toBe(false);
  });

  it('5 ta ketma-ket xato urinishdan so‘ng bloklaydi', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAuthAttempt(clientKey);
    }
    const check = checkTokenStuffingLock(clientKey);
    expect(check.limited).toBe(true);
    expect(check.retryAfterSec).toBeGreaterThan(0);
  });

  it('resetFailedAuthAttempts blokirovkasini tozalaydi', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAuthAttempt(clientKey);
    }
    expect(checkTokenStuffingLock(clientKey).limited).toBe(true);
    resetFailedAuthAttempts(clientKey);
    expect(checkTokenStuffingLock(clientKey).limited).toBe(false);
  });
});

describe('GitHub AI Auth — Informative Error Messaging', () => {
  it('barcha nuqsonli token holatlari uchun tushunarli o‘zbekcha xabarlar qaytaradi', () => {
    expect(getInformativeErrorMessage('BAD_CREDENTIALS')).toContain('yaroqsiz yoki muddati bekor qilingan');
    expect(getInformativeErrorMessage('TOKEN_EXPIRED')).toContain('amal qilish muddati tugagan');
    expect(getInformativeErrorMessage('RATE_LIMIT_EXCEEDED')).toContain('so‘rovlar chegarasi tugadi');
    expect(getInformativeErrorMessage('INSUFFICIENT_PERMISSIONS')).toContain('ruxsatnomalari yetarli emas');
    expect(getInformativeErrorMessage('XSS_DETECTED')).toContain('XSS xavfsizligi');
    expect(getInformativeErrorMessage('CSRF_MISMATCH')).toContain('CSRF token mos kelmadi');
    expect(getInformativeErrorMessage('TOKEN_STUFFING_BLOCKED', '45 soniya')).toContain('Token stuffing');
    expect(getInformativeErrorMessage('NETWORK_ERROR', 'Timeout')).toContain('aloqa o‘rnatib bo‘lmadi');
  });
});

describe('GitHub AI Auth — Granular Permissions & Scopes Parsing', () => {
  it('to‘liq "repo" scope bo‘lsa barcha ruxsatlarni faol qiladi', () => {
    const scopes = 'repo, read:org, workflow';
    const perms = parseGitHubScopes(scopes);
    expect(perms.repo).toBe(true);
    expect(perms.issues).toBe(true);
    expect(perms.pullRequests).toBe(true);
    expect(perms.workflow).toBe(true);
    expect(perms.readOrg).toBe(true);
    expect(perms.hasRequiredScopes).toBe(true);
  });

  it('"public_repo" scope bo‘lsa ochiq repozitoriyalar uchun yetarli hisoblaydi', () => {
    const scopes = 'public_repo, read:user';
    const perms = parseGitHubScopes(scopes);
    expect(perms.repo).toBe(true);
    expect(perms.issues).toBe(true);
    expect(perms.pullRequests).toBe(true);
    expect(perms.user).toBe(true);
    expect(perms.hasRequiredScopes).toBe(true);
  });

  it('repo scope bo‘lmasa hasRequiredScopes false bo‘ladi', () => {
    const scopes = 'read:user, user:email, gist';
    const perms = parseGitHubScopes(scopes);
    expect(perms.repo).toBe(false);
    expect(perms.hasRequiredScopes).toBe(false);
    expect(perms.issues).toBe(false);
  });

  it('bo‘sh yoki null scope holatida xavfsiz defaultlarni qaytaradi', () => {
    expect(parseGitHubScopes(null).repo).toBe(false);
    expect(parseGitHubScopes('').hasRequiredScopes).toBe(false);
  });
});

describe('GitHub AI Auth — Dinamik Saqlash va Xavfsizlik Checksum', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const dummySession: GitHubAuthSession = {
    token: 'ghp_dummytoken1234567890abcdef1234567890',
    maskedToken: 'ghp_••••••••7890',
    username: 'octocat',
    user: {
      login: 'octocat',
      name: 'Mona Lisa',
      avatar_url: 'https://github.com/octocat.png',
      html_url: 'https://github.com/octocat',
      bio: 'GitHub mascot',
      public_repos: 8,
    },
    scopes: ['repo'],
    permissions: parseGitHubScopes('repo'),
    status: 'valid',
    statusMessage: 'Faol ulanish ✓',
    createdAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    expiresAt: null,
    authMethod: 'pat',
    checksum: '',
  };

  it('sessiyani shifrlab saqlaydi va round-trip orqali tiklaydi', () => {
    saveStoredGitHubSession(dummySession);
    const loaded = loadStoredGitHubSession();
    expect(loaded).toBeDefined();
    expect(loaded?.username).toBe('octocat');
    expect(loaded?.token).toBe(dummySession.token);
    expect(loaded?.permissions.repo).toBe(true);

    // Legacy kalitlar ham moslashtirilgan
    expect(localStorage.getItem(STORAGE_KEY_LEGACY_TOKEN)).toBe(dummySession.token);
  });

  it('buzilgan yoki o‘zboshimchalik bilan o‘zgartirilgan sessiyani rad etadi', () => {
    saveStoredGitHubSession(dummySession);
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_SESSION);
    // Buzilgan payload
    localStorage.setItem(STORAGE_KEY_AUTH_SESSION, raw + '_tampered');
    expect(loadStoredGitHubSession()).toBeNull();
  });

  it('clearStoredGitHubSession barcha kalitlarni tozalaydi', () => {
    saveStoredGitHubSession(dummySession);
    clearStoredGitHubSession();
    expect(loadStoredGitHubSession()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY_LEGACY_TOKEN)).toBeNull();
  });

  it('legacy token mavjud bo‘lganda avtomatik minimal sessiyaga aylantiradi', () => {
    localStorage.setItem(STORAGE_KEY_LEGACY_TOKEN, 'ghp_legacytoken12345678901234567890');
    localStorage.setItem(STORAGE_KEY_LEGACY_USERNAME, 'legacyuser');
    const loaded = loadStoredGitHubSession();
    expect(loaded).toBeDefined();
    expect(loaded?.username).toBe('legacyuser');
    expect(loaded?.token).toBe('ghp_legacytoken12345678901234567890');
  });
});

describe('GitHub AI Auth — GitHub API Bilan Tekshirish (verifyGitHubTokenWithApi)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('200 javobida foydalanuvchi va ruxsatnomalarni to‘g‘ri parse qiladi', async () => {
    const mockHeaders = new Headers();
    mockHeaders.set('x-oauth-scopes', 'repo, issues');
    mockHeaders.set('github-authentication-token-expiration', '2026-12-31T23:59:59Z');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      json: async () => ({
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://github.com/testuser.png',
        html_url: 'https://github.com/testuser',
        public_repos: 5,
      }),
    });

    const res = await verifyGitHubTokenWithApi('ghp_mocktoken1234567890abcdef12345678');
    expect(res.user.login).toBe('testuser');
    expect(res.permissions.repo).toBe(true);
    expect(res.permissions.issues).toBe(true);
    expect(res.expiresAt).toBe('2026-12-31T23:59:59Z');
  });

  it('401 xatolikda Bad credentials haqida bilgilovchi xabar qaytaradi', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers(),
      text: async () => 'Bad credentials',
    });

    await expect(verifyGitHubTokenWithApi('ghp_badtoken1234567890abcdef1234567890')).rejects.toThrowError(
      /Bad credentials/i
    );
  });

  it('403 rate limit tugaganda bilgilovchi xabar qaytaradi', async () => {
    const mockHeaders = new Headers();
    mockHeaders.set('x-ratelimit-remaining', '0');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: mockHeaders,
      text: async () => 'API rate limit exceeded',
    });

    await expect(verifyGitHubTokenWithApi('ghp_limitedtoken1234567890abcdef123456')).rejects.toThrowError(
      /so‘rovlar chegarasi/i
    );
  });
});

describe('GitHub AI Auth — /auth/github Endpoint Handler', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetFailedAuthAttempts('test_client');
    vi.restoreAllMocks();
  });

  it('action: "login" — muvaffaqiyatli kirish, sessiyani saqlash va ruxsatnomalarni qaytarish', async () => {
    const mockHeaders = new Headers();
    mockHeaders.set('x-oauth-scopes', 'repo, workflow');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      json: async () => ({
        login: 'developer_az',
        name: 'Senior Dev',
        avatar_url: 'https://github.com/developer_az.png',
        html_url: 'https://github.com/developer_az',
        public_repos: 12,
      }),
    });

    const res = await handleAuthGithubEndpoint({
      action: 'login',
      token: 'ghp_validToken1234567890abcdef1234567890',
      clientIp: 'test_client',
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('valid');
    expect(res.user?.login).toBe('developer_az');
    expect(res.permissions?.repo).toBe(true);
    expect(res.csrfToken).toBeDefined();

    // Dinamik omborda saqlanganligini tekshirish
    const saved = loadStoredGitHubSession();
    expect(saved?.username).toBe('developer_az');
  });

  it('action: "login" — XSS token kiritilganda rad etadi', async () => {
    const res = await handleAuthGithubEndpoint({
      action: 'login',
      token: '<script>alert(1)</script>ghp_test',
      clientIp: 'test_client',
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe('invalid');
    expect(res.message).toMatch(/XSS/i);
  });

  it('action: "login" — token berilmaganda rad etadi', async () => {
    const res = await handleAuthGithubEndpoint({
      action: 'login',
      clientIp: 'test_client',
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain('shart');
  });

  it('action: "login" — token stuffing blokirovkasi ishlaydi', async () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAuthAttempt('stuffing_client');
    }

    const res = await handleAuthGithubEndpoint({
      action: 'login',
      token: 'ghp_validToken1234567890abcdef1234567890',
      clientIp: 'stuffing_client',
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe('rate_limited');
    expect(res.message).toMatch(/Token stuffing/i);
  });

  it('action: "refresh" — mavjud sessiyani yangilaydi', async () => {
    const initialSession: GitHubAuthSession = {
      token: 'ghp_refreshMe1234567890abcdef1234567890',
      maskedToken: 'ghp_••••••••7890',
      username: 'dev_refresh',
      user: {
        login: 'dev_refresh',
        name: 'Dev',
        avatar_url: '',
        html_url: '',
        public_repos: 1,
      },
      scopes: ['public_repo'],
      permissions: parseGitHubScopes('public_repo'),
      status: 'valid',
      statusMessage: 'Ok',
      createdAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      expiresAt: null,
      authMethod: 'pat',
      checksum: '',
    };
    saveStoredGitHubSession(initialSession);

    const mockHeaders = new Headers();
    mockHeaders.set('x-oauth-scopes', 'repo, workflow');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      json: async () => ({
        login: 'dev_refresh',
        name: 'Dev Updated',
        avatar_url: '',
        html_url: '',
        public_repos: 2,
      }),
    });

    const res = await handleAuthGithubEndpoint({
      action: 'refresh',
      clientIp: 'test_client',
    });

    expect(res.success).toBe(true);
    expect(res.permissions?.repo).toBe(true);
    expect(res.permissions?.workflow).toBe(true);
  });

  it('action: "autologin" — saqlangan sessiyadan avtomatik tizimga kiradi', async () => {
    saveStoredGitHubSession({
      token: 'ghp_autologinToken1234567890abcdef123456',
      maskedToken: 'ghp_••••••••3456',
      username: 'autodev',
      user: {
        login: 'autodev',
        name: 'Auto Dev',
        avatar_url: '',
        html_url: '',
        public_repos: 3,
      },
      scopes: ['repo'],
      permissions: parseGitHubScopes('repo'),
      status: 'valid',
      statusMessage: 'Oldingi sessiya',
      createdAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      expiresAt: null,
      authMethod: 'pat',
      checksum: '',
    });

    const mockHeaders = new Headers();
    mockHeaders.set('x-oauth-scopes', 'repo');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      json: async () => ({
        login: 'autodev',
        name: 'Auto Dev',
        avatar_url: '',
        html_url: '',
        public_repos: 3,
      }),
    });

    const res = await handleAuthGithubEndpoint({ action: 'autologin' });
    expect(res.success).toBe(true);
    expect(res.user?.login).toBe('autodev');
    expect(res.message).toContain('Avtologin muvaffaqiyatli');
  });

  it('action: "autologin" — sessiya bo‘lmasa va gh CLI topilsa CLI orqali avtologin qiladi', async () => {
    vi.spyOn(ghCliDetector, 'detect').mockResolvedValue({
      is_installed: true,
      is_authenticated: true,
      username: 'cliautodev',
      token: 'ghp_cliToken1234567890abcdef123456789012',
    });

    const mockHeaders = new Headers();
    mockHeaders.set('x-oauth-scopes', 'repo');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      json: async () => ({
        login: 'cliautodev',
        name: 'CLI Auto Dev',
        avatar_url: '',
        html_url: '',
        public_repos: 5,
      }),
    });

    const res = await handleAuthGithubEndpoint({ action: 'autologin' });
    expect(res.success).toBe(true);
    expect(res.user?.login).toBe('cliautodev');
    expect(res.message).toContain('GitHub CLI orqali avtologin');
  });

  it('action: "check_permissions" — faol ruxsatnomalarni qaytaradi', async () => {
    saveStoredGitHubSession({
      token: 'ghp_permsToken1234567890abcdef1234567890',
      maskedToken: 'ghp_••••••••7890',
      username: 'permsdev',
      user: {
        login: 'permsdev',
        name: 'Perms Dev',
        avatar_url: '',
        html_url: '',
        public_repos: 1,
      },
      scopes: ['repo', 'issues'],
      permissions: parseGitHubScopes('repo, issues'),
      status: 'valid',
      statusMessage: 'Ok',
      createdAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      expiresAt: null,
      authMethod: 'pat',
      checksum: '',
    });

    const res = await handleAuthGithubEndpoint({ action: 'check_permissions' });
    expect(res.success).toBe(true);
    expect(res.permissions?.repo).toBe(true);
    expect(res.permissions?.issues).toBe(true);
  });

  it('action: "logout" — barcha ma’lumotlarni o‘chiradi', async () => {
    saveStoredGitHubSession({
      token: 'ghp_logoutToken1234567890abcdef123456789',
      maskedToken: 'ghp_••••••••6789',
      username: 'logoutdev',
      user: { login: 'logoutdev', name: '', avatar_url: '', html_url: '', public_repos: 0 },
      scopes: ['repo'],
      permissions: parseGitHubScopes('repo'),
      status: 'valid',
      statusMessage: '',
      createdAt: '',
      lastVerifiedAt: '',
      expiresAt: null,
      authMethod: 'pat',
      checksum: '',
    });

    const res = await handleAuthGithubEndpoint({ action: 'logout' });
    expect(res.success).toBe(true);
    expect(res.status).toBe('unauthenticated');
    expect(loadStoredGitHubSession()).toBeNull();
  });

  it('fetchGitHubAuthEndpoint bevosita handlerga fallback qiladi', async () => {
    const res = await fetchGitHubAuthEndpoint({ action: 'status' });
    expect(res).toBeDefined();
    expect(res.csrfToken).toBeDefined();
  });
});

describe('GitHub AI Auth — Davriy Heartbeat va Kesh Tozalash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    stopGitHubTokenHealthCheck();
    vi.useRealTimers();
  });

  it('belgilangan vaqt oralig‘ida tokenni tekshiradi va keshni yangilaydi', async () => {
    saveStoredGitHubSession({
      token: 'ghp_periodicToken1234567890abcdef12345678',
      maskedToken: 'ghp_••••••••5678',
      username: 'periodicdev',
      user: { login: 'periodicdev', name: '', avatar_url: '', html_url: '', public_repos: 0 },
      scopes: ['repo'],
      permissions: parseGitHubScopes('repo'),
      status: 'valid',
      statusMessage: 'Ok',
      createdAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      expiresAt: null,
      authMethod: 'pat',
      checksum: '',
    });

    const mockHeaders = new Headers();
    mockHeaders.set('x-oauth-scopes', 'repo');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      json: async () => ({
        login: 'periodicdev',
        name: 'Periodic Dev',
        avatar_url: '',
        html_url: '',
        public_repos: 0,
      }),
    });

    const onStatusChange = vi.fn();
    startGitHubTokenHealthCheck(1000, onStatusChange);

    await vi.advanceTimersByTimeAsync(1000);

    expect(onStatusChange).toHaveBeenCalledWith('valid', expect.stringContaining('muvaffaqiyatli o‘tdi'));
  });

  it('token bekor qilingan taqdirda xatoni qayd etadi va keshni tozalaydi', async () => {
    saveStoredGitHubSession({
      token: 'ghp_expiredToken1234567890abcdef12345678',
      maskedToken: 'ghp_••••••••5678',
      username: 'expireddev',
      user: { login: 'expireddev', name: '', avatar_url: '', html_url: '', public_repos: 0 },
      scopes: ['repo'],
      permissions: parseGitHubScopes('repo'),
      status: 'valid',
      statusMessage: 'Ok',
      createdAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      expiresAt: null,
      authMethod: 'pat',
      checksum: '',
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers(),
      text: async () => 'Bad credentials',
    });

    const onStatusChange = vi.fn();
    startGitHubTokenHealthCheck(1000, onStatusChange);

    await vi.advanceTimersByTimeAsync(1000);

    expect(onStatusChange).toHaveBeenCalledWith('invalid', expect.stringContaining('Bad credentials'));
    const session = loadStoredGitHubSession();
    expect(session?.status).toBe('invalid');
  });

  it('sessiya yoki token bo‘lmaganda heartbeat hech narsa qilmaydi', async () => {
    localStorage.clear();
    const onStatusChange = vi.fn();
    startGitHubTokenHealthCheck(1000, onStatusChange);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('purgeGitHubAuthCache xavfsiz tozalaydi', () => {
    localStorage.setItem('cognidev_gh_auth_cache', 'cache_data');
    purgeGitHubAuthCache();
    expect(localStorage.getItem('cognidev_gh_auth_cache')).toBeNull();
  });
});

describe('GitHub AI Auth — Qo‘shimcha Edge Cases & HTTP Bridge', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('fine-grained token (x-oauth-scopes bo‘sh) bo‘lsa avtomatik ruxsatlarni faol deb belgilaydi', async () => {
    const mockHeaders = new Headers();
    // No x-oauth-scopes header
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      json: async () => ({
        login: 'fine_grained_user',
        name: 'FG User',
        avatar_url: '',
        html_url: '',
        public_repos: 2,
      }),
    });

    const res = await verifyGitHubTokenWithApi('github_pat_11AAAA123456789012345678901234567890');
    expect(res.permissions.repo).toBe(true);
    expect(res.permissions.hasRequiredScopes).toBe(true);
  });

  it('login vaqtida CSRF mos kelmasa xatolik qaytaradi', async () => {
    generateCsrfToken();
    const res = await handleAuthGithubEndpoint({
      action: 'login',
      token: 'ghp_validToken1234567890abcdef1234567890',
      csrfToken: 'wrong_csrf_nonce',
      clientIp: 'test_csrf_ip',
    });
    expect(res.success).toBe(false);
    expect(res.status).toBe('invalid');
    expect(res.message).toMatch(/CSRF/i);
  });

  it('fetchGitHubAuthEndpoint forceNetwork bo‘lganda HTTP so‘rov orqali natija oladi', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        status: 'valid',
        message: 'Endpoint orqali tasdiqlandi ✓',
      }),
    });

    const res = await fetchGitHubAuthEndpoint({ action: 'status' }, {}, true);
    expect(res.success).toBe(true);
    expect(res.message).toContain('Endpoint orqali');
  });

  it('fetchGitHubAuthEndpoint forceNetwork da tarmoq xatoligi bo‘lsa ichki handlerga tushadi', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const res = await fetchGitHubAuthEndpoint({ action: 'status' }, {}, true);
    expect(res).toBeDefined();
    expect(res.csrfToken).toBeDefined();
  });

  it('detectGhCliAuth brauzer/test rejimida null qaytaradi', async () => {
    const { detectGhCliAuth } = await import('../lib/githubAuth');
    const res = await detectGhCliAuth();
    expect(res).toBeNull();
  });

  it('autologin sessiya ham, CLI ham bo‘lmaganda unauthenticated qaytaradi', async () => {
    localStorage.clear();
    vi.spyOn(ghCliDetector, 'detect').mockResolvedValue(null);
    const res = await handleAuthGithubEndpoint({ action: 'autologin' });
    expect(res.success).toBe(false);
    expect(res.status).toBe('unauthenticated');
  });

  it('check_permissions sessiya bo‘lmaganda unauthenticated qaytaradi', async () => {
    localStorage.clear();
    const res = await handleAuthGithubEndpoint({ action: 'check_permissions' });
    expect(res.success).toBe(false);
    expect(res.status).toBe('unauthenticated');
  });

  it('autologin saqlangan token yaroqsiz bo‘lganda uni tozalab CLI ga fallback qiladi', async () => {
    saveStoredGitHubSession({
      token: 'ghp_invalidSaved1234567890abcdef123456',
      maskedToken: 'ghp_••••••••3456',
      username: 'badsaved',
      user: { login: 'badsaved', name: '', avatar_url: '', html_url: '', public_repos: 0 },
      scopes: ['repo'],
      permissions: parseGitHubScopes('repo'),
      status: 'valid',
      statusMessage: '',
      createdAt: '',
      lastVerifiedAt: '',
      expiresAt: null,
      authMethod: 'pat',
      checksum: '',
    });

    // Stored token fails verification with 401
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers(),
      text: async () => 'Bad credentials',
    });

    vi.spyOn(ghCliDetector, 'detect').mockResolvedValue(null);

    const res = await handleAuthGithubEndpoint({ action: 'autologin' });
    expect(res.success).toBe(false);
    expect(loadStoredGitHubSession()).toBeNull();
  });

  it('verifyGitHubTokenWithApi 500 xatolikda NETWORK_ERROR xabarini beradi', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      text: async () => 'GitHub service down',
    });

    await expect(verifyGitHubTokenWithApi('ghp_testToken1234567890abcdef12345678')).rejects.toThrowError(
      /aloqa o‘rnatib bo‘lmadi/i
    );
  });

  it('refresh sessiya ham, token ham bo‘lmaganda unauthenticated qaytaradi', async () => {
    localStorage.clear();
    const res = await handleAuthGithubEndpoint({ action: 'refresh' });
    expect(res.success).toBe(false);
    expect(res.status).toBe('unauthenticated');
  });

  it('status sessiya mavjud bo‘lganda to‘liq status va maskalangan tokenni qaytaradi', async () => {
    saveStoredGitHubSession({
      token: 'ghp_myActiveToken1234567890abcdef123456',
      maskedToken: 'ghp_••••••••3456',
      username: 'active_coder',
      user: {
        login: 'active_coder',
        name: 'Active Coder',
        avatar_url: '',
        html_url: '',
        public_repos: 10,
      },
      scopes: ['repo'],
      permissions: parseGitHubScopes('repo'),
      status: 'valid',
      statusMessage: 'Faol ulanish ✓',
      createdAt: '',
      lastVerifiedAt: '',
      expiresAt: null,
      authMethod: 'pat',
      checksum: '',
    });

    const res = await handleAuthGithubEndpoint({ action: 'status' });
    expect(res.success).toBe(true);
    expect(res.user?.login).toBe('active_coder');
    expect(res.permissions?.repo).toBe(true);
    expect(res.maskedToken).toBe('ghp_••••••••3456');
  });

  it('handleAuthGithubEndpoint kutilmagan xatolikni ushlab failedAttempt ga yozadi', async () => {
    globalThis.fetch = vi.fn().mockImplementationOnce(() => {
      throw new Error('Fatal network crash');
    });

    const res = await handleAuthGithubEndpoint({ action: 'login', token: 'ghp_test1234567890abcdef1234567890' });
    expect(res.success).toBe(false);
    expect(res.status).toBe('invalid');
    expect(res.message).toContain('Fatal network crash');
  });
});
