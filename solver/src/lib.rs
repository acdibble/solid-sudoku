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

const VALUES: [Value; 9] = [
    Value::One,
    Value::Two,
    Value::Three,
    Value::Four,
    Value::Five,
    Value::Six,
    Value::Seven,
    Value::Eight,
    Value::Nine,
];

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

    fn remove(&self, value: &Value) -> Result<State, ()> {
        let new_state = self.0 & !(*value as i32);

        match new_state == self.0 {
            true => Err(()),
            false => Ok(State(new_state)),
        }
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

    fn remove(&mut self, location: usize, value: &Value) -> Result<(), ()> {
        let column_index = location % 9;
        let new_column_state = self.column_states[column_index].remove(value)?;

        let row_index = location / 9;
        let new_row_state = self.row_states[row_index].remove(value)?;

        let square_index = (location % 9) / 3 + location / 27 * 3;
        let new_square_state = self.square_states[square_index].remove(value)?;

        self.column_states[column_index] = new_column_state;
        self.row_states[row_index] = new_row_state;
        self.square_states[square_index] = new_square_state;
        self.values[location] = Value::None;

        Ok(())
    }

    fn solve(&mut self, starting_index: usize) -> Result<(), ()> {
        for index in starting_index..81 {
            if !matches!(self.values[index], Value::None) {
                continue;
            }

            for value in VALUES {
                if self.add(index, &value).is_ok() {
                    if let Ok(arr) = self.solve(index + 1) {
                        return Ok(arr);
                    }

                    self.remove(index, &value)?;
                }
            }

            if matches!(self.values[index], Value::None) {
                return Err(());
            }
        }

        Ok(())
    }
}

impl TryFrom<&js_sys::Int32Array> for Board {
    type Error = ();

    fn try_from(array: &js_sys::Int32Array) -> Result<Self, Self::Error> {
        let mut board = Self {
            values: [Value::None; 81],
            row_states: State::new_array(),
            column_states: State::new_array(),
            square_states: State::new_array(),
        };

        array.for_each(&mut |value, index, _| {
            if value == 0 {
                return;
            }
            board.add(index as usize, &Value::from(value)).unwrap();
        });

        Ok(board)
    }
}

#[wasm_bindgen]
pub fn solve(puzzle: &js_sys::Int32Array) -> js_sys::Int32Array {
    Board::try_from(puzzle)
        .and_then(|mut board| {
            board.solve(0)?;

            let array = js_sys::Int32Array::new_with_length(81);
            for (index, value) in board.values.iter().enumerate() {
                array.set_index(index as u32, i32::from(value))
            }

            Ok(array)
        })
        .unwrap_or_else(|()| js_sys::Int32Array::new_with_length(0))
}
