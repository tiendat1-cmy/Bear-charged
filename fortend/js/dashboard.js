'use strict';

// cấu hình api
const API_BASE_URL = "http://127.0.0.1:8000";
const OVERVIEW_URL = `${API_BASE_URL}/api/dashboard/overview`;
const NOTIFICATIONS_URL = `${API_BASE_URL}/api/dashboard/notifications`;
const RECENT_ORDERS_URL = `${API_BASE_URL}/api/orders/recent?limit=5`;

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

console.log("Dashboard Loaded Successfully!");