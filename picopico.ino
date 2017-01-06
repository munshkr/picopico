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

int scale[] = {0, 13717, 14532, 15397, 16312, 17282, 0, 18310, 19398,
    20552, 21774, 23069, 24440, 25894, 0};

const int Silence = 0;
const int ErrorPin = 0;  // Error LED on PB0

// Note buffer
volatile unsigned int acc[] = {Silence, Silence, Silence, Silence};
volatile unsigned int freqs[] = {0, 0, 0, 0};
volatile byte pw[] = {0x80, 0x80, 0, 0};
volatile byte amp[] = {0xff, 0xff, 0xff, 0xff};

// Globals persist throughout tune
int nextTick = 0;
int tunePtr = 0;
char octave = 0, lastIndex = 0, duration = 4, lfsrOut = 0;
uint16_t lfsr = 1;
signed char oldTemp = 0;

// Global tick counter
volatile unsigned int globalTicks = 0;
volatile bool playing = false;

// Ticks timer
unsigned int ticks() {
    unsigned long t;
    uint8_t oldSREG = SREG;
    cli();
    t = globalTicks >> 2;  // For now divide by 8, because watchdog timer
    // is too fast now for playing a song...
    SREG = oldSREG;
    return t;
}

// External interrupt 0 wakes the MCU
ISR(INT0_vect) {
    GIMSK = 0;           // Disable external interrupts (only need one to wake up)

    if (playing) {
      goToSleep();
      tunePtr = 0;
      octave = 0;
      lastIndex = 0;
      duration = 4;
      lfsrOut = 0;
    }
}

// Watchdog interrupt counts ticks (every 16ms)
ISR(WDT_vect) {
    WDTCR |= 1<<WDIE;
    globalTicks++;

    // test: linear amplitude decay
    for (int c = 0; c < 3; c++) {
        amp[c] = MAX(amp[c] - 6, 0);
    }
}

// Generate triangle waves on 4 channels
ISR(TIMER0_COMPA_vect) {
    unsigned char temp;
    signed char stemp, mask, sum = 0;

    // Voice 1 and 2: Pulses
    for (int c = 0; c < 2; c++) {
        acc[c] += freqs[c];
        temp = (acc[c] >> 8) & pw[c];
        sum += (temp ? amp[c] : 0) >> 2;
    }

    // Voice 3: Triangle
    acc[2] += freqs[2];
    stemp = acc[2] >> 8;
    mask = stemp >> 7;
    sum += (stemp ^ mask) >> 1;

    // Voice 4: Noise
    //
    // This noise generator is somewhat based on the mechanism found in the NES APU.
    // The NES has a linear-feedback shift register for generating pseudorandom numbers.
    // It starts with a register set to 1, and when the period counter reaches 0, it
    // clocks the shift register.
    // The LFSR performs an Exclusive OR between bit 0 and bit 1, then shifts to the
    // right, and sets/resets bit 15 based on the exclusive OR result.
    //
    acc[3] += freqs[3];
    stemp = (acc[3] >> 8) & 0x80;
    // if temp != oldTemp, trigger the LFSR to generate a new pseudorandom value
    if (stemp != oldTemp) {
        lfsrOut = (lfsr & 1) ^ ((lfsr & 2) >> 1);  // output is bit 0 XOR bit 1
        lfsr = (lfsr >> 1) | (lfsrOut << 14);      // shift and include output on bit 15
        oldTemp = stemp;
    }
    sum += (lfsrOut ? amp[2] : 0) >> 2;

    OCR1B = sum;
}

// Setup **********************************************

void setup() {
    set_sleep_mode(SLEEP_MODE_PWR_DOWN);

    disableTimers();

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

    goToSleep();
}

void goToSleep(void) {
    byte adcsra, mcucr1, mcucr2, wdtcr;

    sleep_enable();
    MCUCR &= ~(_BV(ISC01) | _BV(ISC00));      // INT0 on low level
    GIMSK |= _BV(INT0);                       // Enable INT0
    adcsra = ADCSRA;                          // Save ADCSRA
    ADCSRA &= ~_BV(ADEN);                     // Disable ADC
    cli();                                    // Stop interrupts to ensure the BOD timed sequence executes as required
    mcucr1 = MCUCR | _BV(BODS) | _BV(BODSE);  // Turn off the brown-out detector
    mcucr2 = mcucr1 & ~_BV(BODSE);            // If the MCU does not have BOD disable capability,
    MCUCR = mcucr1;                           //   this code has no effect
    MCUCR = mcucr2;
    disableTimers();                          // Disable Timers
    sei();                                    // Ensure interrupts enabled so we can wake up again
    sleep_cpu();                              // Go to sleep
    sleep_disable();                          // Wake up here
    // Now asleep ...

    // ... awake again
    ADCSRA = adcsra;                          // Restore ADCSRA
    enableTimers();
}

inline void disableTimers() {
    WDTCR = 0;                // Disable Watchdog timer
    TIMSK = 0;                // Disable all timers (FIXME: check datasheet)
}

inline void enableTimers() {
    // Enable timer compare match, disable overflow
    TIMSK = 1<<OCIE0A;
    // Enable Watchdog timer for 128 Hz (max) interrupt for globalTicks timer.
    WDTCR = 1<<WDIE;
}


// Main loop - Parse Ample tune notation ****************

void loop() {
    char sign = 0, number = 0;
    char symbol, chan, saveIndex, saveOctave;
    boolean more = 1, readNote = 0, bra = 0, setOctave = 0;

    playing = true;

    do {
        do { // Skip formatting characters
            symbol = pgm_read_byte(&Tune[tunePtr++]);
        } while ((symbol == ' ') || (symbol == '|'));

        char capSymbol = symbol & 0x5F;
        if (symbol == '(') { bra = 1; saveIndex = lastIndex; saveOctave = octave; }
        else if (readNote && !bra) more = 0;
        else if (symbol == ')') { bra = 0; lastIndex = saveIndex; octave = saveOctave; }
        else if (symbol == 0) {
            playing = false;
            goToSleep();
            playing = true;
            tunePtr = 0;
            octave = 0;
            lastIndex = 0;
            duration = 4;
            lfsrOut = 0;
        }
        else if (symbol == ',') { duration = number; number = 0; sign = 0; }
        else if (symbol == ':') {
            setOctave = 1; octave = number;
            if (sign == -1) octave = -octave;
            number = 0; sign = 0;
        }
        else if ((symbol >= '0') && (symbol <= '9')) number = number*10 + symbol - '0';
        else if (symbol == '<') octave--;
        else if (symbol == '>') octave++;
        else if (symbol == '-') sign = -1;
        else if (symbol == '+') sign = 1;
        else if (symbol == '/') readNote = 1;
        else if (symbol == '^') {
            acc[chan] = Silence;
            freqs[chan] = 0;
            amp[chan] = 0xff;
            chan++;
            readNote = 1;
        }
        else if ((capSymbol >= 'A') && (capSymbol <= 'G')) {
            boolean lowercase = (symbol & 0x20);
            int index = (((capSymbol - 'A' + 5) % 7) << 1) + 1 + sign;
            if (!setOctave) {
                if (lastIndex && (index < lastIndex) && !lowercase) octave++;
                if (lastIndex && (index > lastIndex) && lowercase) octave--;
            } else setOctave = 0;
            freqs[chan] = scale[index] >> (4 - octave);
            amp[chan] = 0xff;
            chan++;
            lastIndex = index;
            readNote = 1; sign = 0;
        } else digitalWrite(ErrorPin, 1);  // Illegal character
    } while (more);

    tunePtr--;
    nextTick = nextTick + duration;
    do ; while (ticks() < nextTick);
}
