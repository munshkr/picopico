/*
 * Attune
 * Copyright (C) 2017  Damián Silvani, David Johnson-Davies
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

int Scale[] = { 0, 13717, 14532, 15397, 16312, 17282, 0, 18310, 19398, 20552, 21774, 23069, 24440, 25894, 0 };

const int Silence = 0;
const int Error = 0;  // Error LED on PB0

// Note buffer
volatile unsigned int Acc[] = {Silence, Silence, Silence, Silence};
volatile unsigned int Freqs[] = {0, 0, 0, 0 };

const char Tune[] PROGMEM =
"C(-1:C)Fe 2,dE | 4,F(-1:D) 2,eF 4,A(-1:G)g | 2,f(-1:F)eF(-1:E)G 4,f(-1:D)e(-1:C) |"
"2,d(-2:B)Edc 4,b(-2:G)G | c(-1:C)Fe 2,dE | 4,F(-1:D) 2,eF 4,A(-1:G)g |"
"2,A(-1:F)gA(-1:E)Cb(-1:G)gB(-1:B)D | 4,c(-1:C)g 8,C ^(^^)";

//Globals persist throughout tune
int NextTick = 0;
int TunePtr = 0;
char Octave = 0, LastIndex = 0, Duration = 4;

// Global tick counter
volatile unsigned int GlobalTicks = 0;

// Ticks timer
unsigned int Ticks() {
  unsigned long t;
  uint8_t oldSREG = SREG;
  cli();
  t = GlobalTicks;
  SREG = oldSREG;
  return t;
}

// Watchdog interrupt counts ticks (1/8 sec)
ISR(WDT_vect) {
  WDTCR |= 1<<WDIE;
  GlobalTicks++;
}

// Generate triangle waves on 4 channels
ISR(TIMER0_COMPA_vect) {
  signed char Mask, Temp, Sum=0;
  for (int c=0; c<3; c++) {
    Acc[c] = Acc[c] + Freqs[c];
    Temp = Acc[c] >> 8;
    Mask = Temp >> 15;
    Sum = Sum + ((char)(Temp ^ Mask) >> 1);
  }
  OCR1B = Sum;
}

// Setup **********************************************

void setup() {
  // Enable 64 MHz PLL and use as source for Timer1
  PLLCSR = 1<<PCKE | 1<<PLLE;

  // Set up Timer/Counter1 for PWM output
  TIMSK = 0;                     // Timer interrupts OFF
  TCCR1 = 1<<CS10;               // 1:1 prescale
  GTCCR = 1<<PWM1B | 2<<COM1B0;  // PWM B, clear on match

  OCR1B = 128;
  pinMode(4, OUTPUT);            // Enable PWM output pin

  // Set up Timer/Counter0 for 20kHz interrupt to output samples.
  TCCR0A = 3<<WGM00;             // Fast PWM
  TCCR0B = 1<<WGM02 | 2<<CS00;   // 1/8 prescale
  OCR0A = 49;                    // Divide by 400
  TIMSK = 1<<OCIE0A;             // Enable compare match, disable overflow

  // Set up Watchdog timer for 8 Hz interrupt for ticks timer.
  WDTCR = 1<<WDIE | 3<<WDP0;     // 8 Hz interrupt
}

// Main loop - Parse Ample tune notation ****************

void loop() {
  char Sign = 0, Number = 0;
  char Symbol, Chan, SaveIndex, SaveOctave;
  boolean More = 1, ReadNote = 0, Bra = 0, SetOctave = 0;
  do {
    do { // Skip formatting characters
      Symbol = pgm_read_byte(&Tune[TunePtr++]);
    } while ((Symbol == ' ') || (Symbol == '|'));
    char CapSymbol = Symbol & 0x5F;
    if (Symbol == '(') { Bra = 1; SaveIndex = LastIndex; SaveOctave = Octave; }
    else if (ReadNote && !Bra) More = 0;
    else if (Symbol == ')') { Bra = 0; LastIndex = SaveIndex; Octave = SaveOctave; }
    else if (Symbol == 0) for (;;) ;          // End of string - stop
    else if (Symbol == ',') { Duration = Number; Number = 0; Sign = 0; }
    else if (Symbol == ':') {
      SetOctave = 1; Octave = Number;
      if (Sign == -1) Octave = -Octave;
      Number = 0; Sign = 0;
    }
    else if ((Symbol >= '0') && (Symbol <= '9')) Number = Number*10 + Symbol - '0';
    else if (Symbol == '<') Octave--;
    else if (Symbol == '>') Octave++;
    else if (Symbol == '-') Sign = -1;
    else if (Symbol == '+') Sign = 1;
    else if (Symbol == '/') ReadNote = 1;
    else if (Symbol == '^') { Acc[Chan] = Silence; Freqs[Chan++] = 0; ReadNote = 1; }
    else if ((CapSymbol >= 'A') && (CapSymbol <= 'G')) {
      boolean Lowercase = (Symbol & 0x20);
      int Index = (((CapSymbol - 'A' + 5) % 7) << 1) + 1 + Sign;
      if (!SetOctave) {
        if (LastIndex && (Index < LastIndex) && !Lowercase) Octave++;
        if (LastIndex && (Index > LastIndex) && Lowercase) Octave--;
      } else SetOctave = 0;
      Freqs[Chan++] = Scale[Index] >> (4 - Octave);
      LastIndex = Index;
      ReadNote = 1; Sign = 0;
    } else digitalWrite(Error, 1);  // Illegal character
  } while (More);
  TunePtr--;
  NextTick = NextTick + Duration;
  do ; while (Ticks() < NextTick);
}
