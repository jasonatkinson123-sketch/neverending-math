import assert from "node:assert/strict";
import test from "node:test";
import {correctChallengeAnswer} from "../app/math-input.ts";

test("accepts flexible prime-factor separators and order",()=>{
  for(const answer of ["2, 3, 3","2 3 3","2 × 3 × 3","2x3x3","2*3*3","2 · 3 · 3","3 × 2 × 3","18 = 2 × 3 × 3"]){
    assert.equal(correctChallengeAnswer(2,answer,"factors"),true,answer);
  }
});

test("rejects composite or concatenated prime-factor answers",()=>{
  for(const answer of ["2 × 9","3 × 6","1 × 18","233"]){
    assert.equal(correctChallengeAnswer(2,answer,"factors"),false,answer);
  }
});

test("accepts natural formats for bounding whole numbers",()=>{
  for(const answer of ["7 and 8","7, 8","7 8","between 7 and 8"]){
    assert.equal(correctChallengeAnswer(11,answer,"between"),true,answer);
  }
});
