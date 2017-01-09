/*
 * picopico
 * Copyright (C) 2017  Damián Silvani
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Original code by David Johnson-Davies
 * www.technoblogy.com - 27th March 2016
 *
 * ATtiny85 @ 8MHz (internal oscillator; BOD disabled)
 *
*/

#include <avr/sleep.h>
#include "player.h"
#include "tune.h"

#define MAX(x, y) (((x) > (y)) ? (x) : (y))
#define MIN(x, y) (((x) < (y)) ? (x) : (y))

#define NUM_VOICES      4
#define DEFAULT_OCTAVE  4
#define DEFAULT_NLEN    12
#define DEFAULT_VOL     15
#define DEFAULT_PW      0x80


// Note buffer
volatile uint16_t lfsr = 1;
volatile char lfsrOut = 0;
volatile signed char oldTemp = 0; // FIXME change variable name

// Global tick counter
volatile unsigned int globalTicks = 0;
volatile bool nextTick = false;

Voice voices[NUM_VOICES] = {};
byte playingVoices = 0;

bool playing = false, wantsToStop = false;
volatile bool justAwoke = false;


// External interrupt 0
ISR(INT0_vect) {
    GIMSK = 0;            // Disable interrupt because this routine may fire multiple times
                          // while pin is held low (button pressed)
    justAwoke = true;
}

// Watchdog interrupt counts ticks (every 16ms)
ISR(WDT_vect) {
    WDTCR |= 1<<WDIE;
    nextTick = true;

    /*
    // test: linear amplitude decay
    for (int c = 0; c < 2; c++) {
        voices[c].amp = MAX(voices[c].amp - 6, 0);
    }
    */
}

ISR(TIMER0_COMPA_vect) {
    unsigned char temp;
    signed char stemp, mask, out = 0;
    Voice* v;

    // Voice 1 and 2: Pulses
    for (int c = 0; c < 2; c++) {
        v = &voices[c];
        v->acc += v->freq;
        temp = (v->acc >> 8) & v->pw;
        if (v->gate) out += (temp ? v->amp : 0) >> 2;
    }

    // Voice 3: Triangle
    v = &voices[2];
    v->acc += v->freq;
    stemp = v->acc >> 8;
    mask = stemp >> 7;
    if (v->gate) out += (stemp ^ mask) >> 1;

    // Voice 4: Noise
    //
    // This noise generator is somewhat based on the mechanism found in the NES APU.
    // The NES has a linear-feedback shift register for generating pseudorandom numbers.
    // It starts with a register set to 1, and when the period counter reaches 0, it
    // clocks the shift register.
    // The LFSR performs an Exclusive OR between bit 0 and bit 1, then shifts to the
    // right, and sets/resets bit 15 based on the exclusive OR result.
    //
    v = &voices[3];
    v->acc += v->freq;
    stemp = (v->acc >> 8) & 0x80;
    // if temp != oldTemp, trigger the LFSR to generate a new pseudorandom value
    if (stemp != oldTemp) {
        lfsrOut = (lfsr & 1) ^ ((lfsr & 2) >> 1);  // output is bit 0 XOR bit 1
        lfsr = (lfsr >> 1) | (lfsrOut << 14);      // shift and include output on bit 15
        oldTemp = stemp;
    }
    if (v->gate) out += (lfsrOut ? v->amp : 0) >> 2;

    OCR1B = out;
}

// Setup **********************************************

void setup() {
    set_sleep_mode(SLEEP_MODE_PWR_DOWN);

    // Set all pins as input and enable internal pull-up resistor
    for (int i = 0; i <= 3; i++) {
        pinMode(i, INPUT_PULLUP);
    }

    // Enable 64 MHz PLL and use as source for Timer1
    PLLCSR = 1<<PCKE | 1<<PLLE;

    // Set up Timer/Counter1 for PWM output
    TCCR1 = 1<<CS10;               // 1:1 prescale
    GTCCR = 1<<PWM1B | 2<<COM1B0;  // PWM B, clear on match

    OCR1B = 128;
    pinMode(4, OUTPUT);            // Enable PWM output pin

    // Set up Timer/Counter0 for 20kHz interrupt to output samples.
    TCCR0A = 3<<WGM00;             // Fast PWM
    TCCR0B = 1<<WGM02 | 2<<CS00;   // 1/8 prescale
    OCR0A = 49;                    // Divide by 400

    GIMSK = 0;                     // Disable INT0
}

void goToSleep(void) {
    byte adcsra, mcucr1, mcucr2, wdtcr;

    WDTCR = 0;                                // Disable Watchdog timer
    TIMSK = 0;                                // Disable all timers

    sleep_enable();
    adcsra = ADCSRA;                          // Save ADCSRA
    ADCSRA &= ~_BV(ADEN);                     // Disable ADC

    cli();                                    // Stop interrupts to ensure the BOD timed sequence executes as required
    GIMSK = _BV(INT0);                        // Enable INT0
    mcucr1 = MCUCR | _BV(BODS) | _BV(BODSE);  // Turn off the brown-out detector
    mcucr2 = mcucr1 & ~_BV(BODSE);            // If the MCU does not have BOD disable capability,
    MCUCR = mcucr1;                           //   this code has no effect
    MCUCR = mcucr2;

    sei();                                    // Ensure interrupts enabled so we can wake up again
    sleep_cpu();                              // Go to sleep
    // Now asleep ...

    // ... awake again
    sleep_disable();                          // Wake up here
    ADCSRA = adcsra;                          // Restore ADCSRA

    PLLCSR = 1<<PCKE | 1<<PLLE;               // Re-enable PLL (for some reason, this is needed after sleeping...)
    TIMSK = 1<<OCIE0A;                        // Enable timer compare match, disable overflow
    WDTCR = 1<<WDIE;                          // Enable Watchdog timer for 128Hz interrupt
}


// Main loop

bool playVoice(Voice& voice) {
    if (voice.finished) return false;

    if (voice.playing) {
        if (voice.qlen_c == 1) voice.gate = false;
        if (voice.nlen_c == 1) voice.playing = false;

        voice.qlen_c--;
        voice.nlen_c--;

        if (voice.nlen_c >= 0) {
            // TODO
            //playSequences(c);
            return true;
        }
    }

    while (true) {
        const byte cmd = fetchNextByte(voice);

        if (!cmd) {
            voice.gate = false;
            voice.finished = true;
            break;
        } else if (cmd <= 0x80) {
            playNote(voice, cmd);
            break;
        } else {
            executeCommand(voice, cmd);
        }
    }

    return true;
}

byte fetchNextByte(Voice& voice) {
    return pgm_read_byte(voice.ptr++);
}

inline void playNote(Voice& voice, byte note) {
    voice.playing = true;

    // If note is not a rest, set frequency based on note and current octave
    if (note != REST) {
        voice.freq = scale[(note & 0xf) - 1] >> (8 - voice.octave);
    }

    // Set note length counter
    if (note & WITH_LEN) {
        // If note command has a length counter parameter, use it (word or byte)
        if (note & WORD) {
            voice.nlen_c = fetchNextByte(voice) | (fetchNextByte(voice) << 8);
        } else {
            voice.nlen_c = fetchNextByte(voice);
        }
    } else {
        // Otherwise, use default note length counter
        voice.nlen_c = voice.nlen;
    }

    // Set quantization length counter
    if (note & WITH_Q) {
        if (note & WORD) {
            voice.qlen_c = fetchNextByte(voice) | (fetchNextByte(voice) << 8);
        } else {
            voice.qlen_c = fetchNextByte(voice);
        }
    } else {
        voice.qlen_c = voice.qlen;
    }

    // Set amplitude
    voice.amp = amp[voice.volume];

    // Enable gate if note is not a rest
    voice.gate = (note != REST);

    // TODO
    //resetSequences(voice);
}

inline void executeCommand(Voice& voice, const byte cmd) {
    switch (cmd) {
        case TRACK_LOOP: {
            break;
        }
        case LOOP_START: {
            break;
        }
        case LOOP_END: {
            break;
        }
        case NOTE_LEN: {
            break;
        }
        case NOTE_LEN_WORD: {
            break;
        }
        case QUANT_LEN: {
            break;
        }
        case QUANT_LEN_WORD: {
            break;
        }
        case OCTAVE: {
            const byte param = fetchNextByte(voice);
            voice.octave = param;
            break;
        }
        case INC_OCTAVE: {
            if (voice.octave < 8) voice.octave++;
            break;
        }
        case DEC_OCTAVE: {
            if (voice.octave > 0) voice.octave--;
            break;
        }
        case TRANSPOSE: {
            break;
        }
        case DETUNE: {
            break;
        }
        case TIMBRE: {
            break;
        }
        case VOLUME: {
            const byte param = fetchNextByte(voice);
            voice.volume = param;
            break;
        }
        case INC_VOLUME: {
            if (voice.volume < 16) voice.volume++;
            break;
        }
        case DEC_VOLUME: {
            if (voice.volume > 0) voice.volume--;
            break;
        }
        case PITCH_SWEEP: {
            break;
        }

        // Select Envelope commands
        case VOLUME_ENV: {
            break;
        }
        case NOTE_ENV: {
            break;
        }
        case TIMBRE_ENV: {
            break;
        }
        case PITCH_ENV: {
            break;
        }
    }
}

void loop() {
    // Check if button is pressed for stoping song, taking care of debouncing
    byte buttonPressed = !digitalRead(2);
    if (buttonPressed) {
        if (!justAwoke) {
            // Song was playing, user is pressing button. Prepare for stop
            wantsToStop = true;
        }
    } else {
        if (justAwoke) {
            // User left button after waking up.
            justAwoke = false;
        } else if (wantsToStop) {
            // User was pressing button while song was playing,
            // now stopped pressing.  Stop playing.
            playing = false;
            wantsToStop = false;
        }
    }

    // If we are not playing, go to sleep.
    // After waking up, reset state.
    if (!playing) {
        goToSleep();

        playing = true;
        for (int i = 0; i < NUM_VOICES; i++) {
            Voice* v = &voices[i];
            v->ptr = SongData[i];
            v->playing = false;
            v->finished = false;
            v->nlen = DEFAULT_NLEN;
            v->qlen = v->nlen;
            v->volume = DEFAULT_VOL;
            v->octave = DEFAULT_OCTAVE;
            v->gate = false;
            v->pw = DEFAULT_PW;
        }
        lfsrOut = 0;
        return;
    }

    if (nextTick) {
        nextTick = false;
        bool anyVoicePlaying = false;
        for (int i = 0; i < NUM_VOICES; i++) {
            anyVoicePlaying |= playVoice(voices[i]);
        }
        if (!anyVoicePlaying) playing = false;
    }
}
