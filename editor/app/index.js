import {Player} from './player';

let player = new Player();
let editor = ace.edit('editor');

//editor.setTheme('ace/theme/monokai');
//editor.getSession().setMode('ace/mode/javascript');

function play() {
  player.stop();
  player.document = editor.getValue();
  player.play();
}

document.getElementById('play').addEventListener('click', play);
document.getElementById('stop').addEventListener('click', player.stop);

editor.commands.addCommand({
  name: 'play/stop',
  bindKey: {win: "Ctrl-Enter", "mac": "Cmd-Enter"},
  exec: (editor) => play()
});

editor.getSession().on('change', function(e) {
  localStorage.setItem('document', editor.getValue());
});

let savedDoc = localStorage.getItem('document');
if (savedDoc && savedDoc !== '') {
  editor.setValue(savedDoc);
  editor.clearSelection();
}

editor.focus();
