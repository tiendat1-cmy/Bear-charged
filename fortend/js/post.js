'use strict';

// Cấu hình api
const API_BASE_URL = "http://127.0.0.1:8000";
const PRODUCTS_URL = `${API_BASE_URL}/api/products`;
const CATEGORIES_URL = `${API_BASE_URL}/api/categories`;

// kiểm tra đăng nhập
const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

let products = [];       // danh sách sản phẩm của TRANG hiện tại (server trả về theo page)
let categories = [];     // danh sách toàn bộ danh mục, dùng để đổ vào <select> và tra tên hiển thị
let currentPage = 1;
const itemsPerPage = 5;
let totalPages = 1;
let editingId = null;    // null = đang thêm mới, có giá trị = đang sửa
let deletingId = null;
let searchTimer = null;  // debounce cho ô tìm kiếm

// Lấy dom
const tableBody = document.getElementById("productTableBody");
const paginationEl = document.getElementById("pagination");
const searchInput = document.getElementById("searchInput");

const totalCountEl = document.getElementById("totalCount");
const lowStockCountEl = document.getElementById("lowStockCount");
const outStockCountEl = document.getElementById("outStockCount");

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const productForm = document.getElementById("productForm");
const productIdInput = document.getElementById("productId");
const productNameInput = document.getElementById("productName");
const productCategoryInput = document.getElementById("productCategory"); // giờ là <select>
const productPriceInput = document.getElementById("productPrice");
const productStockInput = document.getElementById("productStock");
const formError = document.getElementById("formError");

const addBtn = document.getElementById("addBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const cancelBtn = document.getElementById("cancelBtn");

const deleteOverlay = document.getElementById("deleteOverlay");
const deleteProductNameEl = document.getElementById("deleteProductName");
const deleteCloseBtn = document.getElementById("deleteCloseBtn");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

function formatCurrency(number) {
    return Math.round(number || 0).toLocaleString("vi-VN") + "đ";
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

function getStatus(quantity) {
    if (quantity <= 0) return { text: "Hết hàng", class: "danger" };
    if (quantity <= 10) return { text: "Sắp hết hàng", class: "warning" };
    return { text: "Còn hàng", class: "success" };
}

// ==== GỌI API CÓ KÈM TOKEN ====
async function apiRequest(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });

    if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return null;
    }

    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
        // 403 = không đủ quyền (không phải admin)
        const msg = result.detail || result.message || "Có lỗi xảy ra";
        throw new Error(msg);
    }

    return result.data !== undefined ? result.data : result;
}

// danh mục
async function loadCategories() {
    try {
        categories = await apiRequest(CATEGORIES_URL) || [];
        productCategoryInput.innerHTML = `<option value="">-- Chọn danh mục --</option>`;
        categories.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.name;
            productCategoryInput.appendChild(opt);
        });
    } catch (err) {
        console.error("Lỗi tải danh mục:", err);
    }
}

function getCategoryName(product) {
    // ProductOut có sẵn field "category" lồng (CategoryOut) nếu backend trả kèm
    if (product.category && product.category.name) return product.category.name;
    const found = categories.find(c => c.id === product.category_id);
    return found ? found.name : "";
}

// danh sách sản phẩm
async function loadProducts() {
    const keyword = searchInput.value.trim();
    const params = new URLSearchParams({
        page: currentPage,
        page_size: itemsPerPage,
    });
    if (keyword) params.set("keyword", keyword);

    try {
        const data = await apiRequest(`${PRODUCTS_URL}?${params.toString()}`);
        products = data.items || [];
        totalPages = data.meta?.total_pages || 1;
        if (currentPage > totalPages) currentPage = totalPages || 1;

        renderTable();
        renderPagination();
        await updateStats(); // stats tính trên toàn bộ sản phẩm, không chỉ trang hiện tại
    } catch (err) {
        console.error("Lỗi tải sản phẩm:", err);
        tableBody.innerHTML = `<tr class="empty-row"><td colspan="7">Không thể tải dữ liệu: ${escapeHtml(err.message)}</td></tr>`;
    }
}

// Thống kê tổng quan: gọi riêng page_size lớn để đếm toàn bộ
// (đơn giản, không cần thêm endpoint mới ở backend)
async function updateStats() {
    try {
        const data = await apiRequest(`${PRODUCTS_URL}?page=1&page_size=100`);
        const all = data.items || [];
        totalCountEl.textContent = data.meta?.total_items ?? all.length;
        lowStockCountEl.textContent = all.filter(p => p.quantity > 0 && p.quantity <= 10).length;
        outStockCountEl.textContent = all.filter(p => p.quantity <= 0).length;
    } catch (err) {
        console.error("Lỗi tải thống kê:", err);
    }
}

function renderTable() {
    tableBody.innerHTML = "";

    if (products.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7">Không tìm thấy sản phẩm nào</td>
            </tr>`;
        return;
    }

    products.forEach(product => {
        const status = getStatus(product.quantity);
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(getCategoryName(product))}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${product.quantity}</td>
            <td><span class="status ${status.class}">${status.text}</span></td>
            <td>
                <button class="edit" data-id="${product.id}"><i class="fa-solid fa-pen"></i></button>
                <button class="delete" data-id="${product.id}"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll(".edit").forEach(btn => {
        btn.addEventListener("click", () => openEditModal(btn.dataset.id));
    });
    tableBody.querySelectorAll(".delete").forEach(btn => {
        btn.addEventListener("click", () => openDeleteConfirm(btn.dataset.id));
    });
}

// phân trang
function renderPagination() {
    paginationEl.innerHTML = "";

    const prevBtn = document.createElement("button");
    prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left"></i>`;
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => goToPage(currentPage - 1));
    paginationEl.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement("button");
        pageBtn.textContent = i;
        if (i === currentPage) pageBtn.classList.add("active");
        pageBtn.addEventListener("click", () => goToPage(i));
        paginationEl.appendChild(pageBtn);
    }

    const nextBtn = document.createElement("button");
    nextBtn.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener("click", () => goToPage(currentPage + 1));
    paginationEl.appendChild(nextBtn);
}

function goToPage(page) {
    currentPage = page;
    loadProducts();
}

// tìm kiếm (debounce 400ms để không gọi API liên tục khi gõ)
searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        currentPage = 1;
        loadProducts();
    }, 400);
});

// thêm + sửa
function openAddModal() {
    editingId = null;
    modalTitle.textContent = "Thêm sản phẩm";
    productForm.reset();
    productIdInput.value = "";
    formError.textContent = "";
    modalOverlay.classList.add("open");
    productNameInput.focus();
}

function openEditModal(id) {
    const product = products.find(p => String(p.id) === String(id));
    if (!product) return;

    editingId = product.id;
    modalTitle.textContent = "Sửa sản phẩm";
    productIdInput.value = product.id;
    productNameInput.value = product.name;
    productCategoryInput.value = product.category_id || "";
    productPriceInput.value = product.price;
    productStockInput.value = product.quantity;
    formError.textContent = "";
    modalOverlay.classList.add("open");
    productNameInput.focus();
}

function closeModal() {
    modalOverlay.classList.remove("open");
    productForm.reset();
    editingId = null;
    formError.textContent = "";
}

addBtn.addEventListener("click", openAddModal);
modalCloseBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
});

// lưu khi thêm / sửa — gọi API thật
productForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = productNameInput.value.trim();
    const categoryId = productCategoryInput.value ? Number(productCategoryInput.value) : null;
    const price = Number(productPriceInput.value);
    const quantity = Number(productStockInput.value);

    if (!name || !categoryId) {
        formError.textContent = "Vui lòng nhập đầy đủ tên và danh mục.";
        return;
    }
    if (price <= 0 || quantity < 0 || isNaN(price) || isNaN(quantity)) {
        formError.textContent = "Giá phải lớn hơn 0, tồn kho phải là số không âm.";
        return;
    }

    const payload = {
        name,
        category_id: categoryId,
        price,
        quantity,
    };

    const saveBtn = document.getElementById("saveBtn");
    saveBtn.disabled = true;

    try {
        if (editingId === null) {
            await apiRequest(PRODUCTS_URL, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        } else {
            await apiRequest(`${PRODUCTS_URL}/${editingId}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
        }

        searchInput.value = "";
        currentPage = 1;
        closeModal();
        await loadProducts();
    } catch (err) {
        formError.textContent = err.message || "Không thể lưu sản phẩm.";
    } finally {
        saveBtn.disabled = false;
    }
});

// xóa
function openDeleteConfirm(id) {
    const product = products.find(p => String(p.id) === String(id));
    if (!product) return;
    deletingId = product.id;
    deleteProductNameEl.textContent = product.name;
    deleteOverlay.classList.add("open");
}

function closeDeleteConfirm() {
    deleteOverlay.classList.remove("open");
    deletingId = null;
}

deleteCloseBtn.addEventListener("click", closeDeleteConfirm);
deleteCancelBtn.addEventListener("click", closeDeleteConfirm);
deleteOverlay.addEventListener("click", (e) => {
    if (e.target === deleteOverlay) closeDeleteConfirm();
});

deleteConfirmBtn.addEventListener("click", async () => {
    if (deletingId === null) return;

    deleteConfirmBtn.disabled = true;
    try {
        await apiRequest(`${PRODUCTS_URL}/${deletingId}`, { method: "DELETE" });
        closeDeleteConfirm();
        await loadProducts();
    } catch (err) {
        alert(err.message || "Không thể xóa sản phẩm.");
    } finally {
        deleteConfirmBtn.disabled = false;
    }
});

// đăng xuất
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        window.location.href = "login.html";
    });
}

async function init() {
    await loadCategories();
    await loadProducts();
}

init();