// Cấu hình api
const API_BASE_URL = "http://127.0.0.1:8000"; // đổi theo port backend của bạn
const LOGIN_URL = `${API_BASE_URL}/api/auth/login`;

// lấy dom dữ liệu
const form = document.querySelector(".login-box");
const emailElement = document.getElementById("email");
const passwordElement = document.getElementById("password");
const errEmail = document.getElementById("emailError");
const errPassword = document.getElementById("errorPassword");

// hiện / ẩn mật khẩu (giữ nguyên)
document.getElementById("togglePassword").addEventListener("click", () => {
  const input = passwordElement;
  const icon = document.querySelector("#togglePassword i");
  if (input.type == "password") {
    input.type = "text";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  }
});

// thông báo (giữ nguyên)
const showToast = (message, sub, isSuccess = true) => {
  const old = document.getElementById("toast");
  if (old) old.remove();

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.className = `toast ${isSuccess ? "toast--success" : "toast--error"}`;

  toast.innerHTML = `
    <div class="toast__stripe"></div>
    <span class="toast__icon">${isSuccess ? "✔" : "✕"}</span>
    <div class="toast__body">
      <p class="toast__title">${message}</p>
      <p class="toast__sub">${sub}</p>
    </div>
    <button class="toast__close" onclick="this.closest('#toast').remove()">✕</button>
  `;

  document.body.appendChild(toast);
  setTimeout(() => toast?.remove(), 1500);
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ==== SUBMIT: GỌI API LOGIN ====
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  let isValid = true;
  errEmail.textContent = "";
  errPassword.textContent = "";

  const emailVal = emailElement.value.trim();
  const passVal = passwordElement.value.trim();

  if (emailVal === "") {
    errEmail.textContent = "Email không được để trống";
    isValid = false;
  } else if (!validateEmail(emailVal)) {
    errEmail.textContent = "Email không đúng định dạng";
    isValid = false;
  }

  if (passVal === "") {
    errPassword.textContent = "Mật khẩu không được để trống";
    isValid = false;
  }

  if (!isValid) return;

  const submitBtn = form.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = "Đang đăng nhập...";

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email:  emailVal, // đổi thành email: emailVal nếu schema dùng field "email"
        password: passVal,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      // FastAPI HTTPException trả {"detail": "..."}
      const msg = result.detail || result.message || "Sai tài khoản hoặc mật khẩu";
      showToast("Đăng nhập thất bại", msg, false);
      errPassword.textContent = msg;
      return;
    }

    // success_response("Đăng nhập thành công", token_data)
    const data = result.data || result;
    const token = data.access_token || data.token;

    if (!token) {
      showToast("Lỗi", "Backend không trả về token", false);
      return;
    }

    // lưu JWT
    localStorage.setItem("token", token);

    const rememberMe = document.getElementById("rememberMe").checked;
    if (rememberMe) {
      localStorage.setItem("rememberLogin", "true");
    } else {
      localStorage.removeItem("rememberLogin");
    }

    showToast("Đăng nhập thành công", "Đang chuyển hướng...", true);

    setTimeout(() => {
      window.location.href = "./dashboard.html";
    }, 800);
  } catch (err) {
    // lỗi mạng, CORS, server không chạy...
    console.error("Login fetch error:", err);
    showToast("Lỗi kết nối", "Không thể kết nối tới server", false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Đăng nhập";
  }
});