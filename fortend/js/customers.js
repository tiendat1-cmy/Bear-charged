'use strict';

const API_BASE_URL = "https://bear-charged.onrender.com";
const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";

function formatCurrency(n) {
    return Math.round(n || 0).toLocaleString("vi-VN") + "đ";
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

async function apiGet(url) {
    const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
    if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return null;
    }
    const result = await res.json();
    if (!res.ok) { console.error(result); return null; }
    return result.data || result;
}

function mapOrderStatus(status) {
    switch (status) {
        case "Completed": return { text: "Đã thanh toán", color: "success" };
        case "Pending":   return { text: "Đang xử lý", color: "pending" };
        case "Cancelled": return { text: "Đã hủy", color: "cancel" };
        default:          return { text: status || "", color: "" };
    }
}

async function loadCustomers() {
    const body = document.getElementById("customerTable");
    const customers = await apiGet(`${API_BASE_URL}/api/dashboard/customers`);

    if (!customers || !customers.length) {
        body.innerHTML = `<tr><td colspan="3">Chưa có khách hàng nào</td></tr>`;
        return;
    }

    body.innerHTML = customers.map(c => `
        <tr class="clickable" data-id="${c.id}" data-name="${escapeHtml(c.fullname)}">
            <td>${escapeHtml(c.fullname)}</td>
            <td>${c.order_count}</td>
            <td>${formatCurrency(c.total_spent)}</td>
        </tr>`).join("");
}

async function showCustomerOrders(id, name) {
    const orders = await apiGet(`${API_BASE_URL}/api/dashboard/customers/${id}/orders`);
    if (!orders) return;

    document.getElementById("customerOrdersTitle").innerText = `Lịch sử mua hàng của ${name}`;

    const body = document.getElementById("customerOrdersBody");
    body.innerHTML = orders.length ? orders.map(o => {
        const { text, color } = mapOrderStatus(o.status);
        const items = o.items.map(i => `${escapeHtml(i.name)} x${i.quantity}`).join(", ");
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString("vi-VN") : "";
        return `
            <tr>
                <td>${escapeHtml(o.code)}</td>
                <td>${date}</td>
                <td>${items}</td>
                <td>${formatCurrency(o.total)}</td>
                <td class="${color}">${text}</td>
            </tr>`;
    }).join("") : `<tr><td colspan="5">Khách này chưa có đơn nào</td></tr>`;

    const panel = document.getElementById("customerOrders");
    panel.style.display = "block";
    panel.scrollIntoView({ behavior: "smooth" });
}

document.getElementById("customerTable").addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-id]");
    if (row) showCustomerOrders(row.dataset.id, row.dataset.name);
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "login.html";
});

loadCustomers();