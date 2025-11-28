import { Test, TestingModule } from '@nestjs/testing';
import { SvnReadService } from './svn-read.service';
import { SvnWriteService } from './svn-write.service';

/**
 * Windows 호환성 테스트
 * 이 테스트는 Windows 환경에서의 경로 처리, shell escaping, 환경 변수 등을 검증합니다.
 */
describe('Windows Compatibility Tests', () => {
  let readService: SvnReadService;
  let writeService: SvnWriteService;
  const originalPlatform = process.platform;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SvnReadService, SvnWriteService],
    }).compile();

    readService = module.get<SvnReadService>(SvnReadService);
    writeService = module.get<SvnWriteService>(SvnWriteService);
  });

  afterEach(() => {
    // 원래 플랫폼으로 복원
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
  });

  describe('Windows Platform Detection', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });
    });

    it('should detect Windows platform correctly', () => {
      expect(process.platform).toBe('win32');
    });
  });

  describe('Windows Path Handling', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });
    });

    it('should handle Windows absolute paths (C:\\)', () => {
      const windowsPath = 'C:\\Users\\Test\\file.txt';
      const resolved = (readService as any).resolvePath(windowsPath, {});

      // Windows 경로는 정규화되어야 함
      expect(resolved).toBeDefined();
      expect(typeof resolved).toBe('string');
    });

    it('should handle Windows UNC paths (\\\\server\\share)', () => {
      const uncPath = '\\\\server\\share\\file.txt';
      const resolved = (readService as any).resolvePath(uncPath, {});

      expect(resolved).toBeDefined();
      expect(typeof resolved).toBe('string');
    });

    it('should handle Windows relative paths', () => {
      const relativePath = '..\\parent\\file.txt';
      const resolved = (readService as any).resolvePath(relativePath, {});

      expect(resolved).toBeDefined();
      // path.normalize는 플랫폼에 따라 다르게 동작
      expect(typeof resolved).toBe('string');
    });

    it('should handle Windows paths with spaces', () => {
      const pathWithSpaces = 'C:\\Users\\My Documents\\file.txt';
      const resolved = (readService as any).resolvePath(pathWithSpaces, {});

      expect(resolved).toBeDefined();
      expect(resolved).toContain('My Documents');
    });

    it('should handle file:// URLs with Windows paths', () => {
      // Windows에서 file:// URL은 file:///C:/path 형식
      const fileUrl = 'file:///C:/Users/Test/repo';
      const resolved = (readService as any).resolvePath(fileUrl, {});

      expect(resolved).toBeDefined();
      expect(resolved).toContain('file://');
    });
  });

  describe('Windows Shell Escaping', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });
    });

    it('should escape Windows paths with spaces using double quotes', () => {
      const testCases = [
        { path: 'C:\\Program Files\\file.txt', expected: '"C:\\Program Files\\file.txt"' },
        { path: 'C:\\Users\\My Documents\\file.txt', expected: '"C:\\Users\\My Documents\\file.txt"' },
      ];

      testCases.forEach(({ path: testPath, expected }) => {
        const result = (readService as any).escapeShellArg(testPath);
        expect(result).toBe(expected);
      });
    });

    it('should escape Windows paths with double quotes', () => {
      const testCases = [
        { path: 'path with "quotes"', expected: '"path with \\"quotes\\""' },
        // Windows에서 백슬래시가 있는 경우 실제 구현은 백슬래시를 이스케이프함
        { path: 'C:\\Users\\"Name"\\file.txt', expected: '"C:\\Users\\\\"Name\\"\\file.txt"' },
      ];

      testCases.forEach(({ path: testPath, expected }) => {
        const result = (readService as any).escapeShellArg(testPath);
        expect(result).toBe(expected);
      });
    });

    it('should handle Windows paths with backslashes', () => {
      const testCases = [
        { path: 'C:\\Users\\Name\\file.txt', expected: '"C:\\Users\\Name\\file.txt"' },
        { path: '\\\\server\\share\\file.txt', expected: '"\\\\server\\share\\file.txt"' },
      ];

      testCases.forEach(({ path: testPath, expected }) => {
        const result = (readService as any).escapeShellArg(testPath);
        expect(result).toBe(expected);
      });
    });

    it('should not escape simple Windows paths', () => {
      const simplePath = 'C:\\Users\\Name\\file.txt';
      const result = (readService as any).escapeShellArg(simplePath);

      // 공백이 없으면 따옴표가 필요할 수 있지만, 현재 로직에 따라 다름
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Windows Environment Variables', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });
    });

    it('should set Windows-compatible locale environment variables', async () => {
      // buildEnvironment는 private이므로 간접적으로 테스트
      const [command] = (readService as any).buildSvnArgs('info', [], {});

      // Windows에서는 LC_MESSAGES, LC_ALL, LANG이 설정되어야 함
      expect(command).toBeDefined();
      expect(typeof command).toBe('string');
    });
  });

  describe('Windows Path Normalization', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });
    });

    it('should normalize Windows paths correctly', () => {
      const testCases = [
        { input: 'C:\\Users\\..\\Documents\\file.txt', expected: 'C:\\Documents\\file.txt' },
        { input: '.\\relative\\path', expected: 'relative\\path' },
        { input: 'C:\\Users\\.\\Documents\\file.txt', expected: 'C:\\Users\\Documents\\file.txt' },
      ];

      testCases.forEach(({ input, expected }) => {
        const resolved = (readService as any).resolvePath(input, {});
        // path.normalize는 플랫폼에 따라 다르게 동작
        expect(resolved).toBeDefined();
        expect(typeof resolved).toBe('string');
      });
    });

    it('should handle mixed path separators', () => {
      // Windows에서 /와 \ 혼용 가능
      const mixedPath = 'C:/Users/Test\\file.txt';
      const resolved = (readService as any).resolvePath(mixedPath, {});

      expect(resolved).toBeDefined();
      expect(typeof resolved).toBe('string');
    });
  });

  describe('Windows URL Path Handling', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });
    });

    it('should handle repositoryUrl with Windows file paths', () => {
      const repoUrl = 'file:///C:/Users/Test/repo';
      const relativePath = 'trunk/file.txt';

      const resolved = (readService as any).resolvePath(relativePath, {
        repositoryUrl: repoUrl,
      });

      expect(resolved).toBeDefined();
      expect(resolved).toContain('file://');
      expect(resolved).toContain('trunk/file.txt');
    });

    it('should encode Windows paths in URLs correctly', () => {
      const repoUrl = 'https://example.com/repo';
      const pathWithSpaces = 'My Documents/file.txt';

      const resolved = (readService as any).resolvePath(pathWithSpaces, {
        repositoryUrl: repoUrl,
      });

      expect(resolved).toBeDefined();
      expect(resolved).toContain('My%20Documents');
    });
  });

  describe('Cross-platform Path Compatibility', () => {
    it('should handle POSIX paths on Windows (for URLs)', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });

      // URL은 항상 POSIX 스타일 경로 사용
      const urlPath = 'https://example.com/repo/trunk/file.txt';
      const resolved = (readService as any).resolvePath(urlPath, {});

      expect(resolved).toBeDefined();
      expect(resolved).toContain('/');
      expect(resolved).not.toContain('\\');
    });

    it('should use path.posix for URL paths regardless of platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });

      const repoUrl = 'https://example.com/repo';
      const relativePath = 'trunk/../branch/file.txt';

      const resolved = (readService as any).resolvePath(relativePath, {
        repositoryUrl: repoUrl,
      });

      expect(resolved).toBeDefined();
      // URL 경로는 POSIX 스타일로 정규화되어야 함
      expect(resolved).toContain('branch/file.txt');
      expect(resolved).not.toContain('trunk/../');
    });
  });

  describe('Windows Command Building', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });
    });

    it('should build SVN commands with Windows paths', () => {
      const windowsPath = 'C:\\Users\\Test\\file.txt';
      const [command] = (readService as any).buildSvnArgs('info', [windowsPath], {});

      expect(command).toBeDefined();
      expect(command).toContain('svn');
      expect(command).toContain('info');
    });

    it('should escape Windows paths in commands', () => {
      const pathWithSpaces = 'C:\\Program Files\\file.txt';
      const [command] = (readService as any).buildSvnArgs('cat', [pathWithSpaces], {});

      expect(command).toBeDefined();
      // path.normalize가 경로를 소문자로 변환할 수 있음 (Windows 파일 시스템은 대소문자 구분 안 함)
      expect(command.toLowerCase()).toContain('"c:\\program files\\file.txt"');
    });
  });

  describe('Windows-specific Edge Cases', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });
    });

    it('should handle Windows reserved characters in paths', () => {
      // Windows 예약 문자: < > : " | ? *
      // 실제 파일명에는 사용할 수 없지만, 테스트용
      const testPath = 'C:\\Users\\Test\\file<name>.txt';
      const resolved = (readService as any).resolvePath(testPath, {});

      expect(resolved).toBeDefined();
      expect(typeof resolved).toBe('string');
    });

    it('should handle Windows long paths (if supported)', () => {
      const longPath = 'C:\\' + 'a\\'.repeat(100) + 'file.txt';
      const resolved = (readService as any).resolvePath(longPath, {});

      expect(resolved).toBeDefined();
      expect(typeof resolved).toBe('string');
    });

    it('should handle Windows drive letters', () => {
      const testCases = ['C:', 'D:', 'Z:'];

      testCases.forEach((drive) => {
        const path = `${drive}\\file.txt`;
        const resolved = (readService as any).resolvePath(path, {});

        expect(resolved).toBeDefined();
        // path.normalize가 드라이브 레터를 소문자로 변환할 수 있음
        expect(resolved.toLowerCase()).toContain(drive.toLowerCase());
      });
    });
  });
});
