import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import livereload from 'rollup-plugin-livereload'
import { terser } from 'rollup-plugin-terser'
import url from '@rollup/plugin-url'
import iPack from 'svelte-i-pack'
import copy from 'rollup-plugin-copy'
import del from 'rollup-plugin-delete'
import replace from '@rollup/plugin-replace'

import autoPreprocess from 'svelte-preprocess'
import typescript from '@rollup/plugin-typescript'

const production = !process.env.ROLLUP_WATCH

function serve() {
  let server

  function toExit() {
    if (server) server.kill(0)
  }

  return {
    writeBundle() {
      if (server) return
      server = require('child_process').spawn(
        'npm',
        ['run', 'start', '--', '--dev'],
        {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true,
        }
      )
      process.on('SIGTERM', toExit)
      process.on('exit', toExit)
    },
  }
}

export default [
{
  input: 'src/main.js',
  output: {
    sourcemap: true,
    format: 'iife',
    name: 'app',
    file: 'dist/bundle.js'
  },
  plugins: [
    url({ 
      destDir: 'dist'
    }),
    del({ 
      targets: [
        'dist/*'
      ],
      force: true,
      runOnce: true }),
    /* iPack({ inputDir: 'assets' }), */
    svelte({
      preprocess: autoPreprocess(),
      dev: !production,
      emitCss: false
    }),
    typescript({ sourceMap: !production }),
    resolve({
      browser: true,
      dedupe: ['svelte']
    }),
    commonjs(),
    copy({
      targets: [
        { src: 'assets/*', dest: 'dist/assets/' },
        { src: ['public/*.*'], dest: 'dist/' }, 
      ],
      hook: 'writeBundle',
      copyOnce: true
    }),
    !production && serve(),
    // !production && livereload('dist'),
    production && terser({ output: { comments: false } }),
    production && replace({
      preventAssignment: false,
      'https://d3nsdzdtjbr5ml.cloudfront.net/casino/nexus/': '../'
    }), 
  ], 
  watch: {
    clearScreen: false
  }
}
]
