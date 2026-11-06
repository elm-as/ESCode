// Elmas Studio — Vanilla JavaScript Mobile App
let count = 0;

const valEl = document.getElementById("counter-val");
const btnInc = document.getElementById("btn-inc");
const btnDec = document.getElementById("btn-dec");

function updateDisplay() {
  if (valEl) {
    valEl.textContent = String(count);
  }
}

if (btnInc) {
  btnInc.addEventListener("click", () => {
    count += 1;
    updateDisplay();
  });
}

if (btnDec) {
  btnDec.addEventListener("click", () => {
    count = Math.max(0, count - 1);
    updateDisplay();
  });
}
