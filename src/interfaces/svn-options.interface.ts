export interface SvnOptions {
  /**
   * SVN username
   */
  username?: string;

  /**
   * SVN password
   */
  password?: string;

  /**
   * Repository URL (used for resolving relative paths)
   */
  repositoryUrl?: string;

  /**
   * Non-interactive mode (default: true)
   */
  nonInteractive?: boolean;

  /**
   * Trust server certificate
   */
  trustServerCert?: boolean;

  /**
   * Disable authentication cache
   */
  noAuthCache?: boolean;
}

export interface SvnCheckoutOptions extends SvnOptions {
  /**
   * Revision to checkout
   */
  revision?: string | number;

  /**
   * Checkout depth
   */
  depth?: 'empty' | 'files' | 'immediates' | 'infinity';
}

export interface SvnUpdateOptions extends SvnOptions {
  /**
   * Revision to update to
   */
  revision?: string | number;

  /**
   * Conflict resolution method
   */
  accept?: 'postpone' | 'base' | 'mine-full' | 'theirs-full' | 'edit' | 'launch';
}

export interface SvnCommitOptions extends SvnOptions {
  /**
   * Commit message (required)
   */
  message: string;

  /**
   * Files to commit
   */
  files?: string[];

  /**
   * Commit depth
   */
  depth?: 'empty' | 'files' | 'immediates' | 'infinity';
}

export interface SvnExportOptions extends SvnOptions {
  /**
   * Revision to export
   */
  revision?: string | number;

  /**
   * Export depth
   */
  depth?: 'empty' | 'files' | 'immediates' | 'infinity';

  /**
   * Overwrite existing files
   */
  force?: boolean;

  /**
   * Use native end-of-line characters
   */
  nativeEol?: string;

  /**
   * Ignore externals
   */
  ignoreExternals?: boolean;
}

export interface SvnLogOptions extends SvnOptions {
  /**
   * Limit number of log entries
   */
  limit?: number;

  /**
   * Revision to query
   */
  revision?: string;

  /**
   * Stop on copy
   */
  stopOnCopy?: boolean;
}

export interface SvnListOptions extends SvnOptions {
  /**
   * Revision to query
   */
  revision?: string;

  /**
   * Recursive listing
   */
  recursive?: boolean;

  /**
   * List depth
   */
  depth?: 'empty' | 'files' | 'immediates' | 'infinity';
}

export interface SvnCatOptions extends SvnOptions {
  /**
   * Revision to read
   */
  revision?: string;
}

export interface SvnDiffOptions extends SvnOptions {
  /**
   * Revision to compare
   */
  revision?: string;

  /**
   * Old revision (used together with newRevision)
   */
  oldRevision?: string;

  /**
   * New revision (used together with oldRevision)
   */
  newRevision?: string;

  /**
   * Diff command to use
   */
  diffCmd?: string;
}

export interface SvnAddOptions extends SvnOptions {
  /**
   * Force add (add files already under version control)
   */
  force?: boolean;

  /**
   * Ignore ignore rules
   */
  noIgnore?: boolean;
}

export interface SvnRemoveOptions extends SvnOptions {
  /**
   * Force remove
   */
  force?: boolean;

  /**
   * Keep local files
   */
  keepLocal?: boolean;
}

export interface SvnCopyOptions extends SvnOptions {
  /**
   * Revision to copy
   */
  revision?: string;

  /**
   * Commit message
   */
  message?: string;

  /**
   * Create parent directories
   */
  parents?: boolean;
}

export interface SvnMoveOptions extends SvnOptions {
  /**
   * Commit message
   */
  message?: string;

  /**
   * Force move
   */
  force?: boolean;

  /**
   * Create parent directories
   */
  parents?: boolean;
}

export interface SvnMkdirOptions extends SvnOptions {
  /**
   * Commit message
   */
  message?: string;

  /**
   * Create parent directories
   */
  parents?: boolean;
}

export interface SvnStatusResult {
  /**
   * File/directory path
   */
  path: string;

  /**
   * Status character (A: added, M: modified, D: deleted, ?: not versioned, !: missing, ~: obstructed, C: conflict, etc.)
   */
  status: string;

  /**
   * Working copy revision
   */
  workingRevision?: string;

  /**
   * Last changed revision
   */
  lastChangedRevision?: string;

  /**
   * Last changed author
   */
  lastChangedAuthor?: string;

  /**
   * Last changed date
   */
  lastChangedDate?: string;
}

export interface SvnInfoResult {
  /**
   * Path
   */
  path: string;

  /**
   * Repository URL
   */
  url: string;

  /**
   * Relative URL
   */
  relativeUrl: string;

  /**
   * Repository root
   */
  repositoryRoot: string;

  /**
   * Repository UUID
   */
  repositoryUuid: string;

  /**
   * Revision
   */
  revision: string;

  /**
   * Node kind (file, dir, etc.)
   */
  nodeKind: string;

  /**
   * Schedule (normal, add, delete, replace, etc.)
   */
  schedule?: string;

  /**
   * Last changed author
   */
  lastChangedAuthor?: string;

  /**
   * Last changed revision
   */
  lastChangedRev?: string;

  /**
   * Last changed date
   */
  lastChangedDate?: string;
}

export interface SvnLogEntry {
  /**
   * Revision
   */
  revision: string;

  /**
   * Author
   */
  author: string;

  /**
   * Commit date
   */
  date: string;

  /**
   * Commit message
   */
  message: string;

  /**
   * Changed files
   */
  paths?: Array<{
    /**
     * Change action (A: added, M: modified, D: deleted, etc.)
     */
    action: string;

    /**
     * File path
     */
    path: string;

    /**
     * File kind (file, dir, etc.)
     */
    kind?: string;
  }>;
}

export interface SvnCommandResult {
  /**
   * Operation success status
   */
  success: boolean;

  /**
   * Standard output
   */
  stdout: string;

  /**
   * Standard error output
   */
  stderr: string;

  /**
   * Exit code
   */
  code?: number;
}
