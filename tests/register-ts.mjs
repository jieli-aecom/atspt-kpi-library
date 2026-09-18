// Node 24's type stripping plus resolution of the emitted .js specifiers used by Vercel Functions.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      for (const candidate of specifier.endsWith('.js') ? [specifier.slice(0, -3) + '.ts'] : [specifier + '.ts']) {
        if (existsSync(new URL(candidate, context.parentURL))) return nextResolve(candidate, context);
      }
    }
    return nextResolve(specifier, context);
  }
});
