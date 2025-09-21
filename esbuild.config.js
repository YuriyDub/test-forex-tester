import esbuild from 'esbuild';

const config = {
  entryPoints: ['src/chart.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/bundle.js',
  sourcemap: true,
  target: 'es2020',
  minify: false,
  platform: 'browser',
  external: [],
};

// Build function
async function build() {
  try {
    await esbuild.build(config);
    console.log('✅ Build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Watch function for development
async function watch() {
  const context = await esbuild.context({
    ...config,
    minify: false,
  });

  await context.watch();
  console.log('👀 Watching for changes...');
}

// CLI handling
const command = process.argv[2];
if (command === 'watch') {
  watch();
} else {
  build();
}
