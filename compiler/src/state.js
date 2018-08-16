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
    // 14400 ???
    return 14400 / this.noteLength / this.tempo;
  }
}

module.exports = State;
