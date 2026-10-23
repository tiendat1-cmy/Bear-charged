'use strict';

// cấu hình api
const API_BASE_URL = "https://bear-charged.onrender.com";
const PRODUCTS_URL = `${API_BASE_URL}/api/products`;
const ORDERS_URL = `${API_BASE_URL}/api/orders`;

// kiểm tra đăng nhập
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = 'login.html';
}

// lấy các phần tử
const DOM = {
  // Quét mã vạch ZEBEX CCD
  barcodeScannerInput: document.getElementById('barcodeScannerInput'),
  barcodeClearButton: document.getElementById('barcodeClearButton'),
  scannerFocusPill: document.getElementById('scannerFocusPill'),

  // Trạng thái phần cứng & in
  printerStatusBadge: document.getElementById('printerStatusBadge'),
  quickReprintBtn: document.getElementById('quickReprintBtn'),

  //  tìm kiếm
  productSearchInput: document.getElementById('productSearchInput'),
  searchClearButton: document.getElementById('searchClearButton'),
  searchDropdown: document.getElementById('searchDropdown'),

  // danh sách sản phẩm
  productGrid: document.getElementById('productGrid'),
  productGridCount: document.getElementById('productGridCount'),

  // giỏ hàng
  cartList: document.getElementById('cartList'),
  cartEmptyState: document.getElementById('cartEmptyState'),
  cartClearButton: document.getElementById('cartClearButton'),

  // tính tiền
  summarySubtotal: document.getElementById('summarySubtotal'),
  summaryVat: document.getElementById('summaryVat'),
  summaryTotal: document.getElementById('summaryTotal'),
  discountInput: document.getElementById('discountInput'),
  discountTypeSelect: document.getElementById('discountTypeSelect'),
  vatPercentLabel: document.getElementById('vatPercentLabel'),

  // thanh toán
  customerPaidInput: document.getElementById('customerPaidInput'),
  paymentChangeDisplay: document.getElementById('paymentChangeDisplay'),
  paymentErrorMessage: document.getElementById('paymentErrorMessage'),
  paymentSubmitButton: document.getElementById('paymentSubmitButton'),

  // modal hóa đơn
  receiptModalOverlay: document.getElementById('receiptModalOverlay'),
  receiptCloseButton: document.getElementById('receiptCloseButton'),
  receiptCode: document.getElementById('receiptCode'),
  receiptDateTime: document.getElementById('receiptDateTime'),
  receiptItemsBody: document.getElementById('receiptItemsBody'),
  receiptSubtotal: document.getElementById('receiptSubtotal'),
  receiptDiscount: document.getElementById('receiptDiscount'),
  receiptVat: document.getElementById('receiptVat'),
  receiptTotal: document.getElementById('receiptTotal'),
  receiptPaid: document.getElementById('receiptPaid'),
  receiptChange: document.getElementById('receiptChange'),
  receiptPrintButton: document.getElementById('receiptPrintButton'),
  receiptAgentPrintButton: document.getElementById('receiptAgentPrintButton'),
  receiptReprintButton: document.getElementById('receiptReprintButton'),
  receiptNewOrderButton: document.getElementById('receiptNewOrderButton'),
  receiptPrintStatusBanner: document.getElementById('receiptPrintStatusBanner'),
  receiptPrintStatusText: document.getElementById('receiptPrintStatusText'),

  // QR trên hóa đơn (chỉ hiện khi thanh toán bằng QR)
  receiptQrSection: document.getElementById('receiptQrSection'),
  receiptQrImage: document.getElementById('receiptQrImage'),

  // header thống kê
  statTotalProducts: document.getElementById('statTotalProducts'),
  statCartItems: document.getElementById('statCartItems'),
  statCartTotal: document.getElementById('statCartTotal'),

  // Toast
  toastContainer: document.getElementById('toastContainer'),
};

// gọi api kèm token
async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
    return null;
  }

  const result = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = result.detail || result.message || 'Có lỗi xảy ra';
    throw new Error(msg);
  }

  return result.data !== undefined ? result.data : result;
}

const AppState = {
  productList: [],
  cartItemList: [],
  vatPercent: 8,
  highlightedDropdownIndex: -1,
  lastCreatedOrder: null,
  selectedPaymentMethod: 'CASH', // 'CASH' hoặc 'QR' — chọn trong modal thanh toán
  customerName: 'Khách lẻ',// tên khách nhập trong modal thanh toán
  customerPhone: '',
  printAgentUrl: 'http://127.0.0.1:18080',
  isPrintAgentReady: false,
  isScanningLocked: false,
  isSubmittingOrder: false,
};

// tải từ api
async function loadProductsFromApi() {
  try {
    const data = await apiRequest(`${PRODUCTS_URL}?page=1&page_size=500`);
    const items = data.items || [];
    AppState.productList = items.map((p) => ({
      id: p.id,
      barcode: p.barcode ? String(p.barcode).trim() : '',
      name: p.name,
      price: p.price,
      stock: p.quantity,
      image: p.image,
      icon: '📦',
      unit: 'sp',
    }));
  } catch (error) {
    console.error('Lỗi tải danh sách sản phẩm:', error);
    showToast('Không thể tải danh sách sản phẩm.', 'error');
    AppState.productList = [];
  }
}

// tìm kiếm
function removeVietnameseTones(inputText) {
  return inputText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function findMatchingProducts(keyword) {
  const normalizedKeyword = removeVietnameseTones(keyword);

  if (!normalizedKeyword) {
    return [];
  }

  return AppState.productList.filter((product) => {
    const normalizedName = removeVietnameseTones(product.name);
    return normalizedName.includes(normalizedKeyword);
  });
}

function highlightMatchedText(productName, keyword) {
  const normalizedName = removeVietnameseTones(productName);
  const normalizedKeyword = removeVietnameseTones(keyword);
  const matchIndex = normalizedName.indexOf(normalizedKeyword);

  if (matchIndex === -1 || !normalizedKeyword) {
    return escapeHtml(productName);
  }

  const beforeMatch = productName.slice(0, matchIndex);
  const matchedPart = productName.slice(matchIndex, matchIndex + normalizedKeyword.length);
  const afterMatch = productName.slice(matchIndex + normalizedKeyword.length);

  return `${escapeHtml(beforeMatch)}<mark>${escapeHtml(matchedPart)}</mark>${escapeHtml(afterMatch)}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderSearchDropdown(keyword) {
  const matchedProducts = findMatchingProducts(keyword);

  DOM.searchDropdown.innerHTML = '';
  AppState.highlightedDropdownIndex = -1;

  if (matchedProducts.length === 0) {
    DOM.searchDropdown.innerHTML = `
      <div class="search-dropdown-empty">
        Không tìm thấy sản phẩm phù hợp với "${escapeHtml(keyword)}"
      </div>
    `;
    openSearchDropdown();
    return;
  }

  matchedProducts.forEach((product) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'search-dropdown-item';
    itemElement.dataset.productId = product.id;

    const stockLabel = product.stock > 0
      ? `Còn ${product.stock} ${product.unit || ''}`
      : 'Hết hàng';

    itemElement.innerHTML = `
      <div class="search-dropdown-item-icon">${product.icon || '📦'}</div>
      <div class="search-dropdown-item-info">
        <div class="search-dropdown-item-name">${highlightMatchedText(product.name, keyword)}</div>
        <div class="search-dropdown-item-meta">${stockLabel}</div>
      </div>
      <div class="search-dropdown-item-price">${formatCurrencyVND(product.price)}</div>
    `;

    itemElement.addEventListener('click', () => {
      handleSelectProductFromSearch(product.id);
    });

    DOM.searchDropdown.appendChild(itemElement);
  });

  openSearchDropdown();
}

function openSearchDropdown() {
  DOM.searchDropdown.classList.add('is-open');
}

function closeSearchDropdown() {
  DOM.searchDropdown.classList.remove('is-open');
  AppState.highlightedDropdownIndex = -1;
}

function handleSelectProductFromSearch(productId) {
  const product = AppState.productList.find((item) => String(item.id) === String(productId));

  if (!product) {
    return;
  }

  if (product.stock <= 0) {
    showToast('Sản phẩm đã hết hàng, không thể thêm vào giỏ.', 'error');
    return;
  }

  addProductToCart(product);

  DOM.productSearchInput.value = '';
  DOM.searchClearButton.classList.remove('is-visible');
  closeSearchDropdown();
  DOM.productSearchInput.focus();
}

function handleSearchInputChange() {
  const keyword = DOM.productSearchInput.value;

  DOM.searchClearButton.classList.toggle('is-visible', keyword.length > 0);

  if (keyword.trim().length === 0) {
    closeSearchDropdown();
    return;
  }

  renderSearchDropdown(keyword);
}

function handleSearchInputKeyDown(event) {
  const dropdownItems = Array.from(DOM.searchDropdown.querySelectorAll('.search-dropdown-item'));

  if (!DOM.searchDropdown.classList.contains('is-open') || dropdownItems.length === 0) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    AppState.highlightedDropdownIndex = Math.min(
      AppState.highlightedDropdownIndex + 1,
      dropdownItems.length - 1
    );
    updateDropdownHighlight(dropdownItems);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    AppState.highlightedDropdownIndex = Math.max(AppState.highlightedDropdownIndex - 1, 0);
    updateDropdownHighlight(dropdownItems);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (AppState.highlightedDropdownIndex >= 0) {
      const selectedElement = dropdownItems[AppState.highlightedDropdownIndex];
      handleSelectProductFromSearch(selectedElement.dataset.productId);
    } else if (dropdownItems.length > 0) {
      handleSelectProductFromSearch(dropdownItems[0].dataset.productId);
    }
  } else if (event.key === 'Escape') {
    closeSearchDropdown();
  }
}

function updateDropdownHighlight(dropdownItems) {
  dropdownItems.forEach((item, index) => {
    item.classList.toggle('is-highlighted', index === AppState.highlightedDropdownIndex);
  });

  const highlightedItem = dropdownItems[AppState.highlightedDropdownIndex];
  if (highlightedItem) {
    highlightedItem.scrollIntoView({ block: 'nearest' });
  }
}

function handleClearSearchInput() {
  DOM.productSearchInput.value = '';
  DOM.searchClearButton.classList.remove('is-visible');
  closeSearchDropdown();
  DOM.productSearchInput.focus();
}

// hiện thị danh sách dưới dạng lưới
function renderProductGrid() {
  DOM.productGrid.innerHTML = '';

  AppState.productList.forEach((product) => {
    const isOutOfStock = product.stock <= 0;

    const cardElement = document.createElement('div');
    cardElement.className = `product-card${isOutOfStock ? ' is-out-of-stock' : ''}`;
    cardElement.dataset.productId = product.id;

    const imageContent = product.image
      ? `<img src="${product.image}" alt="${escapeHtml(product.name)}" />`
      : (product.icon || '📦');

    cardElement.innerHTML = `
      ${isOutOfStock ? '<span class="product-card-badge">Hết hàng</span>' : ''}
      <div class="product-card-image">${imageContent}</div>
      <div class="product-card-name">${escapeHtml(product.name)}</div>
      <div class="product-card-footer">
        <span class="product-card-price">${formatCurrencyVND(product.price)}</span>
        <span class="product-card-stock">Còn ${product.stock}</span>
      </div>
      <button type="button" class="product-card-add-button">+ Thêm vào giỏ</button>
    `;

    const addButton = cardElement.querySelector('.product-card-add-button');
    addButton.addEventListener('click', () => {
      if (isOutOfStock) {
        showToast('Sản phẩm đã hết hàng, không thể thêm vào giỏ.', 'error');
        return;
      }
      addProductToCart(product);
    });

    DOM.productGrid.appendChild(cardElement);
  });

  DOM.productGridCount.textContent = `${AppState.productList.length} sản phẩm`;
}

// ==== ÂM THANH PHẢN HỒI (WEB AUDIO API) ====
function playBeepSound(type = 'success') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Tiếng beep máy quét POS tiêu chuẩn: tần số 1400Hz, dài 70ms
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } else {
      // Tiếng cảnh báo lỗi: trầm và dài hơn
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // Không chặn luồng nếu trình duyệt chặn tự phát âm thanh
  }
}

// ==== XỬ LÝ MÃ VẠCH (ZEBEX CCD SCANNER) ====
async function handleBarcodeScan(rawBarcode) {
  const barcode = (rawBarcode || '').trim();
  if (!barcode) return;

  if (AppState.isScanningLocked) return;
  AppState.isScanningLocked = true;
  setTimeout(() => {
    AppState.isScanningLocked = false;
  }, 250);

  // 1. Tìm nhanh trong danh sách sản phẩm đã nạp ở client (khớp chính xác barcode dạng chuỗi)
  let product = AppState.productList.find(
    (item) => item.barcode && item.barcode.trim() === barcode
  );

  // 2. Nếu chưa có trong client (hoặc mới thêm trên hệ thống), gọi API tra cứu
  if (!product) {
    try {
      const apiProd = await apiRequest(`${PRODUCTS_URL}/barcode/${encodeURIComponent(barcode)}`);
      if (apiProd) {
        product = {
          id: apiProd.id,
          barcode: apiProd.barcode ? String(apiProd.barcode).trim() : '',
          name: apiProd.name,
          price: apiProd.price,
          stock: apiProd.quantity,
          image: apiProd.image,
          icon: '📦',
          unit: 'sp',
        };
        // Thêm vào danh sách client để lần sau tìm tức thì
        const existingIdx = AppState.productList.findIndex((p) => p.id === product.id);
        if (existingIdx >= 0) {
          AppState.productList[existingIdx] = product;
        } else {
          AppState.productList.unshift(product);
        }
        renderProductGrid();
      }
    } catch (err) {
      // Không tìm thấy qua API
    }
  }

  if (product) {
    if (product.stock <= 0) {
      playBeepSound('error');
      showToast(`Sản phẩm "${product.name}" đã hết hàng!`, 'error');
      if (DOM.barcodeScannerInput) {
        DOM.barcodeScannerInput.select();
      }
      return;
    }

    addProductToCart(product);
    playBeepSound('success');
    if (DOM.barcodeScannerInput) {
      DOM.barcodeScannerInput.value = '';
      DOM.barcodeScannerInput.focus();
    }
  } else {
    playBeepSound('error');
    showToast(`Không tìm thấy sản phẩm có mã vạch: "${barcode}"`, 'error');
    if (DOM.barcodeScannerInput) {
      DOM.barcodeScannerInput.select();
    }
  }
}

// Global sniffer cho máy quét ZEBEX (chế độ USB HID Keyboard)
let barcodeSnifferBuffer = '';
let lastSnifferKeyTime = 0;

function setupBarcodeScanner() {
  if (DOM.barcodeScannerInput) {
    DOM.barcodeScannerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleBarcodeScan(DOM.barcodeScannerInput.value);
      }
    });

    DOM.barcodeScannerInput.addEventListener('focus', () => {
      if (DOM.scannerFocusPill) {
        DOM.scannerFocusPill.style.display = 'inline-flex';
      }
    });
  }

  if (DOM.barcodeClearButton) {
    DOM.barcodeClearButton.addEventListener('click', () => {
      if (DOM.barcodeScannerInput) {
        DOM.barcodeScannerInput.value = '';
        DOM.barcodeScannerInput.focus();
      }
    });
  }

  // Phím tắt F2: Focus ngay về ô quét mã
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      if (DOM.barcodeScannerInput) {
        DOM.barcodeScannerInput.focus();
        DOM.barcodeScannerInput.select();
      }
    }
  });

  // Bắt luồng quét toàn cục nếu con trỏ không ở trong ô nhập liệu khác
  window.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const isOtherInput =
      active &&
      active !== DOM.barcodeScannerInput &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');

    if (isOtherInput) return;

    const now = Date.now();
    const diff = now - lastSnifferKeyTime;
    lastSnifferKeyTime = now;

    if (e.key === 'Enter') {
      if (barcodeSnifferBuffer.length >= 3) {
        e.preventDefault();
        const code = barcodeSnifferBuffer;
        barcodeSnifferBuffer = '';
        if (DOM.barcodeScannerInput) {
          DOM.barcodeScannerInput.value = code;
        }
        handleBarcodeScan(code);
      } else {
        barcodeSnifferBuffer = '';
      }
      return;
    }

    if (e.key.length === 1) {
      if (diff > 80) {
        barcodeSnifferBuffer = e.key;
      } else {
        barcodeSnifferBuffer += e.key;
      }
    }
  });
}

function addProductToCart(product) {
  const existingCartItem = AppState.cartItemList.find((item) => item.id === product.id);

  if (existingCartItem) {
    if (existingCartItem.quantity + 1 > product.stock) {
      showToast(`Chỉ còn ${product.stock} sản phẩm "${product.name}" trong kho.`, 'error');
      return;
    }
    existingCartItem.quantity += 1;
  } else {
    AppState.cartItemList.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      icon: product.icon,
      unit: product.unit,
      quantity: 1,
    });
  }

  showToast(`Đã thêm "${product.name}" vào giỏ hàng.`, 'success');
  renderCart();
  updatePaymentValidation();
}

function increaseCartItemQuantity(productId) {
  const cartItem = AppState.cartItemList.find((item) => item.id === productId);
  const product = AppState.productList.find((item) => item.id === productId);

  if (!cartItem || !product) {
    return;
  }

  if (cartItem.quantity + 1 > product.stock) {
    showToast(`Chỉ còn ${product.stock} sản phẩm "${product.name}" trong kho.`, 'error');
    return;
  }

  cartItem.quantity += 1;
  renderCart();
  updatePaymentValidation();
}

function decreaseCartItemQuantity(productId) {
  const cartItem = AppState.cartItemList.find((item) => item.id === productId);

  if (!cartItem) {
    return;
  }

  cartItem.quantity -= 1;

  if (cartItem.quantity <= 0) {
    removeCartItem(productId);
    return;
  }

  renderCart();
  updatePaymentValidation();
}

function removeCartItem(productId) {
  AppState.cartItemList = AppState.cartItemList.filter((item) => item.id !== productId);
  renderCart();
  updatePaymentValidation();
}

function clearCart() {
  if (AppState.cartItemList.length === 0) {
    return;
  }

  const isConfirmed = window.confirm('Bạn có chắc muốn xóa toàn bộ sản phẩm trong giỏ hàng?');
  if (!isConfirmed) {
    return;
  }

  AppState.cartItemList = [];
  renderCart();
  updatePaymentValidation();
  showToast('Đã xóa toàn bộ giỏ hàng.', 'success');
}

function renderCart() {
  DOM.cartList.innerHTML = '';

  const isCartEmpty = AppState.cartItemList.length === 0;
  DOM.cartEmptyState.classList.toggle('is-visible', isCartEmpty);
  DOM.cartList.style.display = isCartEmpty ? 'none' : 'flex';

  AppState.cartItemList.forEach((cartItem) => {
    const itemSubtotal = cartItem.price * cartItem.quantity;

    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item';
    itemElement.dataset.productId = cartItem.id;

    const imageContent = cartItem.image
      ? `<img src="${cartItem.image}" alt="${escapeHtml(cartItem.name)}" />`
      : (cartItem.icon || '📦');

    itemElement.innerHTML = `
      <div class="cart-item-image">${imageContent}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(cartItem.name)}</div>
        <div class="cart-item-unit-price">${formatCurrencyVND(cartItem.price)} / ${cartItem.unit || 'sp'}</div>
      </div>
      <div class="cart-item-quantity-control">
        <button type="button" class="cart-item-quantity-button" data-action="decrease">-</button>
        <span class="cart-item-quantity-value">${cartItem.quantity}</span>
        <button type="button" class="cart-item-quantity-button" data-action="increase">+</button>
      </div>
      <div class="cart-item-subtotal">${formatCurrencyVND(itemSubtotal)}</div>
      <button type="button" class="cart-item-remove-button" title="Xóa sản phẩm">🗑️</button>
    `;

    itemElement
      .querySelector('[data-action="decrease"]')
      .addEventListener('click', () => decreaseCartItemQuantity(cartItem.id));

    itemElement
      .querySelector('[data-action="increase"]')
      .addEventListener('click', () => increaseCartItemQuantity(cartItem.id));

    itemElement
      .querySelector('.cart-item-remove-button')
      .addEventListener('click', () => removeCartItem(cartItem.id));

    DOM.cartList.appendChild(itemElement);
  });

  updateCartSummary();
  updateHeaderStatistics();
}

function calculateSubtotal() {
  return AppState.cartItemList.reduce((total, item) => total + item.price * item.quantity, 0);
}

function calculateDiscountAmount(subtotal) {
  const discountValue = Number(DOM.discountInput.value) || 0;
  const discountType = DOM.discountTypeSelect.value;

  if (discountValue <= 0) {
    return 0;
  }

  let discountAmount = discountType === 'percent'
    ? (subtotal * discountValue) / 100
    : discountValue;

  if (discountAmount > subtotal) {
    discountAmount = subtotal;
  }

  return discountAmount;
}

function calculateVatAmount(amountAfterDiscount) {
  return (amountAfterDiscount * AppState.vatPercent) / 100;
}

function calculateOrderTotals() {
  const subtotal = calculateSubtotal();
  const discountAmount = calculateDiscountAmount(subtotal);
  const amountAfterDiscount = subtotal - discountAmount;
  const vatAmount = calculateVatAmount(amountAfterDiscount);
  const grandTotal = amountAfterDiscount + vatAmount;

  return { subtotal, discountAmount, vatAmount, grandTotal };
}

function updateCartSummary() {
  const totals = calculateOrderTotals();

  DOM.summarySubtotal.textContent = formatCurrencyVND(totals.subtotal);
  DOM.summaryVat.textContent = formatCurrencyVND(totals.vatAmount);
  DOM.summaryTotal.textContent = formatCurrencyVND(totals.grandTotal);
  DOM.vatPercentLabel.textContent = AppState.vatPercent;

  updatePaymentChange();
}

function parseCustomerPaidAmount() {
  const rawValue = DOM.customerPaidInput.value.replace(/[^\d]/g, '');
  return rawValue ? Number(rawValue) : 0;
}

function handleCustomerPaidInputChange() {
  const numericValue = parseCustomerPaidAmount();

  if (numericValue > 0) {
    DOM.customerPaidInput.value = numericValue.toLocaleString('vi-VN');
  } else {
    DOM.customerPaidInput.value = '';
  }

  updatePaymentChange();
  updatePaymentValidation();
}

function updatePaymentChange() {
  const totals = calculateOrderTotals();
  const customerPaidAmount = parseCustomerPaidAmount();
  const changeAmount = customerPaidAmount - totals.grandTotal;

  DOM.paymentChangeDisplay.textContent = formatCurrencyVND(Math.max(changeAmount, 0));
  DOM.paymentChangeDisplay.classList.toggle('is-negative', changeAmount < 0);
}

// Chỉ khóa nút "Thanh toán" khi giỏ hàng trống — không khóa theo tiền khách
// đưa nữa, vì luồng QR cần mở modal trước khi biết khách trả bằng gì.
function updatePaymentValidation() {
  const totals = calculateOrderTotals();
  const customerPaidAmount = parseCustomerPaidAmount();
  const isCartEmpty = AppState.cartItemList.length === 0;

  let errorMessage = '';
  if (!isCartEmpty && customerPaidAmount > 0 && customerPaidAmount < totals.grandTotal) {
    errorMessage = 'Số tiền khách đưa không đủ để thanh toán đơn hàng.';
  }
  DOM.paymentErrorMessage.textContent = errorMessage;
  DOM.paymentErrorMessage.classList.toggle('is-visible', errorMessage.length > 0);

  DOM.paymentSubmitButton.disabled = isCartEmpty || totals.grandTotal <= 0;
}

// ==== THANH TOÁN — GỌI API TẠO ĐƠN HÀNG THẬT ====
async function handleSubmitPayment() {
  const totals = calculateOrderTotals();
  const customerPaidAmount = parseCustomerPaidAmount();

  if (AppState.cartItemList.length === 0) {
    showToast('Giỏ hàng đang trống, không thể thanh toán.', 'error');
    return;
  }

  if (customerPaidAmount < totals.grandTotal) {
    showToast('Số tiền khách đưa không đủ để thanh toán.', 'error');
    return;
  }

  const outOfStockItem = AppState.cartItemList.find((cartItem) => {
    const product = AppState.productList.find((item) => item.id === cartItem.id);
    return !product || product.stock < cartItem.quantity;
  });

  if (outOfStockItem) {
    showToast(`Sản phẩm "${outOfStockItem.name}" không đủ tồn kho để bán.`, 'error');
    return;
  }

  // Chống nhấn thanh toán nhiều lần
  if (AppState.isSubmittingOrder) {
    return;
  }
  AppState.isSubmittingOrder = true;
  DOM.paymentSubmitButton.disabled = true;
  DOM.paymentSubmitButton.textContent = 'Đang xử lý đơn...';

  const payload = {
    customer_id: null,
    customer_name: AppState.customerName,
    customer_phone: AppState.customerPhone || null,
    payment_method: AppState.selectedPaymentMethod === 'QR' ? 'Chuyển khoản QR' : 'Tiền mặt',
    items: AppState.cartItemList.map((item) => ({
      product_id: item.id,
      quantity: item.quantity,
    })),
    discount_type: DOM.discountTypeSelect.value,
    discount_value: Number(DOM.discountInput.value) || 0,
    vat_percent: AppState.vatPercent,
  };

  try {
    const createdOrder = await apiRequest(ORDERS_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const changeAmount = customerPaidAmount - createdOrder.total;

    createdOrder.customerPaidAmount = customerPaidAmount;
    createdOrder.changeAmount = changeAmount;

    AppState.lastCreatedOrder = createdOrder;

    // Cập nhật nút in lại nhanh trên thanh topbar
    if (DOM.quickReprintBtn) {
      DOM.quickReprintBtn.style.display = 'inline-flex';
    }

    await loadProductsFromApi();
    renderProductGrid();

    showReceiptModal(createdOrder);
    resetOrderAfterPayment();
    showToast(`Thanh toán thành công! Mã hóa đơn ${createdOrder.code}.`, 'success');

    // Nếu Print Agent đang sẵn sàng, tự động in hóa đơn nhiệt ngay!
    if (AppState.isPrintAgentReady) {
      printThermalReceipt(createdOrder, false);
    }
  } catch (error) {
    console.error('Lỗi tạo đơn hàng:', error);
    showToast(error.message || 'Không thể tạo đơn hàng, vui lòng thử lại.', 'error');
  } finally {
    AppState.isSubmittingOrder = false;
    DOM.paymentSubmitButton.textContent = 'Thanh toán';
    updatePaymentValidation();
  }
}

function resetOrderAfterPayment() {
  AppState.cartItemList = [];
  AppState.selectedPaymentMethod = 'CASH';
  AppState.customerName = 'Khách lẻ';
  AppState.customerPhone = '';
  DOM.discountInput.value = 0;
  DOM.customerPaidInput.value = '';
  renderCart();
  updatePaymentValidation();
}

function formatDateTimeVietnamese(isoDateString) {
  const dateObject = new Date(isoDateString);

  const hours = String(dateObject.getHours()).padStart(2, '0');
  const minutes = String(dateObject.getMinutes()).padStart(2, '0');
  const seconds = String(dateObject.getSeconds()).padStart(2, '0');

  const day = String(dateObject.getDate()).padStart(2, '0');
  const month = String(dateObject.getMonth() + 1).padStart(2, '0');
  const year = dateObject.getFullYear();

  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

// ==== IN HÓA ĐƠN VÀ PRINT AGENT ====
async function checkPrintAgentStatus() {
  if (!DOM.printerStatusBadge) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${AppState.printAgentUrl}/status`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      AppState.isPrintAgentReady = true;
      const printerName = data.printer_name || 'Sẵn sàng (ESC/POS)';
      DOM.printerStatusBadge.textContent = printerName;
      DOM.printerStatusBadge.className = 'hw-badge hw-badge-ok';
      return;
    }
  } catch (e) {
    // Agent chưa chạy
  }

  AppState.isPrintAgentReady = false;
  DOM.printerStatusBadge.textContent = 'In trình duyệt (HTML/CSS)';
  DOM.printerStatusBadge.className = 'hw-badge hw-badge-neutral';
}

function setPrintStatusBanner(message, type = 'info') {
  if (!DOM.receiptPrintStatusBanner || !DOM.receiptPrintStatusText) return;
  DOM.receiptPrintStatusBanner.style.display = 'flex';
  DOM.receiptPrintStatusBanner.className = `receipt-print-status-banner is-${type}`;
  DOM.receiptPrintStatusText.textContent = message;
}

async function printThermalReceipt(order, isReprint = false) {
  if (!order) {
    showToast('Không có dữ liệu hóa đơn để in.', 'error');
    return false;
  }

  setPrintStatusBanner(
    isReprint ? 'Đang gửi lệnh in lại...' : 'Đang gửi lệnh in tới máy in nhiệt...',
    'info'
  );

  const printPayload = {
    order_id: order.id,
    code: order.code,
    created_at: order.created_at,
    customer_fullname: order.customer_fullname || 'Khách lẻ',
    payment_method: order.payment_method || 'Tiền mặt',
    subtotal: order.subtotal,
    discount_amount: order.discount_amount || 0,
    vat_amount: order.vat_amount || 0,
    total: order.total,
    customer_paid: order.customerPaidAmount || order.total,
    change_amount: order.changeAmount || 0,
    is_reprint: isReprint,
    items: (order.order_details || []).map((detail) => {
      const prod = AppState.productList.find((p) => p.id === detail.product_id);
      return {
        product_id: detail.product_id,
        name: detail.product_name || (prod ? prod.name : `#${detail.product_id}`),
        barcode: detail.product_barcode || (prod ? prod.barcode : ''),
        quantity: detail.quantity,
        price: detail.price,
        subtotal: detail.price * detail.quantity,
      };
    }),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${AppState.printAgentUrl}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(printPayload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      setPrintStatusBanner(
        isReprint ? '✅ Đã in lại hóa đơn thành công!' : '✅ Đã in hóa đơn ra máy in nhiệt thành công!',
        'success'
      );
      showToast(isReprint ? 'In lại thành công!' : 'In hóa đơn thành công!', 'success');
      return true;
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || errData.message || 'Lỗi gửi lệnh in');
    }
  } catch (err) {
    console.warn('Lỗi Print Agent:', err);
    setPrintStatusBanner(
      '⚠️ Không thể kết nối Print Agent. Hãy kiểm tra Print Agent hoặc bấm "In trình duyệt" để in.',
      'error'
    );
    showToast('Máy in nhiệt chưa kết nối. Có thể in qua trình duyệt.', 'error');
    return false;
  }
}

// hiển thị hóa đơn — dùng dữ liệu thật trả về từ API
function showReceiptModal(order, isReprint = false) {
  DOM.receiptCode.textContent = order.code;
  DOM.receiptDateTime.textContent = formatDateTimeVietnamese(order.created_at);

  if (DOM.receiptPrintStatusBanner) {
    DOM.receiptPrintStatusBanner.style.display = 'none';
  }

  DOM.receiptItemsBody.innerHTML = '';
  (order.order_details || []).forEach((detail) => {
    const product = AppState.productList.find((p) => p.id === detail.product_id);
    const productName = detail.product_name || (product ? product.name : `#${detail.product_id}`);
    const barcodeText = detail.product_barcode || (product && product.barcode ? ` (${product.barcode})` : '');
    const lineSubtotal = detail.price * detail.quantity;

    const rowElement = document.createElement('tr');
    rowElement.innerHTML = `
      <td>${escapeHtml(productName)}${barcodeText ? `<small style="display:block;color:#64748b;font-size:10px;">${escapeHtml(barcodeText)}</small>` : ''}</td>
      <td>${detail.quantity}</td>
      <td>${formatCurrencyVND(detail.price)}</td>
      <td>${formatCurrencyVND(lineSubtotal)}</td>
    `;
    DOM.receiptItemsBody.appendChild(rowElement);
  });

  DOM.receiptSubtotal.textContent = formatCurrencyVND(order.subtotal);
  DOM.receiptDiscount.textContent = formatCurrencyVND(order.discount_amount);
  DOM.receiptVat.textContent = formatCurrencyVND(order.vat_amount);
  DOM.receiptTotal.textContent = formatCurrencyVND(order.total);
  DOM.receiptPaid.textContent = formatCurrencyVND(order.customerPaidAmount || order.total);
  DOM.receiptChange.textContent = formatCurrencyVND(order.changeAmount || 0);

  // Chỉ hiện QR trên hóa đơn (và khi in) nếu khách chọn thanh toán QR
  if (AppState.selectedPaymentMethod === 'QR' && DOM.receiptQrSection && DOM.receiptQrImage) {
    DOM.receiptQrImage.src = generateVietQR(order.total, order.code);
    DOM.receiptQrSection.classList.add('is-visible');
  } else if (DOM.receiptQrSection) {
    DOM.receiptQrSection.classList.remove('is-visible');
  }

  DOM.receiptModalOverlay.classList.add('is-open');
}

function closeReceiptModal() {
  DOM.receiptModalOverlay.classList.remove('is-open');
  if (DOM.barcodeScannerInput) {
    DOM.barcodeScannerInput.focus();
  }
}

function handleStartNewOrder() {
  closeReceiptModal();
  if (DOM.barcodeScannerInput) {
    DOM.barcodeScannerInput.focus();
  } else {
    DOM.productSearchInput.focus();
  }
}

function handlePrintReceipt() {
  window.print();
}

function handleAgentPrintReceipt() {
  if (AppState.lastCreatedOrder) {
    printThermalReceipt(AppState.lastCreatedOrder, false);
  } else {
    showToast('Chưa có hóa đơn nào để in.', 'error');
  }
}

function handleReprintReceipt() {
  if (AppState.lastCreatedOrder) {
    printThermalReceipt(AppState.lastCreatedOrder, true);
  } else {
    showToast('Chưa có hóa đơn nào để in lại.', 'error');
  }
}

function handleQuickReprint() {
  if (AppState.lastCreatedOrder) {
    showReceiptModal(AppState.lastCreatedOrder, true);
  } else {
    showToast('Chưa có hóa đơn nào được tạo trong phiên này.', 'error');
  }
}

function showToast(message, type = 'success') {
  const toastElement = document.createElement('div');
  toastElement.className = `toast toast--${type}`;
  toastElement.innerHTML = `
    <span>${type === 'success' ? '✅' : '⚠️'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  DOM.toastContainer.appendChild(toastElement);

  window.setTimeout(() => {
    toastElement.classList.add('is-leaving');
    window.setTimeout(() => {
      toastElement.remove();
    }, 200);
  }, 2600);
}

function updateHeaderStatistics() {
  const totals = calculateOrderTotals();

  DOM.statTotalProducts.textContent = AppState.productList.length;
  DOM.statCartItems.textContent = AppState.cartItemList.length;
  DOM.statCartTotal.textContent = formatCurrencyVND(totals.grandTotal);
}

function formatCurrencyVND(amount) {
  const roundedAmount = Math.round(amount || 0);
  return `${roundedAmount.toLocaleString('vi-VN')}đ`;
}

function registerAllEventListeners() {
  // tìm kiếm
  DOM.productSearchInput.addEventListener('input', handleSearchInputChange);
  DOM.productSearchInput.addEventListener('keydown', handleSearchInputKeyDown);
  DOM.productSearchInput.addEventListener('focus', () => {
    if (DOM.productSearchInput.value.trim().length > 0) {
      renderSearchDropdown(DOM.productSearchInput.value);
    }
  });

  DOM.searchClearButton.addEventListener('click', handleClearSearchInput);

  document.addEventListener('click', (event) => {
    const isClickInsideSearch = event.target.closest('.search-box-wrapper');
    if (!isClickInsideSearch) {
      closeSearchDropdown();
    }
  });

  // giỏ hàng và tính tiền
  DOM.cartClearButton.addEventListener('click', clearCart);
  DOM.discountInput.addEventListener('input', () => {
    if (Number(DOM.discountInput.value) < 0) {
      DOM.discountInput.value = 0;
    }
    updateCartSummary();
    updatePaymentValidation();
  });

  DOM.discountTypeSelect.addEventListener('change', () => {
    updateCartSummary();
    updatePaymentValidation();
  });

  // thanh toán — bấm nút chỉ MỞ MODAL chọn CASH/QR, chưa gọi API ngay
  DOM.customerPaidInput.addEventListener('input', handleCustomerPaidInputChange);
  DOM.paymentSubmitButton.addEventListener('click', () => {
    document.getElementById('paymentModal').style.display = 'flex';
  });
  DOM.receiptCloseButton.addEventListener('click', closeReceiptModal);

  DOM.receiptNewOrderButton.addEventListener('click', handleStartNewOrder);
  // in hóa đơn & máy in nhiệt
  if (DOM.receiptPrintButton) {
    DOM.receiptPrintButton.addEventListener('click', handlePrintReceipt);
  }
  if (DOM.receiptAgentPrintButton) {
    DOM.receiptAgentPrintButton.addEventListener('click', handleAgentPrintReceipt);
  }
  if (DOM.receiptReprintButton) {
    DOM.receiptReprintButton.addEventListener('click', handleReprintReceipt);
  }
  if (DOM.quickReprintBtn) {
    DOM.quickReprintBtn.addEventListener('click', handleQuickReprint);
  }

  DOM.receiptModalOverlay.addEventListener('click', (event) => {
    if (event.target === DOM.receiptModalOverlay) {
      closeReceiptModal();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && DOM.receiptModalOverlay.classList.contains('is-open')) {
      closeReceiptModal();
    }
  });

  // đăng xuất
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      window.location.href = 'login.html';
    });
  }
}

async function initializeApplication() {
  await loadProductsFromApi();
  renderProductGrid();
  renderCart();
  updateHeaderStatistics();
  updatePaymentValidation();

  setupBarcodeScanner();
  registerAllEventListeners();
  await checkPrintAgentStatus();

  // Kiểm tra trạng thái máy in định kỳ mỗi 15 giây
  window.setInterval(checkPrintAgentStatus, 15000);

  // Tự động focus vào ô quét mã vạch khi mở màn hình POS
  if (DOM.barcodeScannerInput) {
    DOM.barcodeScannerInput.focus();
  }
}
document.addEventListener('DOMContentLoaded', initializeApplication);


// ==== QR THANH TOÁN ====
function generateVietQR(totalAmount, orderCode) {

    const BANK_ID = "970446";
    const ACCOUNT_NO = "3300300975136618";
    const ACCOUNT_NAME = "NGUYEN THI HANH";

    const addInfo = encodeURIComponent(`BearCharged ${orderCode}`);

    const qrUrl =
        `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png` +
        `?amount=${totalAmount}` +
        `&addInfo=${addInfo}` +
        `&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

    return qrUrl;
}

// Modal chọn CASH/QR — đổi phương thức thì hiện/ẩn QR preview
function togglePaymentMethod() {
  const method = document.getElementById('paymentMethod').value;
  const qrContainer = document.getElementById('qrContainer');

  if (method === 'QR') {
    qrContainer.style.display = 'block';
    const totals = calculateOrderTotals();
    const tempCode = 'DH' + Math.floor(1000 + Math.random() * 9000);
    document.getElementById('qrImage').src = generateVietQR(totals.grandTotal, tempCode);
    document.getElementById('qrAmountText').innerText = 'Số tiền: ' + formatCurrencyVND(totals.grandTotal);
  } else {
    qrContainer.style.display = 'none';
  }
}

function closePaymentModal() {
  document.getElementById('paymentModal').style.display = 'none';
}

// Xác nhận trong modal thanh toán → đọc tên khách + phương thức, rồi mới
// gọi API tạo đơn thật qua handleSubmitPayment()
async function submitOrderFinal() {
  const method = document.getElementById('paymentMethod').value;
  const totals = calculateOrderTotals();
  const customerName = document.getElementById('modalCustomerName').value.trim() || 'Khách lẻ';
  const customerPhone = document.getElementById('modalCustomerPhone').value.trim();

  AppState.selectedPaymentMethod = method;
  AppState.customerName = customerName;
  AppState.customerPhone = customerPhone; 

  if (method === 'CASH') {
    const paid = parseCustomerPaidAmount();
    if (paid < totals.grandTotal) {
      showToast('Vui lòng nhập đủ số tiền khách đưa (tiền mặt) trước khi xác nhận.', 'error');
      return;
    }
  } else {
    // QR: khách chuyển khoản đúng tổng tiền, tự điền vào ô để handleSubmitPayment không chặn
    DOM.customerPaidInput.value = totals.grandTotal.toLocaleString('vi-VN');
  }

  await handleSubmitPayment();
  closePaymentModal();
}