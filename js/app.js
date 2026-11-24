let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = new Set();
let secondsElapsed = 0;
let timerInterval = null;

const el = (id) => document.getElementById(id);

async function init() {
  try {
    const response = await fetch("data/questoes_grupo2.json");
    if (!response.ok) throw new Error("Falha ao carregar o arquivo JSON.");
    allQuestions = await response.json();
    updateAvailableCount();
  } catch (error) {
    el("filter-status").textContent =
      "Erro ao carregar data/questoes_grupo2.json. Execute via servidor local (ex.: Live Server).";
    console.error(error);
  }

  el("select-subarea").addEventListener("change", updateAvailableCount);
  el("select-dificuldade").addEventListener("change", updateAvailableCount);
  el("btn-iniciar").addEventListener("click", startExam);
  el("btn-prev").addEventListener("click", () => navigate(-1));
  el("btn-next").addEventListener("click", () => navigate(1));
  el("btn-flag").addEventListener("click", toggleFlag);
  el("btn-finish").addEventListener("click", finishExam);
  el("btn-restart").addEventListener("click", resetToSetup);
}

function getFilteredQuestions() {
  const subarea = el("select-subarea").value;
  const dificuldade = el("select-dificuldade").value;

  return allQuestions.filter((q) => {
    const matchSub = subarea === "TODAS" || q.subarea === subarea;
    const matchDif = dificuldade === "TODOS" || q.nivel_dificuldade === dificuldade;
    return matchSub && matchDif;
  });
}

function updateAvailableCount() {
  const filtered = getFilteredQuestions();
  const btn = el("btn-iniciar");
  if (filtered.length === 0) {
    el("filter-status").textContent = "Nenhuma questão cadastrada para este filtro.";
    btn.disabled = true;
  } else {
    el("filter-status").textContent = `${filtered.length} questão(ões) disponível(is) para este simulado.`;
    btn.disabled = false;
  }
}

function startExam() {
  activeQuestions = getFilteredQuestions();
  currentIndex = 0;
  userAnswers = {};
  flaggedQuestions = new Set();
  secondsElapsed = 0;

  el("screen-setup").classList.add("hidden");
  el("screen-results").classList.add("hidden");
  el("screen-exam").classList.remove("hidden");

  startTimer();
  renderQuestion();
}

function startTimer() {
  clearInterval(timerInterval);
  el("timer-display").textContent = "00:00";
  timerInterval = setInterval(() => {
    secondsElapsed++;
    el("timer-display").textContent = formatTime(secondsElapsed);
  }, 1000);
}

function formatTime(totalSec) {
  const mins = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const secs = String(totalSec % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function renderQuestion() {
  const q = activeQuestions[currentIndex];
  const total = activeQuestions.length;

  el("progress-text").textContent = `Questão ${currentIndex + 1} de ${total}`;
  el("progress-fill").style.width = `${((currentIndex + 1) / total) * 100}%`;
  el("question-meta").textContent =
    `${q.subarea} • Nível: ${q.nivel_dificuldade} • Fonte: ${q.fonte.exame} (${q.fonte.instituicao}, ${q.fonte.ano} - Q.${q.fonte.numero_questao})`;
  el("question-text").textContent = q.enunciado;

  const imgBox = el("question-image-container");
  if (q.imagem_url) {
    el("question-image").src = q.imagem_url;
    imgBox.classList.remove("hidden");
  } else {
    imgBox.classList.add("hidden");
  }

  const optionsContainer = el("options-container");
  optionsContainer.innerHTML = "";

  Object.entries(q.alternativas).forEach(([letter, text]) => {
    const item = document.createElement("div");
    item.className = "option-item" + (userAnswers[q.id] === letter ? " selected" : "");
    item.innerHTML = `<span class="option-letter">${letter})</span><span>${text}</span>`;
    item.addEventListener("click", () => {
      userAnswers[q.id] = letter;
      renderQuestion();
    });
    optionsContainer.appendChild(item);
  });

  const flagBtn = el("btn-flag");
  const isFlagged = flaggedQuestions.has(q.id);
  flagBtn.classList.toggle("active", isFlagged);
  flagBtn.textContent = isFlagged ? "Marcada para revisão" : "Marcar para revisão";

  el("btn-prev").disabled = currentIndex === 0;
  el("btn-next").disabled = currentIndex === total - 1;

  renderNavGrid();
}

function renderNavGrid() {
  const grid = el("question-nav-grid");
  grid.innerHTML = "";

  activeQuestions.forEach((q, idx) => {
    const cell = document.createElement("button");
    cell.className = "nav-cell";
    if (idx === currentIndex) cell.classList.add("current");
    if (flaggedQuestions.has(q.id)) cell.classList.add("flagged");
    else if (userAnswers[q.id]) cell.classList.add("answered");

    cell.textContent = idx + 1;
    cell.addEventListener("click", () => {
      currentIndex = idx;
      renderQuestion();
    });
    grid.appendChild(cell);
  });
}

function navigate(delta) {
  const next = currentIndex + delta;
  if (next >= 0 && next < activeQuestions.length) {
    currentIndex = next;
    renderQuestion();
  }
}

function toggleFlag() {
  const qId = activeQuestions[currentIndex].id;
  if (flaggedQuestions.has(qId)) flaggedQuestions.delete(qId);
  else flaggedQuestions.add(qId);
  renderQuestion();
}

function finishExam() {
  const unanswered = activeQuestions.filter((q) => !userAnswers[q.id]).length;
  if (unanswered > 0) {
    const proceed = confirm(
      `Você ainda possui ${unanswered} questão(ões) em branco. Deseja finalizar o simulado mesmo assim?`
    );
    if (!proceed) return;
  }

  clearInterval(timerInterval);
  el("screen-exam").classList.add("hidden");
  el("screen-results").classList.remove("hidden");

  renderResults();
}

function renderResults() {
  let correctCount = 0;
  const statsBySubarea = {};

  activeQuestions.forEach((q) => {
    if (!statsBySubarea[q.subarea]) {
      statsBySubarea[q.subarea] = { total: 0, correct: 0 };
    }
    statsBySubarea[q.subarea].total++;

    if (userAnswers[q.id] === q.gabarito) {
      correctCount++;
      statsBySubarea[q.subarea].correct++;
    }
  });

  const total = activeQuestions.length;
  const pct = Math.round((correctCount / total) * 100);

  el("score-percentage").textContent = `${pct}%`;
  el("score-summary").textContent = `${correctCount} / ${total}`;
  el("time-summary").textContent = formatTime(secondsElapsed);

  const breakdownContainer = el("subarea-breakdown");
  breakdownContainer.innerHTML = "";

  Object.entries(statsBySubarea).forEach(([subarea, data]) => {
    const subPct = Math.round((data.correct / data.total) * 100);
    const div = document.createElement("div");
    div.className = "breakdown-item";
    div.innerHTML = `
      <div class="breakdown-top">
        <span>${subarea}</span>
        <span>${data.correct}/${data.total} (${subPct}%)</span>
      </div>
      <div class="progress-bar" style="margin-bottom:0">
        <div class="progress-fill" style="width:${subPct}%"></div>
      </div>
    `;
    breakdownContainer.appendChild(div);
  });

  const reviewContainer = el("review-container");
  reviewContainer.innerHTML = "";

  activeQuestions.forEach((q, idx) => {
    const chosen = userAnswers[q.id] || "Em branco";
    const isCorrect = chosen === q.gabarito;

    const card = document.createElement("div");
    card.className = `review-card ${isCorrect ? "correct" : "wrong"}`;
    card.innerHTML = `
      <div class="question-meta">
        Questão ${idx + 1} • ${q.subarea} • Fonte: ${q.fonte.exame} (${q.fonte.instituicao}, ${q.fonte.ano} - Q.${q.fonte.numero_questao})
      </div>
      <p style="margin-bottom:0.6rem"><strong>${q.enunciado}</strong></p>
      <p>Sua resposta: <strong>${chosen}</strong> | Gabarito oficial: <strong>${q.gabarito}</strong></p>
      <div class="justification-box">
        <p><strong>Justificativa da correta (${q.gabarito}):</strong> ${q.justificativa.correta}</p>
        <p style="margin-top:0.4rem"><strong>Análise dos distratores:</strong> ${q.justificativa.distratores}</p>
      </div>
    `;
    reviewContainer.appendChild(card);
  });
}

function resetToSetup() {
  el("screen-results").classList.add("hidden");
  el("screen-setup").classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", init);