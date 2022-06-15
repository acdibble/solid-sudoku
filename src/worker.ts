/* eslint-disable no-restricted-globals */
import init, { solve } from '../solver/pkg';
import type { AppMessage } from './App';

export type WorkerMessage = { message: 'ready' } | { message: 'solved'; result: Int32Array };

const postMessage = (message: WorkerMessage) => self.postMessage(message);

init()
  .then(() => {
    self.onmessage = (e: MessageEvent<AppMessage>) => {
      if (e.data.message === 'solve') {
        try {
          const result = solve(e.data.array);
          postMessage({ message: 'solved', result });
        } catch (err) {
          console.error(err);
          postMessage({ message: 'solved', result: new Int32Array() });
        }
      }
    };

    postMessage({ message: 'ready' });
  })
  .catch(() => {
    console.error('failed to initialize WASM');
  });

export {};
