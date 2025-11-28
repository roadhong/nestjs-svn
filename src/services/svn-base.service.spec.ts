import { Test, TestingModule } from '@nestjs/testing';
import { SvnReadService } from './svn-read.service';
import { SvnWriteService } from './svn-write.service';
import { join } from 'path';
import { promises as fs } from 'fs';
import { rmSync, mkdirSync } from 'fs';

describe('SvnBaseService Path Handling', () => {
  let readService: SvnReadService;
  let writeService: SvnWriteService;
  const testRepoUrl = `file://${join(process.cwd(), 'svn-test')}`;
  const testCheckoutPath = join(process.cwd(), 'svn-test-checkout-path-test');

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SvnReadService, SvnWriteService],
    }).compile();

    readService = module.get<SvnReadService>(SvnReadService);
    writeService = module.get<SvnWriteService>(SvnWriteService);
  });

  afterAll(async () => {
    try {
      rmSync(testCheckoutPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('resolvePath and escapeShellArg', () => {
    describe('Platform-specific escaping', () => {
      const originalPlatform = process.platform;

      afterEach(() => {
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
          writable: true,
          configurable: true,
        });
      });

      describe('Unix/Linux/macOS (single quotes)', () => {
        beforeEach(() => {
          Object.defineProperty(process, 'platform', {
            value: 'linux',
            writable: true,
            configurable: true,
          });
        });

        it('should escape paths with spaces using single quotes', () => {
          const testCases = [
            { path: 'path with spaces', expected: "'path with spaces'" },
            { path: '/path/to/file with spaces.txt', expected: "'/path/to/file with spaces.txt'" },
          ];

          testCases.forEach(({ path, expected }) => {
            const result = (readService as any).escapeShellArg(path);
            expect(result).toBe(expected);
          });
        });

        it('should escape paths with single quotes correctly', () => {
          const testCases = [
            { path: "Genie's Dream", expected: "'Genie'\\''s Dream'" },
            { path: "It's a test's path", expected: "'It'\\''s a test'\\''s path'" },
          ];

          testCases.forEach(({ path, expected }) => {
            const result = (readService as any).escapeShellArg(path);
            expect(result).toBe(expected);
          });
        });
      });

      describe('Windows (double quotes)', () => {
        beforeEach(() => {
          Object.defineProperty(process, 'platform', {
            value: 'win32',
            writable: true,
            configurable: true,
          });
        });

        it('should escape paths with spaces using double quotes', () => {
          const testCases = [
            { path: 'path with spaces', expected: '"path with spaces"' },
            { path: 'C:\\Users\\Name\\file with spaces.txt', expected: '"C:\\Users\\Name\\file with spaces.txt"' },
          ];

          testCases.forEach(({ path, expected }) => {
            const result = (readService as any).escapeShellArg(path);
            expect(result).toBe(expected);
          });
        });

        it('should escape paths with double quotes correctly', () => {
          const testCases = [
            { path: 'path with "quotes"', expected: '"path with \\"quotes\\""' },
            // Windows: backslashes before quotes need to be escaped
            { path: 'C:\\Users\\"Name"\\file.txt', expected: '"C:\\Users\\\\"Name\\"\\file.txt"' },
          ];

          testCases.forEach(({ path, expected }) => {
            const result = (readService as any).escapeShellArg(path);
            expect(result).toBe(expected);
          });
        });

        it('should handle Windows paths correctly', () => {
          const testCases = [
            { path: 'C:\\Users\\Name\\file.txt', expected: '"C:\\Users\\Name\\file.txt"' },
            { path: 'C:\\Users\\Name\\file with spaces.txt', expected: '"C:\\Users\\Name\\file with spaces.txt"' },
            { path: '\\\\server\\share\\file.txt', expected: '"\\\\server\\share\\file.txt"' },
          ];

          testCases.forEach(({ path, expected }) => {
            const result = (readService as any).escapeShellArg(path);
            expect(result).toBe(expected);
          });
        });
      });
    });

    it('should resolve paths correctly', () => {
      const testCases = [
        { path: 'test/path', options: {}, expected: 'test/path' },
        { path: '/', options: { repositoryUrl: 'https://example.com/repo' }, expected: 'https://example.com/repo' },
        { path: 'test/path', options: { repositoryUrl: 'https://example.com/repo' }, expected: 'https://example.com/repo/test/path' },
        { path: '/test/path', options: { repositoryUrl: 'https://example.com/repo' }, expected: 'https://example.com/repo/test/path' },
        { path: './test/path', options: { repositoryUrl: 'https://example.com/repo' }, expected: 'https://example.com/repo/test/path' },
        { path: 'https://example.com/repo/test/path', options: {}, expected: 'https://example.com/repo/test/path' },
        {
          path: '486_MjölnirJackpot',
          options: { repositoryUrl: 'https://example.com/repo/Sound' },
          expected: 'https://example.com/repo/Sound/486_Mj%C3%B6lnirJackpot',
        },
        { path: 'https://example.com/repo/Sound/486_MjölnirJackpot', options: {}, expected: 'https://example.com/repo/Sound/486_Mj%C3%B6lnirJackpot' },
        { path: 'path/with/äöü', options: { repositoryUrl: 'https://example.com/repo' }, expected: 'https://example.com/repo/path/with/%C3%A4%C3%B6%C3%BC' },
        {
          path: '330_Mole&amp;More',
          options: { repositoryUrl: 'https://example.com/repo/Design' },
          expected: 'https://example.com/repo/Design/330_Mole%26More',
        },
        { path: 'https://example.com/repo/Design/330_Mole&amp;More', options: {}, expected: 'https://example.com/repo/Design/330_Mole%26More' },
      ];

      testCases.forEach(({ path, options, expected }) => {
        const result = (readService as any).resolvePath(path, options);
        expect(result).toBe(expected);
      });
    });

    it('should escape simple paths correctly (no escaping needed)', () => {
      const testCases = [
        { path: 'simple-path', expected: 'simple-path' },
        { path: 'my-project-name', expected: 'my-project-name' },
        { path: 'my_project_name', expected: 'my_project_name' },
        { path: 'file.name.txt', expected: 'file.name.txt' },
        { path: '/usr/local/bin/file.txt', expected: '/usr/local/bin/file.txt' },
        { path: './src/file.ts', expected: './src/file.ts' },
        { path: 'path=with=equals', expected: 'path=with=equals' },
        { path: 'path@with@at', expected: 'path@with@at' },
        { path: 'https://example.com/path', expected: 'https://example.com/path' },
        { path: 'file:///path/to/repo', expected: 'file:///path/to/repo' },
        { path: 'https://example.com:8080/path', expected: 'https://example.com:8080/path' },
        { path: 'path%20with%20spaces', expected: 'path%20with%20spaces' },
        { path: '', expected: '' },
        { path: 'a'.repeat(1000), expected: 'a'.repeat(1000) },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = (readService as any).escapeShellArg(path);
        expect(result).toBe(expected);
      });
    });

    it('should escape paths with spaces correctly', () => {
      const isWindows = process.platform === 'win32';
      const testCases = isWindows
        ? [
            { path: 'path with spaces', expected: '"path with spaces"' },
            { path: 'path  with   multiple    spaces', expected: '"path  with   multiple    spaces"' },
            { path: ' path with spaces ', expected: '" path with spaces "' },
            { path: '/path/to/file with spaces.txt', expected: '"/path/to/file with spaces.txt"' },
            { path: '   ', expected: '"   "' },
          ]
        : [
            { path: 'path with spaces', expected: "'path with spaces'" },
            { path: 'path  with   multiple    spaces', expected: "'path  with   multiple    spaces'" },
            { path: ' path with spaces ', expected: "' path with spaces '" },
            { path: '/path/to/file with spaces.txt', expected: "'/path/to/file with spaces.txt'" },
            { path: '   ', expected: "'   '" },
          ];

      testCases.forEach(({ path, expected }) => {
        const result = (readService as any).escapeShellArg(path);
        expect(result).toBe(expected);
      });
    });

    it('should escape paths with quotes correctly', () => {
      const isWindows = process.platform === 'win32';
      const testCases = isWindows
        ? [
            { path: "Genie's Dream", expected: '"Genie\'s Dream"' },
            { path: "It's a test's path", expected: '"It\'s a test\'s path"' },
            { path: 'path with "quotes"', expected: '"path with \\"quotes\\""' },
            { path: 'C:\\Users\\"Name"\\file.txt', expected: '"C:\\Users\\"Name"\\file.txt"' },
          ]
        : [
            { path: "Genie's Dream", expected: "'Genie'\\''s Dream'" },
            { path: "It's a test's path", expected: "'It'\\''s a test'\\''s path'" },
            { path: "'start with quote", expected: "''\\''start with quote'" },
            { path: "end with quote'", expected: "'end with quote'\\'''" },
            { path: "''", expected: "''\\'''\\'''" },
            { path: "/path/to/file's name.txt", expected: "'/path/to/file'\\''s name.txt'" },
            { path: "https://example.com/repo/Genie's Dream/Mobile", expected: "'https://example.com/repo/Genie'\\''s Dream/Mobile'" },
          ];

      testCases.forEach(({ path, expected }) => {
        const result = (readService as any).escapeShellArg(path);
        expect(result).toBe(expected);
      });
    });

    it('should escape file paths with special characters correctly', () => {
      const isWindows = process.platform === 'win32';
      const testCases = isWindows
        ? [
            { path: '/path/to/file(name).txt', expected: '"/path/to/file(name).txt"' },
            { path: 'C:\\Users\\Name\\file.txt', expected: 'C:\\Users\\Name\\file.txt' },
            { path: 'C:\\Users\\Name\\file(name).txt', expected: '"C:\\Users\\Name\\file(name).txt"' },
          ]
        : [
            { path: '/path/to/file(name).txt', expected: "'/path/to/file(name).txt'" },
            { path: 'C:\\Users\\Name\\file.txt', expected: "'C:\\Users\\Name\\file.txt'" },
          ];

      testCases.forEach(({ path, expected }) => {
        const result = (readService as any).escapeShellArg(path);
        expect(result).toBe(expected);
      });
    });

    it('should escape paths with special characters correctly', () => {
      const isWindows = process.platform === 'win32';
      const quote = isWindows ? '"' : "'";
      const testCases = [
        { path: 'path & special', expected: `${quote}path & special${quote}` },
        { path: 'path!special', expected: `${quote}path!special${quote}` },
        { path: 'path (with) parentheses', expected: `${quote}path (with) parentheses${quote}` },
        { path: 'path [with] brackets', expected: `${quote}path [with] brackets${quote}` },
        { path: 'path {with} braces', expected: `${quote}path {with} braces${quote}` },
        { path: 'path*with*asterisk', expected: `${quote}path*with*asterisk${quote}` },
        { path: 'path?with?question', expected: `${quote}path?with?question${quote}` },
        { path: 'path#with#hash', expected: `${quote}path#with#hash${quote}` },
        { path: 'path+with+plus', expected: `${quote}path+with+plus${quote}` },
        { path: 'path|with|pipe', expected: `${quote}path|with|pipe${quote}` },
        { path: 'path;with;semicolon', expected: `${quote}path;with;semicolon${quote}` },
        { path: 'path`with`backtick', expected: `${quote}path\`with\`backtick${quote}` },
        { path: 'path$with$dollar', expected: `${quote}path$with$dollar${quote}` },
        { path: 'path~with~tilde', expected: `${quote}path~with~tilde${quote}` },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = (readService as any).escapeShellArg(path);
        expect(result).toBe(expected);
      });
    });

    it('should escape URLs with special characters correctly', () => {
      const isWindows = process.platform === 'win32';
      const quote = isWindows ? '"' : "'";
      const testCases = [{ path: 'https://example.com/path?param=value', expected: `${quote}https://example.com/path?param=value${quote}` }];

      testCases.forEach(({ path, expected }) => {
        const result = (readService as any).escapeShellArg(path);
        expect(result).toBe(expected);
      });
    });

    it('should escape paths with unicode characters correctly', () => {
      const isWindows = process.platform === 'win32';
      const quote = isWindows ? '"' : "'";
      const testCases = [
        { path: '한글/경로/파일.txt', expected: `${quote}한글/경로/파일.txt${quote}` },
        { path: '中文/路径/文件.txt', expected: `${quote}中文/路径/文件.txt${quote}` },
        { path: '日本語/パス/ファイル.txt', expected: `${quote}日本語/パス/ファイル.txt${quote}` },
        { path: 'path/with/😀/emoji', expected: `${quote}path/with/😀/emoji${quote}` },
        { path: '86_MjölnirJackpot', expected: `${quote}86_MjölnirJackpot${quote}` },
        { path: 'path/with/äöü', expected: `${quote}path/with/äöü${quote}` },
        { path: 'Åland/Islands', expected: `${quote}Åland/Islands${quote}` },
        { path: 'Café/München', expected: `${quote}Café/München${quote}` },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = (readService as any).escapeShellArg(path);
        expect(result).toBe(expected);
      });
    });

    it('should escape edge case paths correctly', () => {
      const isWindows = process.platform === 'win32';
      const quote = isWindows ? '"' : "'";
      const testCases = [
        { path: 'path\nwith\nnewline', expected: `${quote}path\nwith\nnewline${quote}` },
        { path: 'path\twith\ttab', expected: `${quote}path\twith\ttab${quote}` },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = (readService as any).escapeShellArg(path);
        expect(result).toBe(expected);
      });
    });
  });

  describe('buildSvnArgs with path arrays', () => {
    describe('single path', () => {
      it('should escape path with spaces in command', () => {
        const isWindows = process.platform === 'win32';
        const quote = isWindows ? '"' : "'";
        const [command] = (readService as any).buildSvnArgs('list', ['path with spaces'], {});
        expect(command).toContain(`${quote}path with spaces${quote}`);
      });

      it('should escape path with quotes in command', () => {
        const isWindows = process.platform === 'win32';
        const [command] = (readService as any).buildSvnArgs('list', ["Genie's Dream"], {});
        if (isWindows) {
          expect(command).toContain('"Genie\'s Dream"');
        } else {
          expect(command).toContain("'Genie'\\''s Dream'");
        }
      });

      it('should escape URL with special characters', () => {
        const isWindows = process.platform === 'win32';
        const quote = isWindows ? '"' : "'";
        const url = "https://example.com/repo/Genie's Dream/Mobile";
        const [command] = (readService as any).buildSvnArgs('list', [url], {});
        if (isWindows) {
          expect(command).toContain('"https://example.com/repo/Genie\'s%20Dream/Mobile"');
        } else {
          expect(command).toContain("'https://example.com/repo/Genie'\\''s%20Dream/Mobile'");
        }
      });

      it('should handle file path with spaces', () => {
        const isWindows = process.platform === 'win32';
        const quote = isWindows ? '"' : "'";
        const path = '/path/to/file with spaces.txt';
        const [command] = (readService as any).buildSvnArgs('cat', [path], {});
        expect(command).toContain(`${quote}/path/to/file with spaces.txt${quote}`);
      });

      it('should handle Korean path', () => {
        const isWindows = process.platform === 'win32';
        const quote = isWindows ? '"' : "'";
        const path = '한글/경로/파일.txt';
        const [command] = (readService as any).buildSvnArgs('list', [path], {});
        expect(command).toContain(`${quote}${path}${quote}`);
      });
    });

    describe('multiple paths', () => {
      it('should handle multiple paths with special characters', () => {
        const isWindows = process.platform === 'win32';
        const quote = isWindows ? '"' : "'";
        const paths = ['path with spaces', "another'path"];
        const [command] = (readService as any).buildSvnArgs('diff', paths, {});
        expect(command).toContain(`${quote}path with spaces${quote}`);
        if (isWindows) {
          expect(command).toContain('"another\'path"');
        } else {
          expect(command).toContain("'another'\\''path'");
        }
      });

      it('should handle multiple file paths', () => {
        const paths = ['/path/to/file1.txt', '/path/to/file2.txt'];
        const [command] = (readService as any).buildSvnArgs('diff', paths, {});
        expect(paths.forEach((p) => expect(command).toContain(p)));
      });

      it('should handle multiple paths with spaces', () => {
        const paths = ['path one', 'path two', 'path three'];
        const [command] = (readService as any).buildSvnArgs('diff', paths, {});
        paths.forEach((p) => {
          expect(command).toContain(`'${p}'`);
        });
      });

      it('should handle multiple paths with quotes', () => {
        const paths = ["Genie's Dream", "Builder's Path", "User's File"];
        const [command] = (readService as any).buildSvnArgs('diff', paths, {});
        expect(command).toContain("'Genie'\\''s Dream'");
        expect(command).toContain("'Builder'\\''s Path'");
        expect(command).toContain("'User'\\''s File'");
      });

      it('should handle mix of simple and complex paths', () => {
        const paths = ['simple-path', 'path with spaces', "path'with'quotes"];
        const [command] = (readService as any).buildSvnArgs('diff', paths, {});
        expect(command).toContain('simple-path');
        expect(command).toContain("'path with spaces'");
        expect(command).toContain("'path'\\''with'\\''quotes'");
      });

      it('should handle multiple URLs', () => {
        const urls = ["https://example.com/repo/Genie's Dream", "https://example.com/repo/Builder's Path"];
        const [command] = (readService as any).buildSvnArgs('diff', urls, {});
        expect(command).toContain("'https://example.com/repo/Genie'\\''s%20Dream'");
        expect(command).toContain("'https://example.com/repo/Builder'\\''s%20Path'");
      });

      it('should handle array with empty strings', () => {
        const paths = ['valid-path', '', 'another-path'];
        const [command] = (readService as any).buildSvnArgs('diff', paths, {});
        expect(command).toContain('valid-path');
        expect(command).toContain('another-path');
      });

      it('should handle large array of paths', () => {
        const paths = Array.from({ length: 10 }, (_, i) => `path${i} with spaces`);
        const [command] = (readService as any).buildSvnArgs('diff', paths, {});
        paths.forEach((p) => {
          expect(command).toContain(`'${p}'`);
        });
      });
    });

    describe('paths with repositoryUrl', () => {
      it('should resolve relative paths with repositoryUrl', () => {
        const paths = ['relative/path1', 'relative/path2'];
        const [command] = (readService as any).buildSvnArgs('diff', paths, {
          repositoryUrl: 'https://example.com/repo',
        });
        expect(command).toContain('https://example.com/repo/relative/path1');
        expect(command).toContain('https://example.com/repo/relative/path2');
      });

      it('should resolve paths with spaces and repositoryUrl', () => {
        const paths = ['path with spaces'];
        const [command] = (readService as any).buildSvnArgs('list', paths, {
          repositoryUrl: 'https://example.com/repo',
        });
        expect(command).toContain('https://example.com/repo/path%20with%20spaces');
      });

      it('should resolve paths with quotes and repositoryUrl', () => {
        const paths = ["Genie's Dream"];
        const [command] = (readService as any).buildSvnArgs('list', paths, {
          repositoryUrl: 'https://example.com/repo',
        });
        expect(command).toContain("'https://example.com/repo/Genie'\\''s%20Dream'");
      });
    });

    describe('real-world scenarios', () => {
      it('should handle game project paths', () => {
        const paths = ['269_Mine Blast Jackpot/Mobile', '270_The Masked Goddess/Mobile', '271_bingo/Mobile'];
        const [command] = (readService as any).buildSvnArgs('list', paths, {
          repositoryUrl: 'https://example.com/repo',
        });
        expect(command).toContain('https://example.com/repo/269_Mine%20Blast%20Jackpot/Mobile');
        expect(command).toContain('https://example.com/repo/270_The%20Masked%20Goddess/Mobile');
        expect(command).toContain('https://example.com/repo/271_bingo/Mobile');
      });

      it('should handle paths with various special characters', () => {
        const paths = ['path with spaces', "path'with'quotes", 'path(with)parentheses', 'path[with]brackets', 'path{with}braces', 'path&with&ampersand'];
        const [command] = (readService as any).buildSvnArgs('diff', paths, {});
        expect(command).toContain("'path with spaces'");
        expect(command).toContain("'path'\\''with'\\''quotes'");
        expect(command).toContain("'path(with)parentheses'");
        expect(command).toContain("'path[with]brackets'");
        expect(command).toContain("'path{with}braces'");
        expect(command).toContain("'path&with&ampersand'");
      });

      it('should handle mixed file and directory paths', () => {
        const paths = ['/absolute/path/to/file.txt', './relative/path/to/file.txt', 'simple-file.txt', "file'with'quotes.txt"];
        const [command] = (readService as any).buildSvnArgs('add', paths, {});
        expect(command).toContain('/absolute/path/to/file.txt');
        // path.normalize() removes ./ prefix, so check for normalized path
        expect(command).toContain('relative/path/to/file.txt');
        expect(command).toContain('simple-file.txt');
        expect(command).toContain("'file'\\''with'\\''quotes.txt'");
      });
    });
  });

  describe('SVN path recognition integration tests', () => {
    beforeAll(async () => {
      try {
        rmSync(testCheckoutPath, { recursive: true, force: true });
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch {
        // Ignore
      }

      try {
        mkdirSync(join(testCheckoutPath, '..'), { recursive: true });
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch {
        // Ignore
      }

      const checkoutResult = await writeService.checkout(testRepoUrl, testCheckoutPath);
      if (!checkoutResult.success) {
        console.warn('Checkout failed, some tests may be skipped');
      }
    });

    afterAll(async () => {
      try {
        rmSync(testCheckoutPath, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });

    describe('paths with spaces', () => {
      it('should recognize path with spaces in list command', async () => {
        const testDir = join(testCheckoutPath, 'path with spaces');
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(join(testDir, 'test.txt'), 'test content');

        await writeService.add([testDir]);
        const result = await readService.list(testDir);

        expect(Array.isArray(result)).toBe(true);
      });

      it('should recognize path with spaces in info command', async () => {
        const testDir = join(testCheckoutPath, 'path with spaces');
        const info = await readService.info(testDir);

        expect(info).not.toBeNull();
        if (info) {
          expect(info.path).toBeDefined();
        }
      });
    });

    describe('paths with quotes', () => {
      it('should recognize path with single quotes', async () => {
        const testDir = join(testCheckoutPath, "Genie's Dream");
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(join(testDir, 'test.txt'), 'test content');

        await writeService.add([testDir]);
        const result = await readService.list(testDir);

        expect(Array.isArray(result)).toBe(true);
      });

      it('should recognize path with multiple quotes', async () => {
        const testDir = join(testCheckoutPath, "It's a test's path");
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(join(testDir, 'test.txt'), 'test content');

        await writeService.add([testDir]);
        const info = await readService.info(testDir);

        expect(info).not.toBeNull();
      });
    });

    describe('paths with special characters', () => {
      it('should recognize path with parentheses', async () => {
        const testDir = join(testCheckoutPath, 'path(with)parentheses');
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(join(testDir, 'test.txt'), 'test content');

        await writeService.add([testDir]);
        const result = await readService.list(testDir);

        expect(Array.isArray(result)).toBe(true);
      });

      it('should recognize path with brackets', async () => {
        const testDir = join(testCheckoutPath, 'path[with]brackets');
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(join(testDir, 'test.txt'), 'test content');

        await writeService.add([testDir]);
        const info = await readService.info(testDir);

        expect(info).not.toBeNull();
      });

      it('should recognize path with ampersand', async () => {
        const testDir = join(testCheckoutPath, 'path&with&ampersand');
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(join(testDir, 'test.txt'), 'test content');

        await writeService.add([testDir]);
        const result = await readService.list(testDir);

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('paths with repositoryUrl', () => {
      it('should recognize relative path with repositoryUrl', async () => {
        const result = await readService.list('trunk', {
          repositoryUrl: testRepoUrl,
        });

        expect(Array.isArray(result)).toBe(true);
      });

      it('should recognize relative path with spaces and repositoryUrl', async () => {
        const testDir = 'path with spaces';
        await writeService.mkdir([join(testCheckoutPath, testDir)]);

        const result = await readService.list(testDir, {
          repositoryUrl: testRepoUrl,
        });

        expect(Array.isArray(result)).toBe(true);
      });

      it('should recognize relative path with quotes and repositoryUrl', async () => {
        const testDir = "Genie's Dream";
        await writeService.mkdir([join(testCheckoutPath, testDir)]);

        const result = await readService.list(testDir, {
          repositoryUrl: testRepoUrl,
        });

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('file paths', () => {
      it('should recognize file path with spaces', async () => {
        const testFile = join(testCheckoutPath, 'file with spaces.txt');
        await fs.writeFile(testFile, 'test content');

        await writeService.add([testFile]);
        await writeService.commit('Add file with spaces');

        const status = await readService.status(testFile);
        expect(status.length).toBeGreaterThan(0);

        const info = await readService.info(testFile);
        expect(info).not.toBeNull();
      });

      it('should recognize file path with quotes', async () => {
        const testFile = join(testCheckoutPath, "file's name.txt");
        await fs.writeFile(testFile, 'test content');

        await writeService.add([testFile]);
        await writeService.commit("Add file's name");

        const status = await readService.status(testFile);
        expect(status.length).toBeGreaterThan(0);

        const info = await readService.info(testFile);
        expect(info).not.toBeNull();
      });
    });

    describe('multiple paths', () => {
      it('should recognize multiple paths with spaces', async () => {
        const paths = [join(testCheckoutPath, 'path one'), join(testCheckoutPath, 'path two'), join(testCheckoutPath, 'path three')];

        for (const path of paths) {
          await fs.mkdir(path, { recursive: true });
          await fs.writeFile(join(path, 'test.txt'), 'test');
        }

        await writeService.add(paths);
        const status = await readService.status(testCheckoutPath);

        expect(status.length).toBeGreaterThan(0);
      });

      it('should recognize multiple paths with quotes', async () => {
        const paths = [join(testCheckoutPath, "Genie's Dream"), join(testCheckoutPath, "Builder's Path"), join(testCheckoutPath, "User's File")];

        for (const path of paths) {
          await fs.mkdir(path, { recursive: true });
          await fs.writeFile(join(path, 'test.txt'), 'test');
        }

        await writeService.add(paths);
        const status = await readService.status(testCheckoutPath);

        expect(status.length).toBeGreaterThan(0);
      });
    });
  });
});
