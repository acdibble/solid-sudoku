import { createEffect, createMemo, createSignal, For } from 'solid-js';
import { createStore } from 'solid-js/store';
import Worker from './worker?worker';
import type { WorkerMessage } from './worker';

export type AppMessage = { message: 'solve'; array: number[] };

const useTimer = () => {
  const [startTime, setStartTime] = createSignal<number | null>(null);
  const [stopTime, setStopTime] = createSignal<number | null>(null);

  let interval: ReturnType<typeof setInterval> | null = null;

  const timeElapsed = createMemo(() => {
    const startedAt = startTime();
    const stoppedAt = stopTime();
    if (stoppedAt && startedAt) {
      return (stoppedAt - startedAt) / 1000;
    }
    return startedAt && (Date.now() - startedAt) / 1000;
  });

  const stop = () => {
    if (interval) clearInterval(interval);
    interval = null;
    setStopTime(Date.now());
  };
  const reset = () => {
    setStartTime(null);
    setStopTime(null);
  };
  const start = () => {
    reset();
    setStartTime(Date.now());
    interval = setInterval(() => {
      setStopTime(Date.now());
    }, 1);
  };

  return { timeElapsed, start, stop, reset };
};

const cells = document.getElementsByName('cell');

type ArrayOfLength<L, T, U extends T[] = []> = U extends { length: L }
  ? U
  : ArrayOfLength<L, T, [T, ...U]>;

type Row = ArrayOfLength<9, number>;
type Board = ArrayOfLength<9, Row>;
type FlatBoard = ArrayOfLength<81, number>;

const newBoard = () => Array.from({ length: 9 }, () => Array.from({ length: 9 }).fill(0)) as Board;

const flatBoardToBoard = (array: FlatBoard) =>
  Array.from({ length: 9 }, (_, i) => array.slice(i * 9, i * 9 + 9)) as Board;

export default function App() {
  const [values, setValues] = createStore(newBoard());
  const [active, setActive] = createSignal<number | null>(null);
  const [ready, setReady] = createSignal(false);
  const [highlighted, setHighlighted] = createSignal(new Set<number>());
  const [solving, setSolving] = createSignal(false);

  const updateValues: typeof setValues = (...args: Parameters<typeof setValues>) => {
    setValues(...args);
    cells.forEach((cell) => {
      const x = Number.parseInt((cell as Element).getAttribute('data-x') as string, 10);
      if (Number.isNaN(x)) return;
      const y = Number.parseInt((cell as Element).getAttribute('data-y') as string, 10);
      if (Number.isNaN(y)) return;

      // eslint-disable-next-line no-param-reassign
      (cell as HTMLInputElement).value = String(values[y]![x] || '');
    });
  };

  const { timeElapsed, start, stop, reset } = useTimer();

  const worker = new Worker();

  worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
    if (e.data.type === 'message') {
      if (e.data.message === 'ready') {
        setReady(true);
      } else if (e.data.message === 'solved') {
        if (e.data.result.length === 81) {
          updateValues(flatBoardToBoard([...e.data.result] as FlatBoard));
        }
        setSolving(false);
      }
    } else if (e.data.type === 'error') {
      alert(e.data.message);
    }
  };

  createEffect(() => {
    // eslint-disable-next-line no-unused-expressions
    solving() ? start() : stop();
  });

  const postMessage = (message: AppMessage) => ready() && worker.postMessage(message);

  document.addEventListener('keydown', (e) => {
    const x = Number.parseInt((e.target as Element).getAttribute('data-x') as string, 10);
    if (Number.isNaN(x)) return;
    const y = Number.parseInt((e.target as Element).getAttribute('data-y') as string, 10);
    if (Number.isNaN(y)) return;

    const target = e.target as HTMLInputElement;
    e.preventDefault();
    target.value = e.key;

    const selected = active();
    let functionName: 'add' | 'delete' | undefined;
    let newValue = 0;

    if (/^[1-9]$/.test(e.key)) {
      newValue = Number(e.key);
      functionName = 'add';
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      functionName = 'delete';
    }

    if (selected !== null && functionName) {
      updateValues(y, x, newValue);
      const updatedHighlighted = new Set(highlighted());
      updatedHighlighted[functionName](selected);
      setHighlighted(updatedHighlighted);
    }
  });

  const copyBoard = () => {
    if (!getSelection()?.toString()) {
      navigator.clipboard.writeText(JSON.stringify([...values].flat())).catch(() => {
        // pass
      });
    }
  };

  document.addEventListener('copy', copyBoard);

  const pasteBoard = async (e?: ClipboardEvent) => {
    try {
      let data: string;
      if (e) {
        data = e.clipboardData?.getData('text') ?? '[]';
      } else {
        data = await navigator.clipboard.readText();
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const newValues = JSON.parse(data);
      if (
        Array.isArray(newValues) &&
        newValues.length === 81 &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        newValues.every((val) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].includes(val))
      ) {
        updateValues(flatBoardToBoard(newValues as FlatBoard));
        setHighlighted(
          new Set(
            newValues
              .map((n, index) => (n !== 0 ? index : null))
              .filter((v) => v !== null) as number[],
          ),
        );
      }
    } catch {
      // pass
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  document.addEventListener('paste', pasteBoard);

  document.addEventListener('click', () => {
    if (active()) {
      setActive(null);
    }
  });

  return (
    <div class="flex h-screen flex-col items-center space-y-5 pt-4 md:justify-center md:pt-0">
      <div class="flex flex-col items-center ">
        <h1 class="text-3xl">Sudoku Solver</h1>
        <div>{timeElapsed()?.toFixed(3) || '0.000'} s</div>
      </div>
      <div class="grid grid-cols-9">
        <For each={values}>
          {(row, y) => (
            <For each={row}>
              {(cell, x) => (
                <input
                  name="cell"
                  data-x={x()}
                  data-y={y()}
                  classList={{
                    'hover:bg-green-300': active() !== y() * 9 + x(),
                    'bg-green-600': active() === y() * 9 + x(),
                    'bg-stone-300': active() !== y() * 9 + x() && highlighted().has(y() * 9 + x()),
                    'border-r-2': [2, 5, 8].includes(x() % 9),
                    'border-l-2': [0, 3, 6].includes(x() % 9),
                    'border-t-2': [0, 3, 6].includes(y() % 9),
                    'border-b-2': [2, 5, 8].includes(y() % 9),
                  }}
                  class="h-10 w-10 cursor-pointer rounded-none border border-black text-center caret-transparent outline-none"
                  onClick={(e) => {
                    e.stopImmediatePropagation();
                    setActive(y() * 9 + x());
                  }}
                  inputMode="numeric"
                ></input>
              )}
            </For>
          )}
        </For>
      </div>
      <div class="flex space-x-4">
        <button
          onClick={() => {
            setActive(null);
            setSolving(true);
            postMessage({ message: 'solve', array: values.flat() });
          }}
          class="hover:text-stone-80 h-8 w-20 rounded-lg bg-green-600 text-stone-200 transition hover:bg-green-400 disabled:bg-green-400"
          disabled={!ready() || solving()}
        >
          Solve
        </button>
        <button
          disabled={solving()}
          onClick={() => {
            setActive(null);
            const playerChosen = highlighted();
            updateValues(
              (previous) =>
                previous.map((row, y) =>
                  row.map((cell, x) => (playerChosen.has(y * 9 + x) ? cell : 0)),
                ) as Board,
            );
          }}
          class="h-8 w-20 rounded-lg bg-yellow-500 transition hover:bg-yellow-300 hover:text-stone-700 disabled:bg-yellow-300 disabled:text-stone-700"
        >
          Clear
        </button>
        <button
          disabled={solving()}
          onClick={() => {
            setActive(null);
            updateValues(newBoard());
            setHighlighted(new Set<number>());
            reset();
          }}
          class="h-8 w-20 rounded-lg bg-red-600 text-stone-200 transition hover:bg-red-400 disabled:bg-red-400"
        >
          Reset
        </button>
      </div>
      <div class="flex space-x-4">
        <button
          disabled={solving()}
          onClick={() => {
            copyBoard();
          }}
          class="hover:text-stone-80 flex items-center justify-center space-x-2 rounded-lg bg-stone-600 p-2 text-stone-200 transition hover:bg-stone-400 disabled:bg-stone-400"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
            ></path>
          </svg>
          <span>Copy</span>
        </button>
        <button
          disabled={solving()}
          onClick={() => {
            pasteBoard().catch(() => {
              // pass
            });
          }}
          class="hover:text-stone-80 flex items-center justify-center space-x-2 rounded-lg bg-stone-600 p-2 text-stone-200 transition hover:bg-stone-400 disabled:bg-stone-400"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            ></path>
          </svg>
          <span>Paste</span>
        </button>
      </div>
    </div>
  );
}
