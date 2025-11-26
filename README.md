# NestJS SVN Module

A NestJS module for SVN (Subversion) that provides read/write operations to interact with SVN repositories.

## ⚠️ Warning

This module requires SVN (Subversion) to be installed on your system. Make sure SVN is installed and available in your PATH before using this module.

You can verify SVN installation by running:

```bash
svn --version
```

## Installation

```bash
npm install nestjs-svn
# or
pnpm add nestjs-svn
# or
yarn add nestjs-svn
```

## Module Configuration

### Basic Configuration (forRoot)

```typescript
import { Module } from '@nestjs/common';
import { SvnModule } from 'nestjs-svn';

@Module({
  imports: [
    SvnModule.forRoot({
      username: 'your-username',
      password: 'your-password',
      repositoryUrl: 'https://svn.example.com/repo',
      trustServerCert: true,
      nonInteractive: true,
    }),
  ],
})
export class AppModule {}
```

### Async Configuration (forRootAsync)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SvnModule } from 'nestjs-svn';

@Module({
  imports: [
    SvnModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        username: configService.get('SVN_USERNAME'),
        password: configService.get('SVN_PASSWORD'),
        repositoryUrl: configService.get('SVN_REPO_URL'),
        trustServerCert: true,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Usage

### Service Injection

```typescript
import { Injectable } from '@nestjs/common';
import { SvnService } from 'nestjs-svn';

@Injectable()
export class MyService {
  constructor(private readonly svnService: SvnService) {}

  async doSomething() {
    // Perform SVN operations
  }
}
```

## Available Features

### Read Operations

Operations that only query information or read files from the repository. These operations do not modify the repository or working copy.

- **info** - Get repository information (returns `SvnInfoResult | null`)
- **status** - Get working copy status (returns `SvnStatusResult[]`)
- **log** - Get commit logs (returns `SvnLogEntry[]`)
- **list** - List directory contents (returns `string[]`)
- **cat** - Read file contents (returns `string`)
- **diff** - Get differences (returns `string`)
- **export** - Export from repository (without creating working copy) (returns `SvnCommandResult`)

### Write Operations

Operations that modify the repository or working copy, or create a local working copy.

- **checkout** - Checkout repository (creates working copy) (returns `SvnCommandResult`)
- **update** - Update working copy (returns `SvnCommandResult`)
- **add** - Add files/directories (returns `SvnCommandResult`)
- **remove** - Remove files/directories (returns `SvnCommandResult`)
- **commit** - Commit changes (returns `SvnCommandResult`)
- **copy** - Copy files/directories (returns `SvnCommandResult`)
- **move** - Move/rename files/directories (returns `SvnCommandResult`)
- **mkdir** - Create directory (returns `SvnCommandResult`)

## Options

### Common Options (SvnOptions)

```typescript
interface SvnOptions {
  username?: string; // SVN username
  password?: string; // SVN password
  repositoryUrl?: string; // Repository URL (used for resolving relative paths)
  nonInteractive?: boolean; // Non-interactive mode (default: true)
  trustServerCert?: boolean; // Trust server certificate
  noAuthCache?: boolean; // Disable authentication cache
}
```

## Using repositoryUrl Option

When using the `repositoryUrl` option, all paths are interpreted as relative paths within that repository URL. This allows you to use relative paths instead of absolute URLs.

## License

MIT
