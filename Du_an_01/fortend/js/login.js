
const users = JSON.parse(localStorage.getItem("users")) || []


// lấy dom dữ liệu 
const form = document.querySelector(".login-box")
const emailElement = document.getElementById("email");
const passwordElement = document.getElementById("password");
const errEmail = document.getElementById("emailError");
const errPassword = document.getElementById("errorPassword");
// hiện / ẩn mật khẩu 
document.getElementById("togglePassword").addEventListener("click",() => {
    const input = passwordElement
    const icon = document.querySelector("#togglePassword i");
    if (input.type == "password"){
    input.type = "text";
    icon.classList.replace("fa-eye-slash", "fa-eye");
    } else {
        input.type = "password";
        icon.classList.replace( "fa-eye", "fa-eye-slash");
    }
});
// thông báo
const showToast = (message, sub, isSuccess = true) => {
  // xóa toast cũ nếu có
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

// lắng nghe sự kiện
form.addEventListener("submit",(e) => {
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

  // kiểm tra email + password có khớp không
  const user = users.find(
    (u) => u.email === emailVal && u.password === passwordElement.value,
  );

  if (!user) {
    showToast("Đăng nhập thất bại", "Email hoặc mật khẩu không đúng", false);
    return;
  }

  // check box
  const rememberMe = document.getElementById("rememberMe").checked;
  localStorage.setItem("currentUser", JSON.stringify(user));
   if (rememberMe) {
    localStorage.setItem("rememberLogin", "true");
  } else {
    localStorage.removeItem("rememberLogin");
  }
  showToast("Đăng nhập thành công", `Chào mừng ${user.fullName} 🎉`, true);

  setTimeout(() => {
    if (user.role === "admin") {
      window.location.href = "./admin.html";
    } else {
      window.location.href = "./dashboard.html";
    }
  }, 100);
});

// lưu trạng thái khi đăng nhập 
window.addEventListener("pageshow", () => {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  const remember = localStorage.getItem("rememberLogin");

  if (user && remember === "true") {
    if (user.role === "admin") {
      window.location.href = "./admin.html";
    } else {
      window.location.href = "./dashboard.html";
    }
  }
});
