.PHONY: parser lint test install-deps clean

all: parser lint test

install-deps:
	@yarn install

lint:
	@yarn lint --fix

test:
	@yarn test

parser: src/parser.js
src/parser.js: src/grammar.peg
	@node_modules/.bin/pegjs --output $@ $<

clean:
	@rm -f src/parser.js
