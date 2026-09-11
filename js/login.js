// ================================================================
    // LOGIKA LOGIN ADMIN (MODAL) - Semua orang bisa MELIHAT dashboard
    // (Input Data, Pratinjau BRS, Prediksi) tanpa login. Login admin
    // hanya diperlukan untuk MENGEDIT data di tab Input Data & Pratinjau
    // BRS (mengubah tabel, narasi, impor/muat data, dsb).
    //
    // Login memakai Supabase Auth (supabaseClient.auth). Akun admin dibuat
    // manual di dashboard Supabase (Authentication -> Users), lihat
    // README.md. "Nama Pengguna" di form login diisi dengan EMAIL akun
    // admin tersebut.
    // ================================================================

    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    const loginAlertBox = document.getElementById('loginAlertBox');
    const loginAlertText = document.getElementById('loginAlertText');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const loginSubmitBtnText = document.getElementById('loginSubmitBtnText');
    const loginTogglePw = document.getElementById('loginTogglePw');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginEyeIcon = document.getElementById('loginEyeIcon');
    const loginForgotLink = document.getElementById('loginForgotLink');
    const adminFab = document.getElementById('adminFab');
    const btnAdminLogout = document.getElementById('btnAdminLogout');
    const publicNav = document.getElementById('publicNav');
    const adminNav = document.getElementById('adminNav');
    const loginLogoImg = document.getElementById('loginLogoImg');
    const navbarLogoImg = document.querySelector('.topbar .brand img');

    // Fungsi pemicu file input (dipanggil lewat requireAdmin agar terkunci)
    function triggerXlsxImport() { document.getElementById('xlsxImportInput').click(); }
    function triggerLoadJson() { document.getElementById('loadJsonInput').click(); }

    // Menyimpan aksi yang tertunda (mis. "buka Panel Admin") supaya otomatis
    // dijalankan begitu login berhasil, tanpa perlu klik dua kali.
    let pendingAdminAction = null;

    // Panggil requireAdmin(fnAsli, ...argumen) pada setiap kontrol yang
    // hanya boleh dipakai admin. Kalau belum login, modal login muncul dan
    // aksinya disimpan untuk dijalankan otomatis setelah login berhasil.
    function requireAdmin(fn, ...args) {
      if (!isAdmin) {
        pendingAdminAction = () => fn(...args);
        openLoginModal();
        return;
      }
      fn(...args);
    }

    // Pakai logo BPS yang sama dengan navbar dashboard
    if (loginLogoImg && navbarLogoImg) {
      loginLogoImg.src = navbarLogoImg.src;
    }

    function openLoginModal() {
      loginOverlay.classList.remove('hidden');
      loginAlertBox.classList.remove('show');
      document.getElementById('loginUsername').focus();
    }

    function closeLoginModal() {
      loginOverlay.classList.add('hidden');
      loginForm.reset();
      loginAlertBox.classList.remove('show');
      pendingAdminAction = null;
    }

    // Terapkan status login ke seluruh UI: navbar publik/admin, kunci tabel
    // input, dan kunci narasi yang bisa diedit.
    function updateAdminUI() {
      document.body.classList.toggle('admin-mode', isAdmin);

      if (isAdmin) {
        adminFab.style.display = 'none';
        publicNav.style.display = 'none';
        adminNav.style.display = 'flex';
      } else {
        adminFab.style.display = '';
        publicNav.style.display = '';
        adminNav.style.display = 'none';
      }

      // Kunci / buka narasi yang bisa diedit di tab Penampil BRS
      ['narrTPK', 'narrStayTotal', 'narrStayDetail'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('contenteditable', isAdmin ? 'true' : 'false');
      });

      // Render ulang tabel input supaya atribut readonly ikut ter-update
      if (typeof renderTrendTable === 'function' && trendRows.length) renderTrendTable();
      if (typeof renderStayTable === 'function' && rlmtRows.length) renderStayTable();
    }

    // Cek sesi Supabase yang mungkin masih tersimpan (supabase-js otomatis
    // menyimpan sesi login ke localStorage & memperbaruinya sendiri).
   async function checkExistingSession() {
  if (!supabaseClient) { updateAdminUI(); return; }
  const { data } = await supabaseClient.auth.getSession();
  isAdmin = !!(data && data.session);
  updateAdminUI();
}

    // Toggle tampilkan/sembunyikan kata sandi
    loginTogglePw.addEventListener('click', () => {
      const isPw = loginPasswordInput.type === 'password';
      loginPasswordInput.type = isPw ? 'text' : 'password';
      loginEyeIcon.textContent = isPw ? 'Sembunyikan' : 'Lihat';
    });

    // Submit form login
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginAlertBox.classList.remove('show');

      const email = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value.trim();

      if (!email || !password) {
        loginAlertText.textContent = 'Email dan kata sandi wajib diisi.';
        loginAlertBox.classList.add('show');
        return;
      }
      if (!supabaseClient) {
        loginAlertText.textContent = 'Supabase belum dikonfigurasi (lihat README.md).';
        loginAlertBox.classList.add('show');
        return;
      }

      loginSubmitBtn.disabled = true;
      loginSubmitBtnText.textContent = 'Memproses...';

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

      loginSubmitBtn.disabled = false;
      loginSubmitBtnText.textContent = 'Masuk';

      if (!error) {
        isAdmin = true;
        updateAdminUI();
        closeLoginModal();
        if (typeof showToast === 'function') showToast('Berhasil masuk sebagai admin');
        // Jalankan aksi yang tadi tertunda (mis. langsung buka Panel Admin)
        if (typeof pendingAdminAction === 'function') {
          const action = pendingAdminAction;
          pendingAdminAction = null;
          action();
        }
      } else {
        loginAlertText.textContent = 'Email atau kata sandi salah. Silakan coba lagi.';
        loginAlertBox.classList.add('show');
      }
    });

    loginForgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Silakan hubungi administrator sistem BPS Kota Tasikmalaya untuk mengatur ulang kata sandi Anda.');
    });

    // Klik di area gelap luar kotak login akan menutup modal (kalau belum login)
    loginOverlay.addEventListener('click', (e) => {
      if (e.target === loginOverlay) closeLoginModal();
    });

    // Tombol X di pojok modal login
    const loginCloseBtn = document.getElementById('loginCloseBtn');
    if (loginCloseBtn) {
      loginCloseBtn.addEventListener('click', () => closeLoginModal());
    }

    // Tombol Keluar Admin di navbar
    btnAdminLogout.addEventListener('click', async () => {
      if (supabaseClient) await supabaseClient.auth.signOut();
      isAdmin = false;
      updateAdminUI();
      // Selalu kembali ke Beranda karena navbar admin (Tambah Data / Edit
      // Penampil BRS) hilang begitu logout.
      showPanel('beranda');
      if (typeof showToast === 'function') showToast('Berhasil keluar dari mode admin');
    });
