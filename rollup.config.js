import uglify from 'rollup-plugin-uglify'

export default {
  input: 'src/clip.js',
  output: {
    file: 'lib/clip.umd.js',
    format: 'umd',
    name: 'clip'
  },
  plugins:[
    uglify()
  ]
}
