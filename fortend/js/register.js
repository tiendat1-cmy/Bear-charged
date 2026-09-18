//Cấu hình api
const API_BASE_URL = "https://bear-charged.onrender.com";
const REGISTER_URL = `${API_BASE_URL}/api/auth/register`;

// lấy dom dữ liệu
const form = document.getElementById("registerForm");

const nameInput = document.getElementById("fullname");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirm");
const usernameInput = document.getElementById("username");

// lỗi khi nhập sai
const errName = document.getElementById("err-fullname");
const errEmail = document.getElementById("err-email");
const errUser = document.getElementById("err-username");
const errPassword = document.getElementById("err-password");
const errConfirm = document.getElementById("err-confirm");

// test email
const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// mật khẩu phải 8 số và có ký tự đặc biệt
const validatePassword = (pass) => {
  return /^(?=.*[!@#$%^&*])(?=.{8,})/.test(pass);
};

// hiện toast
const showToast = (title, sub, isSuccess = true) => {
  const toast = document.getElementById("toast");
  const toastTitle = toast.querySelector(".toast-title");
  const toastSub = toast.querySelector(".toast-sub");
  if (toastTitle) toastTitle.textContent = title;
  if (toastSub) toastSub.textContent = sub;
  toast.classList.remove("hidden");
  toast.classList.toggle("toast--error", !isSuccess);
  setTimeout(() => closeToast(), 1500);
};

const closeToast = () => {
  document.getElementById("toast").classList.add("hidden");
};

// lắng nghe sự kiện
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  let isValid = true;

  errName.textContent = "";
  errEmail.textContent = "";
  errUser.textContent = "";
  errPassword.textContent = "";
  errConfirm.textContent = "";

  // validate họ tên
  if (nameInput.value.trim() === "") {
    errName.textContent = "Họ tên không được để trống ";
    isValid = false;
  }

  // validate email (chỉ kiểm tra định dạng, không check trùng ở client nữa —
  // để backend tự kiểm tra trùng email trong DB)
  if (emailInput.value.trim() === "") {
    errEmail.textContent = "Email không được để trống";
    isValid = false;
  } else if (!validateEmail(emailInput.value)) {
    errEmail.textContent = "Email phải đúng định dạng";
    isValid = false;
  }

  // validate tên đăng nhập (chỉ validate UI, không gửi lên API vì backend không dùng)
  if (usernameInput.value.trim() === "") {
    errUser.textContent = "Tên đăng nhập không được để trống";
    isValid = false;
  } else if (usernameInput.value.trim().length < 3) {
    errUser.textContent = "Tên đăng nhập tối thiểu 3 ký tự";
    isValid = false;
  }

  // validate mật khẩu
  if (passwordInput.value.trim() === "") {
    errPassword.textContent = "Mật khẩu không được để trống";
    isValid = false;
  } else if (!validatePassword(passwordInput.value)) {
    errPassword.textContent =
      "Mật khẩu tối thiểu 8 ký tự và có ít nhất 1 ký tự đặc biệt";
    isValid = false;
  }

  if (confirmInput.value.trim() === "") {
    errConfirm.textContent = "Mật khẩu xác nhận không được để trống";
    isValid = false;
  } else if (confirmInput.value !== passwordInput.value) {
    errConfirm.textContent = "Mật khẩu không trùng khớp";
    isValid = false;
  }

  const terms = document.getElementById("terms");
  const errTerms = document.getElementById("err-terms");
  if (!terms.checked) {
    errTerms.textContent = "Bạn phải đồng ý với điều khoản sử dụng";
    isValid = false;
  } else {
    errTerms.textContent = "";
  }

  if (!isValid) return;

  const submitBtn = form.querySelector(".btn-register");
  submitBtn.disabled = true;
  submitBtn.textContent = "Đang đăng ký...";

  try {
    const res = await fetch(REGISTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullname: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value,
        role: "Staff", // mặc định — đổi nếu muốn cho chọn role
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      const msg = result.detail || result.message || "Đăng ký thất bại";
      // nếu lỗi liên quan email trùng, backend thường trả message có chữ "email"
      if (typeof msg === "string" && msg.toLowerCase().includes("email")) {
        errEmail.textContent = msg;
      } else {
        showToast("Đăng ký thất bại", msg, false);
      }
      return;
    }

    showToast("Đăng ký thành công!", "Chào mừng bạn đến với Bear Charged 🎉", true);

    setTimeout(() => {
      window.location.href = "./login.html";
    }, 1000);
  } catch (err) {
    console.error("Register fetch error:", err);
    showToast("Lỗi kết nối", "Không thể kết nối tới server", false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Đăng ký";
  }
});

window.togglePw = (inputId, btn) => {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector("i");
  if (!input || !icon) return;

  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  }
};