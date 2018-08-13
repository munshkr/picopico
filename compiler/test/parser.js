const assert = require('assert');
const fs = require('fs');
const peg = require('pegjs');
const path = require('path');

const grammar = fs.readFileSync(path.join(__dirname, '../src/grammar.peg')).toString();
const parse = peg.generate(grammar).parse;

function buildDocument(body) {
  body = body || [];
  return { type: 'document', body: body };
}

describe('Parser', () => {
  describe('Directive', () => {
    it('starts with a # and has a name', () => {
      assert.deepEqual(parse('#foo'),
        buildDocument([{ type: 'directive', name: 'foo', arg: null }])
      );

      assert.deepEqual(parse('  #with_ws \n'),
        buildDocument([{ type: 'directive', name: 'with_ws', arg: null }])
      );
    });

    it('has arguments', () => {
      assert.deepEqual(parse('#title this song'),
        buildDocument([{ type: 'directive', name: 'title', arg: 'this song' }])
      );

      assert.deepEqual(parse('  #with_ws   foo\n\n'),
        buildDocument([{ type: 'directive', name: 'with_ws', arg: 'foo' }])
      );
    });
  });

  describe('Instrument', () => {
    let prg = (bodies) => {
      return buildDocument([{
        type: 'instrument',
        name: 'foo',
        bodies: bodies
      }]);
    };

    it('has a name and an empty body', () => {
      assert.deepEqual(parse('foo { }'), prg([ {} ]));
    });

    it('has a body with parameters', () => {
      assert.deepEqual(parse('foo { a: 0, b: 1, c: 2 }'),
        prg([ {
          a: { type: 'number', value: 0 },
          b: { type: 'number', value: 1 },
          c: { type: 'number', value: 2 }
        } ]));
    });

    it('has many bodies, separated by commas', () => {
      assert.deepEqual(parse('foo { a: 0 }, { b: 1 }'),
        prg([ { a: { type: 'number', value: 0 } },
          { b: { type: 'number', value: 1 } } ]));
    });

    it('has many instrument identifiers, separated by commas', () => {
      assert.deepEqual(parse('foo lead, guitar'),
        prg([ 'lead', 'guitar' ]));
    });

    it('has both bodies and identifiers, separated by commas', () => {
      assert.deepEqual(parse('foo { a: 1 }, bass'),
        prg([ { a: { type: 'number', value: 1 } }, 'bass' ]));
    });

    describe('ParameterValue', () => {
      it('is a number literal', () => {
        assert.deepEqual(parse('foo { a: 42 }'),
          prg([ { a: { type: 'number', value: 42 } } ]));
      });

      it('is an interval', () => {
        assert.deepEqual(parse('foo { a: 1:10 }'),
          prg([ { a: { type: 'interval', from: 1, to: 10, step: null } } ]));
      });

      it('is a number with a repeat marker', () => {
        assert.deepEqual(parse('foo { a: 5\'4 }'),
          prg([ { a: { type: 'repeated_number', value: 5, times: 4 } } ]));
      });

      it('is a sequence', () => {
        assert.deepEqual(parse('foo { a: [1 2 3 4] }'),
          prg([ { a: { type: 'sequence', value: [
            { type: 'number', value: 1 },
            { type: 'number', value: 2 },
            { type: 'number', value: 3 },
            { type: 'number', value: 4 },
          ] } } ]));
      });
    });

    describe('NumLiteral', () => {
      it('is a decimal number', () => {
        assert.deepEqual(parse('foo { a: 42 }'),
          prg([ { a: { type: 'number', value: 42 } } ]));
      });

      it('is a negative decimal number', () => {
        assert.deepEqual(parse('foo { a: -1 }'),
          prg([ { a: { type: 'number', value: -1 } } ]));
      });

      it('is an hexadecimal number with a $ prefix', () => {
        assert.deepEqual(parse('foo { a: $fe }'),
          prg([ { a: { type: 'number', value: 0xfe } } ]));
      });

      it('is an hexadecimal number with a 0x prefix', () => {
        assert.deepEqual(parse('foo { a: 0xff }'),
          prg([ { a: { type: 'number', value: 0xff } } ]));
      });
    });

    describe('Interval', () => {
      it('has a +from+ and +to+', () => {
        assert.deepEqual(parse('foo { a: 0:4 }'),
          prg([ { a: { type: 'interval', from: 0, to: 4, step: null } } ]));
      });

      it('has an optional +step+ value', () => {
        assert.deepEqual(parse('foo { a: 1:10:3 }'),
          prg([ { a: { type: 'interval', from: 1, to: 10, step: 3 } } ]));
      });
    });

    describe('Sequence', () => {
      it('is a list of number literals', () => {
        assert.deepEqual(parse('foo { a: [ 10 20 30 ] }'),
          prg([ { a: { type: 'sequence', value: [
            { type: 'number', value: 10 },
            { type: 'number', value: 20 },
            { type: 'number', value: 30 }
          ] } } ]));
      });

      it('is a list of symbol literals', () => {
        assert.deepEqual(parse('foo { a: [ abc def ] }'),
          prg([ { a: { type: 'sequence', value: [
            { type: 'symbol', value: 'abc' },
            { type: 'symbol', value: 'def' }
          ] } } ]));
      });

      it('has a loop marker', () => {
        assert.deepEqual(parse('foo { a: [ 10 8 | 4 3 ] }'),
          prg([ { a: { type: 'sequence', value: [
            { type: 'number', value: 10 },
            { type: 'number', value: 8 },
            { type: 'loop_marker' },
            { type: 'number', value: 4 },
            { type: 'number', value: 3 },
          ] } } ]));
      });

      it('is a list of intervals', () => {
        assert.deepEqual(parse('foo { a: [ 1:4 4:12:2 ] }'),
          prg([ { a: { type: 'sequence', value: [
            { type: 'interval', from: 1, to: 4, step: null },
            { type: 'interval', from: 4, to: 12, step: 2 },
          ] } } ]));
      });
    });
  });

  describe('Command', () => {
    it('starts with a list of channels in uppercase letters', () => {
      assert.deepEqual(parse('A'), buildDocument([
        { type: 'command',
          channels: ['A'],
          sequence: [] }
      ]));

      assert.deepEqual(parse('AC'), buildDocument([
        { type: 'command',
          channels: ['A', 'C'],
          sequence: [] }
      ]));
    });

    it('has a sequence of commands after channel list', () => {
      assert.deepEqual(parse('A t130 l8 q7'), buildDocument([
        { type: 'command',
          channels: ['A'],
          sequence: [
            { type: 'set_tempo', value: 130 },
            { type: 'set_note_length', value: 8 },
            { type: 'set_quantize', value: 7 }
          ] }
      ]));
    });
  });

  describe('CommandSequence', () => {
    let prg = (sequence) => {
      return buildDocument([{
        type: 'command',
        channels: ['A'],
        sequence: sequence
      }]);
    };

    it('has a Note command', () => {
      assert.deepEqual(parse('A c8de+.'), prg([
        { type: 'note', note: 'c', length: 8, dots: 0, accidental: null },
        { type: 'note', note: 'd', length: null, dots: 0, accidental: null },
        { type: 'note', note: 'e', length: null, dots: 1, accidental: '+' }
      ]));
    });

    describe('Note', () => {
      it('has a note length after note letter', () => {
        assert.deepEqual(parse('A c8 d16'), prg([
          { type: 'note', note: 'c', length: 8, dots: 0, accidental: null },
          { type: 'note', note: 'd', length: 16, dots: 0, accidental: null }
        ]));
      });

      it('has a note length and quantization length after note letter', () => {
        /*
        assert.deepEqual(parse('A d4,7'), prg([
          { type: 'note', note: 'd', length: 16, dots: 0, accidental: null }
        ]));
        */
      });

      it('has a letter with a "+" or "-" for accidentals', () => {
        assert.deepEqual(parse('A c c+ d-'), prg([
          { type: 'note', note: 'c', length: null, dots: 0, accidental: null },
          { type: 'note', note: 'c', length: null, dots: 0, accidental: '+' },
          { type: 'note', note: 'd', length: null, dots: 0, accidental: '-' }
        ]));
      });

      it('has multiple dots', () => {
        assert.deepEqual(parse('A c c. c.. c...'), prg([
          { type: 'note', note: 'c', length: null, dots: 0, accidental: null },
          { type: 'note', note: 'c', length: null, dots: 1, accidental: null },
          { type: 'note', note: 'c', length: null, dots: 2, accidental: null },
          { type: 'note', note: 'c', length: null, dots: 3, accidental: null }
        ]));
      });
    });

    it('has a Rest command', () => {
      assert.deepEqual(parse('A r r16 r4..'), prg([
        { type: 'rest', length: null, dots: 0 },
        { type: 'rest', length: 16, dots: 0 },
        { type: 'rest', length: 4, dots: 2 },
      ]));
    });

    it('has a Set Tempo command', () => {
      assert.deepEqual(parse('A t60'), prg([
        { type: 'set_tempo', value: 60 }
      ]));
    });

    it('has a Set Note Length command', () => {
      assert.deepEqual(parse('A l32'), prg([
        { type: 'set_note_length', value: 32 }
      ]));
    });

    it('has a Set Quantize command', () => {
      assert.deepEqual(parse('A q8'), prg([
        { type: 'set_quantize', value: 8 }
      ]));
    });

    it('has a Set Quantize by Frames command', () => {
      assert.deepEqual(parse('A Q18'), prg([
        { type: 'set_quantize_frames', value: 18 }
      ]));
    });

    it('has a Set Octave command', () => {
      assert.deepEqual(parse('A o3 c'), prg([
        { type: 'set_octave', value: 3 },
        { type: 'note', note: 'c', length: null, dots: 0, accidental: null }
      ]));
    });

    it('has an Increment Octave command', () => {
      assert.deepEqual(parse('A c>d>'), prg([
        { type: 'note', note: 'c', length: null, dots: 0, accidental: null },
        { type: 'inc_octave' },
        { type: 'note', note: 'd', length: null, dots: 0, accidental: null },
        { type: 'inc_octave' }
      ]));
    });

    it('has a Decrement Octave command', () => {
      assert.deepEqual(parse('A c<<d'), prg([
        { type: 'note', note: 'c', length: null, dots: 0, accidental: null },
        { type: 'dec_octave' },
        { type: 'dec_octave' },
        { type: 'note', note: 'd', length: null, dots: 0, accidental: null }
      ]));
    });

    it('has a Transpose command', () => {
      assert.deepEqual(parse('A K7 K-12'), prg([
        { type: 'transpose', value: 7 },
        { type: 'transpose', value: -12 },
      ]));
    });

    it('has a Set Pitch command', () => {
      assert.deepEqual(parse('A p80 p-10'), prg([
        { type: 'set_pitch', value: 80 },
        { type: 'set_pitch', value: -10 },
      ]));
    });

    it('has a Set Timbre command', () => {
      assert.deepEqual(parse('A V0 V7'), prg([
        { type: 'set_timbre', value: 0 },
        { type: 'set_timbre', value: 7 },
      ]));
    });

    it('has a Set Volume command', () => {
      assert.deepEqual(parse('A v4'), prg([
        { type: 'set_volume', value: 4 }
      ]));
    });

    it('has an Increase Volume command', () => {
      assert.deepEqual(parse('A c v+ d v+'), prg([
        { type: 'note', note: 'c', length: null, dots: 0, accidental: null },
        { type: 'inc_volume', value: null },
        { type: 'note', note: 'd', length: null, dots: 0, accidental: null },
        { type: 'inc_volume', value: null }
      ]));
    });

    it('has an Decrease Volume command', () => {
      assert.deepEqual(parse('A c v- d v-'), prg([
        { type: 'note', note: 'c', length: null, dots: 0, accidental: null },
        { type: 'dec_volume', value: null },
        { type: 'note', note: 'd', length: null, dots: 0, accidental: null },
        { type: 'dec_volume', value: null }
      ]));
    });

    it('has a Set Instrument command', () => {
      assert.deepEqual(parse('A @foo c @bar d'), prg([
        { type: 'set_instrument', value: { type: 'instrument_name', value: 'foo' } },
        { type: 'note', note: 'c', length: null, dots: 0, accidental: null },
        { type: 'set_instrument', value: { type: 'instrument_name', value: 'bar' } },
        { type: 'note', note: 'd', length: null, dots: 0, accidental: null }
      ]));
    });

    it('has a Set Anonymous Instrument command', () => {
      assert.deepEqual(parse('A @{ a: 42 } c @{a:1,b:2} d'), prg([
        { type: 'set_instrument',
          value: { type: 'anonymous_instrument',
            value: { a: { type: 'number', value: 42 } } } },
        { type: 'note', note: 'c', length: null, dots: 0, accidental: null },
        { type: 'set_instrument',
          value: { type: 'anonymous_instrument',
            value: {
              a: { type: 'number', value: 1 },
              b: { type: 'number', value: 2 } } } },
        { type: 'note', note: 'd', length: null, dots: 0, accidental: null }
      ]));
    });
  });

  describe('Document', () => {
    it('can be empty', () => {
      assert.deepEqual(parse(''), buildDocument());
    });

    it('can have Directives', () => {
      assert.deepEqual(
        parse(`#TITLE My song
                       #AUTHOR n0x\n`),
        buildDocument([
          { type: 'directive', name: 'title', arg: 'My song' },
          { type: 'directive', name: 'author', arg: 'n0x' }
        ])
      );
    });

    it('can have Commands', () => {
      assert.deepEqual(
        parse(`
          ABC t120 cde  
          A c
        `),
        buildDocument([
          {
            type: 'command',
            channels: ['A', 'B', 'C'],
            sequence: [
              { type: 'set_tempo', value: 120 },
              { type: 'note', note: 'c', length: null, dots: 0, accidental: null },
              { type: 'note', note: 'd', length: null, dots: 0, accidental: null },
              { type: 'note', note: 'e', length: null, dots: 0, accidental: null }
            ]
          },
          {
            type: 'command',
            channels: ['A'],
            sequence: [
              { type: 'note', note: 'c', length: null, dots: 0, accidental: null }
            ]
          }
        ])
      );
    });

    it('can have Instruments', () => {
      assert.deepEqual(
        parse(`
          inst1 {
            foo: [1 2],  
            bar: 1:10  
          }

          inst1bis {
            baz: 42
          }, inst1  

          A @inst1bis c`),
        buildDocument([
          {
            type: 'instrument',
            name: 'inst1',
            bodies: [
              {
                foo: {
                  type: 'sequence',
                  value: [
                    { type: 'number', value: 1 },
                    { type: 'number', value: 2 }
                  ]
                },
                bar: {
                  type: 'interval',
                  from: 1,
                  to: 10,
                  step: null
                }
              }
            ]
          },
          {
            type: 'instrument',
            name: 'inst1bis',
            bodies: [
              { baz: { type: 'number', value: 42 } },
              'inst1'
            ]
          },
          {
            type: 'command',
            channels: ['A'],
            sequence: [
              { type: 'set_instrument', value: { type: 'instrument_name', value: 'inst1bis' } },
              { type: 'note', note: 'c', length: null, dots: 0, accidental: null },
            ]
          }
        ])
      );
    });
  });
});
