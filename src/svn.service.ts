import { Injectable } from '@nestjs/common';
import { SvnReadService } from './services/svn-read.service';
import { SvnWriteService } from './services/svn-write.service';
import type { SvnModuleOptions } from './interfaces/svn-module-options.interface';
import type {
  SvnOptions,
  SvnCheckoutOptions,
  SvnUpdateOptions,
  SvnCommitOptions,
  SvnExportOptions,
  SvnLogOptions,
  SvnListOptions,
  SvnCatOptions,
  SvnDiffOptions,
  SvnAddOptions,
  SvnRemoveOptions,
  SvnCopyOptions,
  SvnMoveOptions,
  SvnMkdirOptions,
  SvnStatusResult,
  SvnInfoResult,
  SvnLogEntry,
  SvnCommandResult,
} from './interfaces/svn-options.interface';

/**
 * SVN Service Integration Class
 * Includes both Read and Write services to maintain backward API compatibility
 */
@Injectable()
export class SvnService {
  constructor(
    private readonly readService: SvnReadService,
    private readonly writeService: SvnWriteService,
  ) {}

  /**
   * Set default options
   */
  setDefaultOptions(options: SvnModuleOptions): void {
    this.readService.setDefaultOptions(options);
    this.writeService.setDefaultOptions(options);
  }

  setDebug(debug: boolean): void {
    this.readService.setDebug(debug);
    this.writeService.setDebug(debug);
  }

  // ========== Read Operations ==========

  /**
   * SVN Info
   */
  async info(path?: string, options: SvnOptions = {}): Promise<SvnInfoResult | null> {
    return this.readService.info(path, options);
  }

  /**
   * SVN Status
   */
  async status(path?: string, options: SvnOptions = {}): Promise<SvnStatusResult[]> {
    return this.readService.status(path, options);
  }

  /**
   * SVN Log
   */
  async log(path?: string, options: SvnLogOptions = {}): Promise<SvnLogEntry[]> {
    return this.readService.log(path, options);
  }

  /**
   * SVN List (ls)
   */
  async list(path?: string, options: SvnListOptions = {}): Promise<string[]> {
    return this.readService.list(path, options);
  }

  /**
   * SVN Cat (read file content)
   */
  async cat(path: string, options: SvnCatOptions = {}): Promise<string> {
    return this.readService.cat(path, options);
  }

  /**
   * SVN Diff
   */
  async diff(path1?: string, path2?: string, options: SvnDiffOptions = {}): Promise<string> {
    return this.readService.diff(path1, path2, options);
  }

  /**
   * SVN Export
   */
  async export(sourcePath: string, destinationPath: string, options: SvnExportOptions = {}): Promise<SvnCommandResult> {
    return this.readService.export(sourcePath, destinationPath, options);
  }

  // ========== Write Operations ==========

  /**
   * SVN Checkout
   */
  async checkout(repositoryUrl: string, localPath: string, options: SvnCheckoutOptions = {}): Promise<SvnCommandResult> {
    return this.writeService.checkout(repositoryUrl, localPath, options);
  }

  /**
   * SVN Update
   */
  async update(path?: string, options: SvnUpdateOptions = {}): Promise<SvnCommandResult> {
    return this.writeService.update(path, options);
  }

  /**
   * SVN Commit
   */
  async commit(message: string, options: Omit<SvnCommitOptions, 'message'> = {}): Promise<SvnCommandResult> {
    return this.writeService.commit(message, options);
  }

  /**
   * SVN Add
   */
  async add(paths: string[], options: SvnAddOptions = {}): Promise<SvnCommandResult> {
    return this.writeService.add(paths, options);
  }

  /**
   * SVN Remove
   */
  async remove(paths: string[], options: SvnRemoveOptions = {}): Promise<SvnCommandResult> {
    return this.writeService.remove(paths, options);
  }

  /**
   * SVN Copy
   */
  async copy(sourcePath: string, destinationPath: string, options: SvnCopyOptions = {}): Promise<SvnCommandResult> {
    return this.writeService.copy(sourcePath, destinationPath, options);
  }

  /**
   * SVN Move (rename)
   */
  async move(sourcePath: string, destinationPath: string, options: SvnMoveOptions = {}): Promise<SvnCommandResult> {
    return this.writeService.move(sourcePath, destinationPath, options);
  }

  /**
   * SVN Mkdir
   */
  async mkdir(paths: string[], options: SvnMkdirOptions = {}): Promise<SvnCommandResult> {
    return this.writeService.mkdir(paths, options);
  }
}
