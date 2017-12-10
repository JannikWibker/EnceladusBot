const mume = require('@shd101wyy/mume')
const fs = require('fs')
const path = './tmp/'

const transpile = async (file) => {
  await mume.init()

  const engine = new mume.MarkdownEngine({
    filePath: file,
    config: {
      previewTheme: "github-light.css",
      codeBlockTheme: "default.css",
      printBackground: true
    }
  })

  await engine.chromeExport({fileType: 'pdf', runAllCodeChunks: true})
}

const main = (str, filename, cb) =>
  write(str, filename.endsWith('.md') ? filename : filename + '.md', () => {
    transpile(path + filename).then(() =>
      cb(path + filename.replace(/\.md/, '.pdf')))
})

const write = (str, filename, cb) => {
  fs.writeFile(path + filename, str, err => {
    if(err) console.log('WRITE ERROR', err);
    cb()
  })
}

module.exports = main
