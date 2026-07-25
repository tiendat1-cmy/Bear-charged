const users = JSON.parse(localStorage.getItem("users")) || []


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
const errUser = document.getElementById("err-username")
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

// hiện totas 
const showToast = () => {
    const toast = document.getElementById("toast");
    toast.classList.remove("hidden");
    setTimeout(() => closeToast(), 1000); // tự đóng sau 1s
};

const closeToast = () => {
    document.getElementById("toast").classList.add("hidden");
};

// lắng nghe sự kiện 
form.addEventListener("submit" , (e) => {
    e.preventDefault();
    let isValid = true;

    errName.textContent = "";
    errEmail.textContent = "";
    errUser.textContent = "";
    errPassword.textContent = "";
    errConfirm.textContent = "";
    // validate họ tên
    if (nameInput.value.trim() === ""){
        errName.textContent = "Họ tên không được để trống ";
        isValid = false;
    }
    // validate email
    if (emailInput.value.trim() === ""){
      errEmail.textContent = "Email không được để trống"
      isValid = false;
    }else if (!validateEmail(emailInput.value)){
        errEmail.textContent = "Email phải đúng định dạng";
        isValid = false;
    } else if (users.some((user) => user.email === emailInput.value.trim())) {
     // kiem tra email đã tồn tại hay chx
        errEmail.textContent =
        "Email này đã được đăng ký, vui lòng dùng email khác";
        isValid = false;
    }

    // validate tên đăng nhập
    if (usernameInput.value.trim() === "") {
      errUser.textContent = "Tên đăng nhập không được để trống";
      isValid = false;
    } else if (usernameInput.value.trim().length < 3) {
      errUser.textContent = "Tên đăng nhập tối thiểu 3 ký tự";
      isValid = false;
    } else if (users.some((u) => u.username === usernameInput.value.trim())) {
      errUser.textContent = "Tên đăng nhập đã tồn tại";
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

  // hien thi canh bao

  const terms = document.getElementById("terms");
  const errTerms = document.getElementById("err-terms");
  if (!terms.checked) {
    errTerms.textContent = "Bạn phải đồng ý với điều khoản sử dụng";
    isValid = false;
  } else {
    errTerms.textContent = "";
  }

  if (isValid) {
    // Thêm user mới vào danh sách
    const newUser = {
      id: Date.now(),
      fullName: nameInput.value.trim(),
      username: usernameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value,
      role: "user",
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    users.push(newUser);
    localStorage.setItem("users", JSON.stringify(users));

    showToast();
    setTimeout(() => {
      window.location.href = "./login.html";
    }, 1000);
  }
});
window.togglePw = (inputId, btn) => {
  const input = document.getElementById(inputId);
  const icon  = btn.querySelector("i");
  if (!input || !icon) return;

  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  }
};
