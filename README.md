# picopico ピコピコ

A very small chiptune synthesizer and player.  Sound is made with an 8-bit microcontroller (Attiny85) and
tries to mimic a classical sound chip used in video game consoles from the 80s.

Pretty much inspired by [1-bit symphony](http://www.1bitsymphony.com/) by Tristan Perich and [lft/kryo's project](http://www.linusakesson.net/hardware/chiptune.php).

![](http://i.imgur.com/SciTb4v.jpg)

## Hardware

* AVR ATtiny85
* CR2032 coin cell battery
* 1K resistor
* 0.1uf capacitor
* 3.5mm audio jack
* Push button

### Schematic

Note: This schematic is old and inaccurate (although similar). Please see this [tutorial](https://github.com/munshkr/picopico/wiki/Programming-with-Arduino-Uno) as the protoboard picture reflects more accurately the current design.


![](schematic.png?raw=true)

## Software

* Music written in an MML-like language
* HTML5 editor with sound emulator

## To do

- [x] Change current parser for a standard MML parser

> AB cdefg4 l8 >cde<c o5 r c

- [x] Implement Square waveform for voice 1 and 2
- [x] Implement Noise waveform for voice 3
- [ ] Envelopes!
- [ ] Work on MML compiler and editor

## License

Schematic and original source code made were taken from a series of blog posts
by [David Johnson-Davies](http://www.technoblogy.com/).

Schematic image is licensed under Creative Commons 4.0.  Source code is
licensed under GPLv3.
