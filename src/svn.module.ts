import { DynamicModule, Global, Module } from '@nestjs/common';
import { SvnService } from './svn.service';
import { SvnReadService } from './services/svn-read.service';
import { SvnWriteService } from './services/svn-write.service';
import { SvnModuleOptions } from './interfaces/svn-module-options.interface';

@Global()
@Module({})
export class SvnModule {
  static forRoot(options?: SvnModuleOptions, debug?: boolean): DynamicModule {
    return {
      module: SvnModule,
      providers: [
        SvnReadService,
        SvnWriteService,
        {
          provide: SvnService,
          useFactory: (readService: SvnReadService, writeService: SvnWriteService) => {
            const service = new SvnService(readService, writeService);

            if (options) {
              service.setDefaultOptions(options);
            }
            service.setDebug(debug);

            return service;
          },
          inject: [SvnReadService, SvnWriteService],
        },
      ],
      exports: [SvnService],
    };
  }

  static forRootAsync(options: { useFactory: (...args: any[]) => Promise<SvnModuleOptions> | SvnModuleOptions; inject?: any[] }, debug?: boolean): DynamicModule {
    return {
      module: SvnModule,
      providers: [
        SvnReadService,
        SvnWriteService,
        {
          provide: SvnService,
          useFactory: async (readService: SvnReadService, writeService: SvnWriteService, ...args: any[]) => {
            const moduleOptions = await options.useFactory(...args);
            const service = new SvnService(readService, writeService);

            if (moduleOptions) {
              service.setDefaultOptions(moduleOptions);
            }
            service.setDebug(debug);

            return service;
          },
          inject: [SvnReadService, SvnWriteService, ...((options.inject || []) as any[])],
        },
      ],
      exports: [SvnService],
    };
  }
}
