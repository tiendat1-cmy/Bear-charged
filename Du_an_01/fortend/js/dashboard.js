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



async function loadStats() {
    try {
        const res = await fetch("/api/dashboard/stats");
        const data = await res.json();

        document.getElementById("revenue").innerText = data.revenue;
        document.getElementById("totalOrders").innerText = data.orders;
        document.getElementById("totalProducts").innerText = data.products;
        document.getElementById("totalCustomers").innerText = data.customers;
    } catch (err) {
        console.error("Lỗi tải thống kê:", err);
    }
}

async function loadChart() {
    try {
        const res = await fetch("/api/dashboard/revenue-chart");
        const data = await res.json();

        salesChart.data.labels = data.labels;
        salesChart.data.datasets[0].data = data.values;
        salesChart.update();
    } catch (err) {
        console.error("Lỗi tải biểu đồ:", err);
    }
}

async function loadOrders() {
    const table = document.getElementById("orderTable");
    table.innerHTML = "";

    try {
        const res = await fetch("/api/orders/recent?limit=5");
        const orders = await res.json();

        if (orders.length === 0) {
            table.innerHTML = `<tr><td colspan="4">Chưa có đơn hàng nào</td></tr>`;
            return;
        }

        orders.forEach(order => {
            let color = "";
            if (order.status === "Hoàn thành") color = "success";
            else if (order.status === "Đang giao") color = "pending";
            else color = "cancel";

            table.innerHTML += `
                <tr>
                    <td>${order.id}</td>
                    <td>${order.customer}</td>
                    <td>${order.total}</td>
                    <td class="${color}">${order.status}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Lỗi tải đơn hàng:", err);
        table.innerHTML = `<tr><td colspan="4">Không tải được đơn hàng</td></tr>`;
    }
}

async function loadNotifications() {
    const list = document.getElementById("notificationList");
    list.innerHTML = "";

    try {
        const res = await fetch("/api/notifications");
        const notifications = await res.json();

        if (notifications.length === 0) {
            list.innerHTML = `<li class="noti-empty">Không có thông báo mới</li>`;
            return;
        }

        notifications.forEach(n => {
            list.innerHTML += `
                <li class="noti-item noti-${n.type}">
                    <i class="fa-solid ${n.icon}"></i>
                    <span>${n.text}</span>
                </li>
            `;
        });
    } catch (err) {
        console.error("Lỗi tải thông báo:", err);
        list.innerHTML = `<li class="noti-empty">Không tải được thông báo</li>`;
    }
}

loadStats();
loadChart();
loadOrders();
loadNotifications();

document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("mouseenter", () => {
        card.style.transform = "translateY(-10px)";
    });
    card.addEventListener("mouseleave", () => {
        card.style.transform = "translateY(0px)";
    });
});
// tìm kiếm
const searchInput = document.querySelector(".search input");

searchInput.addEventListener("keyup", function () {
    const keyword = this.value.toLowerCase();
    const rows = document.querySelectorAll("#orderTable tr");

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(keyword) ? "" : "none";
    });
});


const notifyBtn = document.querySelector(".notify");
const notificationBox = document.querySelector(".notification-box");

notifyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notificationBox.classList.toggle("show");
});

document.addEventListener("click", (e) => {
    if (!notificationBox.contains(e.target) && !notifyBtn.contains(e.target)) {
        notificationBox.classList.remove("show");
    }
});


document.querySelector(".profile").addEventListener("click", () => {
    alert("Trang cá nhân đang được phát triển.");
});


// đăng xuất 
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    sessionStorage.clear();
    window.location.href = "login.html";
});

console.log("Dashboard Loaded Successfully!");