
/* =========================================
   MEDIA GALLERY
   Pure JavaScript + IndexedDB
========================================= */


/* =========================================
   1. ELEMENTS
========================================= */

const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const heroUpload = document.getElementById("heroUpload");
const emptyUpload = document.getElementById("emptyUpload");

const dropZone = document.getElementById("dropZone");
const galleryGrid = document.getElementById("galleryGrid");
const emptyState = document.getElementById("emptyState");

const themeBtn = document.getElementById("themeBtn");

const totalCount = document.getElementById("totalCount");
const imageCount = document.getElementById("imageCount");
const videoCount = document.getElementById("videoCount");

const allFilterCount = document.getElementById("allFilterCount");
const imageFilterCount = document.getElementById("imageFilterCount");
const videoFilterCount = document.getElementById("videoFilterCount");

const galleryInfo = document.getElementById("galleryInfo");

const uploadProgress = document.getElementById("uploadProgress");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");

const lightbox = document.getElementById("lightbox");
const lightboxContent = document.getElementById("lightboxContent");

const lightboxName = document.getElementById("lightboxName");
const lightboxCounter = document.getElementById("lightboxCounter");

const lightboxClose = document.getElementById("lightboxClose");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const toast = document.getElementById("toast");


/* =========================================
   2. CONFIGURATION
========================================= */

const DB_NAME = "MediaGalleryDatabase";
const DB_VERSION = 1;
const STORE_NAME = "media";

const IMAGE_EXTENSIONS = [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "avif"
];

const VIDEO_EXTENSIONS = [
    "mp4",
    "webm",
    "mov"
];

const ALLOWED_EXTENSIONS = [
    ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS
];

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB per file

let db;

let mediaItems = [];
let filteredItems = [];

let currentFilter = "all";
let currentLightboxIndex = 0;

let toastTimer = null;

let activeObjectUrls = new Set();


/* =========================================
   3. INDEXED DB
========================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        if (!window.indexedDB) {
            reject(new Error("IndexedDB brauzeringizda mavjud emas."));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(event) {

            const database = event.target.result;

            if (!database.objectStoreNames.contains(STORE_NAME)) {

                const store = database.createObjectStore(
                    STORE_NAME,
                    {
                        keyPath: "id",
                        autoIncrement: true
                    }
                );

                store.createIndex("type", "type", {
                    unique: false
                });

            }

        };

        request.onsuccess = function(event) {

            db = event.target.result;

            db.onversionchange = function() {
                db.close();
                showToast("Ma'lumotlar bazasi yangilanishi kerak.");
            };

            resolve(db);

        };

        request.onerror = function() {

            reject(
                request.error ||
                new Error("Ma'lumotlar bazasini ochib bo'lmadi.")
            );

        };

    });

}


/* =========================================
   4. DATABASE FUNCTIONS
========================================= */

function saveFile(file, type) {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            STORE_NAME,
            "readwrite"
        );

        const store = transaction.objectStore(STORE_NAME);

        const item = {
            name: file.name,
            type: type,
            mimeType: file.type,
            size: file.size,
            date: Date.now(),
            blob: file
        };

        const request = store.add(item);

        request.onsuccess = function() {
            resolve(request.result);
        };

        request.onerror = function() {
            reject(request.error);
        };

        transaction.onabort = function() {
            reject(
                transaction.error ||
                new Error("Faylni saqlash bekor qilindi.")
            );
        };

    });

}


function getAllFiles() {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            STORE_NAME,
            "readonly"
        );

        const store = transaction.objectStore(STORE_NAME);

        const request = store.getAll();

        request.onsuccess = function() {
            resolve(request.result);
        };

        request.onerror = function() {
            reject(request.error);
        };

    });

}


function deleteFile(id) {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            STORE_NAME,
            "readwrite"
        );

        const store = transaction.objectStore(STORE_NAME);

        const request = store.delete(id);

        request.onsuccess = function() {
            resolve();
        };

        request.onerror = function() {
            reject(request.error);
        };

    });

}


/* =========================================
   5. FILE VALIDATION
========================================= */

function getExtension(filename) {

    const parts = filename.split(".");

    return parts.length > 1
        ? parts.pop().toLowerCase()
        : "";

}


function detectFileType(file) {

    const extension = getExtension(file.name);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return null;
    }

    if (IMAGE_EXTENSIONS.includes(extension)) {

        const validImageTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/avif"
        ];

        if (
            file.type &&
            !validImageTypes.includes(file.type)
        ) {
            return null;
        }

        return "image";

    }

    if (VIDEO_EXTENSIONS.includes(extension)) {

        const validVideoTypes = [
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "application/octet-stream"
        ];

        if (
            file.type &&
            !validVideoTypes.includes(file.type)
        ) {
            return null;
        }

        return "video";

    }

    return null;

}


function validateFile(file) {

    if (!(file instanceof File)) {
        return "Noto'g'ri fayl.";
    }

    if (file.size === 0) {
        return "Fayl bo'sh. Boshqa fayl tanlang.";
    }

    if (file.size > MAX_FILE_SIZE) {
        return "Fayl hajmi 1 GB dan oshmasligi kerak.";
    }

    const type = detectFileType(file);

    if (!type) {

        return "Bu format qo'llab-quvvatlanmaydi: " +
            file.name;

    }

    return null;

}


/* =========================================
   6. FILE SIZE FORMAT
========================================= */

function formatSize(bytes) {

    if (bytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];

    const index = Math.floor(
        Math.log(bytes) / Math.log(1024)
    );

    const size = bytes / Math.pow(1024, index);

    return size.toFixed(2) + " " + units[index];

}


/* =========================================
   7. TOAST
========================================= */

function showToast(message) {

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3500);

}


/* =========================================
   8. OBJECT URL MANAGEMENT
========================================= */

function createMediaURL(blob) {

    const url = URL.createObjectURL(blob);

    activeObjectUrls.add(url);

    return url;

}

function revokeMediaURL(url) {

    if (activeObjectUrls.has(url)) {

        URL.revokeObjectURL(url);

        activeObjectUrls.delete(url);

    }

}

function clearObjectURLs() {

    activeObjectUrls.forEach(url => {

        URL.revokeObjectURL(url);

    });

    activeObjectUrls.clear();

}


/* =========================================
   9. LOAD MEDIA
========================================= */

async function loadGallery() {

    try {

        mediaItems = await getAllFiles();

        mediaItems.sort((a, b) => b.date - a.date);

        updateStatistics();

        renderGallery();

    } catch (error) {

        console.error(error);

        showToast("Galereyani yuklashda xatolik yuz berdi.");

    }

}


/* =========================================
   10. STATISTICS
========================================= */

function updateStatistics() {

    const images = mediaItems.filter(
        item => item.type === "image"
    );

    const videos = mediaItems.filter(
        item => item.type === "video"
    );

    totalCount.textContent = mediaItems.length;

    imageCount.textContent = images.length;

    videoCount.textContent = videos.length;

    allFilterCount.textContent = mediaItems.length;

    imageFilterCount.textContent = images.length;

    videoFilterCount.textContent = videos.length;

}


/* =========================================
   11. FILTER
========================================= */

function getFilteredItems() {

    if (currentFilter === "image") {

        return mediaItems.filter(
            item => item.type === "image"
        );

    }

    if (currentFilter === "video") {

        return mediaItems.filter(
            item => item.type === "video"
        );

    }

    return [...mediaItems];

}


function setupFilters() {

    const buttons = document.querySelectorAll(".filter-btn");

    buttons.forEach(button => {

        button.addEventListener("click", function() {

            buttons.forEach(btn => {
                btn.classList.remove("active");
            });

            this.classList.add("active");

            currentFilter = this.dataset.filter;

            renderGallery();

        });

    });

}


/* =========================================
   12. GALLERY RENDER
========================================= */

function renderGallery() {

    filteredItems = getFilteredItems();

    galleryGrid.innerHTML = "";

    galleryInfo.textContent =
        filteredItems.length + " ta fayl";

    if (filteredItems.length === 0) {

        galleryGrid.style.display = "none";

        emptyState.classList.add("show");

        return;

    }

    galleryGrid.style.display = "grid";

    emptyState.classList.remove("show");

    filteredItems.forEach((item, index) => {

        const card = document.createElement("article");

        card.className = "media-card";

        const preview = document.createElement("div");

        preview.className = "media-preview";

        preview.addEventListener("click", () => {

            openLightbox(index);

        });

        const badge = document.createElement("span");

        badge.className = "media-badge";

        badge.textContent =
            item.type === "image" ? "IMAGE" : "VIDEO";

        preview.appendChild(badge);

        const url = createMediaURL(item.blob);

        if (item.type === "image") {

            const img = document.createElement("img");

            img.src = url;

            img.alt = item.name;

            img.loading = "lazy";

            img.decoding = "async";

            preview.appendChild(img);

        } else {

            const video = document.createElement("video");

            video.src = url;

            video.preload = "metadata";

            video.muted = true;

            video.playsInline = true;

            video.controls = false;

            preview.appendChild(video);

            const overlay = document.createElement("div");

            overlay.className = "video-overlay";

            const play = document.createElement("span");

            play.className = "play-icon";

            play.textContent = "▶";

            overlay.appendChild(play);

            preview.appendChild(overlay);

        }


        // DELETE BUTTON

        const deleteButton = document.createElement("button");

        deleteButton.className = "media-delete";

        deleteButton.textContent = "✕";

        deleteButton.title = "O'chirish";

        deleteButton.setAttribute(
            "aria-label",
            item.name + " faylini o'chirish"
        );

        deleteButton.addEventListener("click", async event => {

            event.stopPropagation();

            const confirmed = confirm(
                `"${item.name}" faylini o'chirmoqchimisiz?`
            );

            if (!confirmed) return;

            try {

                await deleteFile(item.id);

                showToast("Fayl muvaffaqiyatli o'chirildi.");

                await loadGallery();

            } catch (error) {

                console.error(error);

                showToast("Faylni o'chirishda xatolik.");

            }

        });


        // MEDIA INFORMATION

        const info = document.createElement("div");

        info.className = "media-info";

        const name = document.createElement("div");

        name.className = "media-name";

        name.textContent = item.name;

        name.title = item.name;

        const meta = document.createElement("div");

        meta.className = "media-meta";

        const size = document.createElement("span");

        size.textContent = formatSize(item.size);

        const date = document.createElement("span");

        date.textContent = new Date(item.date).toLocaleDateString(
            "uz-UZ"
        );

        meta.append(size, date);

        info.append(name, meta);

        card.append(
            preview,
            deleteButton,
            info
        );

        galleryGrid.appendChild(card);

    });

}


/* =========================================
   13. UPLOAD FILES
========================================= */

async function uploadFiles(files) {

    const selectedFiles = Array.from(files);

    if (selectedFiles.length === 0) return;

    uploadProgress.classList.add("show");

    let successful = 0;
    let failed = 0;

    const total = selectedFiles.length;

    for (let i = 0; i < total; i++) {

        const file = selectedFiles[i];

        const error = validateFile(file);

        if (error) {

            failed++;

            showToast(error);

        } else {

            try {

                const type = detectFileType(file);

                await saveFile(file, type);

                successful++;

            } catch (error) {

                console.error(error);

                failed++;

                showToast(
                    "Xotira to'ldi yoki faylni saqlash imkoni bo'lmadi."
                );

                break;

            }

        }

        const progress = Math.round(
            ((i + 1) / total) * 100
        );

        progressFill.style.width = progress + "%";

        progressPercent.textContent = progress + "%";

        progressText.textContent =
            `${i + 1} / ${total} ta fayl tekshirildi`;

    }

    await loadGallery();

    fileInput.value = "";

    setTimeout(() => {

        uploadProgress.classList.remove("show");

        progressFill.style.width = "0%";

    }, 1000);

    if (successful > 0) {

        showToast(
            `${successful} ta fayl muvaffaqiyatli saqlandi!`
        );

    } else if (failed === 0) {

        showToast("Yuklash uchun fayl tanlanmadi.");

    }

}


/* =========================================
   14. UPLOAD BUTTONS
========================================= */

function openFilePicker() {

    fileInput.click();

}

uploadBtn.addEventListener("click", openFilePicker);

heroUpload.addEventListener("click", openFilePicker);

emptyUpload.addEventListener("click", openFilePicker);


fileInput.addEventListener("change", function() {

    uploadFiles(this.files);

});


/* =========================================
   15. DRAG AND DROP
========================================= */

dropZone.addEventListener("dragover", event => {

    event.preventDefault();

    dropZone.classList.add("dragover");

});

dropZone.addEventListener("dragleave", event => {

    if (!dropZone.contains(event.relatedTarget)) {

        dropZone.classList.remove("dragover");

    }

});

dropZone.addEventListener("drop", event => {

    event.preventDefault();

    dropZone.classList.remove("dragover");

    const files = event.dataTransfer.files;

    uploadFiles(files);

});

dropZone.addEventListener("click", event => {

    if (
        event.target.closest("button") ||
        event.target.closest("input")
    ) return;

    openFilePicker();

});

dropZone.addEventListener("keydown", event => {

    if (event.key === "Enter") {
        openFilePicker();
    }

});


/* =========================================
   16. LIGHTBOX
========================================= */

function openLightbox(index) {

    currentLightboxIndex = index;

    showLightboxItem();

    lightbox.classList.add("open");

    document.body.style.overflow = "hidden";

}


function showLightboxItem() {

    const item = filteredItems[currentLightboxIndex];

    if (!item) return;

    lightboxContent.innerHTML = "";

    const url = createMediaURL(item.blob);

    lightboxName.textContent = item.name;

    lightboxCounter.textContent =
        `${currentLightboxIndex + 1} / ${filteredItems.length}`;

    if (item.type === "image") {

        const img = document.createElement("img");

        img.src = url;

        img.alt = item.name;

        lightboxContent.appendChild(img);

    } else {

        const video = document.createElement("video");

        video.src = url;

        video.controls = true;

        video.autoplay = true;

        video.playsInline = true;

        video.preload = "auto";

        lightboxContent.appendChild(video);

    }

    prevBtn.style.display =
        filteredItems.length > 1 ? "flex" : "none";

    nextBtn.style.display =
        filteredItems.length > 1 ? "flex" : "none";

}


function closeLightbox() {

    lightbox.classList.remove("open");

    document.body.style.overflow = "";

    lightboxContent.innerHTML = "";

}


function nextMedia() {

    if (filteredItems.length <= 1) return;

    currentLightboxIndex++;

    if (currentLightboxIndex >= filteredItems.length) {

        currentLightboxIndex = 0;

    }

    showLightboxItem();

}


function previousMedia() {

    if (filteredItems.length <= 1) return;

    currentLightboxIndex--;

    if (currentLightboxIndex < 0) {

        currentLightboxIndex = filteredItems.length - 1;

    }

    showLightboxItem();

}


lightboxClose.addEventListener("click", closeLightbox);

nextBtn.addEventListener("click", nextMedia);

prevBtn.addEventListener("click", previousMedia);


// Modal tashqarisiga bosilganda yopish

lightbox.addEventListener("click", event => {

    if (event.target === lightbox) {

        closeLightbox();

    }

});


/* =========================================
   17. KEYBOARD CONTROLS
========================================= */

document.addEventListener("keydown", event => {

    if (!lightbox.classList.contains("open")) return;

    if (event.key === "Escape") {

        closeLightbox();

    }

    if (event.key === "ArrowRight") {

        nextMedia();

    }

    if (event.key === "ArrowLeft") {

        previousMedia();

    }

});


/* =========================================
   18. DARK MODE
========================================= */

function setTheme(dark) {

    document.body.classList.toggle("dark", dark);

    themeBtn.textContent = dark ? "☀" : "☾";

    try {

        localStorage.setItem(
            "media-gallery-theme",
            dark ? "dark" : "light"
        );

    } catch (error) {

        console.warn("Theme saqlanmadi:", error);

    }

}


themeBtn.addEventListener("click", () => {

    const isDark = !document.body.classList.contains("dark");

    setTheme(isDark);

});


function loadTheme() {

    let savedTheme = "light";

    try {

        savedTheme =
            localStorage.getItem("media-gallery-theme") || "light";

    } catch (error) {

        console.warn(error);

    }

    setTheme(savedTheme === "dark");

}


/* =========================================
   19. CLEANUP
========================================= */

window.addEventListener("pagehide", () => {

    clearObjectURLs();

    if (db) {
        db.close();
    }

});


/* =========================================
   20. INITIALIZATION
========================================= */

async function init() {

    try {

        loadTheme();

        await openDatabase();

        await loadGallery();

        setupFilters();

        console.log(
            "Media Gallery muvaffaqiyatli ishga tushdi!"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Galereyani ishga tushirib bo'lmadi. Brauzer sozlamalarini tekshiring."
        );

    }

}


// START APPLICATION

init();
