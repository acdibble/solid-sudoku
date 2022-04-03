use std::result::Result;
use wasm_bindgen::prelude::*;

type Board = [u32; 81];

struct ValidChecker {
    map: [bool; 9],
}

impl ValidChecker {
    fn new() -> Self {
        Self { map: [false; 9] }
    }

    fn add(&mut self, num: u32) -> Result<(), ()> {
        if num != 0 {
            match self.map.get_mut(num as usize - 1) {
                None | Some(true) => return Err(()),
                Some(value) => *value = true,
            }
        }

        Ok(())
    }
}

fn is_row_valid(puzzle: &Board, index: usize) -> Result<(), ()> {
    let row_start = (index / 9) * 9;
    let row = &puzzle[row_start..(row_start + 9)];
    let mut checker = ValidChecker::new();

    for value in row {
        checker.add(*value)?
    }

    Ok(())
}

fn is_column_valid(puzzle: &Board, index: usize) -> Result<(), ()> {
    let col_num = index % 9;
    let mut checker = ValidChecker::new();

    for row in 0..9 {
        checker.add(puzzle[col_num + row * 9])?
    }

    Ok(())
}

fn is_square_valid(puzzle: &Board, index: usize) -> Result<(), ()> {
    let col_num = index % 9;
    let row_num = index / 9;
    let x_start = col_num - (col_num % 3);
    let y_start = row_num - (row_num % 3);
    let mut checker = ValidChecker::new();

    for y in y_start..(y_start + 3) {
        for x in x_start..(x_start + 3) {
            checker.add(puzzle[y * 9 + x])?
        }
    }

    Ok(())
}

fn run(puzzle: &mut Board, index: usize) -> Result<(), ()> {
    is_row_valid(puzzle, index)?;
    is_column_valid(puzzle, index)?;
    is_square_valid(puzzle, index)?;

    for index in 0..81 {
        if puzzle[index] != 0 {
            continue;
        }

        for n in 1..=9 {
            puzzle[index] = n;
            if run(puzzle, index).is_ok() {
                return Ok(());
            }
            puzzle[index] = 0;
        }

        if puzzle[index] == 0 {
            return Err(());
        }
    }

    Ok(())
}

#[wasm_bindgen]
pub fn solve(puzzle: &js_sys::Uint32Array) -> js_sys::Uint32Array {
    let mut board = [0u32; 81];
    puzzle.copy_to(&mut board);

    match run(&mut board, 0) {
        Ok(()) => js_sys::Uint32Array::from(&board[..]),
        _ => js_sys::Uint32Array::new_with_length(0),
    }
}
