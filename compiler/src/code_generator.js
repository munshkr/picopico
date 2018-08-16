const State = require('./state');
const tuneTpl = require('./tune.h');
const debug = require('debug')('code_generator');

const numChannels = 4;
const defaultHeaderField = 'unknown';

const headerNames = ['title', 'author', 'released'];

const noteCommands = [
  'NOTE_C',  'NOTE_CS', 'NOTE_D',  'NOTE_DS',
  'NOTE_E',  'NOTE_F',  'NOTE_FS', 'NOTE_G',
  'NOTE_GS', 'NOTE_A',  'NOTE_AS', 'NOTE_B'
];

const noteIndexes = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };


class CodeGenerator {
  constructor(document, options) {
    if (typeof(document) === 'undefined') {
      throw new TypeError('document is required');
    }

    this.document = document;
    this.options = options || {};
  }

  generate() {
    let initialStates = this.document.initialState;

    let data = {
      debug: this.options.debug,
      headers: this._buildHeaders(),
      initialStates: initialStates,
      sequences: this._buildSequences(),
      song: this._buildSongTables(initialStates)
    };

    return this._template(data);
  }

  _buildHeaders() {
    let headers = {};

    for (let dir in this.document.directives) {
      if (headerNames.includes(dir)) {
        let value = this.document.directives[dir].trim();
        if (value.length > 32) {
          console.warn(`Argument of header #${dir.name.toUpperCase()} is ` +
            'too long (max 32 characters)');
        }
        headers[dir] = value.slice(0, 32);
      }
    }

    for (let name of headerNames) {
      if (!headers[name]) {
        headers[name] = defaultHeaderField;
      }
      headers[name] = this._padRight(headers[name], 32);
    }

    return headers;
  }

  _pushStateChanges(i, song, state, lastState, updateOnlyState) {
    // push commands to change from lastState to state
    let changes = this._changesFrom(state, lastState);
    debug(`#${i} changes: ${JSON.stringify(changes, null, 4)}`);

    // update lastState
    Object.assign(lastState, state);

    // push commands based on changes
    if (!updateOnlyState) {
      if (changes.noteLength || changes.noteLengthFrames) {
        song.push('NOTE_LEN', state.noteLengthFrames - 1);
      }
      if (changes.quantLength || changes.quantLengthFrames) {
        song.push('QUANT_LEN', state.quantLengthFrames - 1);
      }
      if (changes.transpose) {
        let value = state.transpose & 0xff;
        /* ????
        if (value < 0) {
          value = (0xff + data8 + 1);
        }
        */
        song.push('TRANSPOSE', value);
      }
    }
  }

  _pushInstrument(body, i, song) {
    for (let param in body) {
      let value = body[param];
      switch (param) {
      /*
      case 'adsr': {
        if (value.type === 'sequence' && value.value.length === 4) {
          let seq = value.value.map(n => n.value);
          song.push('ADSR', (seq[1]<<3)|seq[0], (seq[3]<<3)|seq[2]);
        } else {
          console.error('Value for \'adsr\' param must be a sequence of 4 numbers');
        }
        break;
      }
      */
      default:
        console.error(`Instrument parameter not implemented yet: ${param}`);
      }
    }
  }

  _pushSequence(sequence, i, song, state, lastState, updateOnlyState) {
    for (let cmd of sequence) {
      debug(`#${i} cmd: ${JSON.stringify(cmd)}`);

      switch (cmd.type) {
      case 'note':
      case 'rest': {
        this._pushStateChanges(i, song, state, lastState, updateOnlyState);

        // increment borrow
        state.borrow += state.borrowFrames;
        debug(`#${i} borrow = ${state.borrow}`);

        // append notes
        if (!updateOnlyState) {
          debug(`#${i} push cmd: ${JSON.stringify(cmd)}`);
          for (let b of this._bytesFromNoteCommand(cmd, state)) {
            song.push(b);
          }
        }

        break;
      }
      case 'set_tempo':
        state.tempo = cmd.value;
        break;
      case 'set_note_length':
        state.noteLength = cmd.value;
        break;
      case 'set_quantize':
        state.quantLength = cmd.value;
        break;
      case 'set_octave':
        state.octave = cmd.value;
        if (!updateOnlyState) {
          song.push('OCTAVE', state.octave);
        }
        break;
      case 'inc_octave':
        state.octave += 1;
        if (!updateOnlyState) {
          song.push('INC_OCTAVE');
        }
        break;
      case 'dec_octave':
        state.octave -= 1;
        if (!updateOnlyState) {
          song.push('DEC_OCTAVE');
        }
        break;
      case 'transpose': {
        state.transpose = cmd.value;
        break;
      }
      case 'set_volume':
        state.volume = cmd.value;
        if (!updateOnlyState) {
          song.push('VOLUME', state.volume);
        }
        break;
      case 'inc_volume':
        if (cmd.value) {
          console.error('Warning: inc_volume argument is ignored by player');
        }
        state.volume += 1;
        if (!updateOnlyState) {
          song.push('INC_VOLUME');
        }
        break;
      case 'dec_volume':
        if (cmd.value) {
          console.error('Warning: dec_volume argument is ignored by player');
        }
        state.volume -= 1;
        if (!updateOnlyState) {
          song.push('DEC_VOLUME');
        }
        break;
      case 'loop': {
        this._pushStateChanges(i, song, state, lastState, updateOnlyState);
        if (!updateOnlyState) {
          song.push('LOOP_START', cmd.times);
        }
        this._pushSequence(cmd.body, i, song, state, lastState, updateOnlyState);
        for (let j = 0; j < cmd.times - 1; j++) {
          this._pushSequence(cmd.body, i, song, state, lastState, true);
        }
        if (!updateOnlyState) {
          song.push('LOOP_END');
        }
        break;
      }
      case 'set_instrument': {
        let inst = cmd.value;
        if (inst.type === 'anonymous_instrument') {
          this._pushInstrument(inst.value, i, song);
        }
        break;
      }
      default:
        console.error(`Command not implemented yet: ${cmd.type}`);
      }
    }
  }

  _buildSongTables(initialStates) {
    let songs = [], states = [], lastStates = [];

    // create tables
    for (let i = 0; i < numChannels; i++) {
      songs.push([]);
      states.push(new State(initialStates[i]));
      // lastState stores the state before the last *note command*
      lastStates.push(new State(states[i]));
    }

    debug(`initialStates: ${JSON.stringify(lastStates, null, 4)}`);

    for (let elem of this.document.commands) {
      for (let channel of elem.channels) {
        let i = this._channelNumFromName(channel);
        this._pushSequence(elem.sequence, i, songs[i], states[i], lastStates[i]);
      }
    }

    for (let i = 0; i < numChannels; i++) {
      songs[i].push('END');
    }

    return songs;
  }

  _changesFrom(state, lastState) {
    let changes = {};

    for (let k in state) {
      if (state[k] !== lastState[k]) {
        changes[k] = state[k];
      }
    }

    if (state.noteLengthFrames !== lastState.noteLengthFrames) {
      changes.noteLengthFrames = state.noteLengthFrames;
    }
    if (state.quantLengthFrames !== lastState.quantLengthFrames) {
      changes.quantLengthFrames = state.quantLengthFrames;
    }

    return changes;
  }

  _buildSequences() {
    // TODO
    return [];
  }

  _channelNumFromName(name) {
    let n;
    if (name === 'A') { n = 0; }
    if (name === 'B') { n = 1; }
    if (name === 'C') { n = 2; }
    if (name === 'D') { n = 3; }
    return n;
  }

  _bytesFromNoteCommand(command, state) {
    let bytes = [];

    let inst;
    if (command.type === 'rest') {
      inst = 'REST';
    } else {
      let ni = noteIndexes[command.note];
      if (command.accidental === '-') {
        ni = (ni - 1) % 12;
      } else if (command.accidental === '+') {
        ni = (ni + 1) % 12;
      }
      inst = noteCommands[ni];
    }

    // Create a modified state based on custom note length from command
    // (if available)
    let modState = new State(state);
    Object.assign(modState, {
      noteLength: command.length || state.noteLength
    });

    let noteLen = modState.noteLengthFrames;

    // Process "dots" if its a dotted note
    let dotsLen = 2 - (1 / Math.pow(2, command.dots));

    noteLen = noteLen * dotsLen;

    // Add frames "borrow" from previous notes to compensate
    if (state.borrow >= 1) {
      state.borrow -= 1;
      noteLen += 1;
      debug(`state.borrow >= 1, so increment noteLen to ${noteLen}`);
    } else if (state.borrow <= -1) {
      state.borrow += 1;
      noteLen -= 1;
      debug(`state.borrow <= -1, so decrement noteLen to ${noteLen}`);
    }

    // If note length differs from current default note length, append note
    // length and quantization length bytes
    if (noteLen !== state.noteLengthFrames) {
      let noteQuant = modState.quantLengthFrames;
      noteQuant = noteQuant * dotsLen;
      noteQuant = Math.min(noteQuant, noteLen);

      inst = inst + '|WITH_LEN|WITH_Q';
      if (noteLen > 0xff) {
        inst += '|WORD';
      }

      // decrement because player routine requires note length to be n-1
      noteQuant -= 1;
      noteLen -= 1;

      // push note command instruction and operands
      bytes.push(inst);
      bytes.push(noteLen & 0xff);
      if (noteLen > 0xff) {
        bytes.push((noteLen >> 8) & 0xff);
      }
      bytes.push(noteQuant & 0xff);
      if (noteQuant > 0xff) {
        bytes.push((noteQuant >> 8) & 0xff);
      }
    } else {
      bytes.push(inst);
    }

    return bytes;
  }

  _template(data) {
    return tuneTpl(data);
  }

  _padRight(str, len, char) {
    return str + Array(len - str.length + 1).join(char || ' ');
  }
}

module.exports = CodeGenerator;
