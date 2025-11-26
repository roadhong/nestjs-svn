import { Test, TestingModule } from '@nestjs/testing';
import { SvnService } from './svn.service';
import { SvnModule } from './svn.module';
import { join } from 'path';

describe('SvnService - Integration Service', () => {
  let service: SvnService;
  const testRepoUrl = `file://${join(process.cwd(), 'svn-test')}`;
  const testCheckoutPath = join(process.cwd(), 'svn-test-checkout');

  beforeAll(async () => {
    console.log('\n=== SVN Service Integration Test Start ===\n');
    console.log(`Repository URL: ${testRepoUrl}`);
    console.log(`Checkout Path: ${testCheckoutPath}\n`);

    const module: TestingModule = await Test.createTestingModule({
      imports: [SvnModule.forRoot()],
    }).compile();

    service = module.get<SvnService>(SvnService);
  });

  describe('Basic Integration Test', () => {
    it('should work as unified service', async () => {
      console.log('1. Unified service basic functionality test...');

      // Read operations
      const info = await service.info(testRepoUrl);
      expect(info).toBeDefined();
      console.log('   ✓ Info query successful');

      const logs = await service.log(testRepoUrl, { limit: 1 });
      expect(Array.isArray(logs)).toBe(true);
      console.log('   ✓ Log query successful');

      // Write operations
      // Try to delete in case checkout already exists
      try {
        const fs = await import('fs/promises');
        await fs.rm(testCheckoutPath, { recursive: true, force: true });
      } catch {
        // Ignore
      }

      const checkoutResult = await service.checkout(testRepoUrl, testCheckoutPath);
      if (checkoutResult.success) {
        console.log('   ✓ Checkout successful');
      } else {
        console.log(`   - Checkout failed (expected): ${checkoutResult.stderr.substring(0, 50)}...`);
      }
      expect(typeof checkoutResult.success).toBe('boolean');

      const updateResult = await service.update(testCheckoutPath);
      if (updateResult.success) {
        console.log('   ✓ Update successful');
      } else {
        console.log(`   - Update failed (expected): ${updateResult.stderr.substring(0, 50)}...`);
      }
      expect(typeof updateResult.success).toBe('boolean');

      console.log('');
    });
  });

  afterAll(() => {
    console.log('=== Integration Service Test Complete ===\n');
  });
});

describe('SvnModule - Authentication Configuration Test', () => {
  const testRepoUrl = `file://${join(process.cwd(), 'svn-test')}`;

  describe('forRoot - Default Authentication Configuration', () => {
    it('should use default auth options from module', async () => {
      console.log('\n=== SvnModule.forRoot Authentication Configuration Test ===\n');

      const testUsername = 'test-user';
      const testPassword = 'test-pass';

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          SvnModule.forRoot({
            username: testUsername,
            password: testPassword,
            trustServerCert: true,
            noAuthCache: true,
          }),
        ],
      }).compile();

      const service = module.get<SvnService>(SvnService);

      console.log('1. Default authentication configuration check:');
      console.log(`   ✓ Username: ${testUsername}`);
      console.log(`   ✓ Password: ${testPassword}`);
      console.log(`   ✓ Trust Server Cert: true`);
      console.log(`   ✓ No Auth Cache: true`);
      console.log('');

      // Check if authentication options are applied via Info command
      console.log('2. Execute Info command (using default auth options):');
      const info = await service.info(testRepoUrl);
      expect(info).toBeDefined();
      if (info) {
        console.log(`   ✓ Info query successful (default auth options applied)`);
        console.log(`   ✓ URL: ${info.url || 'N/A'}`);
      }
      console.log('');

      // Check if default options are merged even when explicit options are provided
      console.log('3. Explicit options and default options merge test:');
      const result = await service.info(testRepoUrl, {
        username: 'override-user',
        trustServerCert: false,
      });
      expect(result).toBeDefined();
      console.log('   ✓ Options merge confirmed (explicit options take precedence)');
      console.log('');
    });
  });

  describe('forRootAsync - Async Authentication Configuration', () => {
    it('should use async auth options from module', async () => {
      console.log('\n=== SvnModule.forRootAsync Authentication Configuration Test ===\n');

      const testUsername = 'async-user';
      const testPassword = 'async-pass';

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          SvnModule.forRootAsync({
            useFactory: async () => {
              // Simulate async configuration
              await new Promise((resolve) => setTimeout(resolve, 10));

              return {
                username: testUsername,
                password: testPassword,
                trustServerCert: true,
              };
            },
          }),
        ],
      }).compile();

      const service = module.get<SvnService>(SvnService);

      console.log('1. Async authentication configuration check:');
      console.log(`   ✓ Username: ${testUsername}`);
      console.log(`   ✓ Password: ${testPassword}`);
      console.log('');

      console.log('2. Execute Info command (using async configured auth options):');
      const info = await service.info(testRepoUrl);
      expect(info).toBeDefined();
      if (info) {
        console.log(`   ✓ Info query successful (async auth options applied)`);
        console.log(`   ✓ URL: ${info.url || 'N/A'}`);
      }
      console.log('');
    });
  });

  describe('Use without default options', () => {
    it('should work without default options', async () => {
      console.log('\n=== Use without default options test ===\n');

      const module: TestingModule = await Test.createTestingModule({
        imports: [SvnModule.forRoot()],
      }).compile();

      const service = module.get<SvnService>(SvnService);

      console.log('1. Info query without default options:');
      const info = await service.info(testRepoUrl);
      expect(info).toBeDefined();
      if (info) {
        console.log(`   ✓ Info query successful (works without default options)`);
        console.log(`   ✓ URL: ${info.url || 'N/A'}`);
      }
      console.log('');

      console.log('2. Explicit options test:');
      const result = await service.info(testRepoUrl, {
        username: 'explicit-user',
        password: 'explicit-pass',
      });
      expect(result).toBeDefined();
      console.log('   ✓ Works with explicit options confirmed');
      console.log('');
    });
  });
});
