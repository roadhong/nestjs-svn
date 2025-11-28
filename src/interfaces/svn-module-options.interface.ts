export interface SvnModuleOptions {
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
