const assert = require('assert');

const Document = require('../src/document');

describe('Document', () => {
  describe('AST', () => {
    it('is the parsed abstract syntax tree (AST)', () => {
      let doc = new Document('A c4.');

      assert.deepEqual(doc.AST, {
        type: 'document',
        body: [{ type: 'command', channels: ['A'], sequence: [
          { type: 'note', note: 'c', length: 4, dots: 1, accidental: null },
        ] }]
      });
    });
  });

  describe('directives', () => {
    it('returns an object that contains all directives', () => {
      let doc = new Document(`
        A c4.
        #foo 1
        B cde
        #bar 2`);

      assert.deepEqual(doc.directives, {
        foo: '1',
        bar: '2'
      });
    });

    it('keeps the latest directives if there are duplicates', () => {
      let doc = new Document(`
        #foo 1
        #bar 2
        #foo 42`);

      assert.deepEqual(doc.directives, {
        foo: '42',
        bar: '2'
      });
    });
  });

  describe('commands', () => {
    it('returns an array of AST command nodes', () => {
      let doc = new Document(`A c4.
                              BC cd`);

      assert.deepEqual(doc.commands, [
        { type: 'command',
          channels: ['A'],
          sequence: [{ type: 'note', note: 'c', length: 4, dots: 1, accidental: null }] },
        { type: 'command',
          channels: ['B', 'C'],
          sequence: [
            { type: 'note', note: 'c', length: null, dots: 0, accidental: null },
            { type: 'note', note: 'd', length: null, dots: 0, accidental: null }
          ] },
      ]);
    });
  });

  describe('initialState', () => {
    it('returns an array of State objects for each channel', () => {
      let doc = new Document(`A  l8 c
                              BC l4 q6 cd`);

      assert.equal(doc.initialState[0].noteLength, 4);
      //assert.equal(doc.initialState[0].noteLength, 8);
      assert.equal(doc.initialState[1].noteLength, 4);
      assert.equal(doc.initialState[2].noteLength, 4);

      assert.equal(doc.initialState[0].quantLength, 8);
      assert.equal(doc.initialState[1].quantLength, 8);
      //assert.equal(doc.initialState[1].quantLength, 6);
      assert.equal(doc.initialState[2].quantLength, 8);
      //assert.equal(doc.initialState[1].quantLength, 6);
    });
  });
});
