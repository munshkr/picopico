class State {
  constructor(state) {
    for (let k in state) {
      this[k] = state[k];
    }
  }

  get noteLengthFrames() {
    return Math.round(this._noteLengthExactFrames());
  }

  get quantLengthFrames() {
    return Math.round(this._noteLengthExactFrames() * (this.quantLength / 8));
  }

  get borrowFrames() {
    let exact = this._noteLengthExactFrames();
    return exact - Math.round(exact);
  }

  _noteLengthExactFrames() {
    // 3750 is the number of frames in a whole minute
    // = 60s / 16ms (watchdog timer frequency)
    // TODO Verify this is accurate
    return 3750 / this.noteLength / this.tempo;
  }
}

module.exports = State;
