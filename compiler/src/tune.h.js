module.exports = function tpl(data) {
  // Prepare definition of sequences
  let seqs_defs = [];
  let seq_def = [];
  data.sequences.forEach((seq, i) => {
    seqs_defs.push(`const byte Seq${i}[] PROGMEM = { ${seq.join(', ')} };`);
    seq_def.push(`Seq${i}`);
  });

  // Prepare definitions of song data arrays
  let songdata_defs = [];
  let songdata_def = [];
  data.song.forEach((songdata, i) => {
    songdata_defs.push(`const byte SongData${i}[] PROGMEM = { ${songdata.join(', ')} };`);
    songdata_def.push(`SongData${i}`);
  });

  return `#ifndef __TUNE_H__
#define __TUNE_H__

#include "player.h"

${seqs_defs.join('\n')}
const byte Seqs[] = {${seq_def.join(', ')}};

${songdata_defs.join('\n')}
const byte* SongData[] = {${songdata_def.join(', ')}};

#endif /* ifndef __TUNE_H__ */`;
};
