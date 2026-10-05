const KEY = "financas:v1";
const CATEGORIAS = {
  despesa: ["Alimentação", "Transporte", "Moradia", "Estudos", "Lazer", "Saúde", "Assinaturas", "Outros"],
  receita: ["Freela ou site", "Salário ou mesada", "Outros"]
};
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

let estado = { lancamentos: [], meta: 0 };
let ultimoExcluido = null;
let toastTimer = null;

const $ = id => document.getElementById(id);

/* ---------- Armazenamento ---------- */
function carregar() {
  try {
    const bruto = localStorage.getItem(KEY);
    if (!bruto) return;
    const o = JSON.parse(bruto);
    if (o && Array.isArray(o.lancamentos)) estado = { lancamentos: o.lancamentos, meta: Number(o.meta) || 0 };
  } catch (e) { /* começa vazio */ }
}
function salvar() {
  try { localStorage.setItem(KEY, JSON.stringify(estado)); }
  catch (e) { $("erro").textContent = "Não foi possível salvar neste navegador."; }
}

/* ---------- Utilitários ---------- */
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseValor(txt) {
  let s = String(txt).trim().replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
function tipoAtual() { return document.querySelector('input[name="tipo"]:checked').value; }
function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ---------- Formulário ---------- */
function preencherCategorias() {
  const sel = $("cat");
  sel.innerHTML = "";
  CATEGORIAS[tipoAtual()].forEach(c => {
    const o = document.createElement("option");
    o.textContent = c;
    sel.appendChild(o);
  });
}
document.querySelectorAll('input[name="tipo"]').forEach(r => r.addEventListener("change", preencherCategorias));

$("form").addEventListener("submit", e => {
  e.preventDefault();
  const desc = $("desc").value.trim();
  const valor = parseValor($("valor").value);
  const data = $("data").value;
  if (!desc) { $("erro").textContent = "Escreva uma descrição."; $("desc").focus(); return; }
  if (!(valor > 0)) { $("erro").textContent = "Informe um valor maior que zero. Exemplo: 12,50"; $("valor").focus(); return; }
  if (!data) { $("erro").textContent = "Escolha a data."; $("data").focus(); return; }
  $("erro").textContent = "";
  estado.lancamentos.push({ id: novoId(), tipo: tipoAtual(), desc, valor, cat: $("cat").value, data });
  salvar();
  $("mes").value = data.slice(0, 7);
  $("desc").value = "";
  $("valor").value = "";
  $("desc").focus();
  render();
});

/* ---------- Meta ---------- */
$("meta").addEventListener("input", () => {
  const v = parseValor($("meta").value);
  estado.meta = v > 0 ? v : 0;
  salvar();
  render();
});

/* ---------- Exclusão com desfazer ---------- */
function excluir(id) {
  const i = estado.lancamentos.findIndex(l => l.id === id);
  if (i < 0) return;
  ultimoExcluido = { item: estado.lancamentos[i], i };
  estado.lancamentos.splice(i, 1);
  salvar();
  render();
  avisar("Lançamento excluído.");
}
function avisar(txt) {
  $("toastTxt").textContent = txt;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; ultimoExcluido = null; }, 6000);
}
$("toastBtn").addEventListener("click", () => {
  if (!ultimoExcluido) return;
  estado.lancamentos.splice(ultimoExcluido.i, 0, ultimoExcluido.item);
  ultimoExcluido = null;
  $("toast").hidden = true;
  salvar();
  render();
});

/* ---------- Backup ---------- */
$("gerar").addEventListener("click", () => {
  const t = $("backup");
  t.value = JSON.stringify(estado);
  t.focus();
  t.select();
  $("backupMsg").textContent = "Backup gerado. Copie o texto acima e guarde em um lugar seguro.";
});
$("restaurar").addEventListener("click", () => {
  try {
    const o = JSON.parse($("backup").value);
    if (!o || !Array.isArray(o.lancamentos)) throw new Error("formato");
    const ok = o.lancamentos.every(l => l && (l.tipo === "receita" || l.tipo === "despesa") &&
      typeof l.desc === "string" && Number(l.valor) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(l.data));
    if (!ok) throw new Error("itens");
    estado = {
      lancamentos: o.lancamentos.map(l => ({ id: l.id || novoId(), tipo: l.tipo, desc: l.desc, valor: Number(l.valor), cat: l.cat || "Outros", data: l.data })),
      meta: Number(o.meta) || 0
    };
    salvar();
    $("meta").value = estado.meta ? String(estado.meta).replace(".", ",") : "";
    $("backupMsg").textContent = "Dados restaurados com sucesso.";
    render();
  } catch (e) {
    $("backupMsg").textContent = "Esse texto não parece um backup válido. Cole o texto completo gerado por este site.";
  }
});

/* ---------- Desenho da tela ---------- */
function render() {
  const mes = $("mes").value || hojeISO().slice(0, 7);
  const [ano, m] = mes.split("-").map(Number);
  const nomeMes = new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  $("mesTitulo").textContent = "Saldo de " + nomeMes;

  const doMes = estado.lancamentos.filter(l => l.data.startsWith(mes));
  const soma = tipo => doMes.filter(l => l.tipo === tipo).reduce((s, l) => s + l.valor, 0);
  const rec = soma("receita");
  const desp = soma("despesa");
  const saldo = Math.round((rec - desp) * 100) / 100;

  const elSaldo = $("saldo");
  elSaldo.textContent = brl.format(saldo);
  elSaldo.className = "linha saldo " + (saldo < 0 ? "neg" : "pos");
  $("receitas").textContent = brl.format(rec);
  $("despesas").textContent = brl.format(desp);

  // Meta
  if (estado.meta > 0) {
    $("metaArea").hidden = false;
    const pct = desp / estado.meta * 100;
    $("metaFill").style.width = Math.min(100, pct) + "%";
    const estourou = desp > estado.meta;
    $("metaBarra").classList.toggle("estourou", estourou);
    $("metaTxt").classList.toggle("estourou", estourou);
    $("metaTxt").textContent = estourou
      ? `Você passou ${brl.format(desp - estado.meta)} da meta de ${brl.format(estado.meta)}.`
      : `${brl.format(desp)} de ${brl.format(estado.meta)} (${Math.round(pct)}%). Ainda restam ${brl.format(estado.meta - desp)}.`;
  } else {
    $("metaArea").hidden = true;
  }

  // Categorias de despesa
  const porCat = {};
  doMes.filter(l => l.tipo === "despesa").forEach(l => { porCat[l.cat] = (porCat[l.cat] || 0) + l.valor; });
  const ordenadas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const ulCats = $("cats");
  ulCats.innerHTML = "";
  ordenadas.forEach(([nome, v]) => {
    const li = document.createElement("li");
    const topo = document.createElement("div");
    topo.className = "topo-cat";
    const a = document.createElement("span"); a.textContent = nome;
    const b = document.createElement("span"); b.textContent = `${brl.format(v)} (${Math.round(v / desp * 100)}%)`;
    topo.append(a, b);
    const barra = document.createElement("div"); barra.className = "barra";
    const fill = document.createElement("i"); fill.style.width = (v / desp * 100) + "%";
    barra.appendChild(fill);
    li.append(topo, barra);
    ulCats.appendChild(li);
  });
  $("catsVazio").hidden = ordenadas.length > 0;

  // Lista
  const ul = $("lista");
  ul.innerHTML = "";
  doMes.slice().sort((a, b) => b.data.localeCompare(a.data)).forEach(l => {
    const li = document.createElement("li");
    li.className = "item";
    const dia = document.createElement("span"); dia.className = "dia"; dia.textContent = l.data.slice(8, 10) + "/" + l.data.slice(5, 7);
    const info = document.createElement("div"); info.className = "info";
    const nome = document.createElement("strong"); nome.textContent = l.desc;
    const cat = document.createElement("small"); cat.textContent = l.cat;
    info.append(nome, cat);
    const dir = document.createElement("div");
    const val = document.createElement("div"); val.className = "val " + (l.tipo === "receita" ? "pos" : "neg");
    val.textContent = (l.tipo === "receita" ? "+ " : "− ") + brl.format(l.valor);
    const bt = document.createElement("button"); bt.type = "button"; bt.className = "excluir"; bt.textContent = "Excluir";
    bt.setAttribute("aria-label", "Excluir " + l.desc);
    bt.addEventListener("click", () => excluir(l.id));
    dir.append(val, bt);
    li.append(dia, info, dir);
    ul.appendChild(li);
  });
  $("listaVazia").hidden = doMes.length > 0;
}

/* ---------- Início ---------- */
carregar();
$("mes").value = hojeISO().slice(0, 7);
$("data").value = hojeISO();
$("meta").value = estado.meta ? String(estado.meta).replace(".", ",") : "";
$("mes").addEventListener("change", render);
preencherCategorias();
render();
