'use strict';

// cấu hình api
const API_BASE_URL = "http://127.0.0.1:8000";
const ME_URL = `${API_BASE_URL}/api/auth/me`;
const CHANGE_PASSWORD_URL = `${API_BASE_URL}/api/auth/change-password`;

// kiểm tra đăng nhập
const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}
// gọi api kèm token
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
        const msg = result.detail || result.message || "Có lỗi xảy ra";
        throw new Error(msg);
    }

    return result.data !== undefined ? result.data : result;
}
// hiển thị thông tin tài khoản
async function loadCurrentUser() {
    try {
        const user = await apiRequest(ME_URL);
        if (!user) return;

        document.getElementById("welcomeUser").textContent = user.fullname;
        document.getElementById("fullName").textContent = user.fullname;
        document.getElementById("email").textContent = user.email;
        document.getElementById("role").textContent = user.role;
    } catch (err) {
        console.error("Lỗi tải thông tin tài khoản:", err);
    }
}

loadCurrentUser();
// đổi mật khẩu

document
    .getElementById("changePasswordForm")
    .addEventListener("submit", async function (e) {

        e.preventDefault();

        const oldPassword =
            document.getElementById("oldPassword").value.trim();

        const newPassword =
            document.getElementById("newPassword").value.trim();

        const confirmPassword =
            document.getElementById("confirmPassword").value.trim();

        if (oldPassword === "") {
            alert("Vui lòng nhập mật khẩu cũ.");
            return;
        }

        // kiểm tra độ dài
        if (newPassword.length < 6) {
            alert("Mật khẩu mới phải từ 6 ký tự.");
            return;
        }

        // kiểm tra xác nhận
        if (newPassword !== confirmPassword) {
            alert("Xác nhận mật khẩu không khớp.");
            return;
        }

        const submitBtn = document.querySelector("#changePasswordForm .btn-save");
        submitBtn.disabled = true;

        try {
            await apiRequest(CHANGE_PASSWORD_URL, {
                method: "PUT",
                body: JSON.stringify({
                    old_password: oldPassword,
                    new_password: newPassword,
                }),
            });

            alert("Đổi mật khẩu thành công!");
            document.getElementById("changePasswordForm").reset();
        } catch (err) {
            alert(err.message || "Không thể đổi mật khẩu, vui lòng thử lại.");
        } finally {
            submitBtn.disabled = false;
        }
    });

// đăng xuất

document
    .getElementById("logoutBtn")
    .addEventListener("click", function (e) {

        e.preventDefault();

        const check = confirm("Bạn có chắc muốn đăng xuất?");

        if (!check) return;

        localStorage.removeItem("token");

        window.location.href = "login.html";

    });