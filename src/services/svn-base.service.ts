import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { SvnOptions, SvnCommandResult } from '../interfaces/svn-options.interface';
import type { SvnModuleOptions } from '../interfaces/svn-module-options.interface';

const execAsync = promisify(exec);

/**
 * Constants for SVN command execution
 */
const COMMAND_CONSTANTS = {
  MAX_BUFFER: 10 * 1024 * 1024, // 10MB
  LOCALE_EN: 'C',
} as const;

export abstract class SvnBaseService {
  protected readonly logger: Logger;
  protected defaultOptions: SvnModuleOptions = {};

  constructor(loggerName: string) {
    this.logger = new Logger(loggerName);
  }

  /**
   * Set default options
   */
  setDefaultOptions(options: SvnModuleOptions): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Merge default options with provided options
   */
  protected mergeOptions(options: SvnOptions = {}): SvnOptions {
    return {
      ...this.defaultOptions,
      ...options,
    };
  }

  /**
   * Execute SVN command
   */
  protected async executeCommand(command: string, options: SvnOptions = {}): Promise<SvnCommandResult> {
    const mergedOptions = this.mergeOptions(options);

    try {
      const env = this.buildEnvironment(mergedOptions);
      const cwd = process.cwd();

      const { stdout, stderr } = await execAsync(command, {
        cwd,
        env,
        maxBuffer: COMMAND_CONSTANTS.MAX_BUFFER,
      });

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (error: unknown) {
      return this.handleCommandError(error);
    }
  }

  /**
   * Build environment variables for SVN command execution
   */
  private buildEnvironment(options: SvnOptions): NodeJS.ProcessEnv {
    const env = { ...process.env };

    // Force SVN output to English for parsing stability
    env.LANG = COMMAND_CONSTANTS.LOCALE_EN;
    env.LC_ALL = COMMAND_CONSTANTS.LOCALE_EN;

    if (options.username) {
      env.SVN_USERNAME = options.username;
    }

    if (options.password) {
      env.SVN_PASSWORD = options.password;
    }

    return env;
  }

  /**
   * Handle command execution errors
   */
  private handleCommandError(error: unknown): SvnCommandResult {
    if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error && 'code' in error) {
      const execError = error as { stdout?: string; stderr?: string; code?: number; message?: string };

      return {
        success: false,
        stdout: execError.stdout?.trim() || '',
        stderr: execError.stderr?.trim() || execError.message || '',
        code: execError.code,
      };
    }

    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    };
  }

  /**
   * Resolve path with repositoryUrl option
   * If repositoryUrl is provided, path is always treated as a relative path within repositoryUrl
   */
  protected resolvePath(path: string | undefined, options: SvnOptions): string | undefined {
    if (!options.repositoryUrl) {
      return path;
    }

    const baseUrl = this.normalizeBaseUrl(options.repositoryUrl);

    if (this.isRootPath(path)) {
      return baseUrl;
    }

    const relativePath = this.normalizeRelativePath(path);

    return `${baseUrl}/${relativePath}`;
  }

  /**
   * Normalize base URL by removing trailing slash
   */
  private normalizeBaseUrl(url: string): string {
    return url.replace(/\/$/, '');
  }

  /**
   * Check if path is root or empty
   */
  private isRootPath(path: string | undefined): boolean {
    return !path || path === './' || path === '.' || path === '/';
  }

  /**
   * Normalize relative path by removing leading slashes and ./
   */
  private normalizeRelativePath(path: string | undefined): string {
    if (!path) {
      return '';
    }

    return path.replace(/^\.\//, '').replace(/^\//, '');
  }

  /**
   * Build SVN command arguments
   */
  protected buildSvnArgs(command: string, args: string[] = [], options: SvnOptions = {}): string {
    const mergedOptions = this.mergeOptions(options);
    const svnArgs: string[] = [command];

    this.addCommonFlags(svnArgs, mergedOptions);
    this.addAuthFlags(svnArgs, mergedOptions);

    const resolvedArgs = this.resolvePathArgs(args, mergedOptions);
    svnArgs.push(...resolvedArgs);

    return `svn ${svnArgs.join(' ')}`;
  }

  /**
   * Add common SVN flags to command arguments
   */
  private addCommonFlags(svnArgs: string[], options: SvnOptions): void {
    if (options.nonInteractive !== false) {
      svnArgs.push('--non-interactive');
    }

    if (options.trustServerCert) {
      svnArgs.push('--trust-server-cert');
    }

    if (options.noAuthCache) {
      svnArgs.push('--no-auth-cache');
    }
  }

  /**
   * Add authentication flags to command arguments
   */
  private addAuthFlags(svnArgs: string[], options: SvnOptions): void {
    if (options.username) {
      svnArgs.push('--username', options.username);
    }

    if (options.password) {
      svnArgs.push('--password', options.password);
    }
  }

  /**
   * Resolve paths in arguments with repositoryUrl option
   */
  private resolvePathArgs(args: string[], options: SvnOptions): string[] {
    return args.map((arg) => {
      if (this.isPathArgument(arg, options)) {
        return this.resolvePath(arg, options) || arg;
      }

      return arg;
    });
  }

  /**
   * Check if argument looks like a path (not a flag or number)
   */
  private isPathArgument(arg: string, options: SvnOptions): boolean {
    return Boolean(arg && !arg.startsWith('--') && !/^\d+$/.test(arg) && options.repositoryUrl);
  }
}
