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
  MAX_BUFFER: 10 * 1024 * 1024,
  LOCALE_EN: 'C',
} as const;

export abstract class SvnBaseService {
  protected readonly logger: Logger;
  protected defaultOptions: SvnModuleOptions = {};
  protected debug: boolean = false;

  constructor(loggerName: string) {
    this.logger = new Logger(loggerName);
  }

  /**
   * Set default options
   */
  setDefaultOptions(options: SvnModuleOptions): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  setDebug(debug: boolean): void {
    this.debug = debug;
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
   * @param command - Command string to execute
   * @param mergedOptions - Already merged options (from buildSvnArgs) or raw options to merge
   */
  protected async executeCommand(command: string, mergedOptions?: SvnOptions): Promise<SvnCommandResult> {
    if (this.debug) {
      this.logger.debug(`Executing: ${command}`);
    }

    const options = mergedOptions || this.mergeOptions({});

    try {
      const env = this.buildEnvironment(options);
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
   * Encode URL path segments (only the path part, not the entire URL)
   * Decodes each segment first to avoid double encoding
   */
  private encodeUrlPathSegments(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').map((segment) => {
        if (!segment) {
          return segment;
        }
        try {
          const decoded = decodeURIComponent(segment);

          return encodeURIComponent(decoded);
        } catch {
          return encodeURIComponent(segment);
        }
      });
      urlObj.pathname = pathSegments.join('/');

      return urlObj.toString();
    } catch {
      // If URL parsing fails, try to encode path segments manually
      const match = url.match(/^([^/]+:\/\/[^/]+)(\/.*)?$/);
      if (match) {
        const [, base, path] = match;
        if (path) {
          const encodedPath = path
            .split('/')
            .map((segment) => {
              if (!segment) {
                return segment;
              }
              try {
                const decoded = decodeURIComponent(segment);

                return encodeURIComponent(decoded);
              } catch {
                return encodeURIComponent(segment);
              }
            })
            .join('/');

          return `${base}${encodedPath}`;
        }

        return url;
      }

      return url;
    }
  }

  /**
   * Check if a string is a URL
   */
  private isUrl(path: string): boolean {
    return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path);
  }

  /**
   * Resolve path with repositoryUrl option
   * If repositoryUrl is provided, path is always treated as a relative path within repositoryUrl
   */
  protected resolvePath(path: string | undefined, options: SvnOptions): string | undefined {
    if (!path) {
      return path;
    }

    if (options.repositoryUrl) {
      const baseUrl = options.repositoryUrl.replace(/\/$/, '');

      if (path === './' || path === '.' || path === '/') {
        return baseUrl;
      }

      const relativePath = path.replace(/^\.\//, '').replace(/^\//, '');
      const fullUrl = `${baseUrl}/${relativePath}`;

      return this.encodeUrlPathSegments(fullUrl);
    }

    // If path is already a URL, encode its path segments
    if (this.isUrl(path)) {
      return this.encodeUrlPathSegments(path);
    }

    return path;
  }

  /**
   * Build SVN command arguments
   * @returns Tuple of [command string, merged options] - merged options can be reused for executeCommand
   */
  protected buildSvnArgs(command: string, args: string[] = [], options: SvnOptions = {}): [string, SvnOptions] {
    const mergedOptions = this.mergeOptions(options);
    const svnArgs: string[] = [command];

    this.addCommonFlags(svnArgs, mergedOptions);
    this.addAuthFlags(svnArgs, mergedOptions);

    const resolvedArgs = this.resolvePathArgs(args, mergedOptions);
    const escapedArgs = resolvedArgs.map((arg) => this.escapeShellArg(arg));
    svnArgs.push(...escapedArgs);

    return [`svn ${svnArgs.join(' ')}`, mergedOptions];
  }

  /**
   * Escape shell argument to handle special characters safely
   * Wraps path in single quotes and escapes single quotes within
   */
  private escapeShellArg(arg: string): string {
    if (!arg) {
      return arg;
    }

    if (!/[^\w\-./:=@%]/.test(arg)) {
      return arg;
    }

    return `'${arg.replace(/'/g, "'\\''")}'`;
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
      if (arg && !arg.startsWith('--') && !/^\d+$/.test(arg)) {
        return this.resolvePath(arg, options) || arg;
      }

      return arg;
    });
  }
}
