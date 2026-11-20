const seedSubscriptions = [
  { id: 1, name: "Netflix", price: 17000, due: 20, category: "영상", icon: "N", logo: "netflix-logo", detail: "프리미엄 · 친구 1명과 공유", friend: "민지", friendShare: 8500, startedAt: "2022-03-15" },
  { id: 2, name: "YouTube Premium", price: 14900, due: 24, category: "영상", icon: "▶", logo: "youtube-logo", detail: "개인 멤버십", friend: "", friendShare: 0, startedAt: "2023-07-01" },
  { id: 3, name: "쿠팡 와우", price: 7890, due: 27, category: "쇼핑", icon: "C", logo: "coupang-logo", detail: "와우 멤버십", friend: "", friendShare: 0, startedAt: "2024-01-10" },
  { id: 4, name: "ChatGPT Plus", price: 29000, due: 26, category: "AI 도구", icon: "✳", logo: "chatgpt-logo", detail: "Plus 플랜", friend: "", friendShare: 0, startedAt: "2025-02-05" },
  { id: 5, name: "Spotify Premium", price: 10900, due: 29, category: "음악", icon: "●", logo: "spotify-logo", detail: "듀오 · 친구 1명과 공유", friend: "준호", friendShare: 5450, splitCount: 2, startedAt: "2021-09-22" },
];

const serviceColors = ["#3182f6", "#62a0fb", "#8ab8fc", "#afcffd", "#d0e2fe", "#e5efff"];
let subscriptions = JSON.parse(localStorage.getItem("moaSubscriptions") || "null") || seedSubscriptions;
subscriptions = subscriptions.map((item) => ({
  ...item,
  plan: item.plan || item.detail?.split(" · ")[0] || "개인 멤버십",
  cycle: item.cycle || "monthly",
  paymentMethod: item.paymentMethod || "신용카드",
  dueMonth: item.dueMonth ?? new Date().getMonth() + 1,
  splitCount: Number(item.splitCount) > 0 && Number(item.splitCount) <= 10 ? Number(item.splitCount) : item.friend ? 2 : 1,
  startedAt: item.startedAt || (Number(item.id) <= 5 ? seedSubscriptions.find((seed) => seed.id === Number(item.id))?.startedAt : new Date().toISOString().slice(0, 10)),
  ...(item.cancelAt && !item.cancelAfter ? { cancelAfter: dateKey(nextPaymentDate(item)) } : {}),
}));
let reminderEnabled = localStorage.getItem("moaReminder") === "true";
let toastTimer;
let oneSignalReady;
let pushConfig;
let userId = localStorage.getItem("moaUserId") || "jiwoo@example.com";
let accountName = localStorage.getItem("moaAccountName") || "김지우";
let darkMode = localStorage.getItem("moaDarkMode") === "true";
let subscriptionSort = localStorage.getItem("moaSubscriptionSort") || "due";
let selectedSubscriptionId = null;
let previousPage = "subscriptions";
let settingsPreviousPage = "home";
let chartRange = "6m";
let expiryTimer;
let pendingConfirmAction = null;
const money = (amount) => `₩${Number(amount).toLocaleString("ko-KR")}`;
const categoryFallback = { 영상: "▶", 음악: "♫", 쇼핑: "C", "AI 도구": "✳", 기타: "✦" };
const monthlyCost = (item, value = item.price) => Math.round(Number(value || 0) * (item.cycle === "yearly" ? 1 / 12 : 1));
const serviceManagementLinks = [
  { match: /netflix/i, label: "Netflix 계정 관리", url: "https://www.netflix.com/cancelplan" },
  { match: /youtube|유튜브/i, label: "YouTube Premium 멤버십 관리", url: "https://www.youtube.com/paid_memberships" },
  { match: /쿠팡|coupang/i, label: "쿠팡 와우 멤버십 관리", url: "https://www.coupang.com/np/coupangwow" },
  { match: /chatgpt|openai/i, label: "ChatGPT 구독 관리", url: "https://chatgpt.com/#settings/Subscription" },
  { match: /spotify|스포티파이/i, label: "Spotify 구독 관리", url: "https://www.spotify.com/account/subscription/" },
];

function managementLinkFor(item) {
  return serviceManagementLinks.find((entry) => entry.match.test(item.name)) || null;
}

function splitCountFor(item) {
  const count = Math.floor(Number(item.splitCount) || (item.friend ? 2 : 1));
  return count > 10 ? (item.friend ? 2 : 1) : Math.max(1, count);
}

function friendContribution(item) {
  if (!item.friend) return 0;
  const peopleSharing = splitCountFor(item);
  if (peopleSharing < 2) return 0;
  return Math.round(Number(item.price || 0) * (peopleSharing - 1) / peopleSharing);
}

function hasReachedCancellationPayment(item, date = new Date()) {
  return Boolean(item.cancelAt && item.cancelAfter && dateKey(date) > item.cancelAfter);
}

function activeMonthlyCost(item, value = item.price, date = new Date()) {
  return hasReachedCancellationPayment(item, date) ? 0 : monthlyCost(item, value);
}

function replaceWithDaySelect(inputId) {
  const input = document.getElementById(inputId);
  if (!input || input.tagName === "SELECT") return input;
  const select = document.createElement("select");
  select.id = input.id;
  select.required = input.required;
  select.setAttribute("aria-label", input.getAttribute("aria-label") || input.labels?.[0]?.textContent || "결제 일");
  select.innerHTML = Array.from({ length: 31 }, (_, index) => `<option value="${index + 1}">${index + 1}일</option>`).join("");
  input.replaceWith(select);
  return select;
}

function ensureSplitCountField({ id, container, label, note }) {
  let field = document.getElementById(id);
  if (field) return field;
  const wrapper = document.createElement("div");
  wrapper.className = id === "detailSplitCount" ? "detail-field split-count-field" : "split-count-field";
  wrapper.innerHTML = `<label for="${id}">${label}</label><div class="split-count-control"><button type="button" data-split-step="-1" aria-label="정산 인원 줄이기">−</button><input id="${id}" type="number" min="2" max="10" step="1" value="2" inputmode="numeric" /><button type="button" data-split-step="1" aria-label="정산 인원 늘리기">＋</button></div><small id="${id}Note">${note}</small>`;
  container.append(wrapper);
  wrapper.querySelectorAll("[data-split-step]").forEach((button) => button.addEventListener("click", () => {
    const count = wrapper.querySelector("input");
    count.value = Math.min(10, Math.max(2, Number(count.value || 2) + Number(button.dataset.splitStep)));
    count.dispatchEvent(new Event("input", { bubbles: true }));
  }));
  return wrapper.querySelector("input");
}

function updateShareAmount(priceId, countId, shareId, friendId, unitLabel = "회차") {
  const friend = document.getElementById(friendId).value.trim();
  const countInput = document.getElementById(countId);
  const count = friend ? Math.min(10, Math.max(2, Math.floor(Number(countInput.value) || 2))) : 1;
  if (friend) countInput.value = count;
  document.getElementById(shareId).value = friend
    ? Math.round(Number(document.getElementById(priceId).value || 0) * (count - 1) / count)
    : "";
  const note = document.getElementById(`${countId}Note`);
  if (note) note.textContent = friend
    ? `${count - 1}명 분담 합계 · ${count}명 균등 정산 (${unitLabel})`
    : "친구 이름을 입력하면 나눌 금액이 계산돼요.";
}

function saveSubscriptions() {
  localStorage.setItem("moaSubscriptions", JSON.stringify(subscriptions));
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function removeExpiredCancellations() {
  const today = dateKey();
  const expired = subscriptions.filter((item) => item.cancelAt && item.cancelAt < today);
  if (!expired.length) return [];
  subscriptions = subscriptions.filter((item) => !item.cancelAt || item.cancelAt >= today);
  saveSubscriptions();
  return expired;
}

function scheduleCancellationExpiryCheck() {
  clearTimeout(expiryTimer);
  const now = new Date();
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
  expiryTimer = setTimeout(() => {
    const expired = removeExpiredCancellations();
    if (expired.length) {
      showToast(`${expired.map((item) => item.name).join(", ")} 구독이 해지 예정일이 지나 목록에서 정리됐어요.`);
      if (reminderEnabled) void syncReminders();
    }
    if (expired.length || subscriptions.some((item) => item.cancelAt && item.cancelAfter)) renderSubscriptions();
    else scheduleCancellationExpiryCheck();
  }, Math.max(1000, nextDay.getTime() - now.getTime()));
}

function updateAccountLabels() {
  const initial = accountName.trim().slice(0, 1) || "지";
  document.getElementById("headerInitial").textContent = initial;
  document.getElementById("menuInitial").textContent = initial;
  document.getElementById("menuAccountName").textContent = accountName;
  document.querySelector(".welcome-row h1").innerHTML = `좋은 아침이에요, ${escapeHtml(accountName)}님 <span class="wave">✳</span>`;
  document.getElementById("accountNameInput").value = accountName;
}

function applyTheme() {
  document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  document.getElementById("darkModeToggle").checked = darkMode;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function confirmAction({ title, message, confirmText = "확인", danger = false, action }) {
  pendingConfirmAction = action;
  document.getElementById("actionConfirmTitle").textContent = title;
  document.getElementById("actionConfirmDescription").textContent = message;
  document.getElementById("actionProceed").textContent = confirmText;
  document.getElementById("actionProceed").classList.toggle("danger-confirm-button", danger);
  document.getElementById("actionConfirm").classList.remove("hidden");
  document.getElementById("actionCancel").focus();
}

function closeActionConfirm() {
  document.getElementById("actionConfirm").classList.add("hidden");
  pendingConfirmAction = null;
}

function renderSubscriptions() {
  const expired = removeExpiredCancellations();
  if (expired.length) showToast(`${expired.map((item) => item.name).join(", ")} 구독이 해지 예정일이 지나 목록에서 정리됐어요.`);
  const total = subscriptions.reduce((sum, item) => sum + activeMonthlyCost(item), 0);
  const reimbursements = subscriptions.reduce((sum, item) => sum + activeMonthlyCost(item, friendContribution(item)), 0);
  const friends = [...new Set(subscriptions.filter((item) => item.friend).map((item) => item.friend))];
  document.getElementById("totalAmount").textContent = money(total);
  document.getElementById("chartTotal").textContent = money(total);
  document.getElementById("reportTotal").textContent = money(total);
  document.getElementById("settlementAmount").textContent = money(reimbursements);
  document.getElementById("subscriptionCount").textContent = subscriptions.length;
  document.getElementById("listCount").textContent = String(subscriptions.length).padStart(2, "0");
  document.getElementById("listCountFull").textContent = String(subscriptions.length).padStart(2, "0");
  document.getElementById("donutCount").textContent = String(subscriptions.length).padStart(2, "0");
  document.getElementById("donutCaption").textContent = `${subscriptions.length}개 서비스`;
  document.getElementById("friendCount").textContent = `${friends.length}명`;
  document.getElementById("reportCount").textContent = `${subscriptions.length}개`;
  document.getElementById("reportDonutCount").textContent = String(subscriptions.length).padStart(2, "0");

  const sortedSubscriptions = [...subscriptions].sort((first, second) => {
    if (subscriptionSort === "price") return monthlyCost(second) - monthlyCost(first);
    return nextPaymentDate(first) - nextPaymentDate(second);
  });
  document.getElementById("filterButton").innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10m-7 6h4"/></svg> ${subscriptionSort === "price" ? "금액순" : "결제일순"}`;
  document.getElementById("subscriptionSort").value = subscriptionSort;
  const rowMarkup = (item, editable = false) => `
    <div class="subscription-entry ${editable ? "editable-entry" : ""}">
      <button class="subscription-row subscription-card ${item.cancelAt ? "cancellation-pending" : ""}" type="button" data-open-subscription="${item.id}" aria-label="${escapeHtml(item.name)} 상세 보기">
        <span class="service-identity"><span class="service-logo ${item.logo || "generic-logo"}">${escapeHtml(item.icon || categoryFallback[item.category] || "✦")}</span><span class="service-name"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.plan || item.category)}${item.friend ? ` · ${escapeHtml(item.friend)}님과 공유` : ""}${item.cancelAt ? ` · 해지 예정 ${escapeHtml(item.cancelAt)}` : ""}</small></span></span>
        <span class="service-due">${item.cycle === "yearly" ? `매년 ${item.dueMonth}월 ${item.due}일` : `매월 ${item.due}일`}</span><span class="service-price">${money(item.price)}<small>/${item.cycle === "yearly" ? "년" : "월"}</small></span><span class="card-chevron" aria-hidden="true">›</span>
      </button>${editable ? `<button class="subscription-edit-button" type="button" data-edit-subscription="${item.id}">수정</button>` : ""}
    </div>`;
  document.getElementById("subscriptionList").innerHTML = sortedSubscriptions.map((item) => rowMarkup(item, true)).join("") || `<div class="empty-state">아직 등록한 구독이 없어요. 첫 구독을 추가해 보세요.</div>`;
  document.getElementById("homeSubscriptionList").innerHTML = sortedSubscriptions.map((item) => rowMarkup(item)).join("") || `<div class="empty-state">아직 구독이 없어요. 하나 추가해 볼까요?</div>`;

  document.querySelectorAll("[data-open-subscription]").forEach((button) => button.addEventListener("click", () => openSubscriptionDetail(button.dataset.openSubscription, false)));
  document.querySelectorAll("[data-edit-subscription]").forEach((button) => button.addEventListener("click", () => openSubscriptionDetail(button.dataset.editSubscription, true)));

  const categories = ["영상", "AI 도구", "음악", "쇼핑", "기타"]
    .map((name) => ({ name, total: subscriptions.filter((item) => item.category === name).reduce((sum, item) => sum + activeMonthlyCost(item), 0) }))
    .filter((category) => category.total > 0);
  const grandTotal = Math.max(total, 1);
  let offset = 0;
  const stops = categories.map((category, index) => {
    const start = offset;
    offset += (category.total / grandTotal) * 100;
    return `${serviceColors[index % serviceColors.length]} ${start}% ${offset}%`;
  });
  document.getElementById("donutChart").style.background = stops.length ? `conic-gradient(${stops.join(",")})` : "conic-gradient(#e7eae3 0 100%)";
  document.getElementById("categoryLegend").innerHTML = categories.map((category, index) => `
    <span class="legend-item"><i style="background:${serviceColors[index % serviceColors.length]}"></i>${category.name}<b>${money(category.total)}</b></span>`).join("") || `<span class="empty-legend">구독을 추가하면 지출 구성이 보여요.</span>`;
  document.getElementById("reportDonut").style.background = stops.length ? `conic-gradient(${stops.join(",")})` : "conic-gradient(#e7eae3 0 100%)";
  document.getElementById("reportLegend").innerHTML = document.getElementById("categoryLegend").innerHTML;
  populateChartPeriods();
  renderChart();
  renderReportChart(total);
  renderSettlement(reimbursements);
  renderUpcoming();
  scheduleCancellationExpiryCheck();
}

function monthSpending(year, monthIndex) {
  const end = new Date(year, monthIndex + 1, 0);
  return subscriptions.reduce((sum, item) => {
    const startedAt = new Date(`${item.startedAt || new Date().toISOString().slice(0, 10)}T00:00:00`);
    if (startedAt > end) return sum;
    if (item.cancelAfter) {
      const [cancelYear, cancelMonth] = item.cancelAfter.split("-").map(Number);
      if (year > cancelYear || (year === cancelYear && monthIndex > cancelMonth - 1)) return sum;
    }
    if (item.cycle === "yearly") {
      return monthIndex === Number(item.dueMonth || 1) - 1 && new Date(year, monthIndex, Math.min(Number(item.due), end.getDate())) >= startedAt
        ? sum + Number(item.price)
        : sum;
    }
    return sum + Number(item.price);
  }, 0);
}

function populateChartPeriods() {
  const now = new Date();
  const earliestYear = Math.min(...subscriptions.map((item) => Number(String(item.startedAt || now.getFullYear()).slice(0, 4))), now.getFullYear());
  const years = Array.from({ length: now.getFullYear() - earliestYear + 1 }, (_, index) => earliestYear + index).reverse().map((year) => ({ value: `year:${year}`, label: `${year}년` }));
  const options = [{ value: "6m", label: "최근 6개월" }, { value: "12m", label: "최근 1년" }, ...years];
  if (!options.some((option) => option.value === chartRange)) chartRange = "6m";
  document.getElementById("chartPeriodMenu").innerHTML = options.map((option) => `<button type="button" class="chart-period-option ${option.value === chartRange ? "selected" : ""}" role="option" aria-selected="${option.value === chartRange}" data-chart-range="${option.value}">${option.label}${option.value === chartRange ? `<span>✓</span>` : ""}</button>`).join("");
  document.getElementById("chartPeriodLabel").textContent = options.find((option) => option.value === chartRange)?.label || "최근 6개월";
  document.querySelectorAll("[data-chart-range]").forEach((button) => button.addEventListener("click", () => {
    chartRange = button.dataset.chartRange;
    document.getElementById("chartPeriodMenu").classList.add("hidden");
    document.getElementById("periodButton").setAttribute("aria-expanded", "false");
    populateChartPeriods();
    renderChart();
  }));
}

function renderChart() {
  const now = new Date();
  const yearly = chartRange.startsWith("year:");
  const year = yearly ? Number(chartRange.slice(5)) : now.getFullYear();
  const count = chartRange === "6m" ? 6 : 12;
  const firstMonth = yearly ? 0 : now.getMonth() - count + 1;
  const months = Array.from({ length: count }, (_, index) => {
    const date = new Date(year, firstMonth + index, 1);
    return { year: date.getFullYear(), month: date.getMonth(), label: `${date.getMonth() + 1}월`, amount: monthSpending(date.getFullYear(), date.getMonth()) };
  });
  const sum = months.reduce((total, month) => total + month.amount, 0);
  document.getElementById("chartTotal").textContent = money(sum);
  document.getElementById("chartSummaryLabel").textContent = yearly ? `${year}년 합계` : "기간 합계";
  document.getElementById("chartPeriodCaption").textContent = yearly ? "1월 - 12월" : chartRange === "12m" ? "최근 1년" : "최근 6개월";
  const rawMax = Math.max(...months.map((month) => month.amount), 0);
  const axisMax = Math.max(25000, Math.ceil(rawMax / 25000) * 25000);
  document.getElementById("chartYLabels").innerHTML = Array.from({ length: 5 }, (_, index) => `<span>₩${Math.round(axisMax * (4 - index) / 4 / 1000)}k</span>`).join("");
  const chart = document.getElementById("barChart");
  chart.innerHTML = months.map((item) => {
    const current = item.year === now.getFullYear() && item.month === now.getMonth();
    const height = rawMax ? Math.max(item.amount ? 4 : 0, (item.amount / axisMax) * 100) : 0;
    return `<div class="chart-column ${current ? "current" : ""}"><span class="bar-value">${Math.round(item.amount / 1000)}k</span><i class="chart-bar" style="height:${height}%"></i><span class="bar-label">${item.label}</span></div>`;
  }).join("");
}

function renderReportChart(total) {
  const labels = Array.from({ length: 6 }, (_, index) => new Intl.DateTimeFormat("ko-KR", { month: "short" }).format(new Date(new Date().getFullYear(), new Date().getMonth() - 5 + index, 1)));
  const ratios = [0.72, 0.84, 0.79, 0.91, 0.93, 1];
  document.getElementById("reportBars").innerHTML = labels.map((label, index) => `<div class="report-bar-column"><span class="report-bar-amount">${Math.round(total * ratios[index] / 1000)}천</span><i class="report-bar ${index === 5 ? "current" : ""}" style="height:${Math.max(4, ratios[index] * 100)}%"></i><span>${label}</span></div>`).join("");
}

function renderSettlement(total) {
  const shared = subscriptions.filter((item) => item.friend && friendContribution(item) > 0 && activeMonthlyCost(item, friendContribution(item)) > 0);
  const rows = shared.length ? shared.map((item, index) => `
    <div class="friend-row"><span class="friend-avatar ${index % 2 ? "friend-two" : "friend-one"}">${escapeHtml(item.friend.slice(0, 1))}</span><span class="friend-copy"><strong>${escapeHtml(item.friend)}</strong><small>${escapeHtml(item.name)} · ${splitCountFor(item)}명 정산</small></span><span class="friend-amount">+${money(friendContribution(item))}</span></div>`).join("") : `<div class="empty-settlement">친구와 나누는 구독을 추가해 보세요.</div>`;
  const summary = document.querySelector(".full-settlement-panel .settlement-summary");
  summary.querySelector("strong").textContent = money(total);
  document.getElementById("settlementFriends").innerHTML = rows;
}

function renderUpcoming() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = subscriptions.map((item) => {
    const dateForMonth = (year, month) => new Date(year, month, Math.min(Number(item.due), new Date(year, month + 1, 0).getDate()));
    let date;
    if (item.cycle === "yearly") {
      date = dateForMonth(today.getFullYear(), Number(item.dueMonth || today.getMonth() + 1) - 1);
      if (date < today) date = dateForMonth(today.getFullYear() + 1, Number(item.dueMonth || today.getMonth() + 1) - 1);
    } else {
      date = dateForMonth(today.getFullYear(), today.getMonth());
      if (date < today) date = dateForMonth(today.getFullYear(), today.getMonth() + 1);
    }
    return { ...item, nextDate: date, days: Math.round((date - today) / 86400000) };
  }).sort((a, b) => a.nextDate - b.nextDate);
  const first = upcoming[0];
  document.getElementById("upcomingDay").textContent = first ? first.nextDate.getDate() : "–";
  document.getElementById("upcomingDateLabel").textContent = first ? new Intl.DateTimeFormat("ko-KR", { month: "long", weekday: "long" }).format(first.nextDate) : "예정된 구독 없음";
  document.getElementById("upcomingCountdown").textContent = first ? (first.days === 0 ? "오늘 결제 예정" : `${first.days}일 후 첫 결제 예정`) : "구독을 추가해 보세요";
  document.getElementById("upcomingTotal").textContent = first ? money(first.price) : money(0);
  document.getElementById("upcomingList").innerHTML = upcoming.slice(0, 2).map((item, index) => `
    <div class="upcoming-service"><span class="service-logo ${item.logo || "generic-logo"}">${escapeHtml(item.icon || "✦")}</span><span class="service-name"><strong>${escapeHtml(item.name)}</strong><small>${item.cycle === "yearly" ? `매년 ${item.dueMonth}월 ${item.due}일 결제` : `매월 ${item.due}일 결제`}</small></span><span class="reminder-tag ${index ? "muted-tag" : ""}">D-${item.days}</span></div>`).join("");
}

function openSubscriptionDetail(id, editable = false) {
  const item = subscriptions.find((subscription) => String(subscription.id) === String(id));
  if (!item) return;
  selectedSubscriptionId = item.id;
  const activePage = document.querySelector(".view-page.active")?.dataset.page || "subscriptions";
  if (activePage !== "detail") previousPage = activePage;
  const today = new Date();
  const month = item.cycle === "yearly" ? Number(item.dueMonth || today.getMonth() + 1) : today.getMonth() + 1;
  const day = Number(item.due);
  document.getElementById("detailName").value = item.name;
  document.getElementById("detailPlan").value = item.plan || "";
  document.getElementById("detailPrice").value = Number(item.price);
  document.getElementById("detailCycle").value = item.cycle || "monthly";
  document.getElementById("detailDue").value = day;
  document.getElementById("detailDueMonth").value = month;
  document.getElementById("detailDueMonthWrap").classList.toggle("hidden", item.cycle !== "yearly");
  document.getElementById("detailPaymentMethod").value = item.paymentMethod || "신용카드";
  document.getElementById("detailCategory").value = item.category || "기타";
  document.getElementById("detailFriend").value = item.friend || "";
  document.getElementById("detailFriendShare").value = friendContribution(item) || "";
  document.getElementById("detailSplitCount").value = splitCountFor(item);
  document.getElementById("detailServiceHeading").textContent = item.name;
  document.getElementById("detailServiceIcon").textContent = item.icon || categoryFallback[item.category] || "✦";
  document.getElementById("detailServiceIcon").className = `service-logo ${item.logo || "generic-logo"}`;
  ensureEditCancellationButton();
  updateCancellationControls(item);
  document.getElementById("detailTitle").textContent = editable ? "구독 수정" : "구독 상세";
  document.getElementById("detailIntro").textContent = editable ? "정보를 수정하고 저장하면 모든 요약에 반영돼요." : "이용 기간과 결제 정보를 확인해요.";
  document.getElementById("detailForm").classList.toggle("hidden", !editable);
  document.getElementById("detailReadonly").classList.toggle("hidden", editable);
  document.getElementById("detailDeleteZone").classList.toggle("hidden", !editable);
  if (!editable) renderReadonlyDetails(item);
  updateCycleNote();
  document.querySelectorAll(".view-page").forEach((page) => page.classList.toggle("active", page.dataset.page === "detail"));
  document.querySelector(".bottom-tabs").classList.add("detail-tabs-hidden");
  const backButton = document.getElementById("topbarBack");
  backButton.classList.remove("hidden");
  backButton.querySelector("span").textContent = "이전 화면";
  backButton.setAttribute("aria-label", "이전 화면으로 돌아가기");
  document.getElementById("currentPageTitle").textContent = "구독 상세";
  document.getElementById("mainContent").scrollTo({ top: 0 });
  window.scrollTo(0, 0);
}

function nextPaymentDate(item, today = new Date()) {
  const dateForMonth = (year, month) => new Date(year, month, Math.min(Number(item.due), new Date(year, month + 1, 0).getDate()));
  if (item.cycle === "yearly") {
    const month = Number(item.dueMonth || today.getMonth() + 1) - 1;
    let date = dateForMonth(today.getFullYear(), month);
    if (date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) date = dateForMonth(today.getFullYear() + 1, month);
    return date;
  }
  let date = dateForMonth(today.getFullYear(), today.getMonth());
  if (date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) date = dateForMonth(today.getFullYear(), today.getMonth() + 1);
  return date;
}

function renderReadonlyDetails(item) {
  const startedAt = new Date(`${item.startedAt || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.max(1, Math.floor((today - startedAt) / 86400000) + 1);
  const date = nextPaymentDate(item, today);
  document.getElementById("readonlyServiceName").textContent = item.name;
  document.getElementById("readonlyPlan").textContent = item.plan || "개인 멤버십";
  document.getElementById("readonlyServiceIcon").textContent = item.icon || categoryFallback[item.category] || "✦";
  document.getElementById("readonlyServiceIcon").className = `service-logo ${item.logo || "generic-logo"}`;
  const managementAction = ensureServiceManageAction();
  const management = managementLinkFor(item);
  managementAction.classList.toggle("hidden", !management);
  if (management) {
    managementAction.href = management.url;
    managementAction.setAttribute("aria-label", `해지하러 가기 · ${management.label}, 새 창에서 열기`);
    managementAction.title = management.label;
  } else {
    managementAction.removeAttribute("href");
    managementAction.removeAttribute("aria-label");
    managementAction.removeAttribute("title");
  }
  document.getElementById("readonlyDuration").textContent = `${days.toLocaleString("ko-KR")}일째`;
  document.getElementById("readonlyNextPayment").textContent = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(date);
  const facts = [
    ["결제 금액", `${money(item.price)} / ${item.cycle === "yearly" ? "년" : "월"}`],
    ["결제 주기", item.cycle === "yearly" ? "매년" : "매월"],
    ["결제일", item.cycle === "yearly" ? `매년 ${item.dueMonth}월 ${item.due}일` : `매월 ${item.due}일`],
    ["결제수단", item.paymentMethod || "신용카드"],
    ["카테고리", item.category || "기타"],
    ["공유 친구", item.friend || "없음"],
    ...(item.friend ? [[`친구 ${splitCountFor(item) - 1}명 분담 합계`, `${money(friendContribution(item))} / ${item.cycle === "yearly" ? "년" : "월"}`]] : []),
    ["구독 시작일", new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(startedAt)],
    ["구독 상태", item.cancelAt ? `해지 예정 · ${item.cancelAt}` : "구독 중"],
    ...(item.cancelAt && item.cancelAfter ? [["총액 반영", `${item.cancelAfter} 다음 날부터 제외`]] : []),
  ];
  document.getElementById("readonlyFacts").innerHTML = facts.map(([label, value]) => `<div class="readonly-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

function ensureServiceManageAction() {
  let action = document.getElementById("serviceManageAction");
  if (action) return action;
  action = document.createElement("a");
  action.id = "serviceManageAction";
  action.className = "service-manage-action hidden";
  action.target = "_blank";
  action.rel = "noopener noreferrer";
  action.innerHTML = `해지하러 가기 <span aria-hidden="true">↗</span>`;
  document.getElementById("readonlyCancelAction").insertAdjacentElement("afterend", action);
  return action;
}

function updateCancellationControls(item) {
  const readonlyBox = document.getElementById("readonlyCancellation");
  const readonlyAction = document.getElementById("readonlyCancelAction");
  readonlyBox.classList.toggle("pending", Boolean(item.cancelAt));
  const paymentDate = item.cancelAfter ? new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(`${item.cancelAfter}T00:00:00`)) : "다음 결제일";
  readonlyBox.innerHTML = item.cancelAt
    ? `<strong>해지 예정 구독</strong><span>${escapeHtml(item.cancelAt)}까지 목록에 남아요. 다음 결제일(${paymentDate})이 지난 뒤 월 총액에서 제외되고, 해지 예정일 다음 날 자동으로 정리돼요.</span>`
    : `<strong>구독을 해지할 예정인가요?</strong><span>날짜를 지정하면 그날까지 이용 내역을 확인하고, 이후 목록에서 자동 정리돼요.</span>`;
  readonlyAction.textContent = item.cancelAt ? "해지 예정 취소" : "해지 예정 설정";
  readonlyAction.classList.toggle("cancel-pending-action", Boolean(item.cancelAt));
  readonlyAction.onclick = () => item.cancelAt ? cancelScheduledCancellation(item) : scheduleSubscriptionCancellation(item);
  const editAction = document.getElementById("editCancellationButton");
  if (editAction) {
    editAction.textContent = item.cancelAt ? "해지일 변경" : "해지 예정 설정";
    editAction.onclick = () => scheduleSubscriptionCancellation(item);
  }
}

function ensureEditCancellationButton() {
  if (document.getElementById("editCancellationButton")) return;
  const button = document.createElement("button");
  button.id = "editCancellationButton";
  button.type = "button";
  button.className = "secondary-action-button cancellation-edit-button";
  document.getElementById("detailDeleteZone").insertBefore(button, document.getElementById("deleteOpenButton"));
}

function scheduleSubscriptionCancellation(item) {
  const suggestedDate = item.cancelAt || dateKey(nextPaymentDate(item));
  const [year, month, day] = suggestedDate.split("-").map(Number);
  document.getElementById("cancelYear").value = year;
  document.getElementById("cancelMonth").value = month;
  document.getElementById("cancelDay").value = day;
  document.getElementById("cancelDateTitle").textContent = item.cancelAt ? "해지 예정일을 바꿔요" : "해지 예정일을 정해요";
  document.getElementById("cancelDateDescription").textContent = `${item.name} 구독은 선택한 날까지 목록에 표시되고, 다음 날 자동으로 정리돼요.`;
  document.getElementById("cancelDateDialog").classList.remove("hidden");
}

function confirmScheduledCancellation(item, cancelAt) {
  const paymentExclusionDate = item.cancelAfter || dateKey(nextPaymentDate(item));
  confirmAction({
    title: item.cancelAt ? "해지 예정일을 변경할까요?" : "해지 예정으로 지정할까요?",
    message: `${item.name} 구독은 ${cancelAt}까지 목록에 남아요. 다음 결제일(${paymentExclusionDate})이 지난 뒤 월 총액에서 제외되고, 해지 예정일 다음 날 목록에서 자동 정리돼요.`,
    confirmText: item.cancelAt ? "날짜 변경" : "해지 예정 지정",
    action: () => {
      if (!item.cancelAt || !item.cancelAfter) item.cancelAfter = dateKey(nextPaymentDate(item));
      item.cancelAt = cancelAt;
      saveSubscriptions();
      renderSubscriptions();
      updateCancellationControls(item);
      if (!document.getElementById("detailReadonly").classList.contains("hidden")) renderReadonlyDetails(item);
      if (reminderEnabled) void syncReminders();
      showToast(`${item.name} 구독을 ${cancelAt} 해지 예정으로 지정했어요.`);
    },
  });
}

function cancelScheduledCancellation(item) {
  confirmAction({
    title: "해지 예정을 취소할까요?",
    message: `${item.name} 구독을 계속 이용 중으로 바꿔요.`,
    confirmText: "해지 예정 취소",
    action: () => {
      delete item.cancelAt;
      delete item.cancelAfter;
      saveSubscriptions();
      renderSubscriptions();
      updateCancellationControls(item);
      renderReadonlyDetails(item);
      if (reminderEnabled) void syncReminders();
      showToast(`${item.name} 구독을 계속 이용하도록 변경했어요.`);
    },
  });
}

function updateCycleNote() {
  const cycle = document.getElementById("detailCycle").value;
  const price = Number(document.getElementById("detailPrice").value || 0);
  const monthly = cycle === "yearly" ? Math.round(price / 12) : price;
  document.getElementById("detailDueMonthWrap").classList.toggle("hidden", cycle !== "yearly");
  document.getElementById("detailCycleNote").textContent = cycle === "yearly"
    ? `${money(price)} 연 결제 · 월평균 ${money(monthly)}으로 요약돼요.`
    : `${money(price)} 월 결제 금액이 지출 요약에 반영돼요.`;
}

function closeDetail() {
  document.getElementById("deleteConfirm").classList.add("hidden");
  document.querySelector(".bottom-tabs").classList.remove("detail-tabs-hidden");
  openPage(previousPage === "detail" ? "subscriptions" : previousPage);
  selectedSubscriptionId = null;
}

function openPage(page) {
  const target = document.querySelector(`[data-page="${page}"]`);
  if (!target) return;
  document.querySelectorAll(".view-page").forEach((view) => view.classList.toggle("active", view === target));
  document.querySelectorAll(".tab-button").forEach((button) => {
    const selected = button.dataset.tab === page;
    button.classList.toggle("active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const labels = { home: "홈", subscriptions: "구독 목록", reports: "리포트", settlements: "정산", settings: "설정" };
  document.getElementById("currentPageTitle").textContent = labels[page] || "홈";
  const backButton = document.getElementById("topbarBack");
  const isSecondaryPage = page !== "home" && page !== "detail";
  backButton.classList.toggle("hidden", page === "home");
  const backLabel = page === "settings" ? "이전 화면" : isSecondaryPage ? "홈으로" : "이전 화면";
  backButton.querySelector("span").textContent = backLabel;
  backButton.setAttribute("aria-label", page === "settings" ? "이전 화면으로 돌아가기" : isSecondaryPage ? "홈 화면으로 돌아가기" : "이전 화면으로 돌아가기");
  document.getElementById("mainContent").scrollTo({ top: 0, behavior: "smooth" });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSettingsPanel(panel) {
  document.querySelectorAll("[data-settings-tab]").forEach((button) => button.classList.toggle("active", button.dataset.settingsTab === panel));
  document.querySelectorAll("[data-settings-panel]").forEach((section) => section.classList.toggle("hidden", section.dataset.settingsPanel !== panel));
}

function setSubscriptionSort(value) {
  subscriptionSort = value === "price" ? "price" : "due";
  localStorage.setItem("moaSubscriptionSort", subscriptionSort);
  document.getElementById("subscriptionSort").value = subscriptionSort;
  renderSubscriptions();
  showToast(`기본 정렬을 ${subscriptionSort === "price" ? "금액순" : "결제일순"}으로 바꿨어요.`);
}

function finishLogout() {
  localStorage.removeItem("moaUserId");
  localStorage.removeItem("moaReminder");
  reminderEnabled = false;
  updateNotificationState();
  document.getElementById("reminderToggle").classList.remove("on");
  document.getElementById("appShell").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  openPage("home");
  showToast("로그아웃했어요. 구독과 화면 설정은 이 기기에 유지돼요.");
}

function requestLogout() {
  confirmAction({
    title: "로그아웃할까요?",
    message: "로그아웃해도 이 브라우저에 저장된 구독과 설정은 유지돼요.",
    confirmText: "로그아웃",
    action: finishLogout,
  });
}

function deleteDemoAccount() {
  confirmAction({
    title: "정말 회원 탈퇴할까요?",
    message: "이 기기에 저장된 구독, 계정 이름, 알림과 화면 설정을 모두 삭제해요. 이 작업은 되돌릴 수 없어요.",
    confirmText: "탈퇴하고 데이터 삭제",
    danger: true,
    action: () => {
      const deletedUserId = userId;
      void fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deletedUserId, enabled: false, items: [] }),
      });
      ["moaUserId", "moaAccountName", "moaReminder", "moaSubscriptions", "moaDarkMode", "moaSubscriptionSort"].forEach((key) => localStorage.removeItem(key));
      subscriptions = [];
      accountName = "김지우";
      userId = "jiwoo@example.com";
      reminderEnabled = false;
      darkMode = false;
      subscriptionSort = "due";
      saveSubscriptions();
      updateNotificationState();
      applyTheme();
      updateAccountLabels();
      document.getElementById("profileEmail").textContent = userId;
      renderSubscriptions();
      document.getElementById("appShell").classList.add("hidden");
      document.getElementById("loginScreen").classList.remove("hidden");
      openPage("home");
      showToast("데모 계정과 저장된 데이터를 삭제했어요.");
    },
  });
}

function updateNotificationState() {
  const button = document.getElementById("notificationButton");
  button.classList.toggle("enabled", reminderEnabled);
  button.classList.toggle("disabled", !reminderEnabled);
  button.setAttribute("aria-label", reminderEnabled ? "알림 켜짐" : "알림 해제됨");
  button.title = reminderEnabled ? "알림 켜짐 · 눌러서 끄기" : "알림 꺼짐 · 눌러서 켜기";
}

function closeProfileMenu() {
  document.getElementById("profileMenu").classList.add("hidden");
  document.getElementById("headerProfileButton").setAttribute("aria-expanded", "false");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function openApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  window.scrollTo(0, 0);
  if (reminderEnabled) void syncReminders();
}

document.getElementById("demoButton").addEventListener("click", openApp);
document.getElementById("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  userId = document.getElementById("email").value.trim().toLowerCase();
  localStorage.setItem("moaUserId", userId);
  document.getElementById("profileEmail").textContent = userId;
  openApp();
  showToast("모아에 오신 걸 환영해요, 지우님!");
});
document.getElementById("signupButton").addEventListener("click", () => showToast("데모에서는 회원가입 대신 데모로 시작해 주세요."));
document.getElementById("forgotButton").addEventListener("click", () => showToast("데모 계정은 비밀번호 찾기 없이 바로 이용할 수 있어요."));

document.querySelectorAll("[data-open-modal]").forEach((button) => button.addEventListener("click", () => {
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("serviceName").focus();
}));
document.getElementById("modalClose").addEventListener("click", () => document.getElementById("modalBackdrop").classList.add("hidden"));
document.getElementById("modalBackdrop").addEventListener("click", (event) => {
  if (event.target.id === "modalBackdrop") event.currentTarget.classList.add("hidden");
});
document.getElementById("isShared").addEventListener("change", (event) => {
  document.getElementById("sharedFields").classList.toggle("hidden", !event.target.checked);
  document.getElementById("friendName").required = event.target.checked;
  document.getElementById("friendShare").required = false;
  updateShareAmount("servicePrice", "newSplitCount", "friendShare", "friendName", document.getElementById("serviceCycle").value === "yearly" ? "연간" : "매월");
});
function updateNewSubscriptionCycle() {
  const yearly = document.getElementById("serviceCycle").value === "yearly";
  const dateInput = document.getElementById("serviceDue");
  const monthlyFields = document.getElementById("serviceMonthlyDueFields");
  const annualFields = document.getElementById("yearlyDueFields");
  dateInput.classList.add("hidden");
  dateInput.required = false;
  monthlyFields.classList.toggle("hidden", yearly);
  document.getElementById("serviceDueDayMonthly").required = !yearly;
  annualFields.classList.toggle("hidden", !yearly);
  document.getElementById("serviceDueDay").required = yearly;
  document.getElementById("serviceDueLabel").htmlFor = yearly ? "serviceDueDay" : "serviceDueDayMonthly";
  document.getElementById("serviceDueLabel").htmlFor = yearly ? "serviceDueDay" : "serviceDueDayMonthly";
  document.getElementById("servicePriceLabel").textContent = yearly ? "1년 결제 금액" : "월 결제 금액";
  document.getElementById("serviceDueLabel").textContent = yearly ? "연간 결제 일정" : "다음 결제일";
  document.getElementById("servicePrice").placeholder = yearly ? "예: 119,000" : "예: 13,500";
  document.querySelectorAll("[data-new-cycle]").forEach((button) => {
    const selected = button.dataset.newCycle === (yearly ? "yearly" : "monthly");
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  updateAnnualMonthButtons();
}

function updateAnnualMonthButtons() {
  document.querySelectorAll("[data-annual-month]").forEach((button) => {
    const selected = Number(button.dataset.annualMonth) === Number(document.getElementById("serviceDueMonth").value);
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function initializeDateSelectors() {
  const addDateInput = document.getElementById("serviceDue");
  addDateInput.required = false;
  addDateInput.classList.add("hidden");
  const monthlyFields = document.createElement("div");
  monthlyFields.id = "serviceMonthlyDueFields";
  monthlyFields.className = "monthly-due-fields";
  monthlyFields.innerHTML = `<label class="yearly-field-label" for="serviceDueDayMonthly">매월 결제 일</label><select id="serviceDueDayMonthly" required>${Array.from({ length: 31 }, (_, index) => `<option value="${index + 1}">${index + 1}일</option>`).join("")}</select>`;
  addDateInput.before(monthlyFields);
  const detailDay = replaceWithDaySelect("detailDue");
  detailDay.setAttribute("aria-label", "매월 또는 매년 결제 일");
  const annualDay = replaceWithDaySelect("serviceDueDay");
  annualDay.setAttribute("aria-label", "매년 결제 일");
}

function initializeSplitControls() {
  const addFriendShare = document.getElementById("friendShare");
  addFriendShare.readOnly = true;
  addFriendShare.closest(".shared-fields").querySelector('label[for="friendShare"]').textContent = "친구 분담 총액";
  document.getElementById("friendName").placeholder = "예: 민지, 준호 (여러 명은 쉼표로)";
  ensureSplitCountField({
    id: "newSplitCount",
    container: document.getElementById("sharedFields"),
    label: "실제 정산 인원 (나 포함)",
    note: "요금제 정원과 별도로 실제 비용을 나눌 인원을 입력해요.",
  });
  const detailShare = document.getElementById("detailFriendShare");
  detailShare.readOnly = true;
  detailShare.closest(".detail-field").querySelector("label").innerHTML = "친구 분담 총액 <small>(결제 주기 기준)</small>";
  document.getElementById("detailFriend").placeholder = "예: 민지, 준호 (여러 명은 쉼표로)";
  ensureSplitCountField({
    id: "detailSplitCount",
    container: document.querySelector(".detail-fields-grid"),
    label: "실제 정산 인원 (나 포함)",
    note: "요금제 정원과 실제로 비용을 나눌 인원은 다를 수 있어요.",
  });
}

initializeDateSelectors();
initializeSplitControls();
for (const id of ["servicePrice", "newSplitCount", "friendName"]) {
  document.getElementById(id).addEventListener("input", () => updateShareAmount("servicePrice", "newSplitCount", "friendShare", "friendName", document.getElementById("serviceCycle").value === "yearly" ? "연간" : "매월"));
}

document.querySelectorAll("[data-new-cycle]").forEach((button) => button.addEventListener("click", () => {
  document.getElementById("serviceCycle").value = button.dataset.newCycle;
  updateNewSubscriptionCycle();
}));
document.querySelectorAll("[data-annual-month]").forEach((button) => button.addEventListener("click", () => {
  document.getElementById("serviceDueMonth").value = button.dataset.annualMonth;
  updateAnnualMonthButtons();
}));
document.getElementById("subscriptionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const cycle = document.getElementById("serviceCycle").value;
  const annualMonth = Number(document.getElementById("serviceDueMonth").value);
  const selectedDay = Number(cycle === "yearly" ? document.getElementById("serviceDueDay").value : document.getElementById("serviceDueDayMonthly").value);
  const month = cycle === "yearly" ? annualMonth : new Date().getMonth() + 1;
  const date = new Date(new Date().getFullYear(), month - 1, selectedDay, 12);
  const due = Math.min(selectedDay, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate());
  const shared = document.getElementById("isShared").checked;
  const name = document.getElementById("serviceName").value.trim();
  const category = document.getElementById("serviceCategory").value;
  const friend = shared ? document.getElementById("friendName").value.trim() : "";
  const splitCount = friend ? Math.min(10, Math.max(2, Number(document.getElementById("newSplitCount").value) || 2)) : 1;
  subscriptions.unshift({
    id: Date.now(), name, price: Number(document.getElementById("servicePrice").value),
    due, dueMonth: month, category, icon: categoryFallback[category] || "✦", logo: "generic-logo",
    plan: "개인 멤버십", cycle, paymentMethod: "신용카드", startedAt: new Date().toISOString().slice(0, 10),
    detail: friend ? `친구 ${friend}님과 공유` : `${category} 구독`,
    friend,
    splitCount,
    friendShare: friend ? Math.round(Number(document.getElementById("servicePrice").value) * (splitCount - 1) / splitCount) : 0,
  });
  saveSubscriptions();
  renderSubscriptions();
  if (reminderEnabled) void syncReminders();
  event.currentTarget.reset();
  document.getElementById("sharedFields").classList.add("hidden");
  updateNewSubscriptionCycle();
  document.getElementById("friendName").required = false;
  document.getElementById("friendShare").required = false;
  document.getElementById("newSplitCount").value = 2;
  document.getElementById("serviceDueMonth").value = String(new Date().getMonth() + 1);
  document.getElementById("serviceDueDay").value = "1";
  document.getElementById("serviceDueDayMonthly").value = String(Math.min(31, new Date().getDate() + 7));
  document.getElementById("newSplitCount").value = 2;
  updateShareAmount("servicePrice", "newSplitCount", "friendShare", "friendName");
  updateAnnualMonthButtons();
  document.getElementById("modalBackdrop").classList.add("hidden");
  showToast(`${name} 구독을 추가했어요.`);
});

document.getElementById("detailCycle").addEventListener("change", () => {
  updateCycleNote();
  updateShareAmount("detailPrice", "detailSplitCount", "detailFriendShare", "detailFriend", document.getElementById("detailCycle").value === "yearly" ? "연간" : "매월");
});
document.getElementById("detailPrice").addEventListener("input", updateCycleNote);
document.getElementById("detailPrice").addEventListener("input", () => updateShareAmount("detailPrice", "detailSplitCount", "detailFriendShare", "detailFriend", document.getElementById("detailCycle").value === "yearly" ? "연간" : "매월"));
document.getElementById("detailFriend").addEventListener("input", () => updateShareAmount("detailPrice", "detailSplitCount", "detailFriendShare", "detailFriend", document.getElementById("detailCycle").value === "yearly" ? "연간" : "매월"));
document.getElementById("detailSplitCount").addEventListener("input", () => updateShareAmount("detailPrice", "detailSplitCount", "detailFriendShare", "detailFriend", document.getElementById("detailCycle").value === "yearly" ? "연간" : "매월"));
document.getElementById("detailForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const item = subscriptions.find((subscription) => subscription.id === selectedSubscriptionId);
  if (!item) return;
  const day = Number(document.getElementById("detailDue").value);
  const month = Number(document.getElementById("detailDueMonth").value);
  const friend = document.getElementById("detailFriend").value.trim();
  const splitCount = friend ? Math.min(10, Math.max(2, Number(document.getElementById("detailSplitCount").value) || 2)) : 1;
  const plan = document.getElementById("detailPlan").value.trim() || "개인 멤버십";
  Object.assign(item, {
    name: document.getElementById("detailName").value.trim(),
    plan,
    price: Number(document.getElementById("detailPrice").value),
    cycle: document.getElementById("detailCycle").value,
    due: document.getElementById("detailCycle").value === "yearly" ? Math.min(day, new Date(new Date().getFullYear(), month, 0).getDate()) : day,
    dueMonth: month,
    paymentMethod: document.getElementById("detailPaymentMethod").value,
    category: document.getElementById("detailCategory").value,
    friend,
    splitCount,
    friendShare: friend ? Math.round(Number(document.getElementById("detailPrice").value) * (splitCount - 1) / splitCount) : 0,
    detail: friend ? `${plan} · 친구와 공유` : plan,
  });
  if (item.cancelAt) item.cancelAfter = dateKey(nextPaymentDate(item));
  saveSubscriptions();
  renderSubscriptions();
  if (reminderEnabled) void syncReminders();
  const updatedName = item.name;
  closeDetail();
  showToast(`${updatedName} 정보를 저장했어요.`);
});

document.getElementById("detailBack").addEventListener("click", closeDetail);
document.getElementById("topbarBack").addEventListener("click", () => {
  if (document.querySelector('.view-page[data-page="detail"].active')) {
    closeDetail();
    return;
  }
  if (document.querySelector('.view-page[data-page="settings"].active')) {
    openPage(settingsPreviousPage);
    return;
  }
  openPage("home");
});
document.getElementById("deleteOpenButton").addEventListener("click", () => {
  document.getElementById("deleteConfirm").classList.remove("hidden");
  document.getElementById("deleteCancel").focus();
});
document.getElementById("deleteCancel").addEventListener("click", () => document.getElementById("deleteConfirm").classList.add("hidden"));
document.getElementById("deleteConfirm").addEventListener("click", (event) => {
  if (event.target.id === "deleteConfirm") event.currentTarget.classList.add("hidden");
});
document.getElementById("deleteConfirmButton").addEventListener("click", () => {
  const item = subscriptions.find((subscription) => subscription.id === selectedSubscriptionId);
  if (!item) return;
  subscriptions = subscriptions.filter((subscription) => subscription.id !== selectedSubscriptionId);
  saveSubscriptions();
  renderSubscriptions();
  if (reminderEnabled) void syncReminders();
  const removedName = item.name;
  closeDetail();
  showToast(`${removedName} 구독을 삭제했어요.`);
});

document.getElementById("actionCancel").addEventListener("click", closeActionConfirm);
document.getElementById("actionConfirm").addEventListener("click", (event) => {
  if (event.target.id === "actionConfirm") closeActionConfirm();
});
document.getElementById("actionProceed").addEventListener("click", () => {
  const action = pendingConfirmAction;
  closeActionConfirm();
  action?.();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeActionConfirm();
    document.getElementById("deleteConfirm").classList.add("hidden");
    document.getElementById("modalBackdrop").classList.add("hidden");
  }
});

document.querySelectorAll("[data-settings-tab]").forEach((button) => button.addEventListener("click", () => openSettingsPanel(button.dataset.settingsTab)));
document.getElementById("darkModeToggle").addEventListener("change", (event) => {
  const requested = event.target.checked;
  event.target.checked = darkMode;
  confirmAction({
    title: requested ? "다크 모드를 켤까요?" : "다크 모드를 끌까요?",
    message: "화면 테마를 바꾸면 이 브라우저에 설정이 저장돼요.",
    confirmText: "화면 모드 변경",
    action: () => {
      darkMode = requested;
      localStorage.setItem("moaDarkMode", String(darkMode));
      applyTheme();
    },
  });
});
document.getElementById("subscriptionSort").addEventListener("change", (event) => {
  const requested = event.target.value;
  event.target.value = subscriptionSort;
  confirmAction({
    title: "기본 정렬을 바꿀까요?",
    message: `구독 목록과 홈 목록을 ${requested === "price" ? "금액순" : "결제일순"}으로 보여드려요.`,
    confirmText: "정렬 변경",
    action: () => setSubscriptionSort(requested),
  });
});
document.getElementById("accountNameForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const requestedName = document.getElementById("accountNameInput").value.trim();
  if (!requestedName || requestedName === accountName) {
    showToast("새 이름을 입력해 주세요.");
    return;
  }
  confirmAction({
    title: "이름을 변경할까요?",
    message: `계정 이름을 ‘${requestedName}’(으)로 바꿔요.`,
    confirmText: "이름 변경",
    action: () => {
      accountName = requestedName;
      localStorage.setItem("moaAccountName", accountName);
      updateAccountLabels();
      showToast("계정 이름을 변경했어요.");
    },
  });
});
document.getElementById("passwordForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  if (newPassword !== confirmPassword) {
    showToast("새 비밀번호가 서로 달라요. 다시 확인해 주세요.");
    document.getElementById("confirmPassword").focus();
    return;
  }
  confirmAction({
    title: "비밀번호를 변경할까요?",
    message: "데모에서는 비밀번호가 로그인 인증에 저장되지는 않아요.",
    confirmText: "변경 확인",
    action: () => {
      event.currentTarget.reset();
      showToast("데모 비밀번호 변경 흐름을 확인했어요.");
    },
  });
});
document.getElementById("settingsLogout").addEventListener("click", requestLogout);
document.getElementById("deleteAccountButton").addEventListener("click", deleteDemoAccount);
document.getElementById("cancelDateClose").addEventListener("click", () => document.getElementById("cancelDateDialog").classList.add("hidden"));
document.getElementById("cancelDateDismiss").addEventListener("click", () => document.getElementById("cancelDateDialog").classList.add("hidden"));
document.getElementById("cancelDateDialog").addEventListener("click", (event) => {
  if (event.target.id === "cancelDateDialog") event.currentTarget.classList.add("hidden");
});
document.getElementById("cancelDateForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const item = subscriptions.find((subscription) => subscription.id === selectedSubscriptionId);
  const year = Number(document.getElementById("cancelYear").value);
  const month = Number(document.getElementById("cancelMonth").value);
  const day = Number(document.getElementById("cancelDay").value);
  const parsedDate = new Date(year, month - 1, day);
  const cancelAt = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!item || parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day || cancelAt < dateKey()) {
    showToast("오늘 이후의 해지 예정일을 선택해 주세요.");
    return;
  }
  document.getElementById("cancelDateDialog").classList.add("hidden");
  confirmScheduledCancellation(item, cancelAt);
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const expired = removeExpiredCancellations();
  if (expired.length) {
    renderSubscriptions();
    showToast(`${expired.map((item) => item.name).join(", ")} 구독이 해지 예정일이 지나 목록에서 정리됐어요.`);
  }
});

document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => openPage(button.dataset.tab)));
document.querySelectorAll("[data-open-page]").forEach((button) => button.addEventListener("click", () => openPage(button.dataset.openPage)));

document.getElementById("reminderToggle").classList.toggle("on", reminderEnabled);
updateNotificationState();
async function configureOneSignal() {
  if (oneSignalReady) return oneSignalReady;
  oneSignalReady = (async () => {
    try {
      const response = await fetch("/api/config");
      pushConfig = await response.json();
      if (!pushConfig.configured) return null;
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      const instancePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("OneSignal SDK did not load")), 12000);
        window.OneSignalDeferred.push(async (OneSignal) => {
          try {
            await OneSignal.init({ appId: pushConfig.appId, serviceWorkerPath: "/OneSignalSDKWorker.js", serviceWorkerParam: { scope: "/" } });
            await OneSignal.login(userId);
            clearTimeout(timeout);
            resolve(OneSignal);
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
      const sdk = document.createElement("script");
      sdk.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      sdk.defer = true;
      document.head.append(sdk);
      return await instancePromise;
    } catch (error) {
      oneSignalReady = null;
      return null;
    }
  })();
  return oneSignalReady;
}

async function syncReminders() {
  try {
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, enabled: reminderEnabled, items: subscriptions }),
    });
  } catch {
    showToast("서버에 연결되지 않아 알림 설정을 저장하지 못했어요.");
  }
}

async function enableReminders() {
  reminderEnabled = true;
  localStorage.setItem("moaReminder", "true");
  document.getElementById("reminderToggle").classList.add("on");
  updateNotificationState();
  await syncReminders();
  showToast("데모 알림을 켰어요. 결제 전 알림을 받는 흐름을 확인해 보세요.");
  return true;
}

document.getElementById("reminderSettings").addEventListener("click", async () => {
  if (reminderEnabled) {
    reminderEnabled = false;
    localStorage.setItem("moaReminder", "false");
    document.getElementById("reminderToggle").classList.remove("on");
    updateNotificationState();
    await syncReminders();
    showToast("결제 전 알림을 껐어요. 이후 알림은 발송되지 않아요.");
    return;
  }
  await enableReminders();
});
document.getElementById("notificationButton").addEventListener("click", async () => {
  if (reminderEnabled) {
    document.getElementById("reminderSettings").click();
    return;
  }
  await enableReminders();
});
async function shareSettlement() {
  const text = "모아 정산 내역: 이번 달 친구에게 받을 금액 " + document.getElementById("settlementAmount").textContent;
  try {
    await navigator.clipboard.writeText(text);
    showToast("정산 내용이 복사됐어요. 친구에게 공유해 보세요.");
  } catch {
    showToast(text);
  }
}
document.getElementById("settleButton").addEventListener("click", shareSettlement);
document.getElementById("settleButtonTop").addEventListener("click", shareSettlement);
document.getElementById("filterButton").addEventListener("click", () => {
  const nextSort = subscriptionSort === "due" ? "price" : "due";
  confirmAction({
    title: "구독 목록 정렬을 바꿀까요?",
    message: `앞으로 목록을 ${nextSort === "price" ? "금액순" : "결제일순"}으로 보여드려요.`,
    confirmText: "정렬 변경",
    action: () => setSubscriptionSort(nextSort),
  });
});
document.getElementById("periodButton").addEventListener("click", () => {
  const menu = document.getElementById("chartPeriodMenu");
  const isOpening = menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !isOpening);
  document.getElementById("periodButton").setAttribute("aria-expanded", String(isOpening));
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".chart-period-wrap")) {
    document.getElementById("chartPeriodMenu").classList.add("hidden");
    document.getElementById("periodButton").setAttribute("aria-expanded", "false");
  }
});
document.getElementById("headerProfileButton").addEventListener("click", () => {
  const menu = document.getElementById("profileMenu");
  const isOpening = menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !isOpening);
  document.getElementById("headerProfileButton").setAttribute("aria-expanded", String(isOpening));
});
document.querySelectorAll("[data-profile-action]").forEach((button) => button.addEventListener("click", () => {
  closeProfileMenu();
  if (button.dataset.profileAction === "settings") {
    settingsPreviousPage = document.querySelector(".view-page.active")?.dataset.page || "home";
    openSettingsPanel("display");
    openPage("settings");
    return;
  }
  requestLogout();
}));
document.addEventListener("click", (event) => {
  if (!event.target.closest(".profile-menu-wrap")) closeProfileMenu();
});

const today = new Date();
document.getElementById("profileEmail").textContent = userId;
updateAccountLabels();
applyTheme();
openSettingsPanel("display");
document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(today);
document.getElementById("todayFullLabel").textContent = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(today);
document.getElementById("serviceDueMonth").value = String(today.getMonth() + 1);
document.getElementById("serviceDueDay").value = "1";
document.getElementById("serviceDueDayMonthly").value = String(Math.min(31, today.getDate() + 7));
document.getElementById("detailSplitCount").value = 2;
updateNewSubscriptionCycle();
updateAnnualMonthButtons();
updateShareAmount("servicePrice", "newSplitCount", "friendShare", "friendName");
renderSubscriptions();
