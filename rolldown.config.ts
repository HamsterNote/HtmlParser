import { dts } from 'rolldown-plugin-dts'

export default {
  input: {
    index: './src/index.ts',
    'htmlParser.worker': './src/htmlParser.worker.ts'
  },
  plugins: [dts()],
  output: [{ dir: 'dist', format: 'es', sourcemap: true }]
}
