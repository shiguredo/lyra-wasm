import fs from "fs";
import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

const banner = `/**
 * ${pkg.name}
 * ${pkg.description}
 * @version: ${pkg.version}
 * @author: ${pkg.author}
 * @license: ${pkg.license}
 **/
`;

export default [
  {
    input: 'src/lyra_sync_worker.ts',
    plugins: [
      typescript({module: "esnext"}),
      commonjs(),
      resolve()
    ],
    output: {
      sourcemap: false,
      format: 'umd',
      file: './dist/lyra_sync_worker.js',
      banner: banner,
    }
  },
  {
    input: 'src/lyra.ts',
    plugins: [
      replace({
        __WEB_WORKER_SCRIPT__: () => fs.readFileSync("dist/lyra_sync_worker.js", "base64"),
        preventAssignment: true
      }),
      typescript({module: "esnext"}),
      commonjs(),
      resolve(),
    ],
    output: {
      sourcemap: false,
      file: './dist/lyra.mjs',
      format: 'module',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  },
  {
    input: 'src/lyra.ts',
    plugins: [
      replace({
        __WEB_WORKER_SCRIPT__: () => fs.readFileSync("dist/lyra_sync_worker.js", "base64"),
        preventAssignment: true
      }),
      typescript({module: "esnext"}),
      commonjs(),
      resolve()
    ],
    output: {
      sourcemap: false,
      file: './dist/lyra.js',
      format: 'umd',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  }
];
