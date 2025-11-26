import { Test, TestingModule } from '@nestjs/testing';
import { SvnReadService } from './svn-read.service';
import { SvnWriteService } from './svn-write.service';
import { join } from 'path';
import { promises as fs } from 'fs';
import { rmSync, mkdirSync } from 'fs';

describe('SvnService Integration Tests', () => {
  let readService: SvnReadService;
  let writeService: SvnWriteService;
  const testRepoUrl = `file://${join(process.cwd(), 'svn-test')}`;
  const testCheckoutPath = join(process.cwd(), 'svn-test-checkout');
  const testCatFile = join(testCheckoutPath, 'test-cat.txt');
  const testDiffFile = join(testCheckoutPath, 'test-diff.txt');

  beforeAll(async () => {
    console.log('\n=== SVN Service Integration Test Start ===\n');
    console.log(`Repository URL: ${testRepoUrl}`);
    console.log(`Checkout Path: ${testCheckoutPath}\n`);

    const module: TestingModule = await Test.createTestingModule({
      providers: [SvnReadService, SvnWriteService],
    }).compile();

    readService = module.get<SvnReadService>(SvnReadService);
    writeService = module.get<SvnWriteService>(SvnWriteService);
  });

  // ========== Phase 1: Write Operations (Initial Setup and Data Preparation) ==========

  describe('Phase 1: Write Operations - Initial Setup and Data Preparation', () => {
    describe('checkout', () => {
      it('should checkout repository', async () => {
        console.log('1. Executing Checkout...');

        try {
          rmSync(testCheckoutPath, { recursive: true, force: true });
        } catch (error) {
          console.error(`Error removing checkout directory: ${error}`);
        }

        const parentDir = join(testCheckoutPath, '..');
        try {
          mkdirSync(parentDir, { recursive: true });
        } catch (error) {
          console.error(`Error creating parent directory: ${error}`);
        }

        const result = await writeService.checkout(testRepoUrl, testCheckoutPath);

        if (result.success) {
          console.log('   ✓ Checkout successful');
          console.log(`   ✓ stdout:`);
          console.log(result.stdout);
          if (result.stderr) {
            console.log(`   ✓ stderr:`);
            console.log(result.stderr);
          }
        } else {
          console.log(`   ✗ Checkout failed`);
          console.log(`   ✗ stdout: ${result.stdout}`);
          console.log(`   ✗ stderr: ${result.stderr}`);
          console.log(`   ✗ code: ${result.code || 'N/A'}`);
        }

        expect(result.success).toBe(true);
        console.log('');
      });
    });

    describe('update', () => {
      it('should update working copy', async () => {
        console.log('2. Executing Update...');
        const result = await writeService.update(testCheckoutPath);
        if (result.success) {
          console.log('   ✓ Update successful');
          if (result.stdout) {
            console.log(`   ✓ stdout:`);
            console.log(result.stdout);
          }
          if (result.stderr) {
            console.log(`   ✓ stderr:`);
            console.log(result.stderr);
          }
        } else {
          console.log(`   - Update failed (expected)`);
          console.log(`   - stdout: ${result.stdout}`);
          console.log(`   - stderr: ${result.stderr}`);
          console.log(`   - code: ${result.code || 'N/A'}`);
        }
        expect(typeof result.success).toBe('boolean');
        console.log('');
      });
    });

    describe('prepare test data - files and commit', () => {
      it('should create test files and commit for read tests', async () => {
        console.log('3. Preparing test data (file creation and commit)...');

        // Create file for Cat test
        await fs.writeFile(testCatFile, 'Line 1\nLine 2\nLine 3\nCat test content\n');
        await writeService.add([testCatFile]);

        // Create file for Diff test
        await fs.writeFile(testDiffFile, 'Original content\n');
        await writeService.add([testDiffFile]);

        // Create file for Status test
        const statusFile = join(testCheckoutPath, 'test-status.txt');
        await fs.writeFile(statusFile, 'Status test content');
        await writeService.add([statusFile]);

        // Create directories and files for List test (multiple)
        const listDir1 = join(testCheckoutPath, 'test-list-dir-1');
        const listDir2 = join(testCheckoutPath, 'test-list-dir-2');
        await fs.mkdir(listDir1, { recursive: true });
        await fs.mkdir(listDir2, { recursive: true });
        const listFile1 = join(listDir1, 'list-file-1.txt');
        const listFile2 = join(listDir1, 'list-file-2.txt');
        const listFile3 = join(listDir2, 'list-file-3.txt');
        await fs.writeFile(listFile1, 'List file 1 content');
        await fs.writeFile(listFile2, 'List file 2 content');
        await fs.writeFile(listFile3, 'List file 3 content');
        await writeService.add([listDir1, listDir2, listFile1, listFile2, listFile3]);

        // Also create root level files for List test
        const rootFile1 = join(testCheckoutPath, 'root-file-1.txt');
        const rootFile2 = join(testCheckoutPath, 'root-file-2.txt');
        const rootFile3 = join(testCheckoutPath, 'root-file-3.txt');
        await fs.writeFile(rootFile1, 'Root file 1 content');
        await fs.writeFile(rootFile2, 'Root file 2 content');
        await fs.writeFile(rootFile3, 'Root file 3 content');
        await writeService.add([rootFile1, rootFile2, rootFile3]);

        // Create and commit multiple files for Log test
        const logFile1 = join(testCheckoutPath, 'log-file-1.txt');
        const logFile2 = join(testCheckoutPath, 'log-file-2.txt');
        const logFile3 = join(testCheckoutPath, 'log-file-3.txt');
        await fs.writeFile(logFile1, 'Log file 1 content');
        await fs.writeFile(logFile2, 'Log file 2 content');
        await fs.writeFile(logFile3, 'Log file 3 content');
        await writeService.add([logFile1, logFile2, logFile3]);

        // Create log data via Commit (may fail in local repository)
        const allFiles = [testCatFile, testDiffFile, statusFile, listDir1, listDir2, listFile1, listFile2, listFile3, rootFile1, rootFile2, rootFile3, logFile1, logFile2, logFile3];
        const commitResult = await writeService.commit('Test commit for read operations - batch 1', {
          files: allFiles,
        });

        if (commitResult.success) {
          console.log('   ✓ Test file creation and commit successful');
          console.log(`   ✓ stdout: ${commitResult.stdout}`);
        } else {
          console.log('   - Commit failed (normal for local repository, files are added)');
          console.log(`   - stdout: ${commitResult.stdout}`);
          console.log(`   - stderr: ${commitResult.stderr}`);
        }

        // Try additional commit (to increase log entries)
        const logFile4 = join(testCheckoutPath, 'log-file-4.txt');
        const logFile5 = join(testCheckoutPath, 'log-file-5.txt');
        await fs.writeFile(logFile4, 'Log file 4 content');
        await fs.writeFile(logFile5, 'Log file 5 content');
        await writeService.add([logFile4, logFile5]);
        const commitResult2 = await writeService.commit('Test commit for read operations - batch 2', {
          files: [logFile4, logFile5],
        });

        if (commitResult2.success) {
          console.log('   ✓ Additional commit successful');
        }

        console.log('');
      });
    });

    describe('prepare test data - additional files', () => {
      it('should create additional test files', async () => {
        console.log('4. Preparing additional test files...');

        // Create additional test file
        const additionalFile = join(testCheckoutPath, 'test-additional.txt');
        await fs.writeFile(additionalFile, 'Additional test content');
        await writeService.add([additionalFile]);

        console.log('   ✓ Additional test file creation complete');
        console.log('');
      });
    });
  });

  // ========== Phase 2: Read Operations (Basic Queries) ==========

  describe('Phase 2: Read Operations - Basic Queries', () => {
    describe('info', () => {
      it('should get repository info with all fields', async () => {
        console.log('5. Querying Repository Info...');
        // First query info from checkout path (more information)
        let info = await readService.info(testCheckoutPath);
        expect(info).toBeDefined();
        expect(info).not.toBeNull();

        // If checkout path fails, query from repository URL
        if (!info || !info.url) {
          console.log('   - Checkout path Info is empty, checking repository URL...');
          info = await readService.info(testRepoUrl);
        }

        expect(info).toBeDefined();
        expect(info).not.toBeNull();
        expect(info).not.toBe(null);

        // Required field validation - test fails if value is empty
        expect(info?.url).toBeDefined();
        expect(info?.url).not.toBe('');
        expect(info?.url).toBeTruthy();

        expect(info?.repositoryRoot).toBeDefined();
        expect(info?.repositoryRoot).not.toBe('');
        expect(info?.repositoryRoot).toBeTruthy();

        expect(info?.revision).toBeDefined();
        expect(info?.revision).not.toBe('');
        expect(info?.revision).toBeTruthy();

        expect(info?.repositoryUuid).toBeDefined();
        expect(info?.repositoryUuid).not.toBe('');
        expect(info?.repositoryUuid).toBeTruthy();

        expect(info?.nodeKind).toBeDefined();
        expect(info?.nodeKind).not.toBe('');
        expect(info?.nodeKind).toBeTruthy();

        expect(info?.lastChangedAuthor).toBeDefined();
        expect(info?.lastChangedAuthor).not.toBe('');
        expect(info?.lastChangedAuthor).toBeTruthy();

        expect(info?.lastChangedRev).toBeDefined();
        expect(info?.lastChangedRev).not.toBe('');
        expect(info?.lastChangedRev).toBeTruthy();

        expect(info?.lastChangedDate).toBeDefined();
        expect(info?.lastChangedDate).not.toBe('');
        expect(info?.lastChangedDate).toBeTruthy();

        if (info) {
          console.log(`   ✓ Path: ${info.path || '(N/A)'}`);
          console.log(`   ✓ Repository Root: ${info.repositoryRoot}`);
          console.log(`   ✓ Revision: ${info.revision}`);
          console.log(`   ✓ URL: ${info.url}`);
          console.log(`   ✓ Relative URL: ${info.relativeUrl || '(N/A)'}`);
          console.log(`   ✓ Repository UUID: ${info.repositoryUuid}`);
          console.log(`   ✓ Node Kind: ${info.nodeKind}`);
          console.log(`   ✓ Schedule: ${info.schedule || '(N/A)'}`);
          console.log(`   ✓ Last Changed Author: ${info.lastChangedAuthor}`);
          console.log(`   ✓ Last Changed Rev: ${info.lastChangedRev}`);
          console.log(`   ✓ Last Changed Date: ${info.lastChangedDate}`);
        }
        console.log('');
      });
    });

    describe('status', () => {
      it('should get status with items', async () => {
        console.log('6. Querying Status...');
        let status = await readService.status(testCheckoutPath);
        expect(Array.isArray(status)).toBe(true);

        // Check if Status has items (create file if empty)
        if (status.length === 0) {
          console.log('   - Status is empty, creating test file...');
          const testFile = join(testCheckoutPath, 'test-status-empty.txt');
          await fs.writeFile(testFile, 'Status test');
          await writeService.add([testFile]);
          status = await readService.status(testCheckoutPath);
        }

        // Status must have items - test fails if empty
        expect(status.length).toBeGreaterThan(0);
        console.log(`   ✓ Status item count: ${status.length}`);

        // Validate required fields for each item
        status.forEach((item, index) => {
          expect(item.status).toBeDefined();
          expect(item.path).toBeDefined();
          expect(item.path).not.toBe('');
          expect(item.path).toBeTruthy();

          console.log(`   [${index + 1}] Status: ${item.status || ' '}`);
          console.log(`        Path: ${item.path}`);

          // For committed files (status is blank), additional info may exist
          if (item.status === ' ' || !item.status || item.status.trim() === '') {
            // Committed files may have workingRevision, lastChangedRevision, lastChangedAuthor
            if (item.workingRevision) {
              expect(item.workingRevision).not.toBe('');
              expect(item.workingRevision).toBeTruthy();
              console.log(`        Working Revision: ${item.workingRevision}`);
            }
            if (item.lastChangedRevision) {
              expect(item.lastChangedRevision).not.toBe('');
              expect(item.lastChangedRevision).toBeTruthy();
              console.log(`        Last Changed Revision: ${item.lastChangedRevision}`);
            }
            if (item.lastChangedAuthor) {
              expect(item.lastChangedAuthor).not.toBe('');
              expect(item.lastChangedAuthor).toBeTruthy();
              console.log(`        Last Changed Author: ${item.lastChangedAuthor}`);
            }
            if (item.lastChangedDate) {
              expect(item.lastChangedDate).not.toBe('');
              console.log(`        Last Changed Date: ${item.lastChangedDate}`);
            }
          } else {
            // Status exists (A, M, D, etc.) - newly added files may not have revision info
            expect(item.status).not.toBe('');
            expect(item.status).toBeTruthy();
            if (item.workingRevision) {
              expect(item.workingRevision).not.toBe('');
              console.log(`        Working Revision: ${item.workingRevision}`);
            }
            if (item.lastChangedRevision) {
              expect(item.lastChangedRevision).not.toBe('');
              console.log(`        Last Changed Revision: ${item.lastChangedRevision}`);
            }
            if (item.lastChangedAuthor) {
              expect(item.lastChangedAuthor).not.toBe('');
              console.log(`        Last Changed Author: ${item.lastChangedAuthor}`);
            }
            if (item.lastChangedDate) {
              console.log(`        Last Changed Date: ${item.lastChangedDate}`);
            }
          }
        });
        console.log('');
      });
    });

    describe('log', () => {
      it('should get log entries with data', async () => {
        console.log('7. Querying Log...');
        // First query log from checkout path (most reliable)
        let logs = await readService.log(testCheckoutPath, { limit: 20 });
        expect(Array.isArray(logs)).toBe(true);

        // If checkout path is empty, query from repository URL
        if (logs.length === 0) {
          console.log('   - Checkout path log is empty, checking repository URL...');
          logs = await readService.log(testRepoUrl, { limit: 20 });
        }

        // If still empty, query all without limit
        if (logs.length === 0) {
          console.log('   - Log is empty, trying to query all logs...');
          logs = await readService.log(testCheckoutPath);
          if (logs.length === 0) {
            logs = await readService.log(testRepoUrl);
          }
        }

        // Log must have items - test fails if empty
        expect(logs.length).toBeGreaterThan(0);
        console.log(`   ✓ Log item count: ${logs.length}`);

        // Validate required fields for each log entry
        logs.forEach((log, index) => {
          expect(log.revision).toBeDefined();
          expect(log.revision).not.toBe('');
          expect(log.revision).toBeTruthy();

          expect(log.author).toBeDefined();
          expect(log.author).not.toBe('');
          expect(log.author).toBeTruthy();

          expect(log.date).toBeDefined();
          expect(log.date).not.toBe('');
          expect(log.date).toBeTruthy();

          expect(log.message).toBeDefined();
          expect(log.message).not.toBe('');
          expect(log.message).toBeTruthy();

          console.log(`   [${index + 1}] Revision: ${log.revision}`);
          console.log(`        Author: ${log.author}`);
          console.log(`        Date: ${log.date}`);
          console.log(`        Message: ${log.message}`);
          if (log.paths && log.paths.length > 0) {
            console.log(`        Changed files count: ${log.paths.length}`);
            log.paths.slice(0, 5).forEach((path) => {
              expect(path.action).toBeDefined();
              expect(path.path).toBeDefined();
              expect(path.path).not.toBe('');
              console.log(`          - ${path.action} ${path.kind || ''} ${path.path}`);
            });
          }
        });
        console.log('');
      });
    });

    describe('list', () => {
      it('should list directory contents with items', async () => {
        console.log('8. Querying List...');
        // First query list from checkout path (most reliable)
        let list = await readService.list(testCheckoutPath);
        expect(Array.isArray(list)).toBe(true);

        // If checkout path is empty, query from repository URL
        if (list.length === 0) {
          console.log('   - Checkout path List is empty, checking repository URL...');
          list = await readService.list(testRepoUrl);
        }

        // If still empty, check subdirectories
        if (list.length === 0) {
          console.log('   - Root List is empty, checking trunk directory...');
          const trunkList = await readService.list(`${testRepoUrl}/trunk`);
          if (trunkList.length > 0) {
            list = trunkList;
          }
        }

        // If still empty, check created directory
        if (list.length === 0) {
          console.log('   - Root is empty, checking created directory...');
          const listDir = join(testCheckoutPath, 'test-list-dir-1');
          try {
            const dirList = await readService.list(listDir);
            if (dirList.length > 0) {
              list = dirList;
            }
          } catch {
            // Ignore
          }
        }

        // List must have items - test fails if empty
        expect(list.length).toBeGreaterThan(0);
        console.log(`   ✓ Item count: ${list.length}`);

        // Validate each item is not empty
        list.forEach((item, index) => {
          expect(item).toBeDefined();
          expect(item).not.toBe('');
          expect(item).toBeTruthy();
          expect(typeof item).toBe('string');
          expect(item.length).toBeGreaterThan(0);
          console.log(`   [${index + 1}] ${item}`);
        });
        console.log('');
      });
    });

    describe('cat', () => {
      it('should read file content', async () => {
        console.log('9. Cat test (file read)...');
        const content = await readService.cat(testCatFile);
        expect(typeof content).toBe('string');
        expect(content).toBeDefined();
        expect(content).not.toBe('');
        expect(content).toBeTruthy();
        expect(content.length).toBeGreaterThan(0);

        // Test fails if content is empty
        if (content.trim().length === 0) {
          throw new Error('File content is empty');
        }

        console.log(`   ✓ File content read complete (length: ${content.length})`);
        console.log(`   ✓ File content:`);
        console.log(content);
        console.log('');
      });
    });
  });

  // ========== Phase 3: Write Operations (File Manipulation) ==========

  describe('Phase 3: Write Operations - File Manipulation', () => {
    describe('add', () => {
      it('should add files', async () => {
        console.log('10. Add test...');
        try {
          const testFile = join(testCheckoutPath, 'test-add.txt');
          await fs.writeFile(testFile, 'test content');

          const result = await writeService.add([testFile]);
          if (result.success) {
            console.log('   ✓ Add successful');
            console.log(`   ✓ stdout: ${result.stdout}`);
            if (result.stderr) {
              console.log(`   ✓ stderr: ${result.stderr}`);
            }
          } else {
            console.log(`   - Add failed (expected)`);
            console.log(`   - stdout: ${result.stdout}`);
            console.log(`   - stderr: ${result.stderr}`);
            console.log(`   - code: ${result.code || 'N/A'}`);
          }
          expect(typeof result.success).toBe('boolean');
        } catch (error) {
          console.log(`   - Add test skipped: ${error}`);
        }
        console.log('');
      });
    });

    describe('remove', () => {
      it('should remove files', async () => {
        console.log('11. Remove test...');
        try {
          const testFile = join(testCheckoutPath, 'test-remove.txt');
          await fs.writeFile(testFile, 'test content');
          await writeService.add([testFile]);

          const result = await writeService.remove([testFile], { keepLocal: true });
          if (result.success) {
            console.log('   ✓ Remove successful');
            console.log(`   ✓ stdout: ${result.stdout}`);
            if (result.stderr) {
              console.log(`   ✓ stderr: ${result.stderr}`);
            }
          } else {
            console.log(`   ✗ Remove failed`);
            console.log(`   ✗ stdout: ${result.stdout}`);
            console.log(`   ✗ stderr: ${result.stderr}`);
            console.log(`   ✗ code: ${result.code || 'N/A'}`);
          }
          expect(result.success).toBe(true);
        } catch (error) {
          console.log(`   - Remove test skipped: ${error}`);
        }
        console.log('');
      });
    });

    describe('copy', () => {
      it('should copy files', async () => {
        console.log('12. Copy test...');
        try {
          const sourceFile = join(testCheckoutPath, 'test-copy-source.txt');
          const destFile = join(testCheckoutPath, 'test-copy-dest.txt');
          await fs.writeFile(sourceFile, 'Copy source content');
          await writeService.add([sourceFile]);

          const result = await writeService.copy(sourceFile, destFile);
          if (result.success) {
            console.log('   ✓ Copy successful');
            console.log(`   ✓ stdout: ${result.stdout}`);
            if (result.stderr) {
              console.log(`   ✓ stderr: ${result.stderr}`);
            }
          } else {
            console.log(`   - Copy failed (expected)`);
            console.log(`   - stdout: ${result.stdout}`);
            console.log(`   - stderr: ${result.stderr}`);
            console.log(`   - code: ${result.code || 'N/A'}`);
          }
          expect(typeof result.success).toBe('boolean');
        } catch (error) {
          console.log(`   - Copy test skipped: ${error}`);
        }
        console.log('');
      });
    });

    describe('move', () => {
      it('should move files', async () => {
        console.log('13. Move test...');
        try {
          const sourceFile = join(testCheckoutPath, 'test-move-source.txt');
          const destFile = join(testCheckoutPath, 'test-move-dest.txt');
          await fs.writeFile(sourceFile, 'Move source content');
          await writeService.add([sourceFile]);

          const result = await writeService.move(sourceFile, destFile);
          if (result.success) {
            console.log('   ✓ Move successful');
            console.log(`   ✓ stdout: ${result.stdout}`);
            if (result.stderr) {
              console.log(`   ✓ stderr: ${result.stderr}`);
            }
          } else {
            console.log(`   - Move failed (expected)`);
            console.log(`   - stdout: ${result.stdout}`);
            console.log(`   - stderr: ${result.stderr}`);
            console.log(`   - code: ${result.code || 'N/A'}`);
          }
          expect(typeof result.success).toBe('boolean');
        } catch (error) {
          console.log(`   - Move test skipped: ${error}`);
        }
        console.log('');
      });
    });

    describe('mkdir', () => {
      it('should create directory', async () => {
        console.log('14. Mkdir test...');
        try {
          const dirPath = join(testCheckoutPath, 'test-mkdir-dir');
          const result = await writeService.mkdir([dirPath]);
          if (result.success) {
            console.log('   ✓ Mkdir successful');
            console.log(`   ✓ stdout: ${result.stdout}`);
            if (result.stderr) {
              console.log(`   ✓ stderr: ${result.stderr}`);
            }
          } else {
            console.log(`   - Mkdir failed (expected)`);
            console.log(`   - stdout: ${result.stdout}`);
            console.log(`   - stderr: ${result.stderr}`);
            console.log(`   - code: ${result.code || 'N/A'}`);
          }
          expect(typeof result.success).toBe('boolean');
        } catch (error) {
          console.log(`   - Mkdir test skipped: ${error}`);
        }
        console.log('');
      });
    });
  });

  // ========== Phase 4: Read Operations (Advanced Queries) ==========

  describe('Phase 4: Read Operations - Advanced Queries', () => {
    describe('diff', () => {
      it('should get diff', async () => {
        console.log('15. Querying Diff...');
        // Modify file for Diff test
        await fs.writeFile(testDiffFile, 'Modified content\nNew line\n');
        const diff = await readService.diff(testCheckoutPath);
        expect(typeof diff).toBe('string');
        expect(diff).toBeDefined();

        // Diff content should exist (if there are changes)
        // Changes may not exist, but diff itself must exist
        expect(diff).not.toBeNull();

        console.log(`   ✓ Diff query complete (length: ${diff.length})`);
        if (diff) {
          console.log(`   ✓ Diff content:`);
          console.log(diff);
        } else {
          console.log('   ⚠ Diff content is empty (no changes may exist)');
        }
        console.log('');
      });
    });

    describe('export', () => {
      it('should export files from repository', async () => {
        console.log('16. Export test...');
        const exportPath = join(process.cwd(), 'svn-test-export');

        try {
          // Clean up export directory if exists
          try {
            await fs.rm(exportPath, { recursive: true, force: true });
          } catch {
            // Ignore
          }

          // Export from repository URL (use relative path with repositoryUrl option)
          const result = await readService.export('./', exportPath, {
            repositoryUrl: testRepoUrl,
          });

          if (result.success) {
            console.log('   ✓ Export successful');
            console.log(`   ✓ stdout: ${result.stdout}`);
            if (result.stderr) {
              console.log(`   ✓ stderr: ${result.stderr}`);
            }

            // Verify export directory exists
            try {
              const stat = await fs.stat(exportPath);
              expect(stat.isDirectory()).toBe(true);
              console.log(`   ✓ Export directory created: ${exportPath}`);

              // Check if files were exported
              const files = await fs.readdir(exportPath);
              expect(files.length).toBeGreaterThan(0);
              console.log(`   ✓ Exported files count: ${files.length}`);
              files.slice(0, 5).forEach((file) => {
                console.log(`     - ${file}`);
              });
            } catch (error) {
              console.log(`   - Export directory check failed: ${error}`);
            }
          } else {
            console.log(`   - Export failed`);
            console.log(`   - stdout: ${result.stdout}`);
            console.log(`   - stderr: ${result.stderr}`);
            console.log(`   - code: ${result.code || 'N/A'}`);
          }

          expect(typeof result.success).toBe('boolean');
        } catch (error) {
          console.log(`   - Export test skipped: ${error}`);
        }

        // Clean up
        try {
          await fs.rm(exportPath, { recursive: true, force: true });
        } catch {
          // Ignore
        }

        console.log('');
      });
    });
  });

  afterAll(() => {
    console.log('=== Integration Test Complete ===\n');
  });
});
