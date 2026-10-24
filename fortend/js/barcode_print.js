/**
 * ==============================================================
 * LOGIC IN TEM MÃ VẠCH TRÊN GIẤY A4 PHONG CHÂU / TOMY — BEAR POS
 * ==============================================================
 */

'use strict';

// 1. Cấu hình API và kiểm tra đăng nhập
const API_BASE_URL = window.API_BASE_URL || localStorage.getItem('api_base_url') || "https://bear-charged.onrender.com";
const PRODUCTS_URL = `${API_BASE_URL}/api/products`;

const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

// Kiểm tra thư viện JsBarcode đã tải chưa
if (typeof JsBarcode === 'undefined') {
    console.error('JsBarcode chưa được tải! Vui lòng kiểm tra kết nối mạng hoặc file thư viện cục bộ.');
}

// 2. Danh mục kích thước chuẩn các mẫu giấy Decal Phong Châu / Tomy A4
const DECAL_PRESETS = {
    pc_108: {
        code: "108",
        name: "Phong Châu 108 (52 × 41 mm) — 3 cột × 6 hàng (18 tem)",
        columns: 3,
        rows: 6,
        labelWidth: 52.0,
        labelHeight: 41.0,
        marginTop: 15.0,
        marginLeft: 15.0,
        gapX: 12.0,
        gapY: 4.0,
        description: "Mẫu tem Phong Châu số 108 — 52 × 41 mm (3 cột × 6 hàng = 18 tem/tờ) [Chuẩn xác nhận]"
    },
    pc_108_4col: {
        code: "108-4C",
        name: "Phong Châu 108 (52 × 41 mm) — 4 cột × 6 hàng (24 tem)",
        columns: 4,
        rows: 6,
        labelWidth: 52.0,
        labelHeight: 41.0,
        marginTop: 15.0,
        marginLeft: 1.0,
        gapX: 0.0,
        gapY: 4.0,
        description: "Mẫu tem Phong Châu số 108 — 52 × 41 mm (4 cột × 6 hàng = 24 tem/tờ)"
    },
    pc_108_3x7: {
        code: "108-3x7",
        name: "Phong Châu 108 (52 × 41 mm) — 3 cột × 7 hàng (21 tem)",
        columns: 3,
        rows: 7,
        labelWidth: 52.0,
        labelHeight: 41.0,
        marginTop: 5.0,
        marginLeft: 15.0,
        gapX: 12.0,
        gapY: 0.0,
        description: "Mẫu tem Phong Châu số 108 — 52 × 41 mm (3 cột × 7 hàng = 21 tem/tờ)"
    },
    pc_145: {
        code: "145",
        name: "Phong Châu / Tomy 145 (65 tem/tờ — 38 × 21 mm)",
        columns: 5,
        rows: 13,
        labelWidth: 38.0,
        labelHeight: 21.0,
        marginTop: 11.5,
        marginLeft: 8.0,
        gapX: 2.5,
        gapY: 0.0,
        description: "65 tem / tờ — 5 cột × 13 hàng — Kích thước: 38 × 21 mm"
    },
    pc_138: {
        code: "138",
        name: "Phong Châu / Tomy 138 (100 tem/tờ — 38 × 14 mm)",
        columns: 5,
        rows: 20,
        labelWidth: 38.0,
        labelHeight: 14.0,
        marginTop: 8.5,
        marginLeft: 8.0,
        gapX: 2.5,
        gapY: 0.0,
        description: "100 tem / tờ — 5 cột × 20 hàng — Kích thước: 38 × 14 mm"
    },
    pc_149: {
        code: "149",
        name: "Phong Châu / Tomy 149 (44 tem/tờ — 48 × 25 mm)",
        columns: 4,
        rows: 11,
        labelWidth: 48.0,
        labelHeight: 25.0,
        marginTop: 11.0,
        marginLeft: 9.0,
        gapX: 0.0,
        gapY: 0.0,
        description: "44 tem / tờ — 4 cột × 11 hàng — Kích thước: 48 × 25 mm"
    },
    pc_135: {
        code: "135",
        name: "Phong Châu / Tomy 135 (30 tem/tờ — 66 × 28 mm)",
        columns: 3,
        rows: 10,
        labelWidth: 66.0,
        labelHeight: 28.0,
        marginTop: 8.5,
        marginLeft: 6.0,
        gapX: 0.0,
        gapY: 0.0,
        description: "30 tem / tờ — 3 cột × 10 hàng — Kích thước: 66 × 28 mm"
    },
    pc_133: {
        code: "133",
        name: "Phong Châu / Tomy 133 (16 tem/tờ — 101 × 33 mm)",
        columns: 2,
        rows: 8,
        labelWidth: 101.0,
        labelHeight: 33.0,
        marginTop: 16.5,
        marginLeft: 4.0,
        gapX: 0.0,
        gapY: 0.0,
        description: "16 tem / tờ — 2 cột × 8 hàng — Kích thước: 101 × 33 mm"
    }
};

// 3. Trạng thái ứng dụng (State)
const State = {
    allProducts: [],
    selectedProductIds: new Set(),
    printQuantities: {}, // { [productId]: quantity }
    activeFilter: 'all',
    searchKeyword: '',
    config: { ...DECAL_PRESETS.pc_108 },
    startPosition: 1,    // 1-indexed, bỏ qua N ô tem đã bóc
    offsetX: 0,          // mm bù cơ học
    offsetY: 0,          // mm bù cơ học
    contentOptions: {
        shopName: false,
        name: true,
        barcode: true,
        codeText: true,
        price: true,
        testMode: false
    },
    previewPage: 1,
    previewTotalPages: 1,
    previewScale: 'fit',
    showAllPages: false
};

// 4. Lấy DOM Elements
const DOM = {
    // Topbar & stats
    currentTemplateBadge: document.getElementById('currentTemplateBadge'),
    statSelectedProducts: document.getElementById('statSelectedProducts'),
    statTotalLabels: document.getElementById('statTotalLabels'),
    statTotalPages: document.getElementById('statTotalPages'),
    missingBarcodeWarning: document.getElementById('missingBarcodeWarning'),
    missingBarcodeText: document.getElementById('missingBarcodeText'),
    bulkGenerateWarningBtn: document.getElementById('bulkGenerateWarningBtn'),
    startPrintBtn: document.getElementById('startPrintBtn'),
    testPrintBtn: document.getElementById('testPrintBtn'),
    printGuideBtn: document.getElementById('printGuideBtn'),

    // Search & Filter
    productSearchInput: document.getElementById('productSearchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    filterTabs: document.querySelectorAll('.filter-tabs .tab-btn'),
    countAll: document.getElementById('countAll'),
    countSelected: document.getElementById('countSelected'),
    countNoBarcode: document.getElementById('countNoBarcode'),

    // Batch actions
    selectAllCheckbox: document.getElementById('selectAllCheckbox'),
    batchQtyInput: document.getElementById('batchQtyInput'),
    applyBatchQtyBtn: document.getElementById('applyBatchQtyBtn'),
    fillSheetBtn: document.getElementById('fillSheetBtn'),
    fillByStockBtn: document.getElementById('fillByStockBtn'),
    clearSelectionBtn: document.getElementById('clearSelectionBtn'),
    productTableBody: document.getElementById('productTableBody'),

    // Configuration drawer
    toggleConfigBtn: document.getElementById('toggleConfigBtn'),
    configDrawer: document.getElementById('configDrawer'),
    configChevron: document.getElementById('configChevron'),
    templatePresetSelect: document.getElementById('templatePresetSelect'),
    cfgColumns: document.getElementById('cfgColumns'),
    cfgRows: document.getElementById('cfgRows'),
    cfgLabelWidth: document.getElementById('cfgLabelWidth'),
    cfgLabelHeight: document.getElementById('cfgLabelHeight'),
    cfgMarginTop: document.getElementById('cfgMarginTop'),
    cfgMarginLeft: document.getElementById('cfgMarginLeft'),
    cfgGapX: document.getElementById('cfgGapX'),
    cfgGapY: document.getElementById('cfgGapY'),
    cfgStartPosition: document.getElementById('cfgStartPosition'),
    cfgOffsetX: document.getElementById('cfgOffsetX'),
    cfgOffsetY: document.getElementById('cfgOffsetY'),
    cfgShowShopName: document.getElementById('cfgShowShopName'),
    cfgShowName: document.getElementById('cfgShowName'),
    cfgShowBarcode: document.getElementById('cfgShowBarcode'),
    cfgShowCodeText: document.getElementById('cfgShowCodeText'),
    cfgShowPrice: document.getElementById('cfgShowPrice'),
    cfgTestMode: document.getElementById('cfgTestMode'),
    saveCustomPresetBtn: document.getElementById('saveCustomPresetBtn'),
    resetPresetBtn: document.getElementById('resetPresetBtn'),

    // Preview
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    previewCurrentPage: document.getElementById('previewCurrentPage'),
    previewTotalPages: document.getElementById('previewTotalPages'),
    showAllPagesToggle: document.getElementById('showAllPagesToggle'),
    previewScaleSelect: document.getElementById('previewScaleSelect'),
    previewViewport: document.getElementById('previewViewport'),
    previewStage: document.getElementById('previewStage'),

    // Print container
    a4PrintContainer: document.getElementById('a4PrintContainer'),

    // Modals
    guideModalOverlay: document.getElementById('guideModalOverlay'),
    guideModalCloseBtn: document.getElementById('guideModalCloseBtn'),
    guideCloseBtn: document.getElementById('guideCloseBtn'),
    guideTestPrintBtn: document.getElementById('guideTestPrintBtn'),
    toastContainer: document.getElementById('toastContainer'),
    logoutBtn: document.getElementById('logoutBtn')
};

// 5. Hàm tiện ích API
async function apiRequest(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return null;
    }

    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = result.detail || result.message || "Có lỗi xảy ra";
        throw new Error(msg);
    }
    return result.data !== undefined ? result.data : result;
}

function formatVND(num) {
    return Math.round(num || 0).toLocaleString('vi-VN') + 'đ';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';
    if (type === 'warning') icon = 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// 6. Tải danh sách sản phẩm từ backend
// Trả về true nếu cần tự động mở hộp thoại in (truy cập từ biểu tượng in ở trang sản phẩm)
async function loadProducts() {
    try {
        DOM.productTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-cell">
                    <i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu sản phẩm...
                </td>
            </tr>`;

        // Thử lấy danh sách toàn bộ qua /api/products/all, fallback sang /api/products?page_size=1000
        let items = [];
        try {
            items = await apiRequest(`${PRODUCTS_URL}/all`);
        } catch (e) {
            const data = await apiRequest(`${PRODUCTS_URL}?page=1&page_size=500`);
            items = data.items || [];
        }

        State.allProducts = items.map(p => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode ? String(p.barcode).trim() : '',
            price: Number(p.price) || 0,
            quantity: Number(p.quantity) || 0,
            category_id: p.category_id
        }));

        // Kiểm tra URL params nếu có ?id=... để tự động chọn sản phẩm đó
        const urlParams = new URLSearchParams(window.location.search);
        const preSelectId = urlParams.get('id') || urlParams.get('productId');
        let shouldAutoPrint = false;

        if (preSelectId) {
            const targetProd = State.allProducts.find(p => String(p.id) === String(preSelectId));
            if (targetProd) {
                State.selectedProductIds.add(targetProd.id);
                State.printQuantities[targetProd.id] = 1;

                // Kiểm tra mã vạch hợp lệ trước khi cho phép auto-print
                if (!targetProd.barcode) {
                    showToast(`Sản phẩm "${targetProd.name}" chưa có mã vạch. Vui lòng cấp mã trước khi in.`, 'warning');
                } else if (typeof JsBarcode === 'undefined') {
                    showToast('Thư viện mã vạch (JsBarcode) chưa tải được. Vui lòng kiểm tra kết nối mạng.', 'error');
                } else {
                    // Đủ điều kiện: có sản phẩm, có mã vạch, có thư viện → auto-print
                    shouldAutoPrint = true;
                }
            } else {
                showToast(`Không tìm thấy sản phẩm ID "${preSelectId}" trong hệ thống.`, 'error');
            }
        }

        renderProductTable();
        updateStats();
        renderPreview();

        // Trả về cờ để init() biết có cần mở hộp thoại in hay không
        return shouldAutoPrint;

    } catch (err) {
        console.error("Lỗi nạp sản phẩm:", err);
        DOM.productTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">
                    <p style="color:#ef4444;"><i class="fa-solid fa-circle-exclamation"></i> Không thể tải sản phẩm: ${escapeHtml(err.message)}</p>
                </td>
            </tr>`;
        showToast("Không thể tải danh sách sản phẩm: " + err.message, "error");
        return false;
    }
}

// 7. Lọc và hiển thị bảng sản phẩm
function getFilteredProducts() {
    const kw = State.searchKeyword.toLowerCase().trim();
    return State.allProducts.filter(p => {
        // Lọc theo từ khóa
        if (kw) {
            const matchName = p.name.toLowerCase().includes(kw);
            const matchBarcode = p.barcode.toLowerCase().includes(kw);
            const matchId = String(p.id).includes(kw);
            if (!matchName && !matchBarcode && !matchId) return false;
        }

        // Lọc theo Tab
        if (State.activeFilter === 'selected') {
            return State.selectedProductIds.has(p.id);
        }
        if (State.activeFilter === 'no_barcode') {
            return !p.barcode;
        }
        return true;
    });
}

function renderProductTable() {
    const filtered = getFilteredProducts();
    const countNoBarcode = State.allProducts.filter(p => !p.barcode).length;

    // Cập nhật số đếm trên tab
    DOM.countAll.textContent = State.allProducts.length;
    DOM.countSelected.textContent = State.selectedProductIds.size;
    DOM.countNoBarcode.textContent = countNoBarcode;

    // Cảnh báo nếu có sản phẩm thiếu mã
    if (countNoBarcode > 0) {
        DOM.missingBarcodeWarning.style.display = 'inline-flex';
        DOM.missingBarcodeText.textContent = `${countNoBarcode} sản phẩm chưa có mã vạch`;
    } else {
        DOM.missingBarcodeWarning.style.display = 'none';
    }

    if (filtered.length === 0) {
        DOM.productTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">
                    <i class="fa-solid fa-box-open" style="font-size: 24px; margin-bottom: 8px; color: #94a3b8;"></i>
                    <p>Không tìm thấy sản phẩm phù hợp.</p>
                </td>
            </tr>`;
        return;
    }

    DOM.productTableBody.innerHTML = '';
    filtered.forEach(p => {
        const isSelected = State.selectedProductIds.has(p.id);
        const qty = State.printQuantities[p.id] || 0;

        const tr = document.createElement('tr');
        if (isSelected) tr.classList.add('selected');

        let barcodeHtml = '';
        if (p.barcode) {
            barcodeHtml = `<span class="barcode-badge" title="Mã: ${escapeHtml(p.barcode)}">${escapeHtml(p.barcode)}</span>`;
        } else {
            barcodeHtml = `
                <span class="no-barcode-badge" title="Chưa có mã vạch">
                    <i class="fa-solid fa-triangle-exclamation"></i> Chưa có
                </span>
                <button type="button" class="btn-row-generate" data-product-id="${p.id}" title="Tạo mã vạch nội bộ ngay">⚡ Tạo</button>
            `;
        }

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="product-row-checkbox" data-id="${p.id}" ${isSelected ? 'checked' : ''}>
            </td>
            <td>${barcodeHtml}</td>
            <td>
                <strong style="color:#0f172a;">${escapeHtml(p.name)}</strong>
            </td>
            <td style="text-align: right; font-weight:600;">${formatVND(p.price)}</td>
            <td style="text-align: center; color:${p.quantity <= 0 ? '#ef4444' : '#0f172a'}; font-weight:600;">
                ${p.quantity}
            </td>
            <td style="text-align: center;">
                <div class="qty-spinner">
                    <button type="button" class="qty-btn btn-decrease" data-id="${p.id}">-</button>
                    <input type="number" class="qty-input" data-id="${p.id}" value="${qty}" min="0" max="1000">
                    <button type="button" class="qty-btn btn-increase" data-id="${p.id}">+</button>
                </div>
            </td>
            <td style="text-align: center;">
                <button type="button" class="btn-sm btn-outline btn-quick-view" data-id="${p.id}" title="Xem trước tem này">
                    <i class="fa-regular fa-eye"></i>
                </button>
            </td>
        `;

        DOM.productTableBody.appendChild(tr);
    });

    attachTableEvents();
}

function attachTableEvents() {
    // Checkbox từng dòng
    DOM.productTableBody.querySelectorAll('.product-row-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = Number(e.target.dataset.id);
            if (e.target.checked) {
                State.selectedProductIds.add(id);
                if (!State.printQuantities[id] || State.printQuantities[id] === 0) {
                    State.printQuantities[id] = 1;
                }
            } else {
                State.selectedProductIds.delete(id);
            }
            renderProductTable();
            updateStats();
            renderPreview();
        });
    });

    // Nút tăng / giảm số lượng
    DOM.productTableBody.querySelectorAll('.btn-decrease').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const current = State.printQuantities[id] || 0;
            if (current > 0) {
                State.printQuantities[id] = current - 1;
                if (State.printQuantities[id] === 0) {
                    State.selectedProductIds.delete(id);
                }
                renderProductTable();
                updateStats();
                renderPreview();
            }
        });
    });

    DOM.productTableBody.querySelectorAll('.btn-increase').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const current = State.printQuantities[id] || 0;
            State.printQuantities[id] = current + 1;
            State.selectedProductIds.add(id);
            renderProductTable();
            updateStats();
            renderPreview();
        });
    });

    DOM.productTableBody.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', () => {
            const id = Number(input.dataset.id);
            let val = parseInt(input.value, 10);
            if (isNaN(val) || val < 0) val = 0;
            if (val > 1000) val = 1000;
            input.value = val;
            State.printQuantities[id] = val;
            if (val > 0) {
                State.selectedProductIds.add(id);
            } else {
                State.selectedProductIds.delete(id);
            }
            renderProductTable();
            updateStats();
            renderPreview();
        });
    });

    // Nút tạo mã nhanh cho dòng chưa có mã
    DOM.productTableBody.querySelectorAll('.btn-row-generate').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.dataset.productId);
            await autoAssignBarcodeForProduct(id);
        });
    });
}

// 8. Tự động cấp mã vạch cho sản phẩm
async function autoAssignBarcodeForProduct(productId) {
    try {
        const updated = await apiRequest(`${PRODUCTS_URL}/${productId}/auto-barcode`, { method: "POST" });
        showToast(`Đã tạo mã vạch "${updated.barcode}" cho "${updated.name}"!`);
        // Cập nhật lại trong client cache
        const p = State.allProducts.find(item => item.id === productId);
        if (p) {
            p.barcode = updated.barcode;
        }
        renderProductTable();
        renderPreview();
    } catch (err) {
        showToast("Lỗi cấp mã vạch: " + err.message, "error");
    }
}

async function bulkAutoGenerateBarcodes() {
    const count = State.allProducts.filter(p => !p.barcode).length;
    if (count === 0) {
        showToast("Tất cả sản phẩm đã có mã vạch đầy đủ!");
        return;
    }
    if (!confirm(`Bạn có chắc muốn tự động cấp mã vạch nội bộ chuẩn EAN-13/Code 128 cho ${count} sản phẩm chưa có mã?`)) {
        return;
    }

    try {
        const result = await apiRequest(`${PRODUCTS_URL}/bulk-auto-barcodes`, { method: "POST" });
        showToast(`Thành công! Đã cấp mã cho ${result.total_updated} sản phẩm.`);
        await loadProducts();
    } catch (err) {
        showToast("Lỗi cấp mã hàng loạt: " + err.message, "error");
    }
}

// 9. Cập nhật thống kê số tem và số trang A4
function getQueueItems() {
    // Trả về danh sách phẳng các tem cần in: [ { product, index }, ... ]
    const queue = [];
    State.allProducts.forEach(prod => {
        if (State.selectedProductIds.has(prod.id)) {
            const count = State.printQuantities[prod.id] || 0;
            for (let i = 0; i < count; i++) {
                queue.push(prod);
            }
        }
    });
    return queue;
}

function updateStats() {
    const queue = getQueueItems();
    const totalLabels = queue.length;
    const labelsPerSheet = State.config.columns * State.config.rows;

    let totalPages = 0;
    if (totalLabels > 0 && labelsPerSheet > 0) {
        const skipSlots = Math.max(0, State.startPosition - 1);
        const availableSheet1 = Math.max(0, labelsPerSheet - skipSlots);

        if (totalLabels <= availableSheet1) {
            totalPages = 1;
        } else {
            const remaining = totalLabels - availableSheet1;
            totalPages = 1 + Math.ceil(remaining / labelsPerSheet);
        }
    }

    State.previewTotalPages = Math.max(1, totalPages);
    if (State.previewPage > State.previewTotalPages) {
        State.previewPage = State.previewTotalPages;
    }

    DOM.statSelectedProducts.textContent = State.selectedProductIds.size;
    DOM.statTotalLabels.textContent = totalLabels;
    DOM.statTotalPages.textContent = totalPages;

    DOM.previewCurrentPage.textContent = State.previewPage;
    DOM.previewTotalPages.textContent = State.previewTotalPages;

    DOM.prevPageBtn.disabled = State.previewPage <= 1;
    DOM.nextPageBtn.disabled = State.previewPage >= State.previewTotalPages;
}

// 10. Tạo phần tử DOM cho một con tem decal
function createLabelElement(product, isTestMode = false, isBlankSlot = false) {
    const labelEl = document.createElement('div');
    labelEl.className = 'decal-label';
    if (isTestMode) labelEl.classList.add('test-mode');

    if (isBlankSlot) {
        labelEl.classList.add('empty-slot');
        labelEl.innerHTML = `<span class="empty-slot-text">[Đã bóc dùng]</span>`;
        return labelEl;
    }

    const { shopName, name, barcode, codeText, price } = State.contentOptions;

    // Tên shop
    if (shopName) {
        const shopEl = document.createElement('div');
        shopEl.className = 'label-shop-name';
        shopEl.textContent = 'BEAR CHARGED';
        labelEl.appendChild(shopEl);
    }

    // Tên sản phẩm
    if (name) {
        const nameEl = document.createElement('div');
        nameEl.className = 'label-product-name';
        nameEl.textContent = product.name;
        nameEl.title = product.name;
        labelEl.appendChild(nameEl);
    }

    // Hình mã vạch SVG (Code 128)
    if (barcode) {
        const barcodeWrap = document.createElement('div');
        barcodeWrap.className = 'label-barcode-wrapper';

        const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgEl.setAttribute('class', 'label-barcode-svg'); // SVG dùng setAttribute thay vì .className

        const rawCode = product.barcode ? String(product.barcode).trim() : '';
        if (rawCode) {
            try {
                // Render Code 128 chuẩn vector, tỷ lệ phù hợp cho tem 52x41mm
                const barHeight = Math.max(20, Math.min(26, State.config.labelHeight * 0.58));
                JsBarcode(svgEl, rawCode, {
                    format: "CODE128",
                    width: 1.35,
                    height: barHeight,
                    displayValue: false, // In chuỗi số riêng bên dưới cho sắc nét
                    margin: 4,
                    background: "transparent",
                    lineColor: "#000000"
                });
                barcodeWrap.appendChild(svgEl);
            } catch (e) {
                // Fallback nếu chuỗi không hợp lệ
                barcodeWrap.innerHTML = `<span style="font-size:9px;color:red;">Lỗi mã: ${escapeHtml(rawCode)}</span>`;
            }
        } else {
            barcodeWrap.innerHTML = `<span style="font-size:9px;color:#d97706;font-style:italic;">[Chưa có mã vạch]</span>`;
        }
        labelEl.appendChild(barcodeWrap);
    }

    // Chuỗi mã vạch
    if (codeText && product.barcode) {
        const codeTextEl = document.createElement('div');
        codeTextEl.className = 'label-code-text';
        codeTextEl.textContent = String(product.barcode).trim();
        labelEl.appendChild(codeTextEl);
    }

    // Giá bán
    if (price && product.price > 0) {
        const priceEl = document.createElement('div');
        priceEl.className = 'label-price-text';
        priceEl.textContent = formatVND(product.price);
        labelEl.appendChild(priceEl);
    }

    return labelEl;
}

// 11. Render bản xem trước trực quan (Preview Stage)
function renderPreview() {
    DOM.previewStage.innerHTML = '';
    const queue = getQueueItems();
    const cfg = State.config;
    const labelsPerSheet = cfg.columns * cfg.rows;

    if (queue.length === 0 && !State.contentOptions.testMode) {
        DOM.previewStage.innerHTML = `
            <div style="padding: 60px 20px; text-align: center; color: #64748b;">
                <i class="fa-solid fa-file-circle-plus" style="font-size: 38px; color: #94a3b8; margin-bottom: 12px;"></i>
                <h3 style="font-size: 15px; font-weight: 600; color: #334155;">Chưa có sản phẩm nào trong hàng in</h3>
                <p style="font-size: 12px; margin-top: 4px;">Vui lòng chọn sản phẩm và tăng số lượng tem ở cột bên trái.</p>
            </div>`;
        return;
    }

    // Xác định những trang cần render (render 1 trang hoặc toàn bộ các trang)
    const totalPages = State.previewTotalPages;
    const pagesToRender = State.showAllPages
        ? Array.from({ length: totalPages }, (_, i) => i + 1)
        : [State.previewPage];

    let currentItemIndex = 0;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        // Nếu không ở chế độ showAll và không phải trang hiện tại -> bỏ qua
        if (!pagesToRender.includes(pageNum)) {
            // Tính số item bị nhảy qua của trang này
            const skipOnThisSheet = (pageNum === 1) ? Math.max(0, State.startPosition - 1) : 0;
            const availableSlots = labelsPerSheet - skipOnThisSheet;
            currentItemIndex += availableSlots;
            continue;
        }

        const sheetEl = document.createElement('div');
        sheetEl.className = 'a4-sheet-preview';

        // Header watermark
        const wm = document.createElement('div');
        wm.className = 'sheet-header-watermark';
        wm.textContent = `A4 DECAL — TRANG ${pageNum}/${totalPages} — MẪU ${cfg.code || 'PHONG CHÂU'}`;
        sheetEl.appendChild(wm);

        // Tính các ô trống cần bỏ qua trên trang 1
        const startSkip = (pageNum === 1) ? Math.max(0, State.startPosition - 1) : 0;

        for (let slot = 0; slot < labelsPerSheet; slot++) {
            const row = Math.floor(slot / cfg.columns);
            const col = slot % cfg.columns;

            // Tọa độ tính bằng mm
            const posX = cfg.marginLeft + col * (cfg.labelWidth + cfg.gapX) + State.offsetX;
            const posY = cfg.marginTop + row * (cfg.labelHeight + cfg.gapY) + State.offsetY;

            let labelEl = null;

            if (slot < startSkip) {
                // Ô tem đã bị bóc dùng trước đó
                labelEl = createLabelElement(null, false, true);
            } else if (currentItemIndex < queue.length) {
                // Con tem thực tế
                const prod = queue[currentItemIndex];
                labelEl = createLabelElement(prod, State.contentOptions.testMode, false);
                currentItemIndex++;
            } else if (State.contentOptions.testMode) {
                // Ở chế độ in thử thì vẽ toàn bộ các ô để căn chỉnh
                labelEl = createLabelElement({ name: 'TEM MẪU THỬ', barcode: '11111', price: 15000 }, true, false);
            }

            if (labelEl) {
                labelEl.style.left = `${posX}mm`;
                labelEl.style.top = `${posY}mm`;
                labelEl.style.width = `${cfg.labelWidth}mm`;
                labelEl.style.height = `${cfg.labelHeight}mm`;
                sheetEl.appendChild(labelEl);
            }
        }

        DOM.previewStage.appendChild(sheetEl);
    }

    applyPreviewZoom();
}

// 12. Điều chỉnh tỷ lệ phóng to thu nhỏ của Preview
function applyPreviewZoom() {
    const scaleChoice = DOM.previewScaleSelect.value;
    const stage = DOM.previewStage;

    if (scaleChoice === 'fit') {
        const viewportWidth = DOM.previewViewport.clientWidth - 40;
        // 210mm tính ra px khoảng ~ 794px ở 96 DPI
        const a4WidthPx = 794;
        let scale = viewportWidth / a4WidthPx;
        if (scale > 1) scale = 1;
        if (scale < 0.4) scale = 0.4;
        stage.style.transform = `scale(${scale})`;
    } else {
        const numScale = parseFloat(scaleChoice) || 1.0;
        stage.style.transform = `scale(${numScale})`;
    }
}

// 13. Sinh vùng in A4 thực tế (#a4PrintContainer) và gọi window.print()
function renderA4PrintContainer(options = {}) {
    DOM.a4PrintContainer.innerHTML = '';
    const queue = getQueueItems();
    const cfg = State.config;
    const labelsPerSheet = cfg.columns * cfg.rows;
    // In thử bấm từ nút "In thử" chỉ áp dụng cho đúng lần in này, không đổi trạng thái chung
    const isTest = State.contentOptions.testMode || options.testMode === true;

    if (queue.length === 0 && !isTest) {
        showToast("Vui lòng chọn ít nhất 1 sản phẩm để in!", "error");
        return false;
    }

    const totalPages = State.previewTotalPages;
    let currentItemIndex = 0;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const printSheet = document.createElement('div');
        printSheet.className = 'a4-print-sheet';

        const startSkip = (pageNum === 1) ? Math.max(0, State.startPosition - 1) : 0;

        for (let slot = 0; slot < labelsPerSheet; slot++) {
            const row = Math.floor(slot / cfg.columns);
            const col = slot % cfg.columns;

            const posX = cfg.marginLeft + col * (cfg.labelWidth + cfg.gapX) + State.offsetX;
            const posY = cfg.marginTop + row * (cfg.labelHeight + cfg.gapY) + State.offsetY;

            let labelEl = null;

            if (slot < startSkip) {
                // Ô bỏ qua
                labelEl = createLabelElement(null, false, true);
            } else if (currentItemIndex < queue.length) {
                const prod = queue[currentItemIndex];
                labelEl = createLabelElement(prod, isTest, false);
                currentItemIndex++;
            } else if (isTest) {
                labelEl = createLabelElement({ name: 'TEM KIỂM TRA', barcode: '11111', price: 10000 }, true, false);
            }

            if (labelEl) {
                labelEl.style.left = `${posX}mm`;
                labelEl.style.top = `${posY}mm`;
                labelEl.style.width = `${cfg.labelWidth}mm`;
                labelEl.style.height = `${cfg.labelHeight}mm`;
                printSheet.appendChild(labelEl);
            }
        }

        DOM.a4PrintContainer.appendChild(printSheet);
    }

    return true;
}

// Mở hộp thoại in của TRÌNH DUYỆT bằng window.print().
// Trang web không thể (và không được) tự chọn máy in: người dùng chọn máy Canon
// ở mục "Máy in / Destination" trong hộp thoại. Nếu hộp thoại đang để
// "Save as PDF" thì đó là đích in mặc định của trình duyệt, không phải do code.
let isPrintPending = false;

async function triggerPrintDialog(options = {}) {
    if (isPrintPending) return;
    const ready = renderA4PrintContainer(options);
    if (!ready) return;

    isPrintPending = true;
    try {
        // Chờ font + SVG mã vạch dựng xong để bản in ổn định
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        await new Promise(resolve => setTimeout(resolve, 60));
        showToast('Trong hộp thoại in, hãy chọn máy in Canon ở mục "Máy in" (không chọn Save as PDF).', 'warning');
        window.print();
    } finally {
        isPrintPending = false;
    }
}

// 14. Xử lý cài đặt và lưu mẫu tem
function syncInputsWithConfig() {
    const cfg = State.config;
    DOM.cfgColumns.value = cfg.columns;
    DOM.cfgRows.value = cfg.rows;
    DOM.cfgLabelWidth.value = cfg.labelWidth;
    DOM.cfgLabelHeight.value = cfg.labelHeight;
    DOM.cfgMarginTop.value = cfg.marginTop;
    DOM.cfgMarginLeft.value = cfg.marginLeft;
    DOM.cfgGapX.value = cfg.gapX;
    DOM.cfgGapY.value = cfg.gapY;
    DOM.cfgStartPosition.value = State.startPosition;
    DOM.cfgOffsetX.value = State.offsetX;
    DOM.cfgOffsetY.value = State.offsetY;

    DOM.currentTemplateBadge.innerHTML = `<i class="fa-solid fa-tag"></i> Đang chọn: <strong>${cfg.name}</strong>`;
}

// Đọc số từ ô nhập; giữ nguyên giá trị 0 (lề = 0 là hợp lệ), chỉ dùng mặc định khi ô trống/không phải số
function numOr(value, fallback, { min = 0, integer = false } = {}) {
    const n = integer ? parseInt(value, 10) : parseFloat(value);
    return Number.isFinite(n) && n >= min ? n : fallback;
}

function readConfigFromInputs() {
    State.config.columns = numOr(DOM.cfgColumns.value, 5, { min: 1, integer: true });
    State.config.rows = numOr(DOM.cfgRows.value, 13, { min: 1, integer: true });
    State.config.labelWidth = numOr(DOM.cfgLabelWidth.value, 38, { min: 1 });
    State.config.labelHeight = numOr(DOM.cfgLabelHeight.value, 21, { min: 1 });
    State.config.marginTop = numOr(DOM.cfgMarginTop.value, 11.5);
    State.config.marginLeft = numOr(DOM.cfgMarginLeft.value, 8.0);
    State.config.gapX = numOr(DOM.cfgGapX.value, 0);
    State.config.gapY = numOr(DOM.cfgGapY.value, 0);

    State.startPosition = Math.max(1, parseInt(DOM.cfgStartPosition.value, 10) || 1);
    State.offsetX = parseFloat(DOM.cfgOffsetX.value) || 0;
    State.offsetY = parseFloat(DOM.cfgOffsetY.value) || 0;

    State.contentOptions.shopName = DOM.cfgShowShopName.checked;
    State.contentOptions.name = DOM.cfgShowName.checked;
    State.contentOptions.barcode = DOM.cfgShowBarcode.checked;
    State.contentOptions.codeText = DOM.cfgShowCodeText.checked;
    State.contentOptions.price = DOM.cfgShowPrice.checked;
    State.contentOptions.testMode = DOM.cfgTestMode.checked;

    updateStats();
    renderPreview();
}

function loadSavedCustomConfig() {
    try {
        const saved = localStorage.getItem('bear_pos_custom_decal_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            State.config = { ...parsed };
            DOM.templatePresetSelect.value = 'custom';
            syncInputsWithConfig();
        } else {
            syncInputsWithConfig();
        }
    } catch (e) {
        syncInputsWithConfig();
    }
}

function saveCustomConfig() {
    readConfigFromInputs();
    State.config.name = `Tùy chỉnh (${State.config.columns}x${State.config.rows} — ${State.config.labelWidth}x${State.config.labelHeight}mm)`;
    DOM.templatePresetSelect.value = 'custom';
    localStorage.setItem('bear_pos_custom_decal_config', JSON.stringify(State.config));
    syncInputsWithConfig();
    showToast("Đã lưu cấu hình mẫu tem tùy chỉnh thành công!");
}

// 15. Gắn sự kiện (Event Listeners)
function setupEventListeners() {
    // Topbar actions
    DOM.startPrintBtn.addEventListener('click', () => triggerPrintDialog());

    DOM.testPrintBtn.addEventListener('click', () => {
        triggerPrintDialog({ testMode: true });
    });

    DOM.printGuideBtn.addEventListener('click', () => {
        DOM.guideModalOverlay.classList.add('open');
    });

    DOM.guideModalCloseBtn.addEventListener('click', () => {
        DOM.guideModalOverlay.classList.remove('open');
    });

    DOM.guideCloseBtn.addEventListener('click', () => {
        DOM.guideModalOverlay.classList.remove('open');
    });

    DOM.guideTestPrintBtn.addEventListener('click', () => {
        DOM.guideModalOverlay.classList.remove('open');
        triggerPrintDialog({ testMode: true });
    });

    // Cấp mã hàng loạt
    if (DOM.bulkGenerateWarningBtn) {
        DOM.bulkGenerateWarningBtn.addEventListener('click', bulkAutoGenerateBarcodes);
    }

    // Search
    let searchDebounce = null;
    DOM.productSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            State.searchKeyword = e.target.value;
            renderProductTable();
        }, 200);
    });

    DOM.searchClearBtn.addEventListener('click', () => {
        DOM.productSearchInput.value = '';
        State.searchKeyword = '';
        renderProductTable();
    });

    // Filter tabs
    DOM.filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            DOM.filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            State.activeFilter = tab.dataset.filter;
            renderProductTable();
        });
    });

    // Select all checkbox
    DOM.selectAllCheckbox.addEventListener('change', (e) => {
        const filtered = getFilteredProducts();
        if (e.target.checked) {
            filtered.forEach(p => {
                State.selectedProductIds.add(p.id);
                if (!State.printQuantities[p.id] || State.printQuantities[p.id] === 0) {
                    State.printQuantities[p.id] = 1;
                }
            });
        } else {
            filtered.forEach(p => {
                State.selectedProductIds.delete(p.id);
            });
        }
        renderProductTable();
        updateStats();
        renderPreview();
    });

    // Áp dụng số lượng hàng loạt
    DOM.applyBatchQtyBtn.addEventListener('click', () => {
        const qty = parseInt(DOM.batchQtyInput.value, 10) || 1;
        State.selectedProductIds.forEach(id => {
            State.printQuantities[id] = qty;
        });
        renderProductTable();
        updateStats();
        renderPreview();
        showToast(`Đã đặt ${qty} tem cho tất cả ${State.selectedProductIds.size} sản phẩm đã chọn!`);
    });

    // In đầy 1 trang decal A4
    DOM.fillSheetBtn.addEventListener('click', () => {
        const labelsPerSheet = State.config.columns * State.config.rows;
        const selectedCount = State.selectedProductIds.size;
        if (selectedCount === 0) {
            showToast("Vui lòng tích chọn ít nhất một sản phẩm!", "warning");
            return;
        }

        const qtyPerItem = Math.max(1, Math.floor(labelsPerSheet / selectedCount));
        State.selectedProductIds.forEach(id => {
            State.printQuantities[id] = qtyPerItem;
        });
        renderProductTable();
        updateStats();
        renderPreview();
        showToast(`Đã chia đều ${labelsPerSheet} tem cho ${selectedCount} sản phẩm!`);
    });

    // In theo tồn kho
    DOM.fillByStockBtn.addEventListener('click', () => {
        if (State.selectedProductIds.size === 0) {
            showToast("Vui lòng tích chọn sản phẩm!", "warning");
            return;
        }
        State.selectedProductIds.forEach(id => {
            const p = State.allProducts.find(item => item.id === id);
            if (p) {
                State.printQuantities[id] = Math.max(1, p.quantity);
            }
        });
        renderProductTable();
        updateStats();
        renderPreview();
        showToast("Đã nạp số lượng in theo tồn kho thực tế của sản phẩm!");
    });

    // Xóa chọn
    DOM.clearSelectionBtn.addEventListener('click', () => {
        State.selectedProductIds.clear();
        State.printQuantities = {};
        DOM.selectAllCheckbox.checked = false;
        renderProductTable();
        updateStats();
        renderPreview();
    });

    // Toggle drawer cấu hình
    DOM.toggleConfigBtn.addEventListener('click', () => {
        DOM.configDrawer.classList.toggle('is-collapsed');
        const isCollapsed = DOM.configDrawer.classList.contains('is-collapsed');
        DOM.configChevron.className = isCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-down';
    });

    // Chọn Preset mẫu tem Phong Châu
    DOM.templatePresetSelect.addEventListener('change', (e) => {
        const key = e.target.value;
        if (DECAL_PRESETS[key]) {
            State.config = { ...DECAL_PRESETS[key] };
            syncInputsWithConfig();
            updateStats();
            renderPreview();
            showToast(`Đã chuyển sang mẫu ${State.config.name}`);
        }
    });

    // Thay đổi bất kỳ thông số nào trong form cấu hình
    const configInputs = [
        DOM.cfgColumns, DOM.cfgRows, DOM.cfgLabelWidth, DOM.cfgLabelHeight,
        DOM.cfgMarginTop, DOM.cfgMarginLeft, DOM.cfgGapX, DOM.cfgGapY,
        DOM.cfgStartPosition, DOM.cfgOffsetX, DOM.cfgOffsetY,
        DOM.cfgShowShopName, DOM.cfgShowName, DOM.cfgShowBarcode,
        DOM.cfgShowCodeText, DOM.cfgShowPrice, DOM.cfgTestMode
    ];
    configInputs.forEach(input => {
        input.addEventListener('input', readConfigFromInputs);
        input.addEventListener('change', readConfigFromInputs);
    });

    // Lưu & Reset cấu hình
    DOM.saveCustomPresetBtn.addEventListener('click', saveCustomConfig);
    DOM.resetPresetBtn.addEventListener('click', () => {
        localStorage.removeItem('bear_pos_custom_decal_config');
        State.config = { ...DECAL_PRESETS.pc_108 };
        State.startPosition = 1;
        State.offsetX = 0;
        State.offsetY = 0;
        DOM.templatePresetSelect.value = 'pc_108';
        syncInputsWithConfig();
        updateStats();
        renderPreview();
        showToast("Đã khôi phục thông số chuẩn Phong Châu số 108 (52 × 41 mm)!");
    });

    // Phân trang xem trước
    DOM.prevPageBtn.addEventListener('click', () => {
        if (State.previewPage > 1) {
            State.previewPage--;
            DOM.previewCurrentPage.textContent = State.previewPage;
            DOM.prevPageBtn.disabled = State.previewPage <= 1;
            DOM.nextPageBtn.disabled = State.previewPage >= State.previewTotalPages;
            renderPreview();
        }
    });

    DOM.nextPageBtn.addEventListener('click', () => {
        if (State.previewPage < State.previewTotalPages) {
            State.previewPage++;
            DOM.previewCurrentPage.textContent = State.previewPage;
            DOM.prevPageBtn.disabled = State.previewPage <= 1;
            DOM.nextPageBtn.disabled = State.previewPage >= State.previewTotalPages;
            renderPreview();
        }
    });

    DOM.showAllPagesToggle.addEventListener('change', (e) => {
        State.showAllPages = e.target.checked;
        renderPreview();
    });

    DOM.previewScaleSelect.addEventListener('change', applyPreviewZoom);
    window.addEventListener('resize', () => {
        if (DOM.previewScaleSelect.value === 'fit') {
            applyPreviewZoom();
        }
    });

    // Phím tắt Ctrl+P để mở in tem chuyên dụng
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            triggerPrintDialog();
        }
    });

    // Đăng xuất
    if (DOM.logoutBtn) {
        DOM.logoutBtn.addEventListener('click', () => {
            localStorage.removeItem("token");
            window.location.href = "login.html";
        });
    }
}

// 16. Khởi động trang
async function init() {
    loadSavedCustomConfig();
    setupEventListeners();

    // loadProducts() trả về true nếu cần mở hộp thoại in tự động (truy cập từ ?id=...)
    const shouldAutoPrint = await loadProducts();

    if (shouldAutoPrint) {
        // Chờ trình duyệt paint xong rồi mở hộp thoại in (dùng chung logic với nút IN TEM NGAY)
        setTimeout(() => triggerPrintDialog(), 200);
    }
}

init();