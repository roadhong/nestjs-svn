import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
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

    // Set locale environment variables for English output
    // Unix/Linux: LANG and LC_ALL are standard
    // Windows: Some tools may respect LC_MESSAGES or LC_ALL, but behavior varies
    // SVN on Windows typically uses system locale, but setting these may help in some cases
    if (process.platform === 'win32') {
      // Windows: Try LC_MESSAGES and LC_ALL (may not work for all tools)
      // Some Windows builds of SVN may respect these variables
      env.LC_MESSAGES = COMMAND_CONSTANTS.LOCALE_EN;
      env.LC_ALL = COMMAND_CONSTANTS.LOCALE_EN;
      // LANG is not standard on Windows, but some tools may check it
      env.LANG = COMMAND_CONSTANTS.LOCALE_EN;
    } else {
      // Unix/Linux/macOS: Standard locale variables
      env.LANG = COMMAND_CONSTANTS.LOCALE_EN;
      env.LC_ALL = COMMAND_CONSTANTS.LOCALE_EN;
    }

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
   * Decode HTML entities in a string
   * First attempts to decode URL encoding, then decodes HTML entities
   * Handles common HTML entities like &amp;, &lt;, &gt;, &quot;, &#39;
   */
  protected decodeHtmlEntities(str: string): string {
    // First try to decode URL encoding
    let decoded = str;
    try {
      decoded = decodeURIComponent(str);
    } catch {
      // If URL decoding fails, use original string
      decoded = str;
    }

    // Then decode HTML entities
    return decoded
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  /**
   * Encode URL path segments (only the path part, not the entire URL)
   * Decodes HTML entities and URL encoding first to avoid double encoding
   * Uses path.posix for URL path manipulation (URLs always use POSIX-style separators)
   */
  private encodeUrlPathSegments(url: string): string {
    try {
      const urlObj = new URL(url);
      // Use POSIX path operations for URL pathname
      const pathSegments = urlObj.pathname.split(path.posix.sep).map((segment) => {
        if (!segment) {
          return segment;
        }
        // decodeHtmlEntities handles both URL decoding and HTML entity decoding
        const decoded = this.decodeHtmlEntities(segment);

        return encodeURIComponent(decoded);
      });

      // Join using POSIX separator
      urlObj.pathname = pathSegments.join(path.posix.sep);

      return urlObj.toString();
    } catch {
      // If URL parsing fails, try to encode path segments manually
      const match = url.match(/^([^/]+:\/\/[^/]+)(\/.*)?$/);
      if (match) {
        const [, base, urlPath] = match;
        if (urlPath) {
          // Use POSIX path operations for URL paths
          const encodedPath = urlPath
            .split(path.posix.sep)
            .map((segment) => {
              if (!segment) {
                return segment;
              }
              // decodeHtmlEntities handles both URL decoding and HTML entity decoding
              const decoded = this.decodeHtmlEntities(segment);

              return encodeURIComponent(decoded);
            })
            .join(path.posix.sep);

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
   * Uses path.posix for URL paths (SVN URLs always use POSIX-style separators)
   */
  protected resolvePath(pathStr: string | undefined, options: SvnOptions): string | undefined {
    if (!pathStr) {
      return pathStr;
    }

    if (options.repositoryUrl) {
      // Remove trailing slash from base URL
      const baseUrl = options.repositoryUrl.replace(/\/$/, '');

      // Handle root paths
      if (pathStr === './' || pathStr === '.' || pathStr === '/') {
        return baseUrl;
      }

      // Normalize relative path using POSIX path (URLs always use /)
      // Remove leading ./ or /
      let relativePath = pathStr.replace(/^\.\//, '').replace(/^\//, '');

      // Normalize path segments using POSIX path.normalize to handle .. and .
      // This ensures proper handling of parent directory references
      relativePath = path.posix.normalize(relativePath);

      // Join base URL with relative path
      // Use POSIX separator for URL paths (always /)
      const fullUrl = `${baseUrl}/${relativePath}`.replace(/\/+/g, '/');

      return this.encodeUrlPathSegments(fullUrl);
    }

    // If path is already a URL, encode its path segments
    if (this.isUrl(pathStr)) {
      return this.encodeUrlPathSegments(pathStr);
    }

    // For local file paths, normalize using platform-specific path
    // But preserve relative paths (don't resolve to absolute)
    if (path.isAbsolute(pathStr)) {
      return path.normalize(pathStr);
    }

    // Normalize relative paths
    return path.normalize(pathStr);
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
   * Uses platform-specific escaping: single quotes for Unix/Linux, double quotes for Windows
   */
  private escapeShellArg(arg: string): string {
    if (!arg) {
      return arg;
    }

    // Simple arguments don't need escaping
    if (!/[^\w\-./:=@%]/.test(arg)) {
      return arg;
    }

    // Windows uses double quotes, Unix/Linux uses single quotes
    if (process.platform === 'win32') {
      // Windows: escape double quotes and wrap in double quotes
      return `"${arg.replace(/"/g, '\\"')}"`;
    } else {
      // Unix/Linux: escape single quotes and wrap in single quotes
      return `'${arg.replace(/'/g, "'\\''")}'`;
    }
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
