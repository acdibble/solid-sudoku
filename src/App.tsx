import { createSignal } from 'solid-js';
import init, { solve } from '../solver/pkg';

export default function App() {
  const [values, setValues] = createSignal(Uint32Array.from({ length: 81 }));
  const [active, setActive] = createSignal<number | null>(null);
  const [ready, setReady] = createSignal(false);
  const [highlighted, setHighlighted] = createSignal(new Set<number>());

  init()
    .then(() => setReady(true))
    .catch(console.error);

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
      const updatedValues = new Uint32Array(values());
      updatedValues[selected] = newValue;
      setValues(updatedValues);

      const updatedHighlighted = new Set(highlighted());
      updatedHighlighted[functionName](selected);
      setHighlighted(updatedHighlighted);
    }
  });

  document.addEventListener('click', () => {
    if (active()) {
      setActive(null);
    }
  });

  return (
    <div class="flex flex-col justify-center items-center h-screen space-y-5">
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
              <button
                classList={{
                  'w-10': true,
                  'h-10': true,
                  'border-black': true,
                  'border-[1px]': true,
                  'bg-green-600': isSelected,
                  'bg-stone-300': !isSelected && highlighted().has(id),
                  'border-r-2': borderRight,
                  'border-l-2': borderLeft,
                  'border-t-2': borderTop,
                  'border-b-2': borderBottom,
                }}
                onClick={(e) => {
                  e.stopImmediatePropagation();
                  setActive(isSelected ? null : id);
                }}
              >
                {values()[id] || ''}
              </button>
            );
          }),
        )}
      </div>
      <div class="flex space-x-4">
        <button
          onClick={() => {
            setActive(null);
            const solved = solve(new Uint32Array(values()));
            if (solved.length !== 0) setValues(solved);
          }}
          class={`${
            ready() ? 'bg-green-600' : 'bg-green-400'
          } text-stone-200 w-20 h-8 rounded-lg hover:bg-green-400 hover:text-stone-800`}
          disabled={!ready()}
        >
          Solve
        </button>
        <button
          onClick={() => {
            setActive(null);
            const playerChosen = highlighted();
            return setValues((previous) =>
              previous.map((value, index) => (playerChosen.has(index) ? value : 0)),
            );
          }}
          class="w-20 h-8 rounded-lg bg-yellow-500 hover:bg-yellow-300"
        >
          Clear
        </button>
        <button
          onClick={() => {
            setActive(null);
            setValues((previous) => previous.map(() => 0));
            setHighlighted(new Set<number>());
          }}
          class="w-20 h-8 rounded-lg bg-red-600 text-stone-200 hover:bg-red-400"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
