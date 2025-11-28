import { Injectable } from '@nestjs/common';
import { SvnBaseService } from './svn-base.service';
import type {
  SvnOptions,
  SvnStatusResult,
  SvnInfoResult,
  SvnLogEntry,
  SvnLogOptions,
  SvnListOptions,
  SvnCatOptions,
  SvnDiffOptions,
  SvnExportOptions,
  SvnCommandResult,
} from '../interfaces/svn-options.interface';

/**
 * Status item to character mapping
 */
const STATUS_MAP: Record<string, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  replaced: 'R',
  conflicted: 'C',
  obstructed: '~',
  ignored: 'I',
  'not-tracked': '?',
  missing: '!',
  incomplete: '!',
  external: 'X',
  unversioned: '?',
} as const;

/**
 * Invalid revision indicator
 */
const INVALID_REVISION = '-1';

@Injectable()
export class SvnReadService extends SvnBaseService {
  constructor() {
    super(SvnReadService.name);
  }

  /**
   * SVN Info
   * Get information about a working copy path or URL
   */
  async info(path?: string, options: SvnOptions = {}): Promise<SvnInfoResult | null> {
    const args = this.buildPathArgs(path);
    const [command, mergedOptions] = this.buildSvnArgs('info', args, options);

    const result = await this.executeCommand(command, mergedOptions);

    if (!result.success) {
      this.logger.warn(`Info command failed: ${result.stderr}`);

      return null;
    }

    return this.parseInfoOutput(result.stdout);
  }

  /**
   * SVN Status
   * Show the status of working copy files and directories
   */
  async status(path?: string, options: SvnOptions = {}): Promise<SvnStatusResult[]> {
    const args = ['--xml', '--show-updates', ...this.buildPathArgs(path)];
    const [command, mergedOptions] = this.buildSvnArgs('status', args, options);

    const result = await this.executeCommand(command, mergedOptions);

    if (!result.success) {
      this.logger.warn(`Status command failed: ${result.stderr}`);

      return [];
    }

    return this.parseStatusOutput(result.stdout);
  }

  /**
   * SVN Log
   * Show the log messages for a set of paths
   */
  async log(path?: string, options: SvnLogOptions = {}): Promise<SvnLogEntry[]> {
    const args = ['--xml', ...this.buildLogArgs(options), ...this.buildPathArgs(path)];
    const [command, mergedOptions] = this.buildSvnArgs('log', args, options);

    const result = await this.executeCommand(command, mergedOptions);

    if (!result.success) {
      this.logger.warn(`Log command failed: ${result.stderr}`);

      return [];
    }

    return this.parseLogOutput(result.stdout);
  }

  /**
   * SVN List (ls)
   * List directory entries in the repository
   */
  async list(path?: string, options: SvnListOptions = {}): Promise<string[]> {
    const args = ['--xml', ...this.buildListArgs(options), ...this.buildPathArgs(path)];
    const [command, mergedOptions] = this.buildSvnArgs('list', args, options);

    const result = await this.executeCommand(command, mergedOptions);

    if (!result.success) {
      this.handleListError(result.stderr, path, options);

      return [];
    }

    return this.parseListOutput(result.stdout);
  }

  /**
   * SVN Cat (read file content)
   * Output the contents of the specified files or URLs
   */
  async cat(path: string, options: SvnCatOptions = {}): Promise<string> {
    const args = [...this.buildRevisionArgs(options.revision), path];
    const [command, mergedOptions] = this.buildSvnArgs('cat', args, options);

    const result = await this.executeCommand(command, mergedOptions);

    return result.stdout;
  }

  /**
   * SVN Diff
   * Display the differences between two paths
   */
  async diff(path1?: string, path2?: string, options: SvnDiffOptions = {}): Promise<string> {
    const args = [...this.buildDiffRevisionArgs(options), ...this.buildDiffCmdArgs(options.diffCmd), ...this.buildDiffPathArgs(path1, path2, options)];
    const [command, mergedOptions] = this.buildSvnArgs('diff', args, options);

    const result = await this.executeCommand(command, mergedOptions);

    return result.stdout;
  }

  /**
   * SVN Export
   * Export files from repository to local directory without creating working copy
   */
  async export(sourcePath: string, localPath: string, options: SvnExportOptions = {}): Promise<SvnCommandResult> {
    const args = [...this.buildRevisionArgs(options.revision), ...this.buildDepthArgs(options.depth), ...this.buildExportFlags(options), ...this.buildExportPathArgs(sourcePath, localPath, options)];

    const optionsWithoutRepoUrl = { ...options };
    delete optionsWithoutRepoUrl.repositoryUrl;

    const [command, mergedOptions] = this.buildSvnArgs('export', args, optionsWithoutRepoUrl);

    return this.executeCommand(command, mergedOptions);
  }

  /**
   * Parse Status output (XML format)
   */
  private parseStatusOutput(xmlOutput: string): SvnStatusResult[] {
    const results: SvnStatusResult[] = [];
    const statusMatch = xmlOutput.match(/<status[^>]*>([\s\S]*)<\/status>/);

    if (!statusMatch) {
      return results;
    }

    const statusContent = statusMatch[1];
    const entryMatches = statusContent.matchAll(/<entry[^>]*path="([^"]*)"[^>]*>([\s\S]*?)<\/entry>/g);

    for (const match of entryMatches) {
      // Decode HTML entities in path (e.g., &amp; -> &)
      const path = this.decodeHtmlEntities(match[1]);
      const entryContent = match[2];

      const wcStatusMatch = entryContent.match(/<wc-status[^>]*item="([^"]*)"[^>]*revision="([^"]*)"[^>]*>([\s\S]*?)<\/wc-status>/);
      let status = ' ';
      let workingRevision: string | undefined;
      let lastChangedRevision: string | undefined;
      let lastChangedAuthor: string | undefined;
      let lastChangedDate: string | undefined;

      if (wcStatusMatch) {
        const itemStatus = wcStatusMatch[1];
        const revision = wcStatusMatch[2];
        const wcStatusContent = wcStatusMatch[3];

        status = STATUS_MAP[itemStatus] || ' ';

        if (this.isValidRevision(revision)) {
          workingRevision = revision;
        }

        const commitMatch = wcStatusContent.match(/<commit[^>]*revision="([^"]*)"[^>]*>([\s\S]*?)<\/commit>/);
        if (commitMatch) {
          lastChangedRevision = commitMatch[1];
          const commitContent = commitMatch[2];

          const authorMatch = commitContent.match(/<author>(.*?)<\/author>/);
          const dateMatch = commitContent.match(/<date>(.*?)<\/date>/);

          if (authorMatch) {
            lastChangedAuthor = this.decodeHtmlEntities(authorMatch[1]);
          }
          if (dateMatch) {
            lastChangedDate = dateMatch[1];
          }
        }
      }

      const reposStatusMatch = entryContent.match(/<repos-status[^>]*item="([^"]*)"[^>]*>([\s\S]*?)<\/repos-status>/);
      if (reposStatusMatch) {
        const reposStatusContent = reposStatusMatch[2];
        const reposCommitMatch = reposStatusContent.match(/<commit[^>]*revision="([^"]*)"[^>]*>([\s\S]*?)<\/commit>/);
        if (reposCommitMatch && !lastChangedRevision) {
          lastChangedRevision = reposCommitMatch[1];
          const reposCommitContent = reposCommitMatch[2];

          const authorMatch = reposCommitContent.match(/<author>(.*?)<\/author>/);
          const dateMatch = reposCommitContent.match(/<date>(.*?)<\/date>/);

          if (authorMatch && !lastChangedAuthor) {
            lastChangedAuthor = this.decodeHtmlEntities(authorMatch[1]);
          }
          if (dateMatch && !lastChangedDate) {
            lastChangedDate = dateMatch[1];
          }
        }
      }

      results.push({
        path,
        status: status || ' ',
        workingRevision,
        lastChangedRevision,
        lastChangedAuthor,
        lastChangedDate,
      });
    }

    return results;
  }

  /**
   * Parse Info output
   */
  private parseInfoOutput(output: string): SvnInfoResult {
    const lines = output.split('\n');
    const info: Partial<SvnInfoResult> = {};

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (!value) continue;

      switch (key) {
        case 'Path':
          info.path = value;
          break;
        case 'URL':
          info.url = value;
          break;
        case 'Relative URL':
          info.relativeUrl = value;
          break;
        case 'Repository Root':
          info.repositoryRoot = value;
          break;
        case 'Repository UUID':
          info.repositoryUuid = value;
          break;
        case 'Revision':
          info.revision = value;
          break;
        case 'Node Kind':
          info.nodeKind = value;
          break;
        case 'Schedule':
          info.schedule = value;
          break;
        case 'Last Changed Author':
          info.lastChangedAuthor = value;
          break;
        case 'Last Changed Rev':
          info.lastChangedRev = value;
          break;
        case 'Last Changed Date':
          info.lastChangedDate = value;
          break;
      }
    }

    return info as SvnInfoResult;
  }

  /**
   * Parse Log output (XML)
   */
  private parseLogOutput(xmlOutput: string): SvnLogEntry[] {
    const entries: SvnLogEntry[] = [];
    const logMatch = xmlOutput.match(/<log[^>]*>([\s\S]*)<\/log>/);

    if (!logMatch) {
      return entries;
    }

    const logContent = logMatch[1];
    const entryMatches = logContent.matchAll(/<logentry[^>]*revision="(\d+)"[^>]*>([\s\S]*?)<\/logentry>/g);

    for (const match of entryMatches) {
      const revision = match[1];
      const entryContent = match[2];

      const authorMatch = entryContent.match(/<author>(.*?)<\/author>/);
      const dateMatch = entryContent.match(/<date>(.*?)<\/date>/);
      const msgMatch = entryContent.match(/<msg>(.*?)<\/msg>/);
      const pathsMatch = entryContent.match(/<paths>([\s\S]*?)<\/paths>/);

      const entry: SvnLogEntry = {
        revision,
        author: authorMatch ? this.decodeHtmlEntities(authorMatch[1]) : '',
        date: dateMatch ? dateMatch[1] : '',
        message: msgMatch ? this.decodeHtmlEntities(msgMatch[1]) : '',
      };

      if (pathsMatch) {
        const pathsContent = pathsMatch[1];
        const pathMatches = pathsContent.matchAll(/<path[^>]*action="([^"]*)"[^>]*kind="([^"]*)"[^>]*>(.*?)<\/path>/g);
        entry.paths = [];

        for (const pathMatch of pathMatches) {
          entry.paths.push({
            action: pathMatch[1],
            kind: pathMatch[2],
            path: this.decodeHtmlEntities(pathMatch[3]),
          });
        }
      }

      entries.push(entry);
    }

    return entries;
  }

  /**
   * Parse List output (XML)
   */
  private parseListOutput(xmlOutput: string): string[] {
    const paths: string[] = [];
    const listMatch = xmlOutput.match(/<lists[^>]*>([\s\S]*)<\/lists>/);

    if (!listMatch) {
      return paths;
    }

    const listContent = listMatch[1];
    const entryMatches = listContent.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/g);

    for (const match of entryMatches) {
      const entryContent = match[1];
      const nameMatch = entryContent.match(/<name>(.*?)<\/name>/);

      if (nameMatch) {
        // Decode HTML entities (e.g., &amp; -> &)
        const decodedName = this.decodeHtmlEntities(nameMatch[1]);
        paths.push(decodedName);
      }
    }

    return paths;
  }

  // ========== Helper Methods ==========

  /**
   * Build path arguments array
   */
  private buildPathArgs(path?: string): string[] {
    return path ? [path] : [];
  }

  /**
   * Build revision arguments
   */
  private buildRevisionArgs(revision?: string | number): string[] {
    return revision ? ['--revision', String(revision)] : [];
  }

  /**
   * Build log-specific arguments
   */
  private buildLogArgs(options: SvnLogOptions): string[] {
    const args: string[] = [];

    if (options.limit) {
      args.push('--limit', String(options.limit));
    }

    if (options.revision) {
      args.push('--revision', String(options.revision));
    }

    if (options.stopOnCopy) {
      args.push('--stop-on-copy');
    }

    return args;
  }

  /**
   * Build list-specific arguments
   */
  private buildListArgs(options: SvnListOptions): string[] {
    const args: string[] = [];

    if (options.revision) {
      args.push('--revision', String(options.revision));
    }

    if (options.recursive) {
      args.push('--recursive');
    }

    if (options.depth) {
      args.push('--depth', options.depth);
    }

    return args;
  }

  /**
   * Build diff revision arguments
   */
  private buildDiffRevisionArgs(options: SvnDiffOptions): string[] {
    if (options.revision) {
      return ['--revision', String(options.revision)];
    }

    if (options.oldRevision && options.newRevision) {
      return ['--revision', `${options.oldRevision}:${options.newRevision}`];
    }

    return [];
  }

  /**
   * Build diff command arguments
   */
  private buildDiffCmdArgs(diffCmd?: string): string[] {
    return diffCmd ? ['--diff-cmd', diffCmd] : [];
  }

  /**
   * Build diff path arguments
   */
  private buildDiffPathArgs(path1?: string, path2?: string, options?: SvnOptions): string[] {
    const args: string[] = [];
    const mergedOptions = options ? this.mergeOptions(options) : {};
    const resolvedPath1 = path1 ? this.resolvePath(path1, mergedOptions) : undefined;
    const resolvedPath2 = path2 ? this.resolvePath(path2, mergedOptions) : undefined;

    if (resolvedPath1) {
      args.push(resolvedPath1);
    }

    if (resolvedPath2) {
      args.push(resolvedPath2);
    }

    return args;
  }

  /**
   * Build depth arguments
   */
  private buildDepthArgs(depth?: string): string[] {
    return depth ? ['--depth', depth] : [];
  }

  /**
   * Build export flag arguments
   */
  private buildExportFlags(options: SvnExportOptions): string[] {
    const args: string[] = [];

    if (options.force) {
      args.push('--force');
    }

    if (options.nativeEol) {
      args.push('--native-eol', options.nativeEol);
    }

    if (options.ignoreExternals) {
      args.push('--ignore-externals');
    }

    return args;
  }

  /**
   * Build export path arguments
   */
  private buildExportPathArgs(sourcePath: string, destinationPath: string, options: SvnExportOptions): string[] {
    const args: string[] = [];
    const mergedOptions = this.mergeOptions(options);
    const resolvedSourcePath = this.resolvePath(sourcePath, mergedOptions);

    if (resolvedSourcePath) {
      args.push(resolvedSourcePath);
    }

    args.push(destinationPath);

    return args;
  }

  /**
   * Handle list command errors
   */
  private handleListError(stderr: string, path: string | undefined, options: SvnOptions): void {
    const mergedOptions = this.mergeOptions(options);
    const resolvedPath = this.resolvePath(path, mergedOptions);

    if (stderr.includes('is not a working copy') || stderr.includes('E155007')) {
      this.logger.warn(`List command failed: Path '${resolvedPath || 'current directory'}' is not a working copy. Use a repository URL (e.g., file://, http://) or a working copy path.`);
    } else {
      this.logger.warn(`List command failed: ${stderr}`);
    }
  }

  /**
   * Check if revision is valid
   */
  private isValidRevision(revision: string | undefined): boolean {
    return Boolean(revision && revision !== INVALID_REVISION && /^\d+$/.test(revision));
  }
}
