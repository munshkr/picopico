#ifndef __TUNE_H__
#define __TUNE_H__

#include "player.h"

const byte SongData0[] PROGMEM = {
  NOTE_C, NOTE_D, NOTE_E, NOTE_F, NOTE_G, NOTE_F, NOTE_E, NOTE_D, END
};
const byte SongData1[] PROGMEM = { END };
const byte SongData2[] PROGMEM = { END };
const byte SongData3[] PROGMEM = { END };

const byte* SongData[] = { SongData0, SongData1, SongData2, SongData3 };

#endif /* ifndef __TUNE_H__ */
