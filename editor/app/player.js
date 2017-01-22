//import {Parser} from './parser';

export class Player {
  constructor(doc) {
    this.document = doc;
  }

  get document() {
    return this._document;
  }

  set document(doc) {
    this._document = doc;
    //this._parser = new Parser(doc);
  }

  play() {
    Pico.play((e) => this._process(e));
  }

  stop() {
    Pico.pause();
  }

  _process(e) {
    if (this._document) return;
    //let cell = this._sequencer.process();
    let cell = [];

    e.buffers[0].set(cell);
    e.buffers[1].set(cell);
  }
}
