#ifndef __TUNE_H__
#define __TUNE_H__

#include "player.h"

const byte Seq1[] PROGMEM = { 12, 14, 16, 12, 10, SEQ_LOOP, 9, 9, 9, 8, 8, 8, 7, 7, 7, 8, 8, 8, SEQ_REL, 6, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 1, SEQ_END };
const byte Seq2[] PROGMEM = { SEQ_END };
const byte Seq3[] PROGMEM = { SEQ_END };

const byte Seqs[] = { Seq1, Seq2, Seq3 };

const byte SongData0[] PROGMEM = {
    NOTE_LEN, 16,
    QUANT_LEN, 12,
    VOLUME_ENV, 1,
    VOLUME, 15,
    INC_OCTAVE,

    TRACK_LOOP,

    LOOP_START, 2, NOTE_C, NOTE_E, NOTE_G, NOTE_B, DEC_VOLUME, LOOP_END,
    LOOP_START, 2, NOTE_C, NOTE_DS, NOTE_G, NOTE_AS, DEC_VOLUME, LOOP_END,

    END
};
const byte SongData1[] PROGMEM = {
    NOTE_LEN, 16,
    QUANT_LEN, 12,
    VOLUME_ENV, 1,
    VOLUME, 7,
    REST|WITH_LEN|WITH_Q, 8, 8,
    INC_OCTAVE,

    TRACK_LOOP,

    LOOP_START, 2, NOTE_C, NOTE_E, NOTE_G, NOTE_B, DEC_VOLUME, LOOP_END,
    LOOP_START, 2, NOTE_C, NOTE_DS, NOTE_G, NOTE_AS, DEC_VOLUME, LOOP_END,

    END
};
const byte SongData2[] PROGMEM = {
    NOTE_LEN, 16,
    QUANT_LEN, 12,
    OCTAVE, 3,

    TRACK_LOOP,

    NOTE_C, NOTE_C, NOTE_C, NOTE_C, NOTE_C, NOTE_C, NOTE_C, NOTE_C,
    DEC_OCTAVE,
    NOTE_B, NOTE_B, NOTE_B, NOTE_B, NOTE_B, NOTE_B, NOTE_B, NOTE_B,
    INC_OCTAVE,

    END
};
const byte SongData3[] PROGMEM = { END };

const byte* SongData[] = { SongData0, SongData1, SongData2, SongData3 };

#endif /* ifndef __TUNE_H__ */
