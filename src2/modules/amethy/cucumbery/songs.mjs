import { TerminalNodeListener } from '../terminal/terminal.mjs';

async function play(name = 'random') {
  if (name == 'random') {
    TerminalNodeListener.wss.event('console-command', {
      client: '0000',
      data: 'csong play --random--stop',
    });
  }
}

export default {
  play: play,
};
