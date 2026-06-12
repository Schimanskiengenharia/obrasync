// Aplica o tema salvo ANTES do primeiro paint para evitar flash de tema errado.
// Em arquivo separado (não inline) para o Content-Security-Policy permitir
// script-src 'self' sem 'unsafe-inline'. Usado pelo index.html e pelos plugins.
(function () {
  var pref = "auto";
  try { pref = localStorage.getItem("finconta.theme") || "auto"; } catch (e) { /* sem armazenamento */ }
  if (pref !== "light" && pref !== "dark" && pref !== "auto") pref = "auto";
  var dark = pref === "dark" || (pref === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePref = pref;
})();
