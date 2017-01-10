#ifndef __TUNE_H__
#define __TUNE_H__

#include "player.h"

const byte Seq1[] PROGMEM = { 16, 10, 6, 5, 3, 1, END };
const byte Seq2[] PROGMEM = { END };
const byte Seq3[] PROGMEM = { END };

const byte Seqs[] = { Seq1, Seq2, Seq3 };

const byte SongData0[] PROGMEM = {
    //NOTE_LEN, 8,
    //QUANT_LEN, 8,
    VOLUME_ENV, 1,
    VOLUME, 15,
    INC_OCTAVE,

    TRACK_LOOP,

    LOOP_START, 2,
    LOOP_START, 2, NOTE_C, NOTE_E, NOTE_G, NOTE_B, DEC_VOLUME, LOOP_END,
    LOOP_START, 2, NOTE_C, NOTE_DS, NOTE_G, NOTE_AS, DEC_VOLUME, LOOP_END,
    LOOP_END,

    END
};
const byte SongData1[] PROGMEM = {
    //NOTE_LEN, 8,
    //QUANT_LEN, 8,
    VOLUME_ENV, 1,
    VOLUME, 7,
    REST|WITH_LEN|WITH_Q, 8, 8,
    INC_OCTAVE,

    TRACK_LOOP,

    LOOP_START, 2,
    LOOP_START, 2, NOTE_C, NOTE_E, NOTE_G, NOTE_B, DEC_VOLUME, LOOP_END,
    LOOP_START, 2, NOTE_C, NOTE_DS, NOTE_G, NOTE_AS, DEC_VOLUME, LOOP_END,
    LOOP_END,

    END
};
const byte SongData2[] PROGMEM = {
    //NOTE_LEN, 8,
    //QUANT_LEN, 8,
    OCTAVE, 3,

    TRACK_LOOP,

    LOOP_START, 2,
    NOTE_C, NOTE_C, NOTE_C, NOTE_C, NOTE_C, NOTE_C, NOTE_C, NOTE_C,
    DEC_OCTAVE,
    NOTE_B, NOTE_B, NOTE_B, NOTE_B, NOTE_B, NOTE_B, NOTE_B, NOTE_B,
    INC_OCTAVE,
    LOOP_END,

    END
};
const byte SongData3[] PROGMEM = { END };

const byte* SongData[] = { SongData0, SongData1, SongData2, SongData3 };

#endif /* ifndef __TUNE_H__ */
