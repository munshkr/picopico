function playSong(mmlData) {
  "use strict";

  function inherits(ctor, superCtor) {
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: { value: ctor }
    });
  }

  function repeat(n, ch) {
    var str = "";
    for (var i = 0; i < n; i++) {
      str += ch;
    }
    return str;
  }

  function midicps(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  var ToneGenerator = (function() {
    function ToneGenerator() {
      this.sampleRate = Pico.sampleRate;
      this.velocity = 0.8;
      this.cell = new Float32Array(Pico.bufferSize);
    }

    ToneGenerator.prototype.setVelocity = function(val) {
      return this.velocity = val / 16;
    };

    ToneGenerator.prototype.setParams = function(val) {
      if (this.env) {
        this.env.setParams(val);
      }
    };

    return ToneGenerator;
  })();

  var PwmGenerator = (function() {
    function PwmGenerator() {
      ToneGenerator.call(this);
      this.env = new Envelope();
      this.phase = 0;
      this.phaseIncr = 0;
      this.width = 0.5;
    }
    inherits(PwmGenerator, ToneGenerator);

    PwmGenerator.prototype.setFreq = function(val) {
      this.phaseIncr = val / this.sampleRate;
      this.env.bang();
    };

    PwmGenerator.prototype.setWidth = function(val) {
      this.width = val * 0.01;
    };

    PwmGenerator.prototype.process = function() {
      for (var i = 0, imax = this.cell.length; i < imax; i++) {
        this.cell[i] = (this.phase < this.width ? +0.1 : -0.1) * this.velocity;
        this.phase += this.phaseIncr;
        while (this.phase >= 1) {
          this.phase -= 1;
        }
      }

      this.env.process(this.cell);

      return this.cell;
    };

    return PwmGenerator;
  })();

  var TriangleGenerator = (function() {
    function TriangleGenerator() {
      ToneGenerator.call(this);
      this.env = new Envelope();
      this.phase = 0;
      this.phaseIncr = 0;
    }
    inherits(TriangleGenerator, ToneGenerator);

    TriangleGenerator.prototype.setFreq = function(val) {
      this.phaseIncr = val / this.sampleRate;
      this.env.bang();
    };

    TriangleGenerator.prototype.process = function() {
      for (var i = 0, imax = this.cell.length; i < imax; i++) {
        this.cell[i] = (this.phase < 0.5 ? this.phase : 1-this.phase) * this.velocity * 0.8;
        this.phase += this.phaseIncr;
        while (this.phase >= 1) {
          this.phase -= 1;
        }
      }

      this.env.process(this.cell);

      return this.cell;
    };

    return TriangleGenerator;
  })();

  var NoiseGenerator = (function() {
    function NoiseGenerator() {
      ToneGenerator.call(this);
      this.env = new Envelope();
      this.phase = 0;
      this.phaseIncr = 1;
      this.value = 0;
      this.onOff = 0;
    }
    inherits(NoiseGenerator, ToneGenerator);

    NoiseGenerator.prototype.setFreq = function(val) {
      this.onOff = val ? 0.15 : 0;
      this.env.bang();
    };

    NoiseGenerator.prototype.setNoise = function(val) {
      if (val > 0) {
        this.phaseIncr = 4 / val;
      } else {
        this.phaseIncr = 0;
      }
    };

    NoiseGenerator.prototype.process = function() {
      for (var i = 0, imax = this.cell.length; i < imax; i++) {
        this.cell[i] = this.value * this.onOff;
        this.phase += this.phaseIncr;
        if (this.phase >= 1) {
          this.phase -= 1;
          this.value = Math.random() * this.velocity;
        }
      }

      this.env.process(this.cell);

      return this.cell;
    };

    return NoiseGenerator;
  })();

  var Envelope = (function() {
    function Envelope() {
      this.sampleRate = Pico.sampleRate;
      this.a = 0;
      this.d = 64;
      this.s = 32;
      this.r = 0;
      this.samples = 0;
      this.status = 0;
      this.x = 1;
      this.dx = 0;
    }

    Envelope.prototype.setParams = function(params) {
      this.a = params[0];
      this.d = params[1];
      this.s = params[2];
      this.r = params[3];
    };

    Envelope.prototype.bang = function() {
      this.samples = 0;
      this.status = 0;
      this.x = 1;
      this.dx = 0;
    };

    Envelope.prototype.process = function(cell) {
      while (this.samples <= 0) {
        switch (this.status) {
        case 0:
          this.status = 1;
          this.samples = (this.a * 0.005) * this.sampleRate;
          this.x = 0;
          this.dx = (1 / this.samples) * cell.length;
          break;
        case 1:
          this.status = 2;
          this.samples = (this.d * 0.005) * this.sampleRate;
          this.x = 1;
          this.dx = -(1 / this.samples) * cell.length;
          this.dx *= (1 - this.s / 128);
          break;
        case 2:
          this.status = 3;
          this.samples = Infinity;
          this.dx = 0;
          if (this.s === 0) {
            this.x = 0;
          }
        }
      }

      for (var i = 0, imax = cell.length; i < imax; i++) {
        cell[i] *= this.x;
      }

      this.x += this.dx;
      this.samples -= cell.length;

      return cell;
    };

    return Envelope;
  })();

  var MMLVoice = (function() {
    function MMLVoice(toneGenerator) {
      this.toneGenerator = toneGenerator;
      this.sampleRate = Pico.sampleRate;
      this.tempo = 120;
      this.len = 4;
      this.octave = 5;
      this.tie = false;
      this.curFreq = 0;
      this.index = -1;
      this.samples = 0;
      this.loopStack = [];
      this.commands = [];
      this.mml = '';
    }

    MMLVoice.prototype.compile = function() {
      var cmd, m, mask;
      var commands = [];
      var checked = {};

      for (var i = 0, imax = MMLCommands.length; i < imax; i++) {
        var def = MMLCommands[i];

        while ((m = def.re.exec(this.mml)) !== null) {
          if (!checked[m.index]) {
            checked[m.index] = true;

            cmd = def.func(m);
            cmd.index = m.index;
            cmd.origin = m[0];

            commands.push(cmd);

            mask = repeat(m[0].length, " ");

            this.mml = this.mml.substr(0, m.index) + mask + this.mml.substr(m.index + mask.length);
          }
        }
      }

      commands.sort(function(a, b) {
        return a.index - b.index;
      });

      return commands;
    };

    MMLVoice.prototype.doCommand = function(cmd) {
      if (!cmd) {
        return;
      }

      var peek;

      switch (cmd.name) {
      case "@w":
        if (this.toneGenerator && this.toneGenerator.setWidth) {
          this.toneGenerator.setWidth(cmd.val);
        }
        break;
      case "@n":
        if (this.toneGenerator && this.toneGenerator.setNoise) {
          this.toneGenerator.setNoise(cmd.val);
        }
        break;
      case "t":
        this.tempo = cmd.val;
        break;
      case "l":
        this.len = cmd.val;
        break;
      case "o":
        this.octave = cmd.val;
        break;
      case "<":
        this.octave += 1;
        break;
      case ">":
        this.octave -= 1;
        break;
      case "&":
        this.tie = true;
        break;
      /*
      case "/:":
        this.loopStack.push({
          index: this.index,
          count: cmd.val || 2,
          exit: 0
        });
        break;
      case ":/":
        peek = this.loopStack[this.loopStack.length - 1];
        peek.exit = this.index;
        peek.count -= 1;
        if (peek.count <= 0) {
          this.loopStack.pop();
        } else {
          this.index = peek.index;
        }
        break;
      case "/":
        peek = this.loopStack[this.loopStack.length - 1];
        if (peek.count === 1) {
          this.loopStack.pop();
          this.index = peek.exit;
        }
        break;
      */
      case "v":
        this.toneGenerator.setVelocity(cmd.val);
        break;
      case "note":
      case "rest":
        var len = cmd.len || this.len;
        this.samples += ((60 / this.tempo) * (4 / len) * this.sampleRate) | 0;
        this.samples *= [1, 1.5, 1.75][cmd.dot] || 1;

        var freq = (cmd.name === "rest") ? 0 : midicps(cmd.tone + this.octave * 12);

        if (this.curFreq !== freq) {
          this.tie = false;
        }

        if (!this.tie) {
          this.toneGenerator.setFreq(freq);
          this.curFreq = freq;
        } else {
          this.tie = false;
        }

        break;
      }
    };

    MMLVoice.prototype.process = function() {
      while (this.samples <= 0) {
        this.index += 1;
        if (this.index >= this.commands.length) {
          this.samples = Infinity;
        } else {
          this.doCommand(this.commands[this.index]);
        }
      }

      this.samples -= Pico.bufferSize;

      if (this.samples !== Infinity && this.toneGenerator) {
        return this.toneGenerator.process();
      }
    };

    return MMLVoice;
  })();

  var MMLSequencer = (function() {
    var VoiceIndices = {'A': 0, 'B': 1, 'C': 2, 'D': 3};

    function MMLSequencer(mml) {
      // This particular MML sequencer has 4 voices,
      // with fixed tone generators:
      this.voices = [
        new MMLVoice(new PwmGenerator),
        new MMLVoice(new PwmGenerator),
        new MMLVoice(new TriangleGenerator),
        new MMLVoice(new NoiseGenerator)
      ];

      // Trim and remove empty lines
      var lines = mml.split("\n")
        .map(function(line) { return line.trim() })
        .filter(function(line) { return line.trim() !== "" });

      // Pass MML lines to their respective voices
      // First token of each line is always a list of affected voices
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var sep = line.indexOf(" ");
        var voices = line.slice(0, sep).split('');
        var seq = line.slice(sep + 1);

        for (var j = 0; j < voices.length; j++) {
          this.voices[VoiceIndices[voices[j]]].mml += seq;
        }
      }

      // Compile MML on each voice
      for (var i = 0; i < this.voices.length; ++i) {
        console.log("Voice " + i + ": " + this.voices[i].mml);
        this.voices[i].commands = this.voices[i].compile();
      }

      this.cell = new Float32Array(Pico.bufferSize);
    }

    MMLSequencer.prototype.process = function() {
      this.cell.set(new Float32Array(this.cell.length));

      this.voices.forEach(function(voice) {
        var cell = voice.process();
        if (cell) {
          for (var i = 0, imax = this.cell.length; i < imax; i++) {
            this.cell[i] += cell[i];
          }
        }
      }, this);

      return this.cell;
    };

    return MMLSequencer;
  })();

  function toInt(x) {
    return x | 0;
  }

  var MMLCommands = [
    {
      re: /@w(\d*)/g,
      func: function(m) {
        return { name: "@w", val: toInt(m[1]) };
      }
    },
    {
      re: /@n(\d*)/g,
      func: function(m) {
        return { name: "@n", val: toInt(m[1]) };
      }
    },
    {
    {
      re: /t(\d*)/g,
      func: function(m) {
        return { name: "t", val: toInt(m[1]) };
      }
    },
    {
      re: /l(\d*)/g,
      func: function(m) {
        return { name: "l", val: toInt(m[1]) };
      }
    },
    {
      re: /v(\d*)/g,
      func: function(m) {
        return { name: "v", val: toInt(m[1]) };
      }
    },
    {
      re: /o(\d*)/g,
      func: function(m) {
        return { name: "o", val: toInt(m[1]) };
      }
    },
    {
      re: /[<>]/g,
      func: function(m) {
        return { name: m[0] };
      }
    },
    /*
    {
      re: /\/:(\d*)/g,
      func: function(m) {
        return { name: "/:", val: toInt(m[1]) };
      }
    },
    {
      re: /:\//g,
      func: function(m) {
        return { name: ":/" };
      }
    },
    {
      re: /\//g,
      func: function(m) {
        return { name: "/" };
      }
    },
    */
    {
      re: /([cdefgab])([-+]?)(\d*)(\.*)/g,
      func: function(m) {
        return {
          name: "note",
          note: m[1],
          len: toInt(m[3]),
          dot: m[4].length,
          tone: {
            c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11
          }[m[1]] + toInt({
            "-": -1,
            "+": +1
          }[m[2]])
        };
      }
    },
    {
      re: /([r])(\d*)(\.*)/g,
      func: function(m) {
        return { name: "rest", note: m[1], len: toInt(m[2]), dot: m[3].length };
      }
    },
    {
      re: /&/g,
      func: function(m) {
        return { name: "&" };
      }
    }
  ];

  var sequencer = new MMLSequencer(mmlData);

  return function(e) {
    var cell = sequencer.process();

    e.buffers[0].set(cell);
    e.buffers[1].set(cell);
  }
}
