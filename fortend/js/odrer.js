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
  receiptNewOrderButton: document.getElementById('receiptNewOrderButton'),

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
};

// tải từ api
// Map field backend (quantity) -> field nội bộ (stock) để không phải sửa lại
// toàn bộ logic hiển thị/giỏ hàng bên dưới. icon/unit backend không có,
// dùng giá trị mặc định.
async function loadProductsFromApi() {
  try {
    const data = await apiRequest(`${PRODUCTS_URL}?page=1&page_size=100`);
    const items = data.items || [];
    AppState.productList = items.map((p) => ({
      id: p.id,
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

// tìm sản phẩm khớp với tên nhất
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

// cập nhật hiệu ứng
function updateDropdownHighlight(dropdownItems) {
  dropdownItems.forEach((item, index) => {
    item.classList.toggle('is-highlighted', index === AppState.highlightedDropdownIndex);
  });

  const highlightedItem = dropdownItems[AppState.highlightedDropdownIndex];
  if (highlightedItem) {
    highlightedItem.scrollIntoView({ block: 'nearest' });
  }
}

// xóa toàn bộ nội dung tìm kiếm
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

// thêm sản phẩm nếu tồn tại chỉ tăng số lượng
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

// tăng số lượng giỏ hàng lên 1
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

// giảm số lượng nếu số lượng về 0 tự động xóa
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

// xóa sản phẩm khỏi giỏ hàng
function removeCartItem(productId) {
  AppState.cartItemList = AppState.cartItemList.filter((item) => item.id !== productId);
  renderCart();
  updatePaymentValidation();
}

// xóa toàn bộ sản phẩm khỏi giỏ hàng
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

// danh sách sản phẩm giỏ hàng
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

// giá vat
function calculateSubtotal() {
  return AppState.cartItemList.reduce((total, item) => total + item.price * item.quantity, 0);
}

// tính số tiền giảm giá
function calculateDiscountAmount(subtotal) {
  const discountValue = Number(DOM.discountInput.value) || 0;
  const discountType = DOM.discountTypeSelect.value;

  if (discountValue <= 0) {
    return 0;
  }

  let discountAmount = discountType === 'percent'
    ? (subtotal * discountValue) / 100
    : discountValue;

  // Không cho phép số tiền giảm giá vượt quá tạm tính
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

// cập nhật tỉ lệ tính tiền thừa
function updatePaymentChange() {
  const totals = calculateOrderTotals();
  const customerPaidAmount = parseCustomerPaidAmount();
  const changeAmount = customerPaidAmount - totals.grandTotal;

  DOM.paymentChangeDisplay.textContent = formatCurrencyVND(Math.max(changeAmount, 0));
  DOM.paymentChangeDisplay.classList.toggle('is-negative', changeAmount < 0);
}

function updatePaymentValidation() {
  const totals = calculateOrderTotals();
  const customerPaidAmount = parseCustomerPaidAmount();
  const isCartEmpty = AppState.cartItemList.length === 0;

  let errorMessage = '';

  if (isCartEmpty) {
    errorMessage = '';
  } else if (customerPaidAmount === 0) {
    errorMessage = '';
  } else if (customerPaidAmount < totals.grandTotal) {
    errorMessage = 'Số tiền khách đưa không đủ để thanh toán đơn hàng.';
  }

  DOM.paymentErrorMessage.textContent = errorMessage;
  DOM.paymentErrorMessage.classList.toggle('is-visible', errorMessage.length > 0);

  const isPaymentValid = !isCartEmpty
    && totals.grandTotal > 0
    && customerPaidAmount >= totals.grandTotal;

  DOM.paymentSubmitButton.disabled = !isPaymentValid;
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

  // Kiểm tra lại tồn kho lần cuối (kiểm tra client, backend cũng sẽ tự kiểm tra lại)
  const outOfStockItem = AppState.cartItemList.find((cartItem) => {
    const product = AppState.productList.find((item) => item.id === cartItem.id);
    return !product || product.stock < cartItem.quantity;
  });

  if (outOfStockItem) {
    showToast(`Sản phẩm "${outOfStockItem.name}" không đủ tồn kho để bán.`, 'error');
    return;
  }

  const payload = {
    customer_id: null, // Khách lẻ
    payment_method: 'Tiền mặt',
    items: AppState.cartItemList.map((item) => ({
      product_id: item.id,
      quantity: item.quantity,
    })),
    discount_type: DOM.discountTypeSelect.value, // 'percent' hoặc 'amount' — khớp sẵn với enum backend
    discount_value: Number(DOM.discountInput.value) || 0,
    vat_percent: AppState.vatPercent,
  };

  DOM.paymentSubmitButton.disabled = true;

  try {
    const createdOrder = await apiRequest(ORDERS_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const changeAmount = customerPaidAmount - createdOrder.total;

    // Gắn thêm 2 field chỉ dùng để in hóa đơn (không có trong response backend)
    createdOrder.customerPaidAmount = customerPaidAmount;
    createdOrder.changeAmount = changeAmount;

    AppState.lastCreatedOrder = createdOrder;

    // Tải lại danh sách sản phẩm để cập nhật tồn kho mới nhất từ server
    await loadProductsFromApi();
    renderProductGrid();

    showReceiptModal(createdOrder);
    resetOrderAfterPayment();
    showToast(`Thanh toán thành công! Mã hóa đơn ${createdOrder.code}.`, 'success');
  } catch (error) {
    console.error('Lỗi tạo đơn hàng:', error);
    showToast(error.message || 'Không thể tạo đơn hàng, vui lòng thử lại.', 'error');
  } finally {
    updatePaymentValidation();
  }
}

function resetOrderAfterPayment() {
  AppState.cartItemList = [];
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

// hiển thị hóa đơn — dùng dữ liệu thật trả về từ API (order_details chỉ có
// product_id/quantity/price, cần tra lại tên sản phẩm từ AppState.productList)
function showReceiptModal(order) {
  DOM.receiptCode.textContent = order.code;
  DOM.receiptDateTime.textContent = formatDateTimeVietnamese(order.created_at);

  DOM.receiptItemsBody.innerHTML = '';
  (order.order_details || []).forEach((detail) => {
    const product = AppState.productList.find((p) => p.id === detail.product_id);
    const productName = product ? product.name : `#${detail.product_id}`;
    const lineSubtotal = detail.price * detail.quantity;

    const rowElement = document.createElement('tr');
    rowElement.innerHTML = `
      <td>${escapeHtml(productName)}</td>
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
  DOM.receiptPaid.textContent = formatCurrencyVND(order.customerPaidAmount);
  DOM.receiptChange.textContent = formatCurrencyVND(order.changeAmount);

  DOM.receiptModalOverlay.classList.add('is-open');
}

function closeReceiptModal() {
  DOM.receiptModalOverlay.classList.remove('is-open');
}

function handleStartNewOrder() {
  closeReceiptModal();
  DOM.productSearchInput.focus();
}

// in hóa đơn
function handlePrintReceipt() {
  window.print();
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

  // Đóng dropdown khi click ra ngoài vùng tìm kiếm
  document.addEventListener('click', (event) => {
    const isClickInsideSearch = event.target.closest('.search-box-wrapper');
    if (!isClickInsideSearch) {
      closeSearchDropdown();
    }
  });

  // giỏ hàng và tính tiền
  DOM.cartClearButton.addEventListener('click', clearCart);
  DOM.discountInput.addEventListener('input', () => {
    // Không cho phép nhập số âm
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

  // thanh toán
  DOM.customerPaidInput.addEventListener('input', handleCustomerPaidInputChange);
  DOM.paymentSubmitButton.addEventListener('click', handleSubmitPayment);
  DOM.receiptCloseButton.addEventListener('click', closeReceiptModal);
  // hóa đơn
  DOM.receiptNewOrderButton.addEventListener('click', handleStartNewOrder);
  DOM.receiptPrintButton.addEventListener('click', handlePrintReceipt);

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

  registerAllEventListeners();
}
document.addEventListener('DOMContentLoaded', initializeApplication);