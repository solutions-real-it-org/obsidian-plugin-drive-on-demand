import esbuild from 'esbuild';
import builtins from 'builtin-modules';

const production = process.argv[2] === 'production';

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  target: 'es2022',
  platform: 'browser',
  external: ['obsidian', 'electron', ...builtins],
  outfile: 'main.js',
  sourcemap: production ? false : 'inline',
  minify: production,
  logLevel: 'info',
});

if (production) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
}
