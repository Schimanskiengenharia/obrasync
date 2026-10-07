// S3 — listas de módulos por papel no front (espelho do backend).
//
// Contrato: gerente e visualizador NÃO recebem administração do sistema (users,
// permissions, backupLocal, migration, auditLog) no menu; visualizador também não
// recebe RH/Pessoal (LGPD). As telas de Backup e Migração têm guarda isAdmin().
// Extrai o bloco real `const modules ... const moduleLabels` do app.js e o avalia.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "..", "..", "..", "app.js");
const src = fs.readFileSync(APP, "utf8");

let ok = 0;
let falhas = 0;
function t_assert(nome, cond, detalhe) {
  if (cond) { ok++; return; }
  falhas++;
  console.error("  FALHA: " + nome + (detalhe ? "\n         " + detalhe : ""));
}

const ini = src.indexOf("const modules = [");
const fim = src.indexOf("const moduleLabels = Object.fromEntries(modules);");
t_assert("bloco modules..moduleLabels encontrado", ini > 0 && fim > ini);
const bloco = src.slice(ini, fim + "const moduleLabels = Object.fromEntries(modules);".length);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(bloco + "\nthis.modules = modules; this.roleModules = roleModules; this.EDITABLE_BY_ROLE = EDITABLE_BY_ROLE; this.MODULOS_SO_ADMIN = MODULOS_SO_ADMIN; this.MODULOS_VEDADOS_VISUALIZADOR = MODULOS_VEDADOS_VISUALIZADOR;", ctx);

const todas = ctx.modules.map(([k]) => k);
const soAdmin = ["users", "permissions", "backupLocal", "migration", "auditLog"];
const rh = ["rhColaboradores", "rhVencimentos", "rhTiposDocumento"];

t_assert("MODULOS_SO_ADMIN = users/permissions/backupLocal/migration/auditLog", JSON.stringify([...ctx.MODULOS_SO_ADMIN].sort()) === JSON.stringify([...soAdmin].sort()));
t_assert("MODULOS_VEDADOS_VISUALIZADOR = soAdmin + RH", JSON.stringify([...ctx.MODULOS_VEDADOS_VISUALIZADOR].sort()) === JSON.stringify([...soAdmin, ...rh].sort()));

for (const k of soAdmin) {
  t_assert("gerente nao ve " + k, !ctx.roleModules.gerente.includes(k));
  t_assert("visualizador nao ve " + k, !ctx.roleModules.visualizador.includes(k));
  t_assert("gerente nao edita " + k, !ctx.EDITABLE_BY_ROLE.gerente.includes(k));
}
for (const k of rh) {
  t_assert("visualizador nao ve " + k, !ctx.roleModules.visualizador.includes(k));
  t_assert("gerente continua vendo " + k, ctx.roleModules.gerente.includes(k));
}
t_assert("admin ve tudo", ctx.roleModules.admin.length === todas.length);
t_assert("gerente = tudo menos os 5 de admin", ctx.roleModules.gerente.length === todas.length - soAdmin.length);
t_assert("visualizador = tudo menos os 5 de admin e os 3 de RH", ctx.roleModules.visualizador.length === todas.length - soAdmin.length - rh.length);
for (const k of ["dashboard", "projects", "receivable", "payable", "reconciliation", "rdo", "qualidadeDashboard", "reports", "iaBusca"]) {
  t_assert("visualizador ve " + k, ctx.roleModules.visualizador.includes(k));
}

// Guardas de tela (defesa extra ao menu; os endpoints já eram require_admin).
const guarda = /if \(!isAdmin\(\)\) \{\s*qs\("content"\)\.innerHTML = `<section class="panel"><p>Acesso restrito ao administrador\.<\/p><\/section>`;\s*return;\s*\}/;
for (const fn of ["renderBackupLocal", "renderMigration"]) {
  const i = src.indexOf("function " + fn + "()");
  const corpo = src.slice(i, i + 600);
  t_assert(fn + " tem guarda isAdmin()", i > 0 && guarda.test(corpo));
}

console.log(`test_role_modules: ${ok}/${ok + falhas} ok`);
process.exit(falhas > 0 ? 1 : 0);
