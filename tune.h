#ifndef __TUNE_H__
#define __TUNE_H__

#include "player.h"

const byte SongData0[] PROGMEM = {
    VOLUME, 0xA,
    INC_OCTAVE,
    TRACK_LOOP,
    LOOP_START, 2,
    LOOP_START, 2, NOTE_C, NOTE_E, NOTE_G, NOTE_B, LOOP_END,
    LOOP_START, 2, NOTE_C, NOTE_E, NOTE_G, NOTE_AS, LOOP_END,
    LOOP_END,
    END
};
const byte SongData1[] PROGMEM = {
    VOLUME, 4,
    REST|WITH_LEN|WITH_Q, 8, 8,
    INC_OCTAVE,
    TRACK_LOOP,
    LOOP_START, 2,
    LOOP_START, 2, NOTE_C, NOTE_E, NOTE_G, NOTE_B, LOOP_END,
    LOOP_START, 2, NOTE_C, NOTE_E, NOTE_G, NOTE_AS, LOOP_END,
    LOOP_END,
    END
};
const byte SongData2[] PROGMEM = {
    TRACK_LOOP,
    OCTAVE, 3,
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
