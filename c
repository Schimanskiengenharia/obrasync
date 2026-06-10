[1mdiff --git a/app.js b/app.js[m
[1mindex 15a8daa..b6e6cd7 100644[m
[1m--- a/app.js[m
[1m+++ b/app.js[m
[36m@@ -153,8 +153,9 @@[m [mconst roleModules = {[m
 };[m
 [m
 const moduleLabels = Object.fromEntries(modules);[m
[31m-const openNavGroups = new Set(["cadastros", "financeiro"]);[m
[32m+[m[32mconst openNavGroups = new Set();[m
 let sidebarCollapsed = localStorage.getItem("finconta.sidebarCollapsed") === "true";[m
[32m+[m[32mlet navInitialized = false;[m
 let serverMode = false;[m
 let serverStatus = "Conectando ao servidor";[m
 let dashboardViewMode = "general";[m
[36m@@ -1747,11 +1748,18 @@[m [mfunction canAccessModule(key) {[m
   return visibleModules().some(([moduleKey]) => moduleKey === key);[m
 }[m
 [m
[31m-// Navegação lateral: accordion, recolhimento desktop e menu ocultável no mobile.[m
[32m+[m[32m// Navegação lateral: seções independentes, recolhimento desktop e menu ocultável no mobile.[m
 function setupNav() {[m
[32m+[m[32m  if (navInitialized) {[m
[32m+[m[32m    updateShellState();[m
[32m+[m[32m    return;[m
[32m+[m[32m  }[m
[32m+[m[32m  navInitialized = true;[m
[32m+[m
   qs("moduleNav").addEventListener("click", (event) => {[m
[31m-    const groupButton = event.target.closest("[data-nav-group]");[m
[32m+[m[32m    const groupButton = event.target.closest("button[data-nav-group]");[m
     if (groupButton) {[m
[32m+[m[32m      event.preventDefault();[m
       const groupId = groupButton.dataset.navGroup;[m
       if (openNavGroups.has(groupId)) openNavGroups.delete(groupId);[m
       else openNavGroups.add(groupId);[m
[36m@@ -1760,6 +1768,7 @@[m [mfunction setupNav() {[m
     }[m
     const button = event.target.closest("button[data-module]");[m
     if (!button) return;[m
[32m+[m[32m    event.preventDefault();[m
     currentModule = button.dataset.module;[m
     qs("appShell").classList.remove("sidebar-open");[m
     qs("sidebarBackdrop").classList.add("hidden");[m
[36m@@ -1780,6 +1789,10 @@[m [mfunction setupNav() {[m
   });[m
 }[m
 [m
[32m+[m[32mfunction resetNavGroups() {[m
[32m+[m[32m  openNavGroups.clear();[m
[32m+[m[32m}[m
[32m+[m
 function renderNav() {[m
   const allowed = new Set(visibleModules().map(([key]) => key));[m
   qs("moduleNav").innerHTML = sidebarSections.map((section) => {[m
[36m@@ -1790,10 +1803,9 @@[m [mfunction renderNav() {[m
     const items = section.modules.filter((moduleKey) => allowed.has(moduleKey));[m
     if (!items.length) return "";[m
     const active = items.includes(currentModule);[m
[31m-    if (active) openNavGroups.add(section.id);[m
     const open = openNavGroups.has(section.id);[m
     return `[m
[31m-      <div class="nav-section ${active ? "section-active" : ""}">[m
[32m+[m[32m      <div class="nav-section ${active ? "section-active" : ""} ${open ? "open" : "collapsed"}">[m
         <button class="nav-section-toggle" type="button" data-nav-group="${section.id}" aria-expanded="${open}">[m
           <span class="nav-icon">${section.icon}</span>[m
           <span class="nav-label">${section.label}</span>[m
[36m@@ -3358,41 +3370,73 @@[m [mfunction currentScheduleProject() {[m
 }[m
 [m
 function renderAgenda() {[m
[32m+[m[32m  const content = qs("content");[m
[32m+[m[32m  content.innerHTML = "";[m
[32m+[m[32m  try {[m
[32m+[m[32m    renderAgendaView(content);[m
[32m+[m[32m  } catch (error) {[m
[32m+[m[32m    console.error("Erro ao renderizar Agenda:", error);[m
[32m+[m[32m    content.innerHTML = `[m
[32m+[m[32m      <section class="module-head">[m
[32m+[m[32m        <div>[m
[32m+[m[32m          <h2>Agenda</h2>[m
[32m+[m[32m          <p>Compromissos por data, horário, obra, cliente e responsável.</p>[m
[32m+[m[32m        </div>[m
[32m+[m[32m      </section>[m
[32m+[m[32m      <div class="empty">Nenhum compromisso cadastrado</div>[m
[32m+[m[32m    `;[m
[32m+[m[32m  }[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction renderAgendaView(content = qs("content")) {[m
   const editable = canEditModule("agenda");[m
[31m-  const cursor = parseLocalDate(agendaCursorDate) || new Date();[m
[31m-  const projectOptions = (db.projects || []).map((row) => `<option value="${row.id}" ${sameId(row.id, agendaProjectFilter) ? "selected" : ""}>${row.name}</option>`).join("");[m
[31m-  const typeOptions = ["reuniao", "visita", "entrega", "cobranca", "outro"].map((type) => `<option value="${type}" ${agendaTypeFilter === type ? "selected" : ""}>${agendaTypeLabel(type)}</option>`).join("");[m
[31m-  const events = filteredAgendaEvents();[m
[31m-  qs("content").innerHTML = `[m
[32m+[m[32m  const now = new Date();[m
[32m+[m[32m  const today = localDateString(now);[m
[32m+[m[32m  const cursor = parseLocalDate(agendaCursorDate) || now;[m
[32m+[m[32m  const weekDays = agendaWeekDays(cursor);[m
[32m+[m[32m  const weekStart = weekDays[0];[m
[32m+[m[32m  const weekEnd = weekDays.at(-1);[m
[32m+[m[32m  const currentWeekStart = agendaWeekDays(now)[0];[m
[32m+[m[32m  const readOnlyWeek = weekStart < currentWeekStart;[m
[32m+[m[32m  const canCreate = editable && !readOnlyWeek;[m
[32m+[m[32m  const defaultDate = agendaDefaultFormDate(weekDays, today);[m
[32m+[m[32m  const defaultStart = nextFullHour(now);[m
[32m+[m[32m  const defaultEnd = addMinutesToTime(defaultStart, 60);[m
[32m+[m[32m  const events = filteredAgendaEvents().filter((event) => {[m
[32m+[m[32m    const date = String(event.data_inicio || "").slice(0, 10);[m
[32m+[m[32m    return date >= localDateString(weekStart) && date <= localDateString(weekEnd);[m
[32m+[m[32m  });[m
[32m+[m[32m  content.innerHTML = `[m
     <section class="module-head">[m
       <div>[m
         <h2>Agenda</h2>[m
[31m-        <p>Compromissos por obra, cliente, responsável e tipo, com visão mensal, semanal e diária.</p>[m
[32m+[m[32m        <p>Semana de ${asDate(localDateString(weekStart))} a ${asDate(localDateString(weekEnd))}. Hoje: ${asDate(today)} - ${timeNowLabel(now)}</p>[m
       </div>[m
[31m-      ${editable ? '<button id="newAgendaEvent" class="primary" type="button">Novo evento</button>' : ""}[m
[31m-    </section>[m
[31m-    <section class="schedule-toolbar agenda-toolbar">[m
[31m-      <div class="segmented">[m
[31m-        ${["month", "week", "day"].map((mode) => `<button type="button" data-agenda-view="${mode}" class="${agendaViewMode === mode ? "active" : ""}">${agendaViewLabel(mode)}</button>`).join("")}[m
[32m+[m[32m      <div class="actions">[m
[32m+[m[32m        <button type="button" class="secondary" id="agendaPrev">Semana anterior</button>[m
[32m+[m[32m        <button type="button" class="secondary" id="agendaToday">Hoje</button>[m
[32m+[m[32m        <button type="button" class="primary" id="agendaNext">Próxima semana</button>[m
       </div>[m
[31m-      <button type="button" class="secondary" id="agendaPrev">Anterior</button>[m
[31m-      <strong>${agendaPeriodLabel(cursor)}</strong>[m
[31m-      <button type="button" class="secondary" id="agendaNext">Próximo</button>[m
[31m-      <label>Obra<select id="agendaProjectFilter"><option value="">Todas</option>${projectOptions}</select></label>[m
[31m-      <label>Tipo<select id="agendaTypeFilter"><option value="">Todos</option>${typeOptions}</select></label>[m
     </section>[m
[31m-    ${agendaCalendarHtml(cursor, events, editable)}[m
[31m-    ${table("Eventos da agenda", events.map(agendaTableRow), ["titulo", "tipo", "obra_id", "cliente_id", "usuario_id", "data_inicio", "data_fim", "status"], editable, "agendaEvents")}[m
[32m+[m[32m    ${readOnlyWeek ? '<div class="alert">Semana anterior disponível apenas para consulta.</div>' : ""}[m
[32m+[m[32m    ${agendaSummaryHtml(events)}[m
[32m+[m[32m    <section class="agenda-week-shell">[m
[32m+[m[32m      ${agendaFormHtml({ canCreate, defaultDate, defaultStart, defaultEnd })}[m
[32m+[m[32m      ${agendaWeekGridHtml(weekDays, events, { canCreate, editable, today })}[m
[32m+[m[32m    </section>[m
   `;[m
[31m-  qs("newAgendaEvent")?.addEventListener("click", () => openAgendaEventForm(localDateString(cursor)));[m
[31m-  qs("agendaProjectFilter").addEventListener("change", (event) => { agendaProjectFilter = event.target.value; renderAgenda(); });[m
[31m-  qs("agendaTypeFilter").addEventListener("change", (event) => { agendaTypeFilter = event.target.value; renderAgenda(); });[m
[31m-  qs("agendaPrev").addEventListener("click", () => moveAgendaCursor(-1));[m
[31m-  qs("agendaNext").addEventListener("click", () => moveAgendaCursor(1));[m
[31m-  qs("content").querySelectorAll("[data-agenda-view]").forEach((button) => button.addEventListener("click", () => { agendaViewMode = button.dataset.agendaView; renderAgenda(); }));[m
[31m-  qs("content").querySelectorAll("[data-agenda-date]").forEach((button) => button.addEventListener("click", () => openAgendaEventForm(button.dataset.agendaDate)));[m
[31m-  qs("content").querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openForm("agendaEvents", button.dataset.edit)));[m
[31m-  qs("content").querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeRecord("agendaEvents", button.dataset.delete)));[m
[32m+[m[32m  qs("agendaPrev")?.addEventListener("click", () => moveAgendaWeek(-1));[m
[32m+[m[32m  qs("agendaToday")?.addEventListener("click", () => { agendaCursorDate = today; renderAgenda(); });[m
[32m+[m[32m  qs("agendaNext")?.addEventListener("click", () => moveAgendaWeek(1));[m
[32m+[m[32m  qs("agendaQuickForm")?.addEventListener("submit", saveAgendaQuickEvent);[m
[32m+[m[32m  content.querySelectorAll("[data-agenda-pick-date]").forEach((button) => button.addEventListener("click", () => {[m
[32m+[m[32m    const date = button.dataset.agendaPickDate;[m
[32m+[m[32m    if (date < today) return;[m
[32m+[m[32m    const input = qs("agendaFormDate");[m
[32m+[m[32m    if (input) input.value = date;[m
[32m+[m[32m  }));[m
[32m+[m[32m  content.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openForm("agendaEvents", button.dataset.edit)));[m
[32m+[m[32m  content.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeRecord("agendaEvents", button.dataset.delete)));[m
 }[m
 [m
 function renderKanban() {[m
[36m@@ -3432,6 +3476,174 @@[m [mfunction renderKanban() {[m
   qs("content").querySelectorAll("[data-delete-card]").forEach((button) => button.addEventListener("click", () => removeRecord("kanbanCards", button.dataset.deleteCard)));[m
 }[m
 [m
[32m+[m[32mfunction agendaSummaryHtml(events) {[m
[32m+[m[32m  const today = localDateString(new Date());[m
[32m+[m[32m  const todayCount = events.filter((event) => String(event.data_inicio || "").slice(0, 10) === today).length;[m
[32m+[m[32m  const openCount = events.filter((event) => !["cancelado", "concluido", "concluído"].includes(normalizedText(event.status))).length;[m
[32m+[m[32m  const nextEvent = events.find((event) => String(event.data_inicio || "").slice(0, 10) >= today);[m
[32m+[m[32m  return `<section class="kpi-grid">[m
[32m+[m[32m    ${kpi("Compromissos", events.length, false)}[m
[32m+[m[32m    ${kpi("Hoje", todayCount, false)}[m
[32m+[m[32m    ${kpi("Em aberto", openCount, false)}[m
[32m+[m[32m    ${kpi("Próximo", nextEvent ? `${asDate(String(nextEvent.data_inicio).slice(0, 10))} ${agendaTimeLabel(nextEvent.data_inicio)}` : "Sem agenda", false)}[m
[32m+[m[32m  </section>`;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction agendaFormHtml({ canCreate, defaultDate, defaultStart, defaultEnd }) {[m
[32m+[m[32m  const disabled = canCreate ? "" : "disabled";[m
[32m+[m[32m  const userOptions = (db.users || []).filter((row) => row.status !== "Inativo").map((row) => `<option value="${row.id}">${svgText(row.fullName || row.username || row.name || row.id)}</option>`).join("");[m
[32m+[m[32m  const clientOptions = (db.clients || []).map((row) => `<option value="${row.id}">${svgText(row.name || row.document || row.id)}</option>`).join("");[m
[32m+[m[32m  const projectOptions = (db.projects || []).map((row) => `<option value="${row.id}">${svgText(row.name || row.id)}</option>`).join("");[m
[32m+[m[32m  const typeOptions = [[m
[32m+[m[32m    ["reuniao", "Reunião"],[m
[32m+[m[32m    ["vistoria", "Vistoria"],[m
[32m+[m[32m    ["projeto", "Projeto"],[m
[32m+[m[32m    ["obra", "Obra"],[m
[32m+[m[32m    ["financeiro", "Financeiro"],[m
[32m+[m[32m    ["comercial", "Comercial"],[m
[32m+[m[32m    ["prazo", "Prazo"],[m
[32m+[m[32m    ["outro", "Outro"],[m
[32m+[m[32m  ].map(([value, label]) => `<option value="${value}">${label}</option>`).join("");[m
[32m+[m[32m  const statusOptions = [[m
[32m+[m[32m    ["agendado", "Agendado"],[m
[32m+[m[32m    ["em_andamento", "Em andamento"],[m
[32m+[m[32m    ["concluido", "Concluído"],[m
[32m+[m[32m    ["cancelado", "Cancelado"],[m
[32m+[m[32m  ].map(([value, label]) => `<option value="${value}">${label}</option>`).join("");[m
[32m+[m[32m  return `<form id="agendaQuickForm" class="agenda-form-card">[m
[32m+[m[32m    <header>[m
[32m+[m[32m      <div>[m
[32m+[m[32m        <h3>Novo compromisso</h3>[m
[32m+[m[32m        <p>${canCreate ? "Cadastre compromissos na semana atual ou em semanas futuras." : "Semana anterior disponível apenas para consulta."}</p>[m
[32m+[m[32m      </div>[m
[32m+[m[32m    </header>[m
[32m+[m[32m    <div class="agenda-form-grid">[m
[32m+[m[32m      <label>Data<input id="agendaFormDate" name="date" type="date" value="${defaultDate}" min="${localDateString(new Date())}" ${disabled} required></label>[m
[32m+[m[32m      <label>Horário inicial<input name="startTime" type="time" value="${defaultStart}" ${disabled} required></label>[m
[32m+[m[32m      <label>Horário final<input name="endTime" type="time" value="${defaultEnd}" ${disabled} required></label>[m
[32m+[m[32m      <label class="full">Título do compromisso<input name="title" type="text" placeholder="Reunião de acompanhamento" ${disabled} required></label>[m
[32m+[m[32m      <label>Tipo<select name="type" ${disabled}>${typeOptions}</select></label>[m
[32m+[m[32m      <label>Status<select name="status" ${disabled}>${statusOptions}</select></label>[m
[32m+[m[32m      <label>Responsável<select name="responsible" ${disabled}><option value="">Sem responsável</option>${userOptions}</select></label>[m
[32m+[m[32m      <label>Cliente<select name="clientId" ${disabled}><option value="">Sem cliente</option>${clientOptions}</select></label>[m
[32m+[m[32m      <label>Obra/Projeto<select name="projectId" ${disabled}><option value="">Sem obra</option>${projectOptions}</select></label>[m
[32m+[m[32m      <label class="full">Observações<textarea name="notes" rows="3" ${disabled} placeholder="Detalhes do compromisso"></textarea></label>[m
[32m+[m[32m    </div>[m
[32m+[m[32m    <button class="primary" type="submit" ${disabled}>Salvar compromisso</button>[m
[32m+[m[32m  </form>`;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction agendaWeekGridHtml(days, events, { canCreate, editable, today }) {[m
[32m+[m[32m  return `<section class="agenda-week-board" aria-label="Agenda semanal">[m
[32m+[m[32m    ${days.map((date) => {[m
[32m+[m[32m      const key = localDateString(date);[m
[32m+[m[32m      const dayEvents = events.filter((event) => String(event.data_inicio || "").slice(0, 10) === key);[m
[32m+[m[32m      const isToday = key === today;[m
[32m+[m[32m      const pastDay = key < today;[m
[32m+[m[32m      const canEditDay = editable && canCreate && !pastDay;[m
[32m+[m[32m      return `<article class="agenda-week-day ${isToday ? "today" : ""} ${pastDay ? "past" : ""}">[m
[32m+[m[32m        <button type="button" class="agenda-day-head" data-agenda-pick-date="${key}" ${canEditDay ? "" : "disabled"}>[m
[32m+[m[32m          <span>${agendaWeekdayLabel(date)}</span>[m
[32m+[m[32m          <strong>${date.getDate()}</strong>[m
[32m+[m[32m        </button>[m
[32m+[m[32m        <div class="agenda-day-events">[m
[32m+[m[32m          ${dayEvents.length ? dayEvents.map((event) => agendaWeekEventHtml(event, canEditDay)).join("") : '<p class="agenda-empty-day">Sem compromissos.</p>'}[m
[32m+[m[32m        </div>[m
[32m+[m[32m      </article>`;[m
[32m+[m[32m    }).join("")}[m
[32m+[m[32m  </section>`;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction agendaWeekEventHtml(event, canEdit) {[m
[32m+[m[32m  const project = nameOf("projects", event.obra_id);[m
[32m+[m[32m  const client = nameOf("clients", event.cliente_id);[m
[32m+[m[32m  const responsible = nameOf("users", event.usuario_id);[m
[32m+[m[32m  const meta = [responsible, client, project].filter(Boolean).join(" · ") || "Sem vínculo";[m
[32m+[m[32m  const status = event.status || "agendado";[m
[32m+[m[32m  return `<article class="agenda-appointment status-${normalizedText(status)}">[m
[32m+[m[32m    <div class="agenda-appointment-time">${agendaTimeLabel(event.data_inicio)}${event.data_fim ? ` - ${agendaTimeLabel(event.data_fim)}` : ""}</div>[m
[32m+[m[32m    <strong>${svgText(event.titulo || "Compromisso")}</strong>[m
[32m+[m[32m    <span>${svgText(meta)}</span>[m
[32m+[m[32m    <div class="agenda-appointment-foot">[m
[32m+[m[32m      <em>${agendaTypeLabel(event.tipo)}</em>[m
[32m+[m[32m      <small>${agendaStatusLabel(status)}</small>[m
[32m+[m[32m    </div>[m
[32m+[m[32m    ${canEdit ? `<div class="agenda-appointment-actions"><button type="button" data-edit="${event.id}">Editar</button><button type="button" data-delete="${event.id}">Excluir</button></div>` : ""}[m
[32m+[m[32m  </article>`;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32masync function saveAgendaQuickEvent(event) {[m
[32m+[m[32m  event.preventDefault();[m
[32m+[m[32m  if (!canEditModule("agenda")) return;[m
[32m+[m[32m  const form = event.target;[m
[32m+[m[32m  const data = Object.fromEntries(new FormData(form).entries());[m
[32m+[m[32m  const today = localDateString(new Date());[m
[32m+[m[32m  if (!data.title?.trim()) return alert("Informe o título do compromisso.");[m
[32m+[m[32m  if (!data.date || data.date < today) return alert("Não é permitido cadastrar compromisso em data anterior à data atual.");[m
[32m+[m[32m  if (!data.startTime || !data.endTime || data.endTime <= data.startTime) return alert("O horário final deve ser maior que o horário inicial.");[m
[32m+[m[32m  try {[m
[32m+[m[32m    await createIntegratedRecord("agendaEvents", {[m
[32m+[m[32m      obra_id: data.projectId || "",[m
[32m+[m[32m      cliente_id: data.clientId || "",[m
[32m+[m[32m      usuario_id: data.responsible || "",[m
[32m+[m[32m      titulo: data.title.trim(),[m
[32m+[m[32m      descricao: data.notes || "",[m
[32m+[m[32m      tipo: data.type || "outro",[m
[32m+[m[32m      data_inicio: `${data.date} ${data.startTime}`,[m
[32m+[m[32m      data_fim: `${data.date} ${data.endTime}`,[m
[32m+[m[32m      dia_todo: "0",[m
[32m+[m[32m      lembrete_minutos: 60,[m
[32m+[m[32m      status: data.status || "agendado",[m
[32m+[m[32m    });[m
[32m+[m[32m    agendaCursorDate = data.date;[m
[32m+[m[32m    renderAgenda();[m
[32m+[m[32m  } catch (error) {[m
[32m+[m[32m    alert(`Não foi possível salvar o compromisso: ${error.message}`);[m
[32m+[m[32m  }[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction agendaWeekDays(cursor) {[m
[32m+[m[32m  const start = startOfLocalDay(cursor);[m
[32m+[m[32m  start.setDate(start.getDate() - start.getDay());[m
[32m+[m[32m  return Array.from({ length: 7 }, (_, index) => addDays(start, index));[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction agendaDefaultFormDate(days, today) {[m
[32m+[m[32m  const weekStart = localDateString(days[0]);[m
[32m+[m[32m  const weekEnd = localDateString(days.at(-1));[m
[32m+[m[32m  if (today >= weekStart && today <= weekEnd) return today;[m
[32m+[m[32m  return weekStart > today ? weekStart : today;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction moveAgendaWeek(direction) {[m
[32m+[m[32m  const date = parseLocalDate(agendaCursorDate) || new Date();[m
[32m+[m[32m  date.setDate(date.getDate() + direction * 7);[m
[32m+[m[32m  agendaCursorDate = localDateString(date);[m
[32m+[m[32m  renderAgenda();[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction agendaWeekdayLabel(date) {[m
[32m+[m[32m  return ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][date.getDay()];[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction timeNowLabel(date) {[m
[32m+[m[32m  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction nextFullHour(date) {[m
[32m+[m[32m  const next = new Date(date);[m
[32m+[m[32m  next.setHours(next.getHours() + 1, 0, 0, 0);[m
[32m+[m[32m  return timeNowLabel(next);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction addMinutesToTime(time, minutes) {[m
[32m+[m[32m  const [hours, mins] = String(time || "09:00").split(":").map(Number);[m
[32m+[m[32m  const date = new Date();[m
[32m+[m[32m  date.setHours(hours || 0, mins || 0, 0, 0);[m
[32m+[m[32m  date.setMinutes(date.getMinutes() + minutes);[m
[32m+[m[32m  return timeNowLabel(date);[m
[32m+[m[32m}[m
[32m+[m
 function agendaCalendarHtml(cursor, events, editable) {[m
   const days = agendaVisibleDays(cursor);[m
   return `<section class="agenda-grid agenda-${agendaViewMode}">[m
[36m@@ -3447,6 +3659,54 @@[m [mfunction agendaCalendarHtml(cursor, events, editable) {[m
   </section>`;[m
 }[m
 [m
[32m+[m[32mfunction agendaListHtml(events, editable) {[m
[32m+[m[32m  if (!events.length) return '<section class="panel"><h3>Compromissos por data</h3><div class="empty">Nenhum compromisso cadastrado</div></section>';[m
[32m+[m[32m  const grouped = events.reduce((groups, event) => {[m
[32m+[m[32m    const key = String(event.data_inicio || "").slice(0, 10) || "sem-data";[m
[32m+[m[32m    if (!groups[key]) groups[key] = [];[m
[32m+[m[32m    groups[key].push(event);[m
[32m+[m[32m    return groups;[m
[32m+[m[32m  }, {});[m
[32m+[m[32m  return `<section class="panel agenda-list">[m
[32m+[m[32m    <h3>Compromissos por data</h3>[m
[32m+[m[32m    ${Object.entries(grouped).map(([date, dayEvents]) => `[m
[32m+[m[32m      <div class="agenda-list-day">[m
[32m+[m[32m        <h4>${date === "sem-data" ? "Sem data" : asDate(date)}</h4>[m
[32m+[m[32m        <div class="table-wrap">[m
[32m+[m[32m          <table>[m
[32m+[m[32m            <thead><tr><th>Horário</th><th>Compromisso</th><th>Tipo</th><th>Obra/Cliente</th><th>Responsável</th><th>Status</th>${editable ? "<th>Ações</th>" : ""}</tr></thead>[m
[32m+[m[32m            <tbody>[m
[32m+[m[32m              ${dayEvents.map((event) => agendaListRowHtml(event, editable)).join("")}[m
[32m+[m[32m            </tbody>[m
[32m+[m[32m          </table>[m
[32m+[m[32m        </div>[m
[32m+[m[32m      </div>[m
[32m+[m[32m    `).join("")}[m
[32m+[m[32m  </section>`;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction agendaListRowHtml(event, editable) {[m
[32m+[m[32m  const start = agendaTimeLabel(event.data_inicio);[m
[32m+[m[32m  const end = agendaTimeLabel(event.data_fim);[m
[32m+[m[32m  const project = nameOf("projects", event.obra_id);[m
[32m+[m[32m  const client = nameOf("clients", event.cliente_id);[m
[32m+[m[32m  const links = [project, client].filter(Boolean).join(" / ") || "Sem vínculo";[m
[32m+[m[32m  return `<tr>[m
[32m+[m[32m    <td>${start}${end ? ` - ${end}` : ""}</td>[m
[32m+[m[32m    <td><strong>${svgText(event.titulo || "")}</strong>${event.descricao ? `<br><small>${svgText(event.descricao)}</small>` : ""}</td>[m
[32m+[m[32m    <td>${agendaTypeLabel(event.tipo)}</td>[m
[32m+[m[32m    <td>${svgText(links)}</td>[m
[32m+[m[32m    <td>${event.usuario_id ? nameOf("users", event.usuario_id) : "Sem responsável"}</td>[m
[32m+[m[32m    <td>${svgText(event.status || "")}</td>[m
[32m+[m[32m    ${editable ? `<td><button type="button" data-edit="${event.id}">Editar</button><button type="button" data-delete="${event.id}">Excluir</button></td>` : ""}[m
[32m+[m[32m  </tr>`;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction agendaTimeLabel(value) {[m
[32m+[m[32m  const time = String(value || "").replace(" ", "T").split("T")[1] || "";[m
[32m+[m[32m  return time.slice(0, 5);[m
[32m+[m[32m}[m
[32m+[m
 function agendaVisibleDays(cursor) {[m
   const base = startOfLocalDay(cursor);[m
   if (agendaViewMode === "day") return [base];[m
[36m@@ -3583,7 +3843,31 @@[m [mfunction kanbanCardDone(card) {[m
 }[m
 [m
 function agendaTypeLabel(type) {[m
[31m-  return ({ reuniao: "Reunião", visita: "Visita", entrega: "Entrega", cobranca: "Cobrança", outro: "Outro" })[type] || type || "";[m
[32m+[m[32m  return ({[m
[32m+[m[32m    reuniao: "Reunião",[m
[32m+[m[32m    vistoria: "Vistoria",[m
[32m+[m[32m    visita: "Vistoria",[m
[32m+[m[32m    projeto: "Projeto",[m
[32m+[m[32m    obra: "Obra",[m
[32m+[m[32m    financeiro: "Financeiro",[m
[32m+[m[32m    comercial: "Comercial",[m
[32m+[m[32m    prazo: "Prazo",[m
[32m+[m[32m    entrega: "Prazo",[m
[32m+[m[32m    cobranca: "Financeiro",[m
[32m+[m[32m    outro: "Outro",[m
[32m+[m[32m  })[type] || type || "";[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction agendaStatusLabel(status) {[m
[32m+[m[32m  return ({[m
[32m+[m[32m    agendado: "Agendado",[m
[32m+[m[32m    em_andamento: "Em andamento",[m
[32m+[m[32m    "em andamento": "Em andamento",[m
[32m+[m[32m    realizado: "Concluído",[m
[32m+[m[32m    concluido: "Concluído",[m
[32m+[m[32m    "concluído": "Concluído",[m
[32m+[m[32m    cancelado: "Cancelado",[m
[32m+[m[32m  })[normalizedText(status)] || status || "Agendado";[m
 }[m
 [m
 function priorityLabel(priority) {[m
[36m@@ -5395,8 +5679,9 @@[m [mfunction directAccessUser() {[m
 }[m
 [m
 function showLogin(message = "") {[m
[32m+[m[32m  resetNavGroups();[m
   if (AUTH_BYPASS_FOR_TESTS) {[m
[31m-    showApp(directAccessUser());[m
[32m+[m[32m    showApp(directAccessUser(), { resetNav: true });[m
     return;[m
   }[m
   currentUser = null;[m
[36m@@ -5408,7 +5693,8 @@[m [mfunction showLogin(message = "") {[m
   qs("loginUser").focus();[m
 }[m
 [m
[31m-function showApp(user) {[m
[32m+[m[32mfunction showApp(user, options = {}) {[m
[32m+[m[32m  if (options.resetNav) resetNavGroups();[m
   currentUser = user;[m
   writeAuthSession(user);[m
   qs("loginScreen").classList.add("hidden");[m
[36m@@ -5426,11 +5712,11 @@[m [masync function handleLogin(event) {[m
         method: "POST",[m
         body: JSON.stringify({ username, password }),[m
       });[m
[31m-      return showApp(payload.user);[m
[32m+[m[32m      return showApp(payload.user, { resetNav: true });[m
     }[m
     const user = db.users.find((item) => item.username?.toLowerCase() === username && item.password === password && item.status === "Ativo");[m
     if (!user) return showLogin(`${serverStatus}. Configure a API ou use dados locais antigos apenas para migração.`);[m
[31m-    showApp(user);[m
[32m+[m[32m    showApp(user, { resetNav: true });[m
   } catch (error) {[m
     showLogin(error.message || "Usuário ou senha inválidos.");[m
   }[m
[36m@@ -5439,7 +5725,7 @@[m [masync function handleLogin(event) {[m
 function restoreSession() {[m
   setupNav();[m
   if (AUTH_BYPASS_FOR_TESTS) {[m
[31m-    showApp(directAccessUser());[m
[32m+[m[32m    showApp(directAccessUser(), { resetNav: true });[m
     return;[m
   }[m
   const session = readAuthSession();[m
