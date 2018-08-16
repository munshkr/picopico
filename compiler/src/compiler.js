const Document = require('./document');
const CodeGenerator = require('./code_generator');

class Compiler {
  constructor(options) {
    this.options = options || {};
  }

  compile(source) {
    const document = new Document(source);
    const codeGen = new CodeGenerator(document, this.options);
    return codeGen.generate();
  }
}

module.exports = Compiler;
