import compression from '@fastify/compress';
import cookieParser from '@fastify/cookie';
import cors from '@fastify/cors';
import { DiscoveryService } from '@golevelup/nestjs-discovery';
import {
  VERSION_NEUTRAL,
  type VersionValue,
} from '@nestjs/common/interfaces/version-options.interface.js';
// eslint-disable-next-line @seedcompany/no-restricted-imports
import { HttpAdapterHost as HttpAdapterHostImpl } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyInstance, HTTPMethods, RouteOptions } from 'fastify';
import rawBody from 'fastify-raw-body';
import * as zlib from 'node:zlib';
import { ConfigService } from '~/core/config/config.service';
import {
  GlobalHttpHook,
  RawBody,
  RouteConfig,
  RouteConstraints,
} from './decorators';
import type { CookieOptions, CorsOptions, HttpHooks, IResponse } from './types';

export type NestHttpApplication = NestFastifyApplication & {
  configure: (
    app: NestFastifyApplication,
    config: ConfigService,
  ) => Promise<void>;
};

export class HttpAdapterHost extends HttpAdapterHostImpl<HttpAdapter> {}

// @ts-expect-error Convert private methods to protected
class PatchedFastifyAdapter extends FastifyAdapter {
  protected injectRouteOptions(
    routerMethodKey: Uppercase<HTTPMethods>,
    ...args: any[]
  ): FastifyInstance {
    // @ts-expect-error work around being marked as private
    return super.injectRouteOptions(routerMethodKey, ...args);
  }
}

export class HttpAdapter extends PatchedFastifyAdapter {
  async configure(app: NestFastifyApplication, config: ConfigService) {
    await app.register(compression, {
      brotliOptions: {
        params: {
          // This API returns text (JSON), so optimize for that
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        },
      },
    });

    await app.register(cors, {
      // typecast to undo deep readonly
      ...(config.cors as CorsOptions),
    });
    await app.register(cookieParser);

    // Only on routes we've decorated.
    await app.register(rawBody, { global: false });

    app.setGlobalPrefix(config.hostUrl$.value.pathname.slice(1));

    config.applyTimeouts(app.getHttpServer(), config.httpTimeouts);

    // Attach hooks
    const globalHooks = await app
      .get(DiscoveryService)
      .providerMethodsWithMetaAtKey<keyof HttpHooks>(GlobalHttpHook.KEY);
    const fastify = app.getHttpAdapter().getInstance();
    for (const globalHook of globalHooks) {
      const handler = globalHook.discoveredMethod.handler.bind(
        globalHook.discoveredMethod.parentClass.instance,
      );
      fastify.addHook(globalHook.meta, handler);
    }
  }

  protected injectRouteOptions(
    method: Uppercase<HTTPMethods>,
    urlOrHandler: string | RouteOptions['handler'],
    maybeHandler?: RouteOptions['handler'],
  ) {
    // I don't know why NestJS allows url/path parameter to be omitted.
    const url = typeof urlOrHandler === 'function' ? '' : urlOrHandler;
    const handler =
      typeof urlOrHandler === 'function' ? urlOrHandler : maybeHandler!;

    const config = RouteConfig.get(handler) ?? {};
    const constraints = RouteConstraints.get(handler) ?? {};
    const rawBody = RawBody.get(handler);

    let version: VersionValue | undefined = (handler as any).version;
    version = version === VERSION_NEUTRAL ? undefined : version;
    if (version) {
      // @ts-expect-error this is what upstream does
      constraints.version = version;
    }

    // Plugin configured to just add the rawBody property while continuing
    // to parse the content type normally.
    // Useful for signed webhook payload validation.
    if (rawBody && !rawBody.passthrough) {
      config.rawBody = true;
    }

    const route: RouteOptions = {
      method,
      url,
      handler,
      ...(Object.keys(constraints).length > 0 ? { constraints } : {}),
      ...(Object.keys(config).length > 0 ? { config } : {}),
    };

    if (rawBody?.passthrough) {
      const { allowContentTypes } = rawBody;
      const contentTypes = Array.isArray(allowContentTypes)
        ? allowContentTypes.slice()
        : ((allowContentTypes ?? '*') as string | RegExp);
      return this.instance.register(async (child) => {
        child.removeAllContentTypeParsers();
        child.addContentTypeParser(
          contentTypes,
          { parseAs: 'buffer' },
          (req, payload, done) => done(null, payload),
        );
        child.route(route);
      });
    }
    return this.instance.route(route);
  }

  setCookie(
    response: IResponse,
    name: string,
    value: string,
    options: CookieOptions,
  ) {
    // Avoid linter wanting us to await sending response.
    // This method just returns the response instance for fluent interface.
    void response.cookie(name, value, options);
  }

  // @ts-expect-error we don't need to be compatible with base
  setHeader(response: IResponse, name: string, value: string) {
    // Avoid linter wanting us to await sending response.
    // This method just returns the response instance for fluent interface.
    void super.setHeader(response, name, value);
  }

  // @ts-expect-error we don't need to be compatible with base
  redirect(response: IResponse, statusCode: number, url: string) {
    // Avoid linter wanting us to await sending response.
    // This method just returns the response instance for fluent interface.
    void super.redirect(response, statusCode, url);
  }
}
