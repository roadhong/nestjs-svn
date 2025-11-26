import { Injectable } from '@nestjs/common';
import { SvnBaseService } from './svn-base.service';
import type {
  SvnCheckoutOptions,
  SvnUpdateOptions,
  SvnCommitOptions,
  SvnAddOptions,
  SvnRemoveOptions,
  SvnCopyOptions,
  SvnMoveOptions,
  SvnMkdirOptions,
  SvnCommandResult,
} from '../interfaces/svn-options.interface';

@Injectable()
export class SvnWriteService extends SvnBaseService {
  constructor() {
    super(SvnWriteService.name);
  }

  /**
   * SVN Checkout
   * Check out a working copy from a repository
   */
  async checkout(repositoryUrl: string, localPath: string, options: SvnCheckoutOptions = {}): Promise<SvnCommandResult> {
    const args = [...this.buildRevisionArgs(options.revision), ...this.buildDepthArgs(options.depth), repositoryUrl, localPath];

    // Don't pass repositoryUrl to buildSvnArgs for checkout
    // repositoryUrl and localPath are already complete paths and shouldn't be resolved
    const optionsWithoutRepoUrl = { ...options };
    delete optionsWithoutRepoUrl.repositoryUrl;

    const command = this.buildSvnArgs('checkout', args, optionsWithoutRepoUrl);

    this.logger.debug(`Executing: ${command}`);

    return this.executeCommand(command, optionsWithoutRepoUrl);
  }

  /**
   * SVN Update
   * Update working copy to a different URL or revision
   */
  async update(path?: string, options: SvnUpdateOptions = {}): Promise<SvnCommandResult> {
    const args = [...this.buildRevisionArgs(options.revision), ...this.buildAcceptArgs(options.accept), ...this.buildPathArgs(path)];
    const command = this.buildSvnArgs('update', args, options);

    this.logger.debug(`Executing: ${command}`);

    return this.executeCommand(command, options);
  }

  /**
   * SVN Commit
   * Send changes from your working copy to the repository
   */
  async commit(message: string, options: Omit<SvnCommitOptions, 'message'> = {}): Promise<SvnCommandResult> {
    const args = ['--message', `"${message}"`, ...this.buildDepthArgs(options.depth), ...this.buildFileArgs(options.files)];
    const command = this.buildSvnArgs('commit', args, options);

    this.logger.debug(`Executing: ${command}`);

    return this.executeCommand(command, options);
  }

  /**
   * SVN Add
   * Put files and directories under version control
   */
  async add(paths: string[], options: SvnAddOptions = {}): Promise<SvnCommandResult> {
    const args = [...this.buildForceArgs(options.force), ...this.buildNoIgnoreArgs(options.noIgnore), ...paths];
    const command = this.buildSvnArgs('add', args, options);

    this.logger.debug(`Executing: ${command}`);

    return this.executeCommand(command, options);
  }

  /**
   * SVN Remove
   * Remove files and directories from version control
   */
  async remove(paths: string[], options: SvnRemoveOptions = {}): Promise<SvnCommandResult> {
    const args = [...this.buildForceArgs(options.force), ...this.buildKeepLocalArgs(options.keepLocal), ...paths];
    const command = this.buildSvnArgs('remove', args, options);

    this.logger.debug(`Executing: ${command}`);

    return this.executeCommand(command, options);
  }

  /**
   * SVN Copy
   * Copy a file or directory in a working copy or in the repository
   */
  async copy(sourcePath: string, destinationPath: string, options: SvnCopyOptions = {}): Promise<SvnCommandResult> {
    const args = [...this.buildRevisionArgs(options.revision), ...this.buildMessageArgs(options.message), ...this.buildParentsArgs(options.parents), sourcePath, destinationPath];
    const command = this.buildSvnArgs('copy', args, options);

    this.logger.debug(`Executing: ${command}`);

    return this.executeCommand(command, options);
  }

  /**
   * SVN Move (rename)
   * Move and/or rename files or directories
   */
  async move(sourcePath: string, destinationPath: string, options: SvnMoveOptions = {}): Promise<SvnCommandResult> {
    const args = [...this.buildMessageArgs(options.message), ...this.buildForceArgs(options.force), ...this.buildParentsArgs(options.parents), sourcePath, destinationPath];
    const command = this.buildSvnArgs('move', args, options);

    this.logger.debug(`Executing: ${command}`);

    return this.executeCommand(command, options);
  }

  /**
   * SVN Mkdir
   * Create a directory under version control
   */
  async mkdir(paths: string[], options: SvnMkdirOptions = {}): Promise<SvnCommandResult> {
    const args = [...this.buildMessageArgs(options.message), ...this.buildParentsArgs(options.parents), ...paths];
    const command = this.buildSvnArgs('mkdir', args, options);

    this.logger.debug(`Executing: ${command}`);

    return this.executeCommand(command, options);
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
   * Build depth arguments
   */
  private buildDepthArgs(depth?: string): string[] {
    return depth ? ['--depth', depth] : [];
  }

  /**
   * Build accept arguments
   */
  private buildAcceptArgs(accept?: string): string[] {
    return accept ? ['--accept', accept] : [];
  }

  /**
   * Build file arguments
   */
  private buildFileArgs(files?: string[]): string[] {
    return files && files.length > 0 ? files : [];
  }

  /**
   * Build force flag arguments
   */
  private buildForceArgs(force?: boolean): string[] {
    return force ? ['--force'] : [];
  }

  /**
   * Build no-ignore flag arguments
   */
  private buildNoIgnoreArgs(noIgnore?: boolean): string[] {
    return noIgnore ? ['--no-ignore'] : [];
  }

  /**
   * Build keep-local flag arguments
   */
  private buildKeepLocalArgs(keepLocal?: boolean): string[] {
    return keepLocal ? ['--keep-local'] : [];
  }

  /**
   * Build message arguments
   */
  private buildMessageArgs(message?: string): string[] {
    return message ? ['--message', `"${message}"`] : [];
  }

  /**
   * Build parents flag arguments
   */
  private buildParentsArgs(parents?: boolean): string[] {
    return parents ? ['--parents'] : [];
  }
}
