/* eslint-disable no-restricted-globals */
import init, { solve } from '../solver/pkg';
import type { AppMessage } from './App';

export type WorkerMessage =
  | { type: 'message'; message: 'ready' }
  | { type: 'message'; message: 'solved'; result: Int32Array }
  | { type: 'error'; message: string };

const postMessage = (message: WorkerMessage) => self.postMessage(message);

init()
  .then(() => {
    self.onmessage = (e: MessageEvent<AppMessage>) => {
      if (e.data.message === 'solve') {
        try {
          const result = solve(e.data.array);
          postMessage({ type: 'message', message: 'solved', result });
        } catch (err) {
          postMessage({ type: 'message', message: 'solved', result: new Int32Array() });
          postMessage({ type: 'error', message: (err as Error).message });
        }
      }
    };

    postMessage({ type: 'message', message: 'ready' });
  })
  .catch(() => {
    postMessage({ type: 'error', message: 'An error occurred while initializing the solver' });
  });

export {};
