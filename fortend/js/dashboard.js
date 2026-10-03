'use strict';

// cấu hình api
const API_BASE_URL = "https://bear-charged.onrender.com";
const OVERVIEW_URL = `${API_BASE_URL}/api/dashboard/overview`;
const NOTIFICATIONS_URL = `${API_BASE_URL}/api/dashboard/notifications`;
const RECENT_ORDERS_URL = `${API_BASE_URL}/api/orders/recent?limit=5`;
const REVENUE_DAY_URL = `${API_BASE_URL}/api/dashboard/revenue-by-day`;
let last7Days = [];

// kiểm tra đăng nhập
const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

function formatCurrency(number) {
    return Math.round(number || 0).toLocaleString("vi-VN") + "đ";
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// gọi API có kèm token, tự xử lý hết hạn / chưa đăng nhập
async function apiGet(url) {
    const res = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
        },
    });

    if (res.status === 401) {
        // token hết hạn hoặc không hợp lệ
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return null;
    }

    const result = await res.json();
    if (!res.ok) {
        console.error("API error:", result);
        return null;
    }
    return result.data || result;
}

// lấy thẻ vẽ biểu đồ
const ctx = document.getElementById("salesChart");

const salesChart = new Chart(ctx, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "Doanh thu",
            data: [],
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79,70,229,.15)",
            fill: true,
            tension: .4,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (evt, elements) => {
        if (!elements.length) return;
        const day = last7Days[elements[0].index];
        if (day && day.date) loadDayDetail(day.date, day.label);
        },
        onHover: (evt, elements) => {
        evt.native.target.style.cursor = elements.length ? "pointer" : "default";
        },
        animation: {
            duration: 800
        },
        plugins: {
            legend: { display: true }
        },
        scales: {
            y: { beginAtZero: true }
        }
    }
});

// thống kê tổng quan + biểu đồ — gọi chung 1 API /overview
async function loadOverview() {
    const data = await apiGet(OVERVIEW_URL);
    if (!data) return;

    // cards
    document.getElementById("revenue").innerText = formatCurrency(data.total_revenue);
    document.getElementById("totalOrders").innerText = data.total_orders ?? 0;
    document.getElementById("totalProducts").innerText = data.total_products ?? 0;
    document.getElementById("totalCustomers").innerText = data.total_customers ?? 0;

    // biểu đồ 7 ngày gần nhất
    const days = data.revenue_last_7_days || [];
    last7Days = days; 
    salesChart.data.labels = days.map(d => d.label);
    salesChart.data.datasets[0].data = days.map(d => d.revenue);
    salesChart.update();
}

// thông báo tồn kho
async function loadNotifications() {
    const list = document.getElementById("notificationList");
    list.innerHTML = "";

    const notifications = await apiGet(NOTIFICATIONS_URL);

    if (!notifications || notifications.length === 0) {
        list.innerHTML = `<li class="noti-empty">Không có thông báo mới</li>`;  
        return;
    }

    notifications.forEach(n => {
        list.innerHTML += `
            <li class="noti-item noti-${n.type}">
                <i class="fa-solid ${n.icon}"></i>
                <span>${escapeHtml(n.text)}</span>
            </li>
        `;
    });
}

// map trạng thái backend -> hiển thị tiếng Việt + màu
function mapOrderStatus(status) {
    switch (status) {
        case "Completed":
            return { text: "Hoàn thành", color: "success" };
        case "Pending":
            return { text: "Đang xử lý", color: "pending" };
        case "Cancelled":
            return { text: "Đã hủy", color: "cancel" };
        default:
            return { text: status || "", color: "" };
    }
}

function renderOrderRow(order) {
    const { text, color } = mapOrderStatus(order.status);
    return `
        <tr>
            <td>${escapeHtml(order.code || "")}</td>
            <td>${escapeHtml(order.customer_fullname || "Khách lẻ")}</td>
            <td>${formatCurrency(order.total)}</td>
            <td class="${color}">${escapeHtml(text)}</td>
        </tr>
    `;
}

// bảng đơn hàng gần đây
async function loadOrders() {
    const table = document.getElementById("orderTable");
    table.innerHTML = "";

    const orders = await apiGet(RECENT_ORDERS_URL);

    if (!orders || orders.length === 0) {
        table.innerHTML = `<tr><td colspan="4">Chưa có đơn hàng nào</td></tr>`;
        return;
    }

    orders.forEach(order => {
        table.innerHTML += renderOrderRow(order);
    });
}

async function loadDayDetail(dateStr, label) {
    const data = await apiGet(`${REVENUE_DAY_URL}?date=${dateStr}`);
    if (!data) return;

    document.getElementById("dayDetailTitle").innerText = `Chi tiết ngày ${label}`;
    document.getElementById("dayDetailSummary").innerText =
        `${data.total_orders} đơn đã hoàn thành • Doanh thu ${formatCurrency(data.total_revenue)}`;

    const body = document.getElementById("dayDetailBody");
    if (!data.orders.length) {
        body.innerHTML = `<tr><td colspan="5">Ngày này chưa có đơn hàng</td></tr>`;
    } else {
        body.innerHTML = data.orders.map(o => {
            const { text, color } = mapOrderStatus(o.status);
            const items = o.items.map(i => `${escapeHtml(i.name)} x${i.quantity}`).join(", ");
            return `
                <tr>
                    <td>${escapeHtml(o.code)}</td>
                    <td>${escapeHtml(o.customer_fullname || "Khách lẻ")}</td>
                    <td>${items}</td>
                    <td>${formatCurrency(o.total)}</td>
                    <td class="${color}">${escapeHtml(text)}</td>
                </tr>`;
        }).join("");
    }

    const panel = document.getElementById("dayDetail");
    panel.style.display = "block";
    panel.scrollIntoView({ behavior: "smooth" });
}

async function refreshDashboard() {
    await loadOverview();
    await loadNotifications();
    await loadOrders();
}

refreshDashboard();

document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("mouseenter", () => {
        card.style.transform = "translateY(-10px)";
    });
    card.addEventListener("mouseleave", () => {
        card.style.transform = "translateY(0px)";
    });
});

// tìm kiếm (giữ nguyên, hoạt động trên bảng hiện tại)
const searchInput = document.querySelector(".search input");
if (searchInput) {
    searchInput.addEventListener("keyup", function () {
        const keyword = this.value.toLowerCase();
        const rows = document.querySelectorAll("#orderTable tr");

        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(keyword) ? "" : "none";
        });
    });
}

const notifyBtn = document.querySelector(".notify");
const notificationBox = document.querySelector(".notification-box");

if (notifyBtn && notificationBox) {
    notifyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        notificationBox.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
        if (!notificationBox.contains(e.target) && !notifyBtn.contains(e.target)) {
            notificationBox.classList.remove("show");
        }
    });
}

const profileEl = document.querySelector(".profile");
if (profileEl) {
    profileEl.addEventListener("click", () => {
        alert("Trang cá nhân đang được phát triển.");
    });
}

// đăng xuất
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        window.location.href = "login.html";
    });
}
const totalOrdersCard = document.getElementById("totalOrders")?.closest(".card");
if (totalOrdersCard) {
    totalOrdersCard.style.cursor = "pointer";
    totalOrdersCard.addEventListener("click", () => {
        window.location.href = "order.html";
    });
}

console.log("Dashboard Loaded Successfully!");