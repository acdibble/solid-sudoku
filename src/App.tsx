import { createEffect, createMemo, createSignal } from 'solid-js';
import Worker from './worker?worker';
import type { WorkerMessage } from './worker';

export type AppMessage = { message: 'solve'; array: Int32Array };

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

export default function App() {
  const [values, setValues] = createSignal(Int32Array.from({ length: 81 }));
  const [active, setActive] = createSignal<number | null>(null);
  const [ready, setReady] = createSignal(false);
  const [highlighted, setHighlighted] = createSignal(new Set<number>());
  const [solving, setSolving] = createSignal(false);

  const { timeElapsed, start, stop, reset } = useTimer();

  const worker = new Worker();

  worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
    if (e.data.type === 'message') {
      if (e.data.message === 'ready') {
        setReady(true);
      } else if (e.data.message === 'solved') {
        if (e.data.result.length !== 0) {
          setValues(e.data.result);
        }
        setSolving(false);
      }
    } else if (e.data.type === 'error') {
      alert(e.data.message);
    }
    console.log(e.data);
  };

  createEffect(() => {
    // eslint-disable-next-line no-unused-expressions
    solving() ? start() : stop();
  });

  const postMessage = (message: AppMessage) => ready() && worker.postMessage(message);

  document.addEventListener('keydown', (e) => {
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
      const updatedValues = new Int32Array(values());
      updatedValues[selected] = newValue;
      setValues(updatedValues);

      const updatedHighlighted = new Set(highlighted());
      updatedHighlighted[functionName](selected);
      setHighlighted(updatedHighlighted);
    }
  });

  const copyBoard = () => {
    if (!getSelection()?.toString()) {
      navigator.clipboard.writeText(JSON.stringify([...values()])).catch(() => {
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
        setValues(new Int32Array(newValues));
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
        {Array.from({ length: 9 }, (_, y) =>
          Array.from({ length: 9 }, (__, x) => {
            const id = y * 9 + x;
            const isSelected = active() === id;
            const borderTop = [0, 3, 6].includes(y % 9);
            const borderRight = [2, 5, 8].includes(x % 9);
            const borderBottom = [2, 5, 8].includes(y % 9);
            const borderLeft = [0, 3, 6].includes(x % 9);

            return (
              <input
                classList={{
                  'hover:bg-green-300': !isSelected,
                  'bg-green-600': isSelected,
                  'bg-stone-300': !isSelected && highlighted().has(id),
                  'border-r-2': borderRight,
                  'border-l-2': borderLeft,
                  'border-t-2': borderTop,
                  'border-b-2': borderBottom,
                }}
                class="h-10 w-10 cursor-pointer border border-black text-center caret-transparent outline-none"
                onClick={(e) => {
                  e.stopImmediatePropagation();
                  setActive(isSelected ? null : id);
                }}
                value={values()[id] || ''}
                inputmode="numeric"
                pattern="^\d$"
              ></input>
            );
          }),
        )}
      </div>
      <div class="flex space-x-4">
        <button
          onClick={() => {
            setActive(null);
            setSolving(true);
            postMessage({ message: 'solve', array: values() });
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
            return setValues((previous) =>
              previous.map((value, index) => (playerChosen.has(index) ? value : 0)),
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
            setValues((previous) => previous.map(() => 0));
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
