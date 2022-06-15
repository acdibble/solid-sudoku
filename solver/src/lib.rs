use std::convert::TryFrom;

use wasm_bindgen::prelude::*;

#[derive(Debug, Copy, Clone)]
enum Value {
    None = 0,
    One = 0b1,
    Two = 0b10,
    Three = 0b100,
    Four = 0b1000,
    Five = 0b1_0000,
    Six = 0b10_0000,
    Seven = 0b100_0000,
    Eight = 0b1000_0000,
    Nine = 0b1_0000_0000,
}

impl Default for Value {
    fn default() -> Self {
        Value::None
    }
}

impl Value {
    fn next(&self) -> Option<Self> {
        match self {
            Value::None => Some(Value::One),
            Value::One => Some(Value::Two),
            Value::Two => Some(Value::Three),
            Value::Three => Some(Value::Four),
            Value::Four => Some(Value::Five),
            Value::Five => Some(Value::Six),
            Value::Six => Some(Value::Seven),
            Value::Seven => Some(Value::Eight),
            Value::Eight => Some(Value::Nine),
            Value::Nine => None,
        }
    }
}

impl From<&Value> for i32 {
    fn from(value: &Value) -> Self {
        match value {
            Value::None => 0,
            Value::One => 1,
            Value::Two => 2,
            Value::Three => 3,
            Value::Four => 4,
            Value::Five => 5,
            Value::Six => 6,
            Value::Seven => 7,
            Value::Eight => 8,
            Value::Nine => 9,
        }
    }
}

impl From<&i32> for Value {
    fn from(number: &i32) -> Self {
        match number {
            0 => Value::None,
            1 => Value::One,
            2 => Value::Two,
            3 => Value::Three,
            4 => Value::Four,
            5 => Value::Five,
            6 => Value::Six,
            7 => Value::Seven,
            8 => Value::Eight,
            9 => Value::Nine,
            _ => unreachable!(),
        }
    }
}

impl From<i32> for Value {
    fn from(number: i32) -> Self {
        Self::from(&number)
    }
}

struct Stack<const N: usize, T: Clone + Copy + Default> {
    items: [T; N],
    pointer: usize,
}

impl<const N: usize, T: Clone + Copy + Default> Stack<N, T> {
    fn new() -> Self {
        Self {
            items: [Default::default(); N],
            pointer: 0,
        }
    }

    fn push(&mut self, element: T) {
        if self.pointer == N {
            panic!("stack overflow")
        }

        self.items[self.pointer] = element;
        self.pointer += 1;
    }

    fn pop(&mut self) {
        if self.pointer == 0 {
            panic!("stack underflow")
        }

        self.pointer -= 1;
    }

    fn peek_mut(&mut self) -> &mut T {
        match self.items.get_mut(self.pointer - 1) {
            Some(value) => value,
            _ => unreachable!(),
        }
    }

    fn peek(&self) -> &T {
        match self.items.get(self.pointer - 1) {
            Some(value) => value,
            _ => unreachable!(),
        }
    }

    fn is_empty(&self) -> bool {
        self.pointer == 0
    }
}

struct State(i32);

impl State {
    fn new_array() -> [State; 9] {
        [
            State(0),
            State(0),
            State(0),
            State(0),
            State(0),
            State(0),
            State(0),
            State(0),
            State(0),
        ]
    }

    fn add(&self, value: &Value) -> Result<State, ()> {
        let new_state = self.0 | *value as i32;

        match new_state == self.0 {
            true => Err(()),
            false => Ok(State(new_state)),
        }
    }

    fn remove(&self, value: &Value) -> State {
        State(self.0 & !(*value as i32))
    }
}

struct Board {
    values: [Value; 81],
    row_states: [State; 9],
    column_states: [State; 9],
    square_states: [State; 9],
}

impl Board {
    fn add(&mut self, location: usize, value: &Value) -> Result<(), ()> {
        let column_index = location % 9;
        let new_column_state = self.column_states[column_index].add(value)?;

        let row_index = location / 9;
        let new_row_state = self.row_states[row_index].add(value)?;

        let square_index = (location % 9) / 3 + location / 27 * 3;
        let new_square_state = self.square_states[square_index].add(value)?;

        self.column_states[column_index] = new_column_state;
        self.row_states[row_index] = new_row_state;
        self.square_states[square_index] = new_square_state;
        self.values[location] = *value;

        Ok(())
    }

    fn remove(&mut self, location: usize, value: &Value) {
        let column_index = location % 9;
        let new_column_state = self.column_states[column_index].remove(value);

        let row_index = location / 9;
        let new_row_state = self.row_states[row_index].remove(value);

        let square_index = (location % 9) / 3 + location / 27 * 3;
        let new_square_state = self.square_states[square_index].remove(value);

        self.column_states[column_index] = new_column_state;
        self.row_states[row_index] = new_row_state;
        self.square_states[square_index] = new_square_state;
        self.values[location] = Value::None;
    }

    fn solve(&mut self) -> Result<(), &'static str> {
        let mut index = 0;
        let mut stack: Stack<81, (usize, Value)> = Stack::new();
        let original_state = self.values.clone();

        while index < 81 {
            if !matches!(original_state[index], Value::None) {
                index += 1;
                continue;
            }

            if stack.is_empty() || stack.peek().0 != index {
                stack.push((index, Value::None));
            }

            let stack_top = stack.peek();

            self.remove(index, &stack_top.1);

            let mut next_value = stack_top.1.next();

            loop {
                if let Some(new_value) = next_value {
                    next_value = new_value.next();
                    stack.peek_mut().1 = new_value;

                    if self.add(index, &new_value).is_ok() {
                        index += 1;
                        break;
                    }
                } else {
                    stack.pop();

                    if stack.is_empty() {
                        return Err("Unable to solve board");
                    }

                    index = stack.peek().0;
                    break;
                }
            }
        }

        Ok(())
    }
}
impl TryFrom<&js_sys::Int32Array> for Board {
    type Error = &'static str;

    fn try_from(array: &js_sys::Int32Array) -> Result<Self, Self::Error> {
        let mut board = Self {
            values: [Value::None; 81],
            row_states: State::new_array(),
            column_states: State::new_array(),
            square_states: State::new_array(),
        };

        let mut error = false;
        array.for_each(&mut |value, index, _| {
            if value == 0 {
                return;
            }
            if board.add(index as usize, &Value::from(value)).is_err() {
                error = true;
            }
        });

        if error {
            Err("Board contains conflicts")
        } else {
            Ok(board)
        }
    }
}

#[wasm_bindgen]
pub fn solve(puzzle: &js_sys::Int32Array) -> Result<js_sys::Int32Array, js_sys::Error> {
    let mut board = Board::try_from(puzzle).map_err(|str| js_sys::Error::new(str))?;

    board.solve().map_err(|str| js_sys::Error::new(str))?;

    let array = js_sys::Int32Array::new_with_length(81);
    for (index, value) in board.values.iter().enumerate() {
        array.set_index(index as u32, i32::from(value))
    }

    Ok(array)
}
