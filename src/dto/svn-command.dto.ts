export class SvnCheckoutDto {
  repositoryUrl: string;
  localPath: string;
  username?: string;
  password?: string;
  revision?: string | number;
  depth?: 'empty' | 'files' | 'immediates' | 'infinity';
  trustServerCert?: boolean;
}

export class SvnUpdateDto {
  path?: string;
  revision?: string | number;
  username?: string;
  password?: string;
  accept?: 'postpone' | 'base' | 'mine-full' | 'theirs-full' | 'edit' | 'launch';
}

export class SvnCommitDto {
  message: string;
  files?: string[];
  path?: string;
  username?: string;
  password?: string;
  depth?: 'empty' | 'files' | 'immediates' | 'infinity';
}

export class SvnAddDto {
  paths: string[];
  username?: string;
  password?: string;
  force?: boolean;
}

export class SvnRemoveDto {
  paths: string[];
  username?: string;
  password?: string;
  force?: boolean;
  keepLocal?: boolean;
}
