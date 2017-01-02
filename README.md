# picopico ピコピコ

A musical project. Sound is made with an 8-bit microcontroller (Attiny85) and
tries to mimic a classical sound chip used in video game consoles from the 80s.

Pretty much inspired by [1-bit symphony](http://www.1bitsymphony.com/) by Tristan Perich and [lft/kryo's project](http://www.linusakesson.net/hardware/chiptune.php).

## Hardware

* AVR ATtiny85
* CR2032 coin cell battery
* 1K resistor
* 0.1uf capacitor
* 10uf capacitor
* 3.5mm audio jack

### Schematic

![](schematic.png?raw=true)

## Software

* Music written in an MML-like language
* HTML5 editor with sound emulator

## To do

* Change current parser for a standard MML parser

> AB cdefg4 l8 >cde<c o5 r c

* Implement Square waveform for voice 1 and 2
* Implement Noise waveform for voice 3
* Envelopes!

## License

Schematic and original source code made were taken from a series of blog posts
by [David Johnson-Davies](http://www.technoblogy.com/).

Schematic image is licensed under Creative Commons 4.0.  Source code is
licensed under GPLv3.
