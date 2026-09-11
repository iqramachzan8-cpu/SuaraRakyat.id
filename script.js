// ==========================================
// 1. GLOBAL STATE & DATA INITIALIZATION
// ==========================================
let currentUser = null;
let cameraStream = null;
let isSocialCustomLogin = false;
let selectedCategories = [];

const ALL_CATEGORIES = [
    "🛣️ Jalan Rusak / Berlubang",
    "💡 Lampu Jalan Mati",
    "🚶 Trotoar Rusak / Alih Fungsi",
    "🚨 Begal / Kriminalitas Jalanan",
    "🏎️ Balap Liar / Kebisingan",
    "🛑 Pungli & Parkir Liar",
    "⚔️ Tawuran Remaja / Ormas",
    "🗑️ Sampah Liar Menumpuk",
    "🌊 Banjir / Drainase Tersumbat",
    "🌳 Pohon Rawan Tumbang",
    "💨 Pencemaran Udara & Bau Limbah",
    "⚡ Pemadaman Listrik / PLN",
    "💧 Air PDAM Mati / Keruh",
    "❓ Masalah Lainnya"
];

let reportData = [
    {
        id: "SR-2026-1042",
        title: "[1 Masalah] Jalan Rusak / Berlubang",
        category: "Jalan Rusak / Berlubang",
        targetAuthority: "🏛️ Pemda / Dinas Pemkot Setempat",
        urgency: "High",
        text: "Banyak lubang dalam mengganggu pengendara motor dan rawan kecelakaan.",
        address: "Jl. Jendral Sudirman, Makassar",
        location: "-5.147600, 119.432700",
        status: "process",
        statusText: "⚡ Diproses",
        votes: 15,
        time: "2 jam yang lalu",
        reporter: "Alex Smith",
        isAnonymous: false
    }
];

function generateReportID() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `SR-${new Date().getFullYear()}-${randomNum}`;
}

// Helper: Set & Update Google Maps Satellite Iframe, Coords Input, & Reverse Geocoding
async function setLocationCoordinates(lat, lng, sourceText = "") {
    const coordsStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const coordsInput = document.getElementById('coordsInput');
    const iframe = document.getElementById('gmapsIframe');
    const locStatus = document.getElementById('locationStatus');
    const addressInput = document.getElementById('addressInput');

    if (coordsInput) coordsInput.value = coordsStr;
    if (iframe) {
        iframe.src = `https://maps.google.com/maps?q=${lat},${lng}&t=k&z=17&ie=UTF8&iwloc=&output=embed`;
    }

    // Pencarian Nama Jalan Asli via OpenStreetMap (Reverse Geocoding)
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        if (data && data.display_name) {
            if (addressInput) addressInput.value = data.display_name;
            if (locStatus) {
                locStatus.innerHTML = `✅ <span style="color:#00d2ff;">Lokasi Terdeteksi (${sourceText}):</span> <br><b>${data.display_name}</b> <br><small>(${coordsStr})</small>`;
            }
            return;
        }
    } catch (err) {
        console.warn("Gagal mengambil nama jalan:", err);
    }

    if (locStatus) {
        locStatus.innerHTML = `✅ <span style="color:#00d2ff;">Lokasi Terdeteksi (${sourceText}):</span> <b>${coordsStr}</b>`;
    }
}

// FUNGSI KHUSUS: Mengambil GPS Device dengan Presisi Tinggi
window.getCurrentPreciseLocation = function(sourceLabel = "GPS Real-time") {
    const locStatus = document.getElementById('locationStatus');
    if (locStatus) locStatus.innerHTML = "⏳ <i>Mengunci sinyal GPS HP & mencari nama jalan... Mohon tunggu.</i>";

    if (!navigator.geolocation) {
        alert("Browser kamu tidak mendukung fitur Geolocation GPS!");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            setLocationCoordinates(latitude, longitude, `${sourceLabel} - Akurasi ±${Math.round(accuracy)}m`);
        },
        (error) => {
            let msg = "Gagal mengambil GPS.";
            if (error.code === error.PERMISSION_DENIED) msg = "Izin akses lokasi ditolak di browser.";
            else if (error.code === error.POSITION_UNAVAILABLE) msg = "Sinyal GPS tidak ditemukan / mati.";
            else if (error.code === error.TIMEOUT) msg = "Waktu pencarian GPS habis.";
            
            if (locStatus) locStatus.innerHTML = `⚠️ <span style="color:#ff4757;">${msg} Silakan ketik nama jalan / patokan lokasi manual di bawah.</span>`;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
};

// ==========================================
// 2. DOM CONTENT LOADED
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    const modalLogin = document.getElementById('modalLogin');
    const modalCamera = document.getElementById('modalCamera');
    const modalGoogleChooser = document.getElementById('modalGoogleChooser');
    const btnOpenLogin = document.getElementById('btnOpenLogin');
    const btnCloseLogin = document.getElementById('btnCloseLogin');
    const btnCloseGoogleChooser = document.getElementById('btnCloseGoogleChooser');
    const formLogin = document.getElementById('formLogin');
    const appContent = document.getElementById('appContent');
    const userProfile = document.getElementById('userProfile');

    const loginTitle = document.getElementById('loginTitle');
    const fieldNama = document.getElementById('fieldNama');
    const labelUser = document.getElementById('labelUser');
    const socialBox = document.getElementById('socialBox');
    const socialDivider = document.getElementById('socialDivider');
    const btnBackToMainModal = document.getElementById('btnBackToMainModal');

    const webcamVideo = document.getElementById('webcamVideo');
    const webcamCanvas = document.getElementById('webcamCanvas');
    const btnSnap = document.getElementById('btnSnap');
    const btnCloseCam = document.getElementById('btnCloseCam');

    if (btnOpenLogin) {
        btnOpenLogin.addEventListener('click', () => {
            resetLoginForm();
            if (modalLogin) modalLogin.classList.add('active');
        });
    }

    if (btnCloseLogin) {
        btnCloseLogin.addEventListener('click', () => {
            if (isSocialCustomLogin) resetLoginForm();
            else if (modalLogin) modalLogin.classList.remove('active');
        });
    }

    if (btnBackToMainModal) btnBackToMainModal.addEventListener('click', resetLoginForm);
    if (btnCloseGoogleChooser) btnCloseGoogleChooser.addEventListener('click', () => modalGoogleChooser.classList.remove('active'));

    window.addEventListener('click', (e) => {
        if (e.target === modalLogin) {
            if (isSocialCustomLogin) resetLoginForm();
            else modalLogin.classList.remove('active');
        }
        if (e.target === modalGoogleChooser) modalGoogleChooser.classList.remove('active');
        if (e.target === modalCamera) stopCamera();
    });

    function resetLoginForm() {
        isSocialCustomLogin = false;
        if(loginTitle) loginTitle.textContent = "Masuk Akun";
        if(fieldNama) fieldNama.style.display = "block";
        if(labelUser) labelUser.textContent = "Masukkan Emailmu:";
        if(socialBox) socialBox.style.display = "grid";
        if(socialDivider) socialDivider.style.display = "flex";
        if(btnBackToMainModal) btnBackToMainModal.style.display = "none";
        if(formLogin) formLogin.reset();
    }

    // Social Login Handlers
    const btnGoogle = document.getElementById('btnGoogle');
    if (btnGoogle) {
        btnGoogle.addEventListener('click', () => {
            if (modalLogin) modalLogin.classList.remove('active');
            if (modalGoogleChooser) modalGoogleChooser.classList.add('active');
        });
    }

    const btnUseAnotherAcc = document.getElementById('btnUseAnotherAcc');
    if (btnUseAnotherAcc) {
        btnUseAnotherAcc.addEventListener('click', () => {
            if (modalGoogleChooser) modalGoogleChooser.classList.remove('active');
            resetLoginForm();
            if (modalLogin) modalLogin.classList.add('active');
        });
    }

    function setupSocialLogin(provider, userLabel) {
        isSocialCustomLogin = true;
        if (loginTitle) loginTitle.textContent = `Login via ${provider}`;
        if (fieldNama) fieldNama.style.display = "none";
        if (labelUser) labelUser.textContent = `Masukkan ${userLabel}:`;
        if (socialBox) socialBox.style.display = "none";
        if (socialDivider) socialDivider.style.display = "none";
        if (btnBackToMainModal) btnBackToMainModal.style.display = "inline-block";
    }

    const btnFacebook = document.getElementById('btnFacebook');
    if (btnFacebook) btnFacebook.addEventListener('click', () => setupSocialLogin("Facebook", "Username / No. HP Facebook"));

    const btnGithub = document.getElementById('btnGithub');
    if (btnGithub) btnGithub.addEventListener('click', () => setupSocialLogin("GitHub", "Username / Email GitHub"));

    const btnApple = document.getElementById('btnApple');
    if (btnApple) btnApple.addEventListener('click', () => setupSocialLogin("Apple ID", "Apple ID (Email)"));

    window.loginWithGoogleAcc = function(name, email) {
        if (modalGoogleChooser) modalGoogleChooser.classList.remove('active');
        handleLoginSuccess(name, email);
    };

    function handleLoginSuccess(name, email) {
        currentUser = { name, email };
        if (modalLogin) modalLogin.classList.remove('active');
        
        if (userProfile) {
            userProfile.innerHTML = `
                <span style="font-size: 12px; margin-right: 8px;"><b>${name}</b></span>
                <button id="btnLogout" class="btn-nav-login" style="border-color:#ff4757; color:#ff4757;">Logout</button>
            `;
            document.getElementById('btnLogout').addEventListener('click', handleLogout);
        }
        renderReportForm();
    }

    function handleLogout() {
        currentUser = null;
        if (userProfile) {
            userProfile.innerHTML = `<button id="btnOpenLogin" class="btn-nav-login">Login</button>`;
            document.getElementById('btnOpenLogin').addEventListener('click', () => {
                resetLoginForm();
                if (modalLogin) modalLogin.classList.add('active');
            });
        }
        renderHeroSection();
    }

    if (formLogin) {
        formLogin.addEventListener('submit', function(e) {
            e.preventDefault();
            const emailOrUser = document.getElementById('email').value.trim();
            const namaInput = document.getElementById('nama') ? document.getElementById('nama').value.trim() : '';
            const name = namaInput || emailOrUser.split('@')[0];

            handleLoginSuccess(name, emailOrUser);
        });
    }

    function renderHeroSection() {
        if (!appContent) return;
        appContent.innerHTML = `
            <div class="hero-text-box">
                <span class="badge">Aspirasi & Keluhan Transparan</span>
                <h1>Satu Suara untuk Perubahan Nyata</h1>
                <p>Laporkan kendala fasilitas umum, jalan rusak, atau aspirasi sosial secara langsung dan terpantau akurat.</p>
            </div>
        `;
    }

    // Kamera Real Stream
    async function openRealCamera() {
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (webcamVideo) webcamVideo.srcObject = cameraStream;
            if (modalCamera) modalCamera.classList.add('active');
        } catch (err) {
            alert("Tidak dapat mengakses kamera. Pastikan izin kamera aktif!");
        }
    }

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
        if (modalCamera) modalCamera.classList.remove('active');
    }

    if (btnCloseCam) btnCloseCam.addEventListener('click', stopCamera);

    // FITUR AMBIL FOTO: Otomatis Baca GPS Presisi Tinggi Saat Dijebret
    if (btnSnap) {
        btnSnap.addEventListener('click', () => {
            const context = webcamCanvas.getContext('2d');
            webcamCanvas.width = webcamVideo.videoWidth;
            webcamCanvas.height = webcamVideo.videoHeight;
            context.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);

            const imageDataUrl = webcamCanvas.toDataURL('image/png');
            const previewImage = document.getElementById('previewImage');
            if (previewImage) {
                previewImage.src = imageDataUrl;
                previewImage.style.display = 'block';
            }

            // Kunci GPS real-time presisi tinggi
            getCurrentPreciseLocation("Kamera Jepret HP");
            stopCamera();
        });
    }

    window.openRealCamera = openRealCamera;

    renderHeroSection();
});

// ==========================================
// 3. RENDER FORM PENGADUAN & GOOGLE MAPS SATELLITE
// ==========================================
function renderReportForm() {
    const appContent = document.getElementById('appContent');
    if (!appContent) return;

    appContent.innerHTML = `
        <div class="report-card">
            <h2 style="text-align: center; color: #00d2ff; margin-top:0;">Form Pengaduan Warga (Multi-Masalah)</h2>

            <form id="formReport">
                <label>Bukti Foto Kejadian:</label>
                <div style="display:flex; gap:8px; margin-top:5px;">
                    <button type="button" class="btn-nav-login" id="btnUploadFile" style="flex:1;">📁 File Gambar</button>
                    <button type="button" class="btn-nav-login" id="btnStartCamera" style="flex:1;" onclick="openRealCamera()">📷 Ambil Foto</button>
                </div>
                <input type="file" id="inputHiddenFile" accept="image/*" style="display:none;">
                <img id="previewImage" alt="Preview Laporan" style="display:none; max-width:100%; margin-top:10px; border-radius:8px;">

                <!-- NOTIFIKASI STATUS GPS/LOKASI -->
                <small id="locationStatus" style="display:block; margin-top:8px; font-size:11px; color:#aaa;">
                    ℹ️ Upload foto ber-GPS atau tekan tombol Lock GPS untuk mengunci lokasi akurat.
                </small>

                <!-- PILIHAN TUJUAN LAPORAN -->
                <label for="selectTargetAuthority" style="margin-top:12px; display:block;">Tujukan Laporan Ini Ke:</label>
                <select id="selectTargetAuthority" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(0,210,255,0.3); margin-top: 5px;">
                    <option value="🏛️ Pemda / Dinas Pemkot Setempat" selected>🏛️ Pemerintah Daerah / Pemkot / Pemkab Setempat</option>
                    <option value="🇮🇩 Presiden & Istana Kepresidenan RI">🇮🇩 Presiden & Kantor Staf Kepresidenan (KSP)</option>
                    <option value="🏢 Kementerian Terkait (PUPR / Perhubungan / DLL)">🏢 Kementerian Terkait (PUPR / Perhubungan / DLL)</option>
                    <option value="🚓 Kepolisian RI (Polres / Polda)">🚓 Kepolisian RI (Polres / Polda Setempat)</option>
                    <option value="📢 DPRD / BPD Setempat">📢 DPRD / Perwakilan Rakyat Daerah</option>
                </select>

                <!-- KATEGORI DROPDOWN MULTI SELECT -->
                <label style="margin-top:12px; display:block;">Pilih Masalah Resah Warga (Maksimal 10):</label>
                <select id="categorySelect" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(0,210,255,0.3); margin-top: 5px;">
                    <option value="" disabled selected>-- Klik di sini untuk menambah masalah --</option>
                    ${ALL_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>

                <!-- WADAH ITEM TERPILIH -->
                <div id="selectedChipsContainer" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; min-height: 40px; padding: 8px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 6px;">
                    <small id="emptyChipText" style="color: #666; font-size: 11px;">Belum ada masalah dipilih. Klik dropdown di atas!</small>
                </div>

                <label for="selectUrgency" style="margin-top:12px; display:block;">Tingkat Urgensi Laporan:</label>
                <select id="selectUrgency" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(0,210,255,0.3); margin-top: 5px;">
                    <option value="Low">🟢 Rendah (Informasi / Saran)</option>
                    <option value="Medium" selected>🟡 Sedang (Perlu Penanganan Biasa)</option>
                    <option value="High">🔴 Tinggi / Darurat (Membahayakan Keselamatan)</option>
                </select>

                <label for="textReport" style="margin-top:12px; display:block;">Uraian Detail Masalah:</label>
                <textarea id="textReport" placeholder="Jelaskan kronologi, patokan lokasi, atau detail masalah..." required style="width:100%; height:80px; padding:8px; border-radius:6px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(0,210,255,0.3); margin-top:5px;"></textarea>

                <!-- INPUT NAMA JALAN / ALAMAT MANUAL -->
                <label for="addressInput" style="margin-top:12px; display:block;">Nama Jalan / Patokan Lokasi Asli:</label>
                <input type="text" id="addressInput" placeholder="Contoh: Jl. Ahmad Yani Depan Toko A, Makassar" required style="width:100%; padding:8px; border-radius:6px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(0,210,255,0.3); margin-top:5px;">

                <!-- GOOGLE MAPS EMBED (MODE SATELIT ASLI) -->
                <label style="margin-top:12px; display:block;">Lokasi Terdeteksi (Google Maps Satelit):</label>
                <iframe 
                    id="gmapsIframe"
                    width="100%" 
                    height="250" 
                    style="border:1px solid rgba(0,210,255,0.3); border-radius:8px; margin-top:5px;" 
                    loading="lazy" 
                    allowfullscreen
                    src="https://maps.google.com/maps?q=-6.2088,106.8456&t=k&z=17&ie=UTF8&iwloc=&output=embed">
                </iframe>

                <!-- TOMBOL LOCK GPS & INPUT KOORDINAT -->
                <div style="display:flex; gap:6px; margin-top:8px;">
                    <input type="text" id="coordsInput" value="-6.2088, 106.8456" placeholder="Koordinat otomatis" required style="flex:1; padding:8px; border-radius:6px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(0,210,255,0.3);" oninput="updateGmapsIframe(this.value)">
                    <button type="button" class="btn-nav-login" onclick="getCurrentPreciseLocation('GPS Realtime')" style="white-space:nowrap; font-size:11px; padding:0 10px; background:#00d2ff; color:#000; font-weight:bold; border-radius:6px; cursor:pointer;">🎯 Lock GPS</button>
                    <button type="button" class="btn-nav-login" onclick="openExternalGoogleMaps()" style="white-space:nowrap; font-size:11px; padding:0 10px; background:rgba(0,210,255,0.1); color:#00d2ff; border:1px solid #00d2ff; border-radius:6px; cursor:pointer;">📌 Buka Maps</button>
                </div>

                <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="chkAnonymous" style="width: auto; margin-top: 0;">
                    <label for="chkAnonymous" style="margin-top: 0; cursor: pointer; font-size: 12px; color: #00d2ff;">Sembunyikan Nama Saya (Anonim)</label>
                </div>

                <button type="submit" class="btn-submit" style="width:100%; padding:10px; margin-top:15px; background:#00d2ff; color:#000; font-weight:bold; border:none; border-radius:6px; cursor:pointer;">🚀 Kirim Pengaduan Sekarang</button>
            </form>

            ${renderFeedComponent()}
        </div>
    `;

    // Dropdown Multi-Select Handler
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
        categorySelect.addEventListener('change', function() {
            const val = this.value;
            if (!val) return;

            if (selectedCategories.length >= 10) {
                alert("Maksimal hanya bisa memilih 10 masalah!");
                this.value = "";
                return;
            }

            if (!selectedCategories.includes(val)) {
                selectedCategories.push(val);
                updateChipsUI();
            }
            this.value = ""; 
        });
    }

    // Upload File Controls & EKSTRAKSI GPS DARI EXIF FOTO
    const inputHiddenFile = document.getElementById('inputHiddenFile');
    const previewImage = document.getElementById('previewImage');

    const btnUploadFile = document.getElementById('btnUploadFile');
    if (btnUploadFile) {
        btnUploadFile.addEventListener('click', () => inputHiddenFile.click());
    }

    if (inputHiddenFile) {
        inputHiddenFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Preview Tampilan Foto
            const reader = new FileReader();
            reader.onload = (evt) => {
                previewImage.src = evt.target.result;
                previewImage.style.display = 'block';
            };
            reader.readAsDataURL(file);

            // Ekstraksi Koordinat GPS dari Metadata Foto Menggunakan EXIFR Library
            try {
                if (window.exifr) {
                    const gpsData = await exifr.gps(file);
                    if (gpsData && gpsData.latitude && gpsData.longitude) {
                        setLocationCoordinates(gpsData.latitude, gpsData.longitude, "EXIF Metadata Foto");
                        return;
                    }
                }
            } catch (exifErr) {
                console.warn("Gagal/tidak ada EXIF GPS pada file foto:", exifErr);
            }

            // Fallback: Jika foto tidak memiliki metadata GPS, gunakan GPS Perangkat HP
            getCurrentPreciseLocation("GPS Perangkat");
        });
    }

    // Submit Form
    const formReport = document.getElementById('formReport');
    if (formReport) {
        formReport.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (selectedCategories.length === 0) {
                alert("Pilih minimal 1 kategori masalah!");
                return;
            }

            const targetAuth = document.getElementById('selectTargetAuthority').value;
            const urgency = document.getElementById('selectUrgency').value;
            const text = document.getElementById('textReport').value.trim();
            const address = document.getElementById('addressInput').value.trim();
            const location = document.getElementById('coordsInput').value;
            const isAnon = document.getElementById('chkAnonymous').checked;
            
            const reporterName = isAnon ? "Anonim" : (currentUser ? currentUser.name : "Warga");
            const newResiID = generateReportID();
            const categoryString = selectedCategories.join(", ");

            reportData.unshift({
                id: newResiID,
                title: `[${selectedCategories.length} Masalah] ${selectedCategories[0]} dll.`,
                category: categoryString,
                targetAuthority: targetAuth,
                urgency: urgency,
                text: text,
                address: address,
                location: location,
                status: "pending",
                statusText: "⏳ Menunggu",
                votes: 1,
                time: "Baru saja",
                reporter: reporterName,
                isAnonymous: isAnon
            });

            alert(`Laporan Berhasil Ditujukan ke: ${targetAuth}\nTotal ${selectedCategories.length} Masalah Terdaftar.\nNomor Resi: ${newResiID}`);
            selectedCategories = []; 
            renderReportForm();
        });
    }

    updateChipsUI();
}

// Update Iframe Peta Google Maps saat Koordinat Diubah Manual
window.updateGmapsIframe = function(coordsStr) {
    const iframe = document.getElementById('gmapsIframe');
    if (!iframe || !coordsStr) return;
    iframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(coordsStr.trim())}&t=k&z=17&ie=UTF8&iwloc=&output=embed`;
};

// Open Link Google Maps Luar
window.openExternalGoogleMaps = function() {
    const coordsInput = document.getElementById('coordsInput');
    const val = coordsInput ? coordsInput.value.trim() : '';
    if (val) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(val)}`, '_blank');
    } else {
        window.open('https://maps.google.com', '_blank');
    }
};

// Update Tampilan Chip/Badge Terpilih
function updateChipsUI() {
    const container = document.getElementById('selectedChipsContainer');
    if (!container) return;

    if (selectedCategories.length === 0) {
        container.innerHTML = `<small id="emptyChipText" style="color: #666; font-size: 11px;">Belum ada masalah dipilih. Klik dropdown di atas!</small>`;
        return;
    }

    container.innerHTML = selectedCategories.map((cat, index) => `
        <span style="display: inline-flex; align-items: center; gap: 6px; background: rgba(0, 210, 255, 0.15); color: #00d2ff; border: 1px solid #00d2ff; padding: 4px 8px; border-radius: 20px; font-size: 11px;">
            ${cat}
            <button type="button" onclick="removeCategory(${index})" style="background: none; border: none; color: #ff4757; font-weight: bold; cursor: pointer; font-size: 12px; padding: 0 2px;">✕</button>
        </span>
    `).join('');
}

window.removeCategory = function(index) {
    selectedCategories.splice(index, 1);
    updateChipsUI();
};

// ==========================================
// 4. FEED COMPONENT & SHARE MULTI-PLATFORM
// ==========================================
function renderFeedComponent() {
    let feedItemsHTML = reportData.map(item => {
        const badgeColor = item.urgency === 'High' ? 'background: #ff4757; color: white;' : 'background: rgba(0, 210, 255, 0.2); color: #00d2ff;';
        const displayAddress = item.address ? item.address : item.location;

        return `
            <div class="feed-item" data-title="${item.title.toLowerCase()} ${item.id.toLowerCase()}" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; margin-top: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; ${badgeColor}">
                            ${item.urgency === 'High' ? '🚨 HIGH URGENCY' : 'NORMAL'}
                        </span>
                        <strong style="display: block; margin-top: 4px;">${item.title}</strong>
                        <small style="color: #00d2ff; font-size: 10px;">ID: ${item.id} | Oleh: ${item.reporter}</small>
                    </div>
                    <span class="badge-status ${item.status}">${item.statusText}</span>
                </div>

                <p style="margin: 6px 0; color: #ccc; font-size: 11px;">"${item.text}"</p>
                <small style="display:block; color:#00d2ff; font-size:10px; margin-bottom: 2px;">🎯 Ditujukan Ke: <b>${item.targetAuthority || 'Pemerintah Setempat'}</b></small>
                <small style="display:block; color:#00d2ff; font-size:10px; margin-bottom: 2px;">📍 Lokasi: <b>${displayAddress}</b></small>
                <small style="display:block; color:#aaa; font-size:10px;">📌 Kategori: ${item.category}</small>
                
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button type="button" class="btn-upvote" onclick="upvoteReport(this)">
                            👍 Dukung (<span class="vote-count">${item.votes}</span>)
                        </button>
                        <small style="color: #888; margin-left: auto;">${item.time}</small>
                    </div>

                    <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
                        <button type="button" class="btn-upvote" style="border-color: #25D366; color: #25D366; font-size:10px;" onclick="shareMultiPlatform('wa', '${item.title}', '${displayAddress}', '${item.id}')">📲 WA</button>
                        <button type="button" class="btn-upvote" style="border-color: #1DA1F2; color: #1DA1F2; font-size:10px;" onclick="shareMultiPlatform('twitter', '${item.title}', '${displayAddress}', '${item.id}')">🐦 X/Twitter</button>
                        <button type="button" class="btn-upvote" style="border-color: #ff0050; color: #ff0050; font-size:10px;" onclick="shareMultiPlatform('tiktok', '${item.title}', '${displayAddress}', '${item.id}')">🎵 TikTok</button>
                        <button type="button" class="btn-upvote" style="border-color: #FF0000; color: #FF0000; font-size:10px;" onclick="shareMultiPlatform('yt', '${item.title}', '${displayAddress}', '${item.id}')">▶️ YouTube</button>
                        <button type="button" class="btn-upvote" style="border-color: #C13584; color: #C13584; font-size:10px;" onclick="shareMultiPlatform('ig', '${item.title}', '${displayAddress}', '${item.id}')">📸 IG</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="report-feed" style="margin-top: 20px;">
            <strong style="font-size:13px;">📌 Feed Pengaduan Warga Real-Time</strong>
            <div id="feedList">
                ${feedItemsHTML}
            </div>
        </div>
    `;
}

window.upvoteReport = function(btnElement) {
    let countSpan = btnElement.querySelector('.vote-count');
    let currentVotes = parseInt(countSpan.textContent);
    
    if (!btnElement.classList.contains('voted')) {
        countSpan.textContent = currentVotes + 1;
        btnElement.classList.add('voted');
        btnElement.style.background = '#00d2ff';
        btnElement.style.color = '#121212';
    } else {
        countSpan.textContent = currentVotes - 1;
        btnElement.classList.remove('voted');
        btnElement.style.background = 'rgba(0, 210, 255, 0.15)';
        btnElement.style.color = '#00d2ff';
    }
};

window.shareMultiPlatform = function(platform, title, location, resi) {
    const textViral = `⚠️ BUTUH DUKUNGAN WARGA! ⚠️\nNo Resi: ${resi}\nMasalah: ${title}\nLokasi: ${location}\n\nMari bantu dukung laporan ini di SuaraRakyat.id agar viral dan ditindaklanjuti! #SuaraRakyat #LaporWarga`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(textViral);
    }

    if (platform === 'wa') window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(textViral)}`, '_blank');
    else if (platform === 'twitter') window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(textViral)}`, '_blank');
    else if (platform === 'tiktok') window.open(`https://www.tiktok.com/upload`, '_blank');
    else if (platform === 'yt') window.open(`https://studio.youtube.com`, '_blank');
    else if (platform === 'ig') window.open(`https://www.instagram.com`, '_blank');
};