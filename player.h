#ifndef __PLAYER_H__
#define __PLAYER_H__

// Note commands
const byte NOTE_C  = 0;
const byte NOTE_CS = 1;
const byte NOTE_D  = 2;
const byte NOTE_DS = 3;
const byte NOTE_E  = 4;
const byte NOTE_F  = 5;
const byte NOTE_FS = 6;
const byte NOTE_G  = 7;
const byte NOTE_GS = 8;
const byte NOTE_A  = 9;
const byte NOTE_AS = 10;
const byte NOTE_B  = 11;
const byte REST    = 12;

// Note flags
enum NoteFlag {
    WITH_LEN = 0x10,
    WITH_Q   = 0x20,
    WORD     = 0x40,
};

// Other commands
const byte SONG_LOOP      = 0x80;
const byte LOOP_START     = 0x81;
const byte LOOP_END       = 0x82;
const byte NOTE_LEN       = 0x83;
const byte NOTE_LEN_WORD  = 0x84;
const byte QUANT_LEN      = 0x85;
const byte QUANT_LEN_WORD = 0x86;
const byte OCTAVE         = 0x87;
const byte INC_OCTAVE     = 0x88;
const byte DEC_OCTAVE     = 0x89;
const byte TRANSPOSE      = 0x8a;
const byte DETUNE         = 0x8b;
const byte TIMBRE         = 0x8c;
const byte VOLUME         = 0x8d;
const byte INC_VOLUME     = 0x8e;
const byte DEC_VOLUME     = 0x8f;
const byte PITCH_SWEEP    = 0x90;

// Select Envelope commands
const byte VOLUME_ENV = 0x91;
const byte NOTE_ENV   = 0x92;
const byte TIMBRE_ENV = 0x93;
const byte PITCH_ENV  = 0x94;

#endif /* ifndef __PLAYER_H__ */
