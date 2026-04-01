export function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

export function formatVGrade(floatDifficulty) {
  const gradeMap = {
    10: "V0", 11: "V0",
    12: "V1", 13: "V1",
    14: "V2", 15: "V2",
    16: "V3", 17: "V3",
    18: "V4", 19: "V4",
    20: "V5", 21: "V5",
    22: "V6", 23: "V7",
    24: "V8", 25: "V9",
    26: "V10", 27: "V11",
    28: "V12", 29: "V13",
    30: "V14", 31: "V15", 32: "V16"
  };
  const score = Math.round(floatDifficulty);
  return gradeMap[score] || `V${score - 13}`; // Fallback calculation
}