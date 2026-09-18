/* ============================================================
       DATA MODEL
       ============================================================ */
    // Status login admin - nilai awal false, dicek ulang secara async dari
    // sesi Supabase Auth oleh checkExistingSession() di js/login.js
    let isAdmin = false;

    let trendRows = [];   // [{bulan, bintang, nonbintang, total}]  <- DRAF yang diedit admin
    let rlmtRows = [];    // [{bulan, Bintang:{Asing,Indonesia,Total}, Nonbintang:{...}, Total:{...}}] <- DRAF

    // Data yang SEDANG ditampilkan di halaman Penampil BRS (publik).
    // Bisa berisi salinan sebuah edisi yang sudah diterbitkan, atau salinan
    // draf admin (kalau sedang mode "Pratinjau Draf").
    let activeTrendRows = [];
    let activeRlmtRows = [];
    let isDraftPreview = false;     // true = activeTrendRows/activeRlmtRows berisi draf, belum resmi terbit
    let currentEditionLabel = null; // label edisi yang sedang tampil (null kalau draf)

    // Daftar edisi BRS yang sudah diterbitkan - diambil dari database
    // Supabase (tabel published_editions) saat halaman dimuat, lihat
    // blok INIT di bagian bawah file ini.
    let publishedEditions = [];

    // Draf yang sedang diedit admin (trendRows/rlmtRows) juga disimpan ke
    // database (tabel draft_data), supaya kalau halaman di-refresh atau
    // dibuka lagi nanti (bahkan dari perangkat lain), perubahan yang belum
    // diterbitkan tidak hilang begitu saja.
    //
    // suppressDraftAutosave: dipakai SAAT INIT saja - supaya kalau proses
    // ambil draf dari database gagal/telat (mis. RLS belum sempat
    // terkonfirmasi) dan sistem terpaksa fallback ke data contoh, fallback
    // itu TIDAK otomatis menimpa draf asli yang sudah tersimpan di database.
    // Render tabel yang dipicu aksi admin sungguhan (edit sel, tambah/hapus
    // baris, impor, dll) tetap selalu tersimpan seperti biasa.
    let suppressDraftAutosave = false;
    function saveDraftToStorage() {
      if (suppressDraftAutosave) return;
      if (typeof dbSaveDraft !== "function") return;
      dbSaveDraft(trendRows, rlmtRows).then(err => {
        if (err) console.error("Gagal menyimpan draf ke database:", err.message || err);
      });
    }
    async function loadDraftFromStorage() {
      if (typeof dbFetchDraft !== "function") return false;
      try {
        const draft = await dbFetchDraft();
        if (draft && Array.isArray(draft.trendRows) && draft.trendRows.length) {
          trendRows = draft.trendRows;
          rlmtRows = Array.isArray(draft.rlmtRows) ? draft.rlmtRows : [];
          return true;
        }
      } catch (e) { console.error(e); }
      return false;
    }
    const stayRowLabels = ["Bintang", "Nonbintang", "Total"];
    const stayColLabels = ["Asing", "Indonesia", "Total"];
    function blankRlmtRow(bulan) {
      return { bulan, Bintang: { Asing: null, Indonesia: null, Total: null }, Nonbintang: { Asing: null, Indonesia: null, Total: null }, Total: { Asing: null, Indonesia: null, Total: null } };
    }
    let chart1, chart2;

    /* ============================================================
       DATA AWAL - bersumber dari TPK.xlsx (data BPS s.d. Mei 2026)
       Gunakan tombol "Impor Excel" untuk memperbarui/menambah sumber
       data bulan berikutnya dari file .xlsx lain dengan pola serupa.
       ============================================================ */
    function defaultTrendFull() {
      return [
        ["Januari 2025", 42.10, 15.20, 29.15],
        ["Februari 2025", 45.30, 16.10, 31.20],
        ["Maret 2025", 47.80, 17.05, 32.90],
        ["April 2025", 49.60, 17.90, 34.20],
        ["Mei 2025", 51.00, 18.57, 35.95],
        ["Juni 2025", 51.36, 18.01, 35.66],
        ["Juli 2025", 48.15, 18.31, 34.14],
        ["Agustus 2025", 43.57, 17.26, 31.22],
        ["September 2025", 50.76, 17.91, 35.34],
        ["Oktober 2025", 54.82, 18.22, 37.64],
        ["November 2025", 59.20, 21.53, 41.71],
        ["Desember 2025", 57.06, 22.26, 40.91],
        ["Januari 2026", 51.48, 22.26, 37.35],
        ["Februari 2026", 46.04, 20.96, 34.10],
        ["Maret 2026", 49.36, 22.91, 36.68],
        ["April 2026", 53.69, 23.88, 39.36],
        ["Mei 2026", 55.47, 22.44, 39.61]
      ].map(r => ({ bulan: r[0], bintang: r[1], nonbintang: r[2], total: r[3] }));
    }
    function defaultStayFull() {
      // Data RLMT (Januari 2025 - Mei 2026), sumber: TPK.xlsx
      const rows = [
        ["Januari 2025", [1.620, 1.100, 1.100], [1.000, 1.020, 1.020], [1.550, 1.080, 1.080]],
        ["Februari 2025", [1.700, 1.090, 1.090], [0.000, 1.030, 1.030], [1.700, 1.070, 1.070]],
        ["Maret 2025", [1.800, 1.100, 1.110], [1.000, 1.020, 1.020], [1.750, 1.080, 1.080]],
        ["April 2025", [1.650, 1.120, 1.120], [2.000, 1.030, 1.030], [1.680, 1.090, 1.090]],
        ["Mei 2025", [1.458, 1.127, 1.128], [3.000, 1.024, 1.025], [1.490, 1.100, 1.101]],
        ["Juni 2025", [1.903, 1.113, 1.115], [1.000, 1.017, 1.017], [1.875, 1.088, 1.089]],
        ["Juli 2025", [1.710, 1.093, 1.095], [0.000, 1.030, 1.030], [1.710, 1.080, 1.080]],
        ["Agustus 2025", [1.737, 1.080, 1.082], [2.000, 1.030, 1.030], [1.741, 1.067, 1.068]],
        ["September 2025", [2.104, 1.132, 1.134], [0.000, 1.039, 1.039], [2.104, 1.108, 1.110]],
        ["Oktober 2025", [2.390, 1.175, 1.178], [null, 1.063, 1.063], [2.390, 1.148, 1.150]],
        ["November 2025", [2.097, 1.197, 1.199], [1.000, 1.081, 1.081], [2.046, 1.167, 1.168]],
        ["Desember 2025", [1.556, 1.118, 1.119], [0.000, 1.017, 1.017], [1.556, 1.090, 1.091]],
        ["Januari 2026", [2.050, 1.110, 1.110], [1.000, 1.030, 1.030], [2.020, 1.090, 1.090]],
        ["Februari 2026", [1.590, 1.130, 1.130], [1.000, 1.020, 1.020], [1.460, 1.090, 1.090]],
        ["Maret 2026", [2.250, 1.120, 1.120], [null, 1.020, 1.020], [2.250, 1.090, 1.090]],
        ["April 2026", [1.610, 1.150, 1.160], [null, 1.010, 1.010], [1.610, 1.110, 1.110]],
        ["Mei 2026", [2.610, 1.180, 1.180], [null, 1.010, 1.010], [2.610, 1.130, 1.130]]
      ];
      return rows.map(r => ({
        bulan: r[0],
        Bintang: { Asing: r[1][0], Indonesia: r[1][1], Total: r[1][2] },
        Nonbintang: { Asing: r[2][0], Indonesia: r[2][1], Total: r[2][2] },
        Total: { Asing: r[3][0], Indonesia: r[3][1], Total: r[3][2] }
      }));
    }
    // Draf admin tetap memakai jendela 13 bulan terakhir (bukan seluruh
    // riwayat Full), supaya perbandingan tahun-lalu (baris pertama) tetap
    // pas 12 bulan ke belakang.
    function defaultTrend() { return defaultTrendFull().slice(-13); }
    function defaultStay() { return defaultStayFull().slice(-13); }
    function loadSampleTrend() { trendRows = defaultTrend(); renderTrendTable(); showToast("Data tren dimuat dari TPK.xlsx (s.d. Mei 2026)"); }
    function loadSampleStay() { rlmtRows = defaultStay(); renderStayTable(); showToast("Data RLMT dimuat dari TPK.xlsx (s.d. Mei 2026)"); }

    /* ============================================================
       HELPERS
       ============================================================ */
    function fmt(n, d = 2) {
      if (n === null || n === undefined || n === "" || Number.isNaN(n)) return "-";
      let num = typeof n === "string" ? toNum(n) : n;
      if (num === null || Number.isNaN(num)) return "-";
      return num.toFixed(d).replace(".", ",");
    }
    // robust parser: accepts "51,36" or "51.36" or "-"
    function toNum(raw) {
      if (raw === null || raw === undefined) return null;
      let s = String(raw).trim();
      if (s === "" || s === "-" || s.toLowerCase() === "na" || s.toLowerCase() === "n/a") return null;
      s = s.replace(",", ".");
      let v = parseFloat(s);
      return Number.isNaN(v) ? null : v;
    }
    function pointChange(cur, prev) {
      if (cur === null || prev === null) return { word: "-", text: "-", cls: "" };
      let d = cur - prev;
      if (Math.abs(d) < 0.005) return { word: "tetap", text: "tetap", cls: "" };
      let word = d > 0 ? "naik" : "turun";
      let cls = d > 0 ? "pos" : "neg";
      return { word, text: (d > 0 ? "+" : "") + fmt(d) + " poin", cls, abs: fmt(Math.abs(d)) };
    }
    function longerShorter(cur, prev) {
      if (cur === null || prev === null) return "-";
      if (Math.abs(cur - prev) < 0.005) return "sama dengan";
      return cur > prev ? "lebih lama" : "lebih singkat";
    }
    function higherLower(cur, prev) {
      if (cur === null || prev === null) return "-";
      if (Math.abs(cur - prev) < 0.005) return "tetap";
      return cur > prev ? "naik" : "turun";
    }

    /* ============================================================
       TREND TABLE (input) RENDER - TPK, 13 bulan
       ============================================================ */
    function renderTrendTable() {
      const body = document.getElementById("trendBody");
      body.innerHTML = "";
      const ro = isAdmin ? "" : "readonly";
      trendRows.forEach((row, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td class="rowno">${i + 1}</td>
      <td><input class="bulan-input" ${ro} value="${row.bulan}" onchange="trendRows[${i}].bulan=this.value;saveDraftToStorage();"></td>
      <td><input ${ro} value="${row.bintang ?? ""}" onchange="trendRows[${i}].bintang=toNum(this.value);saveDraftToStorage();"></td>
      <td><input ${ro} value="${row.nonbintang ?? ""}" onchange="trendRows[${i}].nonbintang=toNum(this.value);saveDraftToStorage();"></td>
      <td><input ${ro} value="${row.total ?? ""}" onchange="trendRows[${i}].total=toNum(this.value);saveDraftToStorage();"></td>
      <td class="action-cell"><div class="row-actions"><button class="editrow-btn" onclick="requireAdmin(toggleRowEdit, this, 'trendBody', ${i})" title="Edit baris">Edit</button><button class="rmrow-btn" onclick="requireAdmin(removeTrendRow,${i})" title="Hapus baris">Hapus</button></div></td>
    `;
        body.appendChild(tr);
      });
      saveDraftToStorage();
    }
    function addTrendRow() {
      trendRows.push({ bulan: "Bulan Baru", bintang: null, nonbintang: null, total: null });
      renderTrendTable();
    }

    /* ============================================================
       ROLL TO NEXT MONTH (geser jendela periode BRS bulanan)
       ============================================================ */
    const ID_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const ID_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    function shortMonthLabel(full) {
      const parts = String(full || "").trim().split(/\s+/);
      if (parts.length < 2) return full;
      const year = parts[parts.length - 1].slice(-2);
      const monthStr = parts.slice(0, -1).join(" ").toLowerCase();
      const idx = ID_MONTHS.findIndex(m => m.toLowerCase() === monthStr);
      if (idx === -1) return full;
      return `${ID_MONTHS_SHORT[idx]} ${year}`;
    }

    function monthSortKey(label) {
      const parts = String(label || "").trim().split(/\s+/);
      if (parts.length < 2) return 999999;
      const year = parseInt(parts[parts.length - 1], 10);
      const monthStr = parts.slice(0, -1).join(" ").toLowerCase();
      const idx = ID_MONTHS.findIndex(m => m.toLowerCase() === monthStr);
      if (idx === -1 || Number.isNaN(year)) return 999999;
      return year * 12 + idx;
    }

    function guessNextMonthLabel(label) {
      if (!label) return "Bulan Baru";
      const parts = label.trim().split(/\s+/);
      if (parts.length < 2) return "Bulan Baru";
      const yearStr = parts[parts.length - 1];
      const monthStr = parts.slice(0, -1).join(" ");
      const year = parseInt(yearStr, 10);
      const idx = ID_MONTHS.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
      if (idx === -1 || Number.isNaN(year)) return "Bulan Baru";
      let nextIdx = idx + 1, nextYear = year;
      if (nextIdx > 11) { nextIdx = 0; nextYear += 1; }
      return ID_MONTHS[nextIdx] + " " + nextYear;
    }

    function rollToNextMonth() {
      if (trendRows.length === 0) { showToast("Isi data tren dulu sebelum menggeser periode"); return; }
      const lastLabel = trendRows[trendRows.length - 1].bulan;
      const nextLabel = guessNextMonthLabel(lastLabel);
      const ok = confirm(
        `Geser periode ke bulan berikutnya?\n\n` +
        `• Bulan "${trendRows[0].bulan}" (paling lama) akan dibuang dari tabel TPK & RLMT.\n` +
        `• Baris baru "${nextLabel}" ditambahkan di akhir kedua tabel (kosong, siap diisi).\n\n` +
        `Lanjutkan?`
      );
      if (!ok) return;

      // 1) shift the 13-month TPK trend window
      trendRows.shift();
      trendRows.push({ bulan: nextLabel, bintang: null, nonbintang: null, total: null });

      // 2) shift the 13-month RLMT trend window the same way
      rlmtRows.shift();
      rlmtRows.push(blankRlmtRow(nextLabel));

      renderTrendTable();
      renderStayTable();
      showPanel("input");
      showToast(`Periode digeser ke ${nextLabel} - silakan isi data terbaru`);
    }
    function removeTrendRow(i) {
      trendRows.splice(i, 1);
      renderTrendTable();
    }

    function toggleRowEdit(button, bodyId, rowIndex) {
      const row = document.getElementById(bodyId)?.querySelectorAll("tr")[rowIndex];
      if (!row) return;
      const isEditing = row.classList.toggle("row-editing");
      row.querySelectorAll("input").forEach(input => { input.readOnly = !isEditing; });
      button.textContent = isEditing ? "Simpan" : "Edit";
      if (isEditing) row.querySelector("input")?.focus();
      else saveDraftToStorage();
    }
    function toggleTrendPaste() {
      document.getElementById("trendPasteBox").classList.toggle("open");
    }
    function applyTrendPaste() {
      const raw = document.getElementById("trendPasteArea").value;
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) { toggleTrendPaste(); return; }
      let rows = [];
      lines.forEach(line => {
        const cells = line.split(/\t/).map(c => c.trim());
        if (cells.length < 2) return;
        // skip header-like row
        if (isNaN(parseFloat(cells[1]?.replace(",", "."))) && !/^\d/.test(cells[1] || "")) {
          if (/bintang/i.test(cells[1] || "") || /tpk/i.test(cells[0] || "")) return;
        }
        rows.push({
          bulan: cells[0] || "",
          bintang: toNum(cells[1]),
          nonbintang: toNum(cells[2]),
          total: toNum(cells[3])
        });
      });
      if (rows.length > 0) { trendRows = rows; renderTrendTable(); }
      document.getElementById("trendPasteArea").value = "";
      toggleTrendPaste();
    }

    /* ============================================================
       RLMT TABLE (input) - tren bulanan lama-menginap, 13 bulan
       ============================================================ */
    function renderStayTable() {
      const body = document.getElementById("stayBody");
      body.innerHTML = "";
      const ro = isAdmin ? "" : "readonly";
      rlmtRows.forEach((row, i) => {
        let cellsHTML = `<td><input class="bulan-input" ${ro} value="${row.bulan}" onchange="rlmtRows[${i}].bulan=this.value;saveDraftToStorage();"></td>`;
        stayRowLabels.forEach(rowKey => {
          stayColLabels.forEach(colKey => {
            const val = row[rowKey][colKey];
            cellsHTML += `<td><input ${ro} value="${val === null || val === undefined ? '' : val}" onchange="rlmtRows[${i}]['${rowKey}']['${colKey}']=toNum(this.value);saveDraftToStorage();"></td>`;
          });
        });
        cellsHTML += `<td class="action-cell"><div class="row-actions"><button class="editrow-btn" onclick="requireAdmin(toggleRowEdit, this, 'stayBody', ${i})" title="Edit baris">Edit</button><button class="rmrow-btn" onclick="requireAdmin(removeRlmtRow,${i})" title="Hapus baris">Hapus</button></div></td>`;
        const tr = document.createElement("tr");
        tr.innerHTML = cellsHTML;
        body.appendChild(tr);
      });
      saveDraftToStorage();
    }
    function addRlmtRow() {
      rlmtRows.push(blankRlmtRow("Bulan Baru"));
      renderStayTable();
    }
    function removeRlmtRow(i) {
      rlmtRows.splice(i, 1);
      renderStayTable();
    }
    function toggleStayPaste() {
      document.getElementById("stayPasteBox").classList.toggle("open");
    }

    /* Parses the RLMT block exactly as copied from the BPS Excel working file:
       optional month-header row, optional Asing/Nusantara/Gabungan sub-header row,
       then 3 data rows in order Bintang / NonBintang / Total(Gabungan), each with
       N months x 3 columns (Asing, Indonesia, Total). Merges into existing rlmtRows
       by matching month label (so partial pastes like "Juni-Desember 2025" work). */
    function parseRlmtPasteBlock(text) {
      const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length > 0);
      if (lines.length === 0) return null;
      let headerIdx = -1;
      for (let i = 0; i < Math.min(lines.length, 3); i++) {
        const cells = lines[i].split("\t").map(collapseWS);
        const hits = cells.filter(c => MONTH_RE.test(c.toLowerCase())).length;
        if (hits >= 1) { headerIdx = i; break; }
      }
      let months = [];
      let dataStart;
      if (headerIdx !== -1) {
        const cells = lines[headerIdx].split("\t").map(collapseWS);
        cells.forEach((c, idx) => { if (MONTH_RE.test(c.toLowerCase())) months.push({ col: idx, label: c }); });
        dataStart = headerIdx + 1;
        if (lines[dataStart] && /asing/i.test(lines[dataStart])) dataStart++;
      } else {
        dataStart = 0;
        months = rlmtRows.map((r, idx) => ({ col: idx * 3, label: r.bulan }));
      }
      const dataLines = lines.slice(dataStart, dataStart + 3);
      if (dataLines.length < 3 || months.length === 0) return null;
      const rows = dataLines.map(l => l.split("\t").map(c => toNum(c)));
      return months.map(m => ({
        bulan: m.label,
        Bintang: { Asing: rows[0][m.col], Indonesia: rows[0][m.col + 1], Total: rows[0][m.col + 2] },
        Nonbintang: { Asing: rows[1][m.col], Indonesia: rows[1][m.col + 1], Total: rows[1][m.col + 2] },
        Total: { Asing: rows[2][m.col], Indonesia: rows[2][m.col + 1], Total: rows[2][m.col + 2] }
      }));
    }
    function mergeRlmtRows(newRows) {
      newRows.forEach(nr => {
        const idx = rlmtRows.findIndex(r => collapseWS(r.bulan).toLowerCase() === collapseWS(nr.bulan).toLowerCase());
        if (idx >= 0) rlmtRows[idx] = nr; else rlmtRows.push(nr);
      });
      rlmtRows.sort((a, b) => monthSortKey(a.bulan) - monthSortKey(b.bulan));
      if (rlmtRows.length > 13) rlmtRows = rlmtRows.slice(rlmtRows.length - 13);
    }
    function applyStayPaste() {
      const raw = document.getElementById("stayPasteArea").value;
      const parsed = parseRlmtPasteBlock(raw);
      if (!parsed) { showToast("Format tidak dikenali - cek kembali data yang ditempel"); toggleStayPaste(); return; }
      mergeRlmtRows(parsed);
      renderStayTable();
      document.getElementById("stayPasteArea").value = "";
      toggleStayPaste();
      showToast(`${parsed.length} bulan data RLMT digabungkan`);
    }

    /* ============================================================
       COMPUTE TABLE 1 (TPK 3-period summary, derived from trend)
       ============================================================ */
    function computeTable1() {
      const n = activeTrendRows.length;
      if (n < 2) return null;
      const p0 = activeTrendRows[0];
      const p1 = activeTrendRows[n - 2];
      const p2 = activeTrendRows[n - 1];
      const rows = ["bintang", "nonbintang", "total"].map(key => {
        const v0 = p0[key], v1 = p1[key], v2 = p2[key];
        return {
          key,
          label: key === "bintang" ? "Bintang" : key === "nonbintang" ? "NonBintang" : "Total",
          v0, v1, v2,
          yoy: (v2 !== null && v0 !== null) ? v2 - v0 : null,
          mom: (v2 !== null && v1 !== null) ? v2 - v1 : null
        };
      });
      return { p0label: p0.bulan, p1label: p1.bulan, p2label: p2.bulan, rows };
    }

    /* ============================================================
       RENDER TABLE 1
       ============================================================ */
    function renderTable1() {
      const t1 = computeTable1();
      const periodHead = document.getElementById("table1PeriodHead");
      const body = document.getElementById("table1Body");
      if (!t1) { periodHead.innerHTML = ""; body.innerHTML = ""; return; }
      periodHead.innerHTML = `<th>${t1.p0label}</th><th>${t1.p1label}</th><th>${t1.p2label}</th>`;
      document.getElementById("t1h_yoy").textContent = `Perubahan ${t1.p2label} thd ${t1.p0label}`;
      document.getElementById("t1h_mom").textContent = `Perubahan ${t1.p2label} thd ${t1.p1label}`;
      body.innerHTML = t1.rows.map(r => {
        const yoyC = r.yoy === null ? "" : (r.yoy >= 0 ? "pos" : "neg");
        const momC = r.mom === null ? "" : (r.mom >= 0 ? "pos" : "neg");
        const yoyTxt = r.yoy === null ? "-" : (r.yoy >= 0 ? "+" : "") + fmt(r.yoy);
        const momTxt = r.mom === null ? "-" : (r.mom >= 0 ? "+" : "") + fmt(r.mom);
        return `<tr class="${r.key === 'total' ? 'total-row' : ''}">
      <td class="lbl-cell">${r.label}</td>
      <td>${fmt(r.v0)}</td><td>${fmt(r.v1)}</td><td>${fmt(r.v2)}</td>
      <td class="${yoyC}">${yoyTxt}</td>
      <td class="${momC}">${momTxt}</td>
    </tr>`;
      }).join("");
    }

    /* ============================================================
       COMPUTE TABLE 2 (RLMT 3-period summary, derived from rlmtRows)
       ============================================================ */
    function computeTable2() {
      const n = activeRlmtRows.length;
      if (n < 2) return null;
      return {
        p0label: activeRlmtRows[0].bulan, p1label: activeRlmtRows[n - 2].bulan, p2label: activeRlmtRows[n - 1].bulan,
        p0: activeRlmtRows[0], p1: activeRlmtRows[n - 2], p2: activeRlmtRows[n - 1]
      };
    }

    /* ============================================================
       RENDER TABLE 2
       ============================================================ */
    function renderTable2() {
      const t2 = computeTable2();
      const periodHead = document.getElementById("table2PeriodHead");
      const body = document.getElementById("table2Body");
      if (!t2) { periodHead.innerHTML = ""; body.innerHTML = ""; return; }
      const labels = [t2.p0label, t2.p1label, t2.p2label];
      periodHead.innerHTML = "";
      for (let g = 0; g < 3; g++) { labels.forEach(lbl => { periodHead.innerHTML += `<th>${lbl}</th>`; }); }
      const periods = [t2.p0, t2.p1, t2.p2];
      body.innerHTML = stayRowLabels.map(rowKey => {
        let tds = `<td class="lbl-cell">${rowKey === "Nonbintang" ? "NonBintang" : rowKey}</td>`;
        stayColLabels.forEach(colKey => {
          periods.forEach(p => { tds += `<td>${fmt(p[rowKey][colKey])}</td>`; });
        });
        return `<tr class="${rowKey === 'Total' ? 'total-row' : ''}">${tds}</tr>`;
      }).join("");
    }

    /* ============================================================
       CHARTS
       ============================================================ */
    const COLORS = { blue: "#0093DD", orange: "#EB891B", green: "#68B92E" };

    function baseDataset(label, color, data) {
      return {
        label, data, borderColor: color, backgroundColor: color,
        pointBackgroundColor: color, pointBorderColor: "#fff", pointBorderWidth: 2,
        borderWidth: 3.4, pointRadius: 5, pointHoverRadius: 7, tension: .32, fill: false,
        datalabels: {
          color: "#1b2733", font: { weight: 700, size: 11.5, family: "Inter" },
          formatter: (v) => v === null ? "" : fmt(v),
          align: (ctx) => ctx.datasetIndex === 0 ? "top" : (ctx.datasetIndex === 1 ? "bottom" : "top"),
          offset: 6, anchor: "center"
        }
      };
    }
    function commonOpts() {
      return {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 28, bottom: 6, left: 28, right: 44 } },
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8, padding: 18, font: { family: "Inter", weight: 600, size: 12.5 } } },
          datalabels: {}
        },
        scales: {
          x: { offset: true, grid: { display: false }, ticks: { font: { family: "Inter", size: 11.5, weight: 600 }, maxRotation: 45, minRotation: 45, color: "#4B5D69" } },
          y: { display: false, grid: { display: false } }
        }
      };
    }

    function renderChart1() {
      const labels = activeTrendRows.map(r => r.bulan);
      const ctx = document.getElementById("chart1").getContext("2d");
      if (chart1) chart1.destroy();
      chart1 = new Chart(ctx, {
        type: "line",
        data: {
          labels, datasets: [
            baseDataset("Bintang", COLORS.blue, activeTrendRows.map(r => r.bintang)),
            baseDataset("NonBintang", COLORS.orange, activeTrendRows.map(r => r.nonbintang)),
            baseDataset("Bintang+NonBintang", COLORS.green, activeTrendRows.map(r => r.total)),
          ]
        },
        options: commonOpts(),
        plugins: [ChartDataLabels]
      });
      if (activeTrendRows.length) {
        document.getElementById("chart1Title").innerHTML =
          `Tingkat Penghunian Kamar Hotel Gabungan<br>${activeTrendRows[0].bulan} &ndash; ${activeTrendRows[activeTrendRows.length - 1].bulan} (Persen)`;
      }
    }
    function renderChart2() {
      const labels = activeTrendRows.map(r => r.bulan);
      const ctx = document.getElementById("chart2").getContext("2d");
      if (chart2) chart2.destroy();
      chart2 = new Chart(ctx, {
        type: "line",
        data: { labels, datasets: [baseDataset("Bintang", COLORS.blue, activeTrendRows.map(r => r.bintang))] },
        options: Object.assign(commonOpts(), { plugins: Object.assign({}, commonOpts().plugins, { legend: { display: false } }) }),
        plugins: [ChartDataLabels]
      });
      if (activeTrendRows.length) {
        document.getElementById("chart2Title").innerHTML =
          `Tingkat Penghunian Kamar Hotel Bintang<br>${activeTrendRows[0].bulan} &ndash; ${activeTrendRows[activeTrendRows.length - 1].bulan} (Persen)`;
      }
    }

    /* ============================================================
       NARRATIVES
       ============================================================ */
    function bd(text) {
      return `<b>${text}</b>`;
    }
    function changeWords(cur, prev) {
      if (cur === null || prev === null) return { verb: "-", noun: "-", abs: "-" };
      const d = cur - prev;
      if (Math.abs(d) < 0.005) return { verb: "tetap", noun: "kestabilan", abs: "0,00" };
      return d > 0
        ? { verb: "naik", noun: "kenaikan", abs: fmt(Math.abs(d)) }
        : { verb: "turun", noun: "penurunan", abs: fmt(Math.abs(d)) };
    }

    function renderTitle() {
      const t1 = computeTable1();
      const el = document.getElementById("brsMainTitle");
      if (!el) return;
      el.textContent = t1
        ? `Perkembangan Tingkat Penghunian Kamar Hotel di Kota Tasikmalaya, ${t1.p2label}`
        : "Perkembangan Tingkat Penghunian Kamar Hotel di Kota Tasikmalaya";
    }

    function narrBrief() {
      const t1 = computeTable1();
      if (!t1) return "";
      const total = t1.rows.find(r => r.key === "total");
      const bintang = t1.rows.find(r => r.key === "bintang");
      const nonbintang = t1.rows.find(r => r.key === "nonbintang");
      const cT = changeWords(total.v2, total.v1);
      const cB = changeWords(bintang.v2, bintang.v1);
      const cN = changeWords(nonbintang.v2, nonbintang.v1);
      const t2 = computeTable2();
      const B2 = t2 ? t2.p2.Bintang.Total : null, N2 = t2 ? t2.p2.Nonbintang.Total : null;
      const A2 = t2 ? t2.p2.Total.Asing : null, I2 = t2 ? t2.p2.Total.Indonesia : null;
      const P2 = bd(t1.p2label), P1 = bd(t1.p1label);

      const items = [
        `Tingkat Penghunian Kamar (TPK) hotel gabungan bintang dan nonbintang di Kota Tasikmalaya pada ${P2} berada pada angka ${bd(fmt(total.v2) + " persen")}. TPK Hotel Bintang mencapai ${bd(fmt(bintang.v2) + " persen")}, sementara TPK Hotel Nonbintang mencapai ${bd(fmt(nonbintang.v2) + " persen")}.`,
        `Tingkat Penghunian Kamar (TPK) Hotel di Kota Tasikmalaya pada ${P2} mencapai ${bd(fmt(total.v2) + " persen")}, ${cT.verb} ${bd(cT.abs + " poin")} dibandingkan TPK ${P1} yang mencapai ${bd(fmt(total.v1) + " persen")}.`,
        `TPK hotel bintang pada ${P2} sebesar ${bd(fmt(bintang.v2) + " persen")}, ${cB.verb} ${bd(cB.abs + " poin")} dibandingkan TPK ${P1} yang mencapai ${bd(fmt(bintang.v1) + " persen")}.`,
        `TPK hotel nonbintang pada ${P2} sebesar ${bd(fmt(nonbintang.v2) + " persen")}, ${cN.verb} ${bd(cN.abs + " poin")} dibandingkan TPK ${P1} yang mencapai ${bd(fmt(nonbintang.v1) + " persen")}.`,
        `Rata-rata lama menginap tamu di hotel bintang pada ${P2} tercatat ${bd(fmt(B2) + " malam")} dan di hotel nonbintang selama ${bd(fmt(N2) + " malam")}.`,
        `Rata-rata lama menginap tamu asing pada ${P2} tercatat ${bd(fmt(A2) + " malam")} dan tamu Indonesia selama ${bd(fmt(I2) + " malam")}.`
      ];
      return items.map(t => `<li>${t}</li>`).join("");
    }

    function narrTPK() {
      const t1 = computeTable1();
      if (!t1) return "";
      const total = t1.rows.find(r => r.key === "total");
      const bintang = t1.rows.find(r => r.key === "bintang");
      const nonbintang = t1.rows.find(r => r.key === "nonbintang");

      const momT = changeWords(total.v2, total.v1), yoyT = changeWords(total.v2, total.v0);
      const momB = changeWords(bintang.v2, bintang.v1), yoyB = changeWords(bintang.v2, bintang.v0);
      const momN = changeWords(nonbintang.v2, nonbintang.v1), yoyN = changeWords(nonbintang.v2, nonbintang.v0);

      const P2 = bd(t1.p2label), P1 = bd(t1.p1label), P0 = bd(t1.p0label);

      return `<p>Tingkat Penghunian Kamar (TPK) Hotel Bintang dan Nonbintang di Kota Tasikmalaya pada ${P2} mencapai ${bd(fmt(total.v2) + " persen")}, ${momT.verb} ${bd(momT.abs + " poin")} dibanding TPK ${P1} yang mencapai ${bd(fmt(total.v1) + " persen")} dan jika dibandingkan dengan bulan yang sama di tahun sebelumnya (${P0}) ${yoyT.verb} ${bd(yoyT.abs + " poin")}, yaitu dari ${bd(fmt(total.v0) + " persen")} menjadi ${bd(fmt(total.v2) + " persen")}. TPK Hotel Bintang pada ${P2} mengalami ${momB.noun} ${bd(momB.abs + " poin")} dibandingkan dengan TPK bulan sebelumnya (${P1}) dari ${bd(fmt(bintang.v1) + " persen")} menjadi ${bd(fmt(bintang.v2) + " persen")} dan jika dibandingkan dengan bulan yang sama di tahun sebelumnya (${P0}) ${yoyB.verb} ${bd(yoyB.abs + " poin")}, yaitu dari ${bd(fmt(bintang.v0) + " persen")} menjadi ${bd(fmt(bintang.v2) + " persen")}. Adapun untuk TPK Hotel Nonbintang pada ${P2} dibanding dengan bulan sebelumnya (${P1}) ${momN.verb} ${bd(momN.abs + " poin")}, yaitu dari ${bd(fmt(nonbintang.v1) + " persen")} menjadi ${bd(fmt(nonbintang.v2) + " persen")} dan jika dibandingkan dengan bulan yang sama di tahun sebelumnya (${P0}) ${yoyN.verb} ${bd(yoyN.abs + " poin")} yaitu dari ${bd(fmt(nonbintang.v0) + " persen")} menjadi ${bd(fmt(nonbintang.v2) + " persen")}.</p>`;
    }

    function narrStayTotal() {
      const t2 = computeTable2();
      if (!t2) return "";
      const periods = [t2.p0, t2.p1, t2.p2];
      const T = periods.map(x => x.Total.Total), B = periods.map(x => x.Bintang.Total), N = periods.map(x => x.Nonbintang.Total);
      const P2 = bd(t2.p2label), P1 = bd(t2.p1label), P0 = bd(t2.p0label);
      return `<p>Secara total, rata-rata lama menginap tamu (asing dan Indonesia) pada jasa akomodasi di Kota Tasikmalaya pada ${P2} tercatat ${bd(fmt(T[2]) + " malam")} ${longerShorter(T[2], T[1])} dibandingkan dengan tamu yang menginap pada ${P1} yang tercatat ${bd(fmt(T[1]) + " malam")} dan ${longerShorter(T[2], T[0])} dibandingkan ${P0} yang tercatat ${bd(fmt(T[0]) + " malam")}. Rata-rata lama menginap tamu di hotel bintang bulan ${P2} adalah ${bd(fmt(B[2]) + " malam")}, ${longerShorter(B[2], N[2])} dibandingkan dengan tamu yang menginap di hotel nonbintang yaitu ${bd(fmt(N[2]) + " malam")}.</p>`;
    }

    function narrStayDetail() {
      const t2 = computeTable2();
      if (!t2) return "";
      const periods = [t2.p0, t2.p1, t2.p2];
      const A = periods.map(x => x.Total.Asing), ABintang = periods.map(x => x.Bintang.Asing);
      const I = periods.map(x => x.Total.Indonesia), IBintang = periods.map(x => x.Bintang.Indonesia), INon = periods.map(x => x.Nonbintang.Indonesia);
      const P2 = bd(t2.p2label), P1 = bd(t2.p1label), P0 = bd(t2.p0label);
      let out = `<p>Rata-rata lama menginap tamu Asing ${P2} tercatat ${bd(fmt(A[2]) + " malam")}, ${longerShorter(A[2], A[1])} dibanding ${P1} yang tercatat ${bd(fmt(A[1]) + " malam")} dan ${longerShorter(A[2], A[0])} dibanding ${P0} yang tercatat ${bd(fmt(A[0]) + " malam")}. Tamu Asing menginap di hotel bintang pada ${P2} rata-rata selama ${bd(fmt(ABintang[2]) + " malam")}.</p>`;
      out += `<p>Rata-rata lama menginap tamu Indonesia ${P2} tercatat ${bd(fmt(I[2]) + " malam")} ${longerShorter(I[2], I[1])} dibanding dengan rata-rata lama menginap tamu pada ${P1} yang tercatat ${bd(fmt(I[1]) + " malam")} dan ${longerShorter(I[2], I[0])} jika dibanding ${P0} yang tercatat ${bd(fmt(I[0]) + " malam")}. Tamu Indonesia menginap di hotel bintang pada ${P2} rata-rata selama ${bd(fmt(IBintang[2]) + " malam")} dan yang menginap di hotel nonbintang rata-rata ${bd(fmt(INon[2]) + " malam")}.</p>`;
      return out;
    }

    /* ============================================================
       MASTER RENDER
       ============================================================ */
    function renderCharts() {
      try {
        renderChart1();
        renderChart2();
      } catch (err) {
        console.error("Gagal menggambar grafik:", err);
        showToast("Gagal menggambar grafik - lihat console (F12)");
      }
    }

    function renderNarratives() {
      renderTitle();
      document.getElementById("briefList").innerHTML = narrBrief();
      document.getElementById("narrTPK").innerHTML = narrTPK();
      document.getElementById("narrStayTotal").innerHTML = narrStayTotal();
      document.getElementById("narrStayDetail").innerHTML = narrStayDetail();
    }

    function renderAll(switchTab) {
      renderTable1();
      renderTable2();
      renderNarratives();
      if (switchTab) {
        showPanel("output");
      } else if (!document.body.classList.contains("viewing-admin")) {
        // Penampil BRS selalu tampil (kecuali sedang di Panel Admin): aman
        // langsung gambar ulang grafiknya
        renderCharts();
      }
    }

    function toggleMobileNav() {
      const root = document.getElementById("dashboardRoot");
      const toggle = document.getElementById("mobileNavToggle");
      if (!root || !toggle) return;
      const isOpen = root.classList.toggle("mobile-menu-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Tutup menu navigasi" : "Buka menu navigasi");
    }

    function closeMobileNav() {
      const root = document.getElementById("dashboardRoot");
      const toggle = document.getElementById("mobileNavToggle");
      if (!root || !toggle) return;
      root.classList.remove("mobile-menu-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Buka menu navigasi");
    }

    function initPanelTransitions() {
      const outputPanel = document.getElementById("panel-output");
      if (!outputPanel || !("IntersectionObserver" in window)) return;

      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          outputPanel.classList.toggle("is-entering", entry.isIntersecting);
        });
      }, { threshold: .12 });

      observer.observe(outputPanel);
    }

    function showPanel(name) {
      closeMobileNav();
      const goingToAdmin = name === "input";
      const goingToPredict = name === "predict";
      document.body.classList.toggle("viewing-admin", goingToAdmin);
      document.body.classList.toggle("viewing-predict", goingToPredict);

      document.getElementById("tabbtn-beranda").classList.toggle("active", name === "beranda");
      document.getElementById("tabbtn-output").classList.toggle("active", name === "output");
      document.getElementById("tabbtn-predict").classList.toggle("active", name === "predict");
      document.getElementById("navbtn-tambah-data").classList.toggle("active", name === "input");
      document.getElementById("navbtn-edit-penampil").classList.toggle("active", name === "output");

      if (name === "output") {
        renderTable1();
        renderTable2();
        renderNarratives();
        requestAnimationFrame(() => { requestAnimationFrame(renderCharts); });
      }
      if (name === "predict") {
        if (typeof refreshPredictPanel === "function") refreshPredictPanel();
        requestAnimationFrame(() => { requestAnimationFrame(renderPredictChart); });
      }

      if (goingToAdmin) {
        // Panel Admin tampil eksklusif (Beranda/Penampil/Peramalan disembunyikan
        // sementara) - cukup scroll ke atas halaman.
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // Beranda dan Penampil BRS berada dalam satu alur scroll. Peramalan
      // dibuka sebagai tampilan terpisah agar tidak ikut terseret saat scroll.
      const targetId = name === "beranda" ? "panel-beranda" : name === "output" ? "panel-output" : "panel-predict";
      const target = document.getElementById(targetId);
      if (target) {
        requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    }

    /* ============================================================
       COPY / EXPORT
       ============================================================ */
    function showToast(msg) {
      const t = document.getElementById("toast");
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(window._toastTimer);
      window._toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
    }
    function copyNarrative(id) {
      const el = document.getElementById(id);
      const text = el.innerText || el.textContent;
      navigator.clipboard.writeText(text).then(() => showToast("Teks disalin ke clipboard"))
        .catch(() => showToast("Gagal menyalin teks"));
    }
    function downloadChartPNG(chartInstance, filenameBase) {
      if (!chartInstance) { showToast("Grafik belum siap"); return; }
      const url = chartInstance.toBase64Image();
      const a = document.createElement("a");
      a.href = url; a.download = (filenameBase || "chart") + ".png";
      a.click();
    }

    /* ============================================================
       IMPOR EXCEL (.xlsx) - mendeteksi pola tabel kerja BPS
       Mengenali pola: baris "Bintang" / "NonBintang" / "Bintang+NonBintang"
       (blok TPK) dan baris "RLMT" diikuti Asing/Nusantara/Gabungan (blok
       lama-menginap), dengan header bulan di atasnya - pola yang sama
       dipakai berulang tiap bulan di file kerja BPS Kota Tasikmalaya.
       ============================================================ */
    const MONTH_RE = /^(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}$/i;
    function collapseWS(v) { return (v === null || v === undefined) ? "" : String(v).replace(/\s+/g, " ").trim(); }
    function normKey(v) { return collapseWS(v).toLowerCase().replace(/[^a-z+]/g, ""); }

    function scanSheetForTPK(aoa) {
      const results = [];
      for (let r = 1; r < aoa.length - 2; r++) {
        const row = aoa[r] || [];
        if (normKey(row[0]) !== "bintang") continue;
        const row2 = aoa[r + 1] || [];
        if (normKey(row2[0]) !== "nonbintang") continue;
        const row3 = aoa[r + 2] || [];
        const k3 = normKey(row3[0]);
        if (k3 !== "bintang+nonbintang" && k3 !== "gabungan" && k3 !== "total") continue;
        const headerRow = aoa[r - 1] || [];
        const months = [];
        for (let c = 1; c < headerRow.length; c++) {
          if (MONTH_RE.test(collapseWS(headerRow[c]).toLowerCase())) {
            months.push({ col: c, label: collapseWS(headerRow[c]) });
          }
        }
        if (months.length >= 2) results.push({ rBintang: r, rNonbintang: r + 1, rTotal: r + 2, months });
      }
      return results;
    }

    function scanSheetForRLMT(aoa) {
      for (let r = 0; r < aoa.length; r++) {
        const row = aoa[r] || [];
        if (normKey(row[0]) !== "rlmt") continue;
        const months = [];
        for (let c = 1; c < row.length; c++) {
          if (MONTH_RE.test(collapseWS(row[c]).toLowerCase())) {
            months.push({ col: c, label: collapseWS(row[c]) });
          }
        }
        if (months.length < 2) continue;
        let rBintang = -1, rNonbintang = -1, rGabungan = -1;
        for (let rr = r + 1; rr < Math.min(aoa.length, r + 10); rr++) {
          const lbl = normKey((aoa[rr] || [])[0]);
          if (lbl === "bintang" && rBintang === -1) rBintang = rr;
          else if (lbl === "nonbintang" && rNonbintang === -1) rNonbintang = rr;
          else if ((lbl === "gabungan" || lbl === "total") && rGabungan === -1) rGabungan = rr;
        }
        if (rBintang !== -1 && rNonbintang !== -1 && rGabungan !== -1) return { rBintang, rNonbintang, rGabungan, months };
      }
      return null;
    }

    function importXlsxFile(evt) {
      const file = evt.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: "array" });
          let bestTPK = null, bestTPKsheet = null;
          const rlmtMonthMap = {}; // bulan -> {Bintang,Nonbintang,Total}
          let rlmtSheetsUsed = [];

          wb.SheetNames.forEach(name => {
            const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
            scanSheetForTPK(aoa).forEach(b => {
              if (!bestTPK || b.months.length > bestTPK.months.length) { bestTPK = Object.assign({ aoa }, b); bestTPKsheet = name; }
            });
            const r = scanSheetForRLMT(aoa);
            if (r) {
              rlmtSheetsUsed.push(name);
              r.months.forEach(m => {
                rlmtMonthMap[m.label] = {
                  bulan: m.label,
                  Bintang: { Asing: toNum(r.aoa[r.rBintang][m.col]), Indonesia: toNum(r.aoa[r.rBintang][m.col + 1]), Total: toNum(r.aoa[r.rBintang][m.col + 2]) },
                  Nonbintang: { Asing: toNum(r.aoa[r.rNonbintang][m.col]), Indonesia: toNum(r.aoa[r.rNonbintang][m.col + 1]), Total: toNum(r.aoa[r.rNonbintang][m.col + 2]) },
                  Total: { Asing: toNum(r.aoa[r.rGabungan][m.col]), Indonesia: toNum(r.aoa[r.rGabungan][m.col + 1]), Total: toNum(r.aoa[r.rGabungan][m.col + 2]) }
                };
              });
            }
          });

          const msgParts = [];
          if (bestTPK) {
            const months = bestTPK.months.slice(-13);
            trendRows = months.map(m => ({
              bulan: m.label,
              bintang: toNum(bestTPK.aoa[bestTPK.rBintang][m.col]),
              nonbintang: toNum(bestTPK.aoa[bestTPK.rNonbintang][m.col]),
              total: toNum(bestTPK.aoa[bestTPK.rTotal][m.col])
            }));
            renderTrendTable();
            msgParts.push(`tren TPK ${months.length} bulan (sheet "${bestTPKsheet}")`);
          }
          const rlmtMonths = Object.keys(rlmtMonthMap);
          if (rlmtMonths.length > 0) {
            rlmtMonths.sort((a, b) => monthSortKey(a) - monthSortKey(b));
            const last13 = rlmtMonths.slice(-13);
            rlmtRows = last13.map(m => rlmtMonthMap[m]);
            renderStayTable();
            msgParts.push(`tren RLMT ${last13.length} bulan (digabung dari ${rlmtSheetsUsed.length} sheet)`);
          }
          if (msgParts.length === 0) {
            showToast("Pola data TPK/RLMT tidak ditemukan di file ini");
          } else {
            previewDraft(false);
            showToast("Berhasil impor: " + msgParts.join(" & ") + " (klik 'Pratinjau Draf' untuk melihat)");
          }
        } catch (err) {
          console.error(err);
          showToast("Gagal membaca file Excel - cek format file");
        }
      };
      reader.readAsArrayBuffer(file);
      evt.target.value = "";
    }

    function downloadJSON() {
      const data = { trendRows, rlmtRows };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "data_tpk_" + (trendRows[trendRows.length - 1]?.bulan || "export").replace(/\s+/g, "_") + ".json";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Data diunduh");
    }

    // Simpan naskah BRS (badge, judul, narasi, tabel, grafik) langsung
    // sebagai file PDF yang otomatis terunduh - tanpa dialog cetak browser.
    function downloadPDF() {
      const area = document.getElementById("brsExportArea");
      if (!area) { showToast("Konten BRS tidak ditemukan"); return; }
      if (typeof html2canvas === "undefined" || typeof window.jspdf === "undefined") {
        showToast("Gagal memuat pustaka PDF - periksa koneksi internet lalu coba lagi");
        return;
      }
      const btn = document.getElementById("btnSavePdf");
      const originalLabel = btn ? btn.innerHTML : null;
      if (btn) { btn.disabled = true; btn.innerHTML = "Menyiapkan PDF..."; }
      showToast("Menyiapkan PDF, mohon tunggu...");
      document.body.classList.add("pdf-exporting");

      html2canvas(area, { scale: 2, useCORS: true, backgroundColor: "#ffffff" }).then(canvas => {
        document.body.classList.remove("pdf-exporting");
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 24;
        const usableW = pageW - margin * 2;
        const usableH = pageH - margin * 2;
        const imgW = usableW;
        const imgH = (canvas.height * imgW) / canvas.width;

        const pxPerPagePt = canvas.width / imgW; // px kanvas per pt halaman
        const pageHeightPx = usableH * pxPerPagePt;

        let renderedPx = 0;
        let pageIndex = 0;
        while (renderedPx < canvas.height) {
          const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeightPx;
          const ctx = pageCanvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
          const sliceImgH = (sliceHeightPx * imgW) / canvas.width;
          if (pageIndex > 0) pdf.addPage();
          pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, imgW, sliceImgH);
          renderedPx += sliceHeightPx;
          pageIndex++;
        }

        const label = (isDraftPreview ? "Draf" : (currentEditionLabel || "BRS")).replace(/\s+/g, "_");
        pdf.save(`BRS_TPK_${label}.pdf`);
        if (btn) { btn.disabled = false; btn.innerHTML = originalLabel; }
        showToast("PDF berhasil diunduh");
      }).catch(err => {
        console.error(err);
        document.body.classList.remove("pdf-exporting");
        if (btn) { btn.disabled = false; btn.innerHTML = originalLabel; }
        showToast("Gagal membuat PDF, coba lagi");
      });
    }
    function loadJSON(evt) {
      const file = evt.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.trendRows) trendRows = data.trendRows;
          if (data.rlmtRows) rlmtRows = data.rlmtRows;
          renderTrendTable();
          renderStayTable();
          previewDraft(false);
          showToast("Data berhasil dimuat ke draf (klik 'Pratinjau Draf' untuk melihat)");
        } catch (err) { showToast("Gagal memuat file"); }
      };
      reader.readAsText(file);
      evt.target.value = "";
    }

    /* ============================================================
       PREDIKSI (Peramalan Holt-Winters) - dihitung ulang di browser
       ============================================================ */
    let predictChart;
    const FORECAST_HORIZON = 6;

    // Data historis dasar (Oktober 2023 - Mei 2026) dari rekap BPS.
    // Kalau admin menambahkan bulan-bulan baru setelah Mei 2026 (lewat Panel
    // Admin atau edisi yang diterbitkan), bulan-bulan itu akan otomatis
    // ditambahkan ke deret ini dan modelnya dihitung ulang - lihat
    // getExtensionRows() & rebuildPredictModel() di bawah.
    const baseHistMonthNamesFull = ['Oktober 2023', 'November 2023', 'Desember 2023', 'Januari 2024', 'Februari 2024', 'Maret 2024', 'April 2024', 'Mei 2024', 'Juni 2024', 'Juli 2024', 'Agustus 2024', 'September 2024', 'Oktober 2024', 'November 2024', 'Desember 2024', 'Januari 2025', 'Februari 2025', 'Maret 2025', 'April 2025', 'Mei 2025', 'Juni 2025', 'Juli 2025', 'Agustus 2025', 'September 2025', 'Oktober 2025', 'November 2025', 'Desember 2025', 'Januari 2026', 'Februari 2026', 'Maret 2026', 'April 2026', 'Mei 2026'];
    const baseHistData = {
      bintang: [47.27, 53.18, 48.77, 46.58, 49.97, 41.98, 44.66, 42.71, 50.46, 51.34, 45.86, 45.99, 55.68, 50.59, 52.88, 50.34, 48.42, 35.45, 54.51, 51.0, 51.36, 48.15, 43.57, 50.76, 54.82, 59.2, 57.06, 51.48, 46.04, 49.36, 53.69, 55.47],
      nonbintang: [25.74, 17.62, 18.43, 17.66, 18.07, 15.01, 18.88, 18.7, 19.01, 17.29, 20.18, 20.52, 17.03, 16.45, 18.78, 19.14, 18.55, 14.16, 19.98, 18.57, 18.01, 18.31, 17.26, 17.91, 18.22, 21.53, 22.26, 22.26, 20.96, 22.91, 23.88, 22.44],
      gabungan: [38.27, 38.31, 36.12, 33.87, 35.1, 30.0, 33.42, 32.25, 36.75, 36.54, 34.69, 34.93, 39.25, 35.79, 38.39, 37.07, 35.71, 26.42, 38.52, 35.95, 35.66, 34.14, 31.22, 35.34, 37.64, 41.71, 40.91, 37.35, 34.1, 36.68, 39.36, 39.61]
    };
    // Bulan-bulan yang bertepatan dengan Idul Fitri (indeks tetap di deret
    // historis dasar - tidak berubah walau deretnya diperpanjang di akhir).
    const predictIdulFitriIdx = [6, 17, 18, 29];

    // Variabel hasil hitungan model - diisi ulang oleh rebuildPredictModel()
    let predictData = baseHistData;
    let predictForecast = { bintang: [], nonbintang: [], gabungan: [] };
    let predictMonthNamesFull = baseHistMonthNamesFull;
    let predictLabels = baseHistMonthNamesFull.map(shortMonthLabel);
    let predictAccuracy = null;
    let predictIdulFitriStats = null;
    let predictForecastCI = null;       // rentang ketidakpastian (90%) per kategori
    let predictDataGapWarning = false;  // true kalau ada bulan bolong/meloncat di data tambahan
    let predictGapInfo = null;          // detail bulan terakhir yang valid sebelum lompatan
    let predictActiveCat = "gabungan";

    // ---------- Holt-Winters (aditif, musiman periode 12) ----------
    function holtWintersFit(y, period, alpha, beta, gamma) {
      const n = y.length;
      if (n < period * 2) return null;
      const season1 = y.slice(0, period);
      const season2 = y.slice(period, period * 2);
      const avg1 = season1.reduce((a, b) => a + b, 0) / period;
      const avg2 = season2.reduce((a, b) => a + b, 0) / period;
      let level = avg1;
      let trend = (avg2 - avg1) / period;
      const seasonal = season1.map(v => v - avg1);
      const fitted = new Array(n).fill(null);
      for (let t = 0; t < n; t++) {
        const s = seasonal[t % period];
        fitted[t] = level + trend + s;
        const prevLevel = level, prevTrend = trend, obs = y[t];
        level = alpha * (obs - s) + (1 - alpha) * (prevLevel + prevTrend);
        trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
        seasonal[t % period] = gamma * (obs - level) + (1 - gamma) * s;
      }
      return { level, trend, seasonal, fitted };
    }
    function holtWintersSSE(y, period, alpha, beta, gamma) {
      const fit = holtWintersFit(y, period, alpha, beta, gamma);
      if (!fit) return Infinity;
      let sse = 0;
      for (let t = period; t < y.length; t++) {
        const e = y[t] - fit.fitted[t];
        sse += e * e;
      }
      return sse;
    }
    function holtWintersAutoFit(y, period) {
      let best = { sse: Infinity, alpha: 0.3, beta: 0.1, gamma: 0.1 };
      const grid = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
      for (const a of grid) for (const b of grid) for (const g of grid) {
        const sse = holtWintersSSE(y, period, a, b, g);
        if (sse < best.sse) best = { sse, alpha: a, beta: b, gamma: g };
      }
      return best;
    }
    function holtWintersForecast(y, period, h) {
      const n = y.length;
      if (n < period * 2) {
        // data belum cukup 2 musim penuh - pakai rata-rata sederhana sbg jaga-jaga
        const avg = y.reduce((a, b) => a + b, 0) / n;
        return new Array(h).fill(avg);
      }
      const best = holtWintersAutoFit(y, period);
      const fit = holtWintersFit(y, period, best.alpha, best.beta, best.gamma);
      const { level, trend, seasonal } = fit;
      const out = [];
      for (let i = 1; i <= h; i++) {
        out.push(level + i * trend + seasonal[(n + i - 1) % period]);
      }
      return out;
    }
    // Sama seperti holtWintersForecast, tapi juga menghitung rentang
    // ketidakpastian (confidence interval) memakai simpangan baku residual
    // in-sample. Ini pendekatan sederhana (bukan formula state-space penuh),
    // tapi cukup untuk memberi gambaran seberapa yakin peramalannya - makin
    // jauh ke depan, rentangnya makin lebar.
    function holtWintersForecastWithCI(y, period, h, zScore) {
      const n = y.length;
      if (n < period * 2) {
        const avg = y.reduce((a, b) => a + b, 0) / n;
        const sd = Math.sqrt(y.reduce((a, b) => a + (b - avg) * (b - avg), 0) / Math.max(1, n - 1));
        const forecast = new Array(h).fill(avg);
        return {
          forecast,
          lower: forecast.map(v => v - zScore * sd),
          upper: forecast.map(v => v + zScore * sd),
          sigma: sd
        };
      }
      const best = holtWintersAutoFit(y, period);
      const fit = holtWintersFit(y, period, best.alpha, best.beta, best.gamma);
      const { level, trend, seasonal, fitted } = fit;
      let se = 0, cnt = 0;
      for (let t = period; t < n; t++) {
        const e = y[t] - fitted[t];
        se += e * e; cnt++;
      }
      const sigma = cnt ? Math.sqrt(se / cnt) : 0;
      const forecast = [], lower = [], upper = [];
      for (let i = 1; i <= h; i++) {
        const point = level + i * trend + seasonal[(n + i - 1) % period];
        const width = zScore * sigma * Math.sqrt(i); // rentang melebar seiring jarak peramalan
        forecast.push(point);
        lower.push(point - width);
        upper.push(point + width);
      }
      return { forecast, lower, upper, sigma };
    }
    function computeRMSEMAPE(actual, forecast) {
      let se = 0, ape = 0, cnt = 0;
      for (let i = 0; i < actual.length; i++) {
        const err = actual[i] - forecast[i];
        se += err * err;
        if (actual[i] !== 0) { ape += Math.abs(err / actual[i]); cnt++; }
      }
      return { rmse: Math.sqrt(se / actual.length), mape: cnt ? (ape / cnt) * 100 : null };
    }
    // Klasifikasi akurasi berdasar nilai MAPE (acuan umum: Lewis, 1982)
    function mapeAccuracyTier(mape) {
      if (mape === null || mape === undefined) return { label: "-", cls: "" };
      if (mape < 10) return { label: "Sangat akurat", cls: "tier-great" };
      if (mape < 20) return { label: "Akurat", cls: "tier-good" };
      if (mape < 50) return { label: "Cukup akurat", cls: "tier-warn" };
      return { label: "Kurang akurat", cls: "tier-bad" };
    }

    // Cari bulan-bulan baru (di Panel Admin / edisi terbit) yang lebih baru
    // dari bulan terakhir pada data historis dasar (Mei 2026), supaya deret
    // historisnya otomatis memanjang mengikuti data terbaru.
    //
    // VALIDASI: bulan tambahan HARUS berurutan tanpa bolong, dimulai persis
    // satu bulan setelah data dasar (mis. dasar berakhir Mei 2026 -> lanjutan
    // harus Juni 2026, lalu Juli 2026, dst). Kalau ada lompatan (mis. Mei
    // 2026 -> September 2026, skip Jun-Agu), bagian SETELAH lompatan itu
    // dipotong (tidak dipakai) supaya model tidak menghitung dengan asumsi
    // interval bulanan yang salah, dan predictDataGapWarning diaktifkan
    // supaya ada peringatan di layar.
    function getExtensionRows() {
      const baseLastKey = monthSortKey(baseHistMonthNamesFull[baseHistMonthNamesFull.length - 1]);
      const seen = new Map();
      (publishedEditions || []).forEach(ed => {
        (ed.trendRows || []).forEach(r => {
          const key = monthSortKey(r.bulan);
          if (key > baseLastKey) seen.set(key, r);
        });
      });
      (typeof trendRows !== "undefined" ? trendRows : []).forEach(r => {
        const key = monthSortKey(r.bulan);
        if (key > baseLastKey) seen.set(key, r);
      });
      const sorted = [...seen.entries()].sort((a, b) => a[0] - b[0]);

      const result = [];
      let expectedKey = baseLastKey + 1;
      predictDataGapWarning = false;
      predictGapInfo = null;
      for (const [key, row] of sorted) {
        if (key === expectedKey) {
          result.push(row);
          expectedKey++;
        } else if (key > expectedKey) {
          predictDataGapWarning = true;
          predictGapInfo = {
            lastValidMonth: result.length ? result[result.length - 1].bulan : baseHistMonthNamesFull[baseHistMonthNamesFull.length - 1],
            skippedToMonth: row.bulan
          };
          break; // hentikan di titik lompatan - jangan lanjut pakai data setelahnya
        }
        // key < expectedKey (duplikat/aneh dari data lama) - lewati saja
      }
      return result;
    }

    // Hitung ulang seluruh model peramalan: perpanjang data historis dengan
    // bulan-bulan baru (kalau ada), lalu fit Holt-Winters & forecast 6 bulan
    // ke depan, plus akurasi (holdout 6 bulan terakhir) dan statistik Idul
    // Fitri. Dipanggil ulang tiap kali panel Peramalan dibuka atau ada edisi
    // baru diterbitkan, supaya selalu mengikuti data terbaru.
    function rebuildPredictModel() {
      const extra = getExtensionRows();
      const histMonthNamesFull = baseHistMonthNamesFull.concat(extra.map(r => r.bulan));
      const histBintang = baseHistData.bintang.concat(extra.map(r => r.bintang));
      const histNonbintang = baseHistData.nonbintang.concat(extra.map(r => r.nonbintang));
      const histGabungan = baseHistData.gabungan.concat(extra.map(r => r.total));

      predictData = { bintang: histBintang, nonbintang: histNonbintang, gabungan: histGabungan };

      // Perkirakan label bulan forecast berikutnya (setelah bulan terakhir historis)
      let lastLabel = histMonthNamesFull[histMonthNamesFull.length - 1];
      const forecastMonthNamesFull = [];
      for (let i = 0; i < FORECAST_HORIZON; i++) {
        lastLabel = guessNextMonthLabel(lastLabel);
        forecastMonthNamesFull.push(lastLabel);
      }

      const Z_90 = 1.645; // rentang keyakinan ~90%
      const ciBintang = holtWintersForecastWithCI(histBintang, 12, FORECAST_HORIZON, Z_90);
      const ciNonbintang = holtWintersForecastWithCI(histNonbintang, 12, FORECAST_HORIZON, Z_90);
      const ciGabungan = holtWintersForecastWithCI(histGabungan, 12, FORECAST_HORIZON, Z_90);

      predictForecast = { bintang: ciBintang.forecast, nonbintang: ciNonbintang.forecast, gabungan: ciGabungan.forecast };
      predictForecastCI = { bintang: ciBintang, nonbintang: ciNonbintang, gabungan: ciGabungan };

      predictMonthNamesFull = histMonthNamesFull.concat(forecastMonthNamesFull);
      predictLabels = predictMonthNamesFull.map(shortMonthLabel);

      // Akurasi via holdout: fit dari semua data KECUALI 6 bulan terakhir,
      // forecast 6 bulan, lalu bandingkan dengan nilai aktual 6 bulan itu.
      const holdoutN = Math.min(FORECAST_HORIZON, Math.max(0, histMonthNamesFull.length - 24));
      predictAccuracy = {};
      ["bintang", "nonbintang", "gabungan"].forEach(cat => {
        const series = predictData[cat];
        if (holdoutN > 0 && series.length - holdoutN >= 24) {
          const trainSeries = series.slice(0, series.length - holdoutN);
          const actualHoldout = series.slice(series.length - holdoutN);
          const fcHoldout = holtWintersForecast(trainSeries, 12, holdoutN);
          predictAccuracy[cat] = computeRMSEMAPE(actualHoldout, fcHoldout);
        } else {
          predictAccuracy[cat] = { rmse: null, mape: null };
        }
      });

      // Statistik efek Idul Fitri (rata-rata TPK Gabungan bulan Idul Fitri vs bulan biasa)
      const gab = predictData.gabungan;
      const duringVals = predictIdulFitriIdx.filter(i => i < gab.length).map(i => gab[i]);
      const normalVals = gab.filter((v, i) => !predictIdulFitriIdx.includes(i));
      const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      predictIdulFitriStats = { duringAvg: avg(duringVals), normalAvg: avg(normalVals) };
    }


    function predictBuildDatasets(cat) {
      const histLen = predictData[cat].length;
      const fcLen = predictForecast[cat].length;
      const actual = predictData[cat].concat(Array(fcLen).fill(null));
      const fc = Array(histLen - 1).fill(null).concat([predictData[cat][histLen - 1]]).concat(predictForecast[cat]);

      const ci = predictForecastCI ? predictForecastCI[cat] : null;
      const upperArr = ci ? Array(histLen - 1).fill(null).concat([predictData[cat][histLen - 1]]).concat(ci.upper) : [];
      const lowerArr = ci ? Array(histLen - 1).fill(null).concat([predictData[cat][histLen - 1]]).concat(ci.lower) : [];

      const datasets = [
        {
          label: "Data aktual", data: actual, borderColor: "#0093DD", backgroundColor: "#0093DD",
          borderWidth: 2.5,
          pointRadius: (ctx) => predictIdulFitriIdx.includes(ctx.dataIndex) ? 6 : 3,
          pointBackgroundColor: (ctx) => predictIdulFitriIdx.includes(ctx.dataIndex) ? "#c0392b" : "#0093DD",
          pointBorderColor: (ctx) => predictIdulFitriIdx.includes(ctx.dataIndex) ? "#c0392b" : "#0093DD",
          tension: 0.25, spanGaps: false
        }
      ];

      if (ci) {
        // Dua dataset transparan buat bikin pita rentang ketidakpastian
        // (area terarsir) di antara batas atas & batas bawah 90%.
        datasets.push({
          label: "Batas atas (rentang 90%)", data: upperArr, borderColor: "transparent",
          backgroundColor: "transparent", borderWidth: 0, pointRadius: 0, spanGaps: true, fill: false, tension: 0.25
        });
        datasets.push({
          label: "Batas bawah (rentang 90%)", data: lowerArr, borderColor: "transparent",
          backgroundColor: "rgba(104,185,46,0.14)", borderWidth: 0, pointRadius: 0, spanGaps: true,
          fill: "-1", tension: 0.25
        });
      }

      datasets.push({
        label: "Peramalan", data: fc, borderColor: "#68B92E", backgroundColor: "#68B92E",
        borderWidth: 2.5, borderDash: [6, 4], pointRadius: 4, pointBackgroundColor: "#68B92E",
        tension: 0.25, spanGaps: true
      });

      return datasets;
    }

    function renderPredictChart() {
      const ctx = document.getElementById("predictChart");
      if (!ctx) return;
      if (predictChart) predictChart.destroy();
      predictChart = new Chart(ctx, {
        type: "line",
        data: { labels: predictLabels, datasets: predictBuildDatasets(predictActiveCat) },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              filter: (item) => !String(item.dataset.label || "").startsWith("Batas"),
              callbacks: { label: (item) => item.dataset.label + ": " + item.formattedValue + "%" }
            }
          },
          scales: {
            y: {
              title: { display: true, text: "TPK (%)", color: "#5B6B76", font: { size: 12, family: "Inter" } },
              grid: { color: "#E1E8ED" }, ticks: { color: "#5B6B76", font: { family: "Inter" } }
            },
            x: {
              grid: { display: false },
              ticks: { color: "#5B6B76", maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 13, font: { family: "Inter" } }
            }
          }
        }
      });
    }

    function predictForecastRows() {
      const histLen = predictData.gabungan.length;
      const ci = predictForecastCI;
      return predictLabels.slice(histLen).map((lbl, i) => {
        const rangeSpan = (cat) => ci && ci[cat] ? `<br><span class="ci-range">(${fmt(ci[cat].lower[i])}&ndash;${fmt(ci[cat].upper[i])})</span>` : "";
        return `<tr>
          <td class="lbl-cell">${lbl}</td>
          <td>${fmt(predictForecast.bintang[i])}${rangeSpan("bintang")}</td>
          <td>${fmt(predictForecast.nonbintang[i])}${rangeSpan("nonbintang")}</td>
          <td>${fmt(predictForecast.gabungan[i])}${rangeSpan("gabungan")}</td>
        </tr>`;
      }).join("");
    }

    function predictGetValuesForIndex(i) {
      const histLen = predictData.gabungan.length;
      if (i < histLen) return { bintang: predictData.bintang[i], nonbintang: predictData.nonbintang[i], gabungan: predictData.gabungan[i], isForecast: false };
      const fi = i - histLen;
      return { bintang: predictForecast.bintang[fi], nonbintang: predictForecast.nonbintang[fi], gabungan: predictForecast.gabungan[fi], isForecast: true };
    }

    function predictRunSearch() {
      const picker = document.getElementById("predictMonthPicker");
      const i = parseInt(picker.value, 10);
      const vals = predictGetValuesForIndex(i);
      document.getElementById("predResMonth").textContent = predictMonthNamesFull[i];
      document.getElementById("predResBintang").textContent = fmt(vals.bintang) + "%";
      document.getElementById("predResNonbintang").textContent = fmt(vals.nonbintang) + "%";
      document.getElementById("predResGabungan").textContent = fmt(vals.gabungan) + "%";
      const tag = document.getElementById("predResTag");
      if (predictIdulFitriIdx.includes(i)) {
        tag.textContent = "Bulan Idul Fitri"; tag.className = "badge tag-lebaran";
      } else if (vals.isForecast) {
        tag.textContent = "Peramalan"; tag.className = "badge tag-forecast";
      } else {
        tag.textContent = "Data aktual"; tag.className = "badge tag-actual";
      }
    }

    // Loncat halus ke kartu tertentu di panel Prediksi (dipicu klik kotak KPI),
    // lalu beri highlight sebentar supaya jelas kartu mana yang dituju.
    function jumpToCard(cardId) {
      const el = document.getElementById(cardId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("kpi-highlight");
      setTimeout(() => el.classList.remove("kpi-highlight"), 1400);
    }

    // Mengisi ulang dropdown "Cari TPK per Bulan" - dipanggil lagi setiap
    // model diperbarui (rebuildPredictModel) supaya bulan-bulan baru ikut
    // muncul di daftar pilihan.
    function populatePredictMonthPicker() {
      const picker = document.getElementById("predictMonthPicker");
      const prevValue = picker.value;
      picker.innerHTML = "";
      const histLen = predictData.gabungan.length;
      predictMonthNamesFull.forEach((name, i) => {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = name + (i >= histLen ? " (peramalan)" : "");
        picker.appendChild(opt);
      });
      // default: bulan aktual terakhir (kalau ada pilihan sebelumnya & masih valid, pertahankan)
      const maxIdx = predictMonthNamesFull.length - 1;
      const wanted = prevValue !== "" && Number(prevValue) <= maxIdx ? Number(prevValue) : histLen - 1;
      picker.value = wanted;
    }

    // Perbarui 4 kotak KPI ringkasan di bagian atas panel Peramalan supaya
    // selalu mengikuti data historis + hasil peramalan terbaru.
    function updatePredictKPIs() {
      const histLen = predictData.gabungan.length;
      const lastActual = predictData.gabungan[histLen - 1];
      const lastActualLabel = predictMonthNamesFull[histLen - 1];
      const firstForecast = predictForecast.gabungan[0];
      const firstForecastLabel = predictMonthNamesFull[histLen];
      const delta = firstForecast - lastActual;

      const elLastVal = document.getElementById("kpiLastActualValue");
      const elLastLbl = document.getElementById("kpiLastActualLabel");
      const elFcLbl = document.getElementById("kpiForecastLabel");
      const elFcVal = document.getElementById("kpiForecastValue");
      const elFcDelta = document.getElementById("kpiForecastDelta");
      const elAccVal = document.getElementById("kpiAccuracyValue");
      const elIdulVal = document.getElementById("kpiIdulFitriValue");

      if (elLastVal) elLastVal.innerHTML = fmt(lastActual) + '<span class="unit">%</span>';
      if (elLastLbl) elLastLbl.textContent = lastActualLabel;
      if (elFcLbl) elFcLbl.textContent = "Peramalan " + firstForecastLabel;
      if (elFcVal) elFcVal.innerHTML = fmt(firstForecast) + '<span class="unit">%</span>';
      if (elFcDelta) {
        elFcDelta.textContent = (delta >= 0 ? "+" : "\u2212") + fmt(Math.abs(delta)).replace("-", "") + " poin dari " + shortMonthLabel(lastActualLabel);
        elFcDelta.className = "kpi-delta " + (delta >= 0 ? "pos" : "neg");
      }
      if (elAccVal && predictAccuracy && predictAccuracy.gabungan && predictAccuracy.gabungan.mape !== null) {
        elAccVal.innerHTML = fmt(predictAccuracy.gabungan.mape) + '<span class="unit">%</span>';
      } else if (elAccVal) {
        elAccVal.innerHTML = '<span class="unit" style="font-size:13px;">Data belum cukup</span>';
      }
      if (elIdulVal && predictIdulFitriStats && predictIdulFitriStats.duringAvg !== null) {
        const d = predictIdulFitriStats.duringAvg - predictIdulFitriStats.normalAvg;
        elIdulVal.innerHTML = (d >= 0 ? "+" : "\u2212") + fmt(Math.abs(d)) + '<span class="unit">poin</span>';
      }
    }

    // Perbarui tabel Akurasi Model (RMSE/MAPE per kategori) dari hasil
    // holdout terbaru.
    function updateAccuracyTable() {
      if (!predictAccuracy) return;
      ["bintang", "nonbintang", "gabungan"].forEach(cat => {
        const rmseEl = document.getElementById("accRmse_" + cat);
        const mapeEl = document.getElementById("accMape_" + cat);
        const acc = predictAccuracy[cat];
        if (rmseEl) rmseEl.textContent = acc && acc.rmse !== null ? fmt(acc.rmse).replace(".", ",") : "-";
        if (mapeEl) {
          if (acc && acc.mape !== null) {
            const tier = mapeAccuracyTier(acc.mape);
            mapeEl.innerHTML = fmt(acc.mape).replace(".", ",") + "%" +
              `<span class="mape-tier ${tier.cls}">${tier.label}</span>`;
          } else {
            mapeEl.textContent = "-";
          }
        }
      });
      const hintEl = document.getElementById("accuracyHint");
      if (hintEl) {
        const histLen = predictData.gabungan.length;
        const holdoutN = Math.min(FORECAST_HORIZON, Math.max(0, histLen - 24));
        if (holdoutN > 0) {
          const startLabel = shortMonthLabel(predictMonthNamesFull[histLen - holdoutN]);
          const endLabel = shortMonthLabel(predictMonthNamesFull[histLen - 1]);
          hintEl.textContent = `Diuji pada holdout ${holdoutN} bulan terakhir (${startLabel} - ${endLabel}) menggunakan model Holt-Winters. Klasifikasi akurasi mengikuti acuan umum MAPE: <10% sangat akurat, 10-20% akurat, 20-50% cukup akurat, >50% kurang akurat.`;
        } else {
          hintEl.textContent = "Data historis belum cukup untuk uji holdout (butuh minimal 2 musim penuh / 24 bulan).";
        }
      }
    }

    // Perbarui catatan "Efek Periode Idul Fitri" dengan rata-rata terbaru.
    function updateIdulFitriNote() {
      if (!predictIdulFitriStats) return;
      const elDuring = document.getElementById("idulFitriDuringVal");
      const elNormal = document.getElementById("idulFitriNormalVal");
      if (elDuring && predictIdulFitriStats.duringAvg !== null) elDuring.textContent = fmt(predictIdulFitriStats.duringAvg) + "%";
      if (elNormal && predictIdulFitriStats.normalAvg !== null) elNormal.textContent = fmt(predictIdulFitriStats.normalAvg) + "%";
    }

    // Tampilkan/sembunyikan banner peringatan kalau ada bulan yang
    // bolong/meloncat di data tambahan (lihat getExtensionRows()).
    function updateGapWarningBanner() {
      const el = document.getElementById("predictGapWarning");
      if (!el) return;
      if (predictDataGapWarning && predictGapInfo) {
        el.innerHTML = `Ada bulan yang meloncat di data Panel Admin: setelah <b>${predictGapInfo.lastValidMonth}</b>, ` +
          `bulan berikutnya yang ditemukan adalah <b>${predictGapInfo.skippedToMonth}</b> (ada bulan yang bolong di ` +
          `antaranya). Supaya model peramalan tetap akurat, data setelah titik lompatan itu ` +
          `<b>tidak ikut dihitung</b> - lengkapi dulu bulan yang bolong di Panel Admin.`;
        el.classList.add("show");
      } else {
        el.classList.remove("show");
      }
    }

    // Jalankan ulang seluruh perhitungan model + refresh semua tampilan
    // terkait (dipanggil saat panel Peramalan dibuka & setiap kali ada
    // edisi baru diterbitkan, supaya selalu memakai data paling baru).
    function refreshPredictPanel() {
      rebuildPredictModel();
      populatePredictMonthPicker();
      document.getElementById("predictForecastBody").innerHTML = predictForecastRows();
      updatePredictKPIs();
      updateAccuracyTable();
      updateIdulFitriNote();
      updateGapWarningBanner();
      predictRunSearch();
      if (predictChart) { predictChart.data.labels = predictLabels; predictChart.data.datasets = predictBuildDatasets(predictActiveCat); predictChart.update(); }
    }

    function initPredictPanel() {
      refreshPredictPanel();

      document.getElementById("predictSearchBtn").addEventListener("click", predictRunSearch);
      document.getElementById("predictMonthPicker").addEventListener("change", predictRunSearch);

      document.getElementById("predictCatTabs").addEventListener("click", (e) => {
        if (!e.target.classList.contains("pill-tab")) return;
        document.querySelectorAll("#predictCatTabs .pill-tab").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        predictActiveCat = e.target.dataset.cat;
        if (predictChart) { predictChart.data.datasets = predictBuildDatasets(predictActiveCat); predictChart.update(); }
      });
    }

    /* ============================================================
       SISTEM EDISI TERBIT (Penampil BRS)
       ============================================================ */
    function cloneRows(rows) { return JSON.parse(JSON.stringify(rows || [])); }

    function updateDraftBanner() {
      const el = document.getElementById("draftBanner");
      if (el) el.classList.toggle("show", isDraftPreview);
    }

    function refreshEditionPicker() {
      const sel = document.getElementById("editionPicker");
      if (!sel) return;
      sel.innerHTML = "";
      if (isDraftPreview) {
        const opt = document.createElement("option");
        opt.value = "__draft__";
        opt.textContent = "Pratinjau Draf (belum terbit)";
        sel.appendChild(opt);
      }
      if (!publishedEditions.length) {
        if (!isDraftPreview) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = " - Belum ada edisi diterbitkan - ";
          sel.appendChild(opt);
        }
      } else {
        const sorted = [...publishedEditions].sort((a, b) => monthSortKey(b.label) - monthSortKey(a.label));
        sorted.forEach(ed => {
          const opt = document.createElement("option");
          opt.value = ed.label;
          opt.textContent = ed.label;
          sel.appendChild(opt);
        });
      }
      sel.value = isDraftPreview ? "__draft__" : (currentEditionLabel || "");
    }

    function onEditionPickerChange(value) {
      if (!value || value === "__draft__") { refreshEditionPicker(); return; }
      loadEditionIntoViewer(value, false);
    }

    function loadEditionIntoViewer(label, switchTab) {
      const ed = publishedEditions.find(e => e.label === label);
      if (!ed) return;
      activeTrendRows = cloneRows(ed.trendRows);
      activeRlmtRows = cloneRows(ed.rlmtRows);
      isDraftPreview = false;
      currentEditionLabel = label;
      updateDraftBanner();
      refreshEditionPicker();
      renderAll(switchTab !== false);
    }

    function previewDraft(switchTab) {
      if (!trendRows.length) { showToast("Data tren masih kosong - isi dulu data di atas"); return; }
      activeTrendRows = cloneRows(trendRows);
      activeRlmtRows = cloneRows(rlmtRows);
      isDraftPreview = true;
      currentEditionLabel = null;
      updateDraftBanner();
      refreshEditionPicker();
      renderAll(switchTab !== false);
    }

    async function publishCurrentEdition() {
      if (!trendRows.length) { showToast("Data tren masih kosong - isi dulu data di atas"); return; }
      const label = trendRows[trendRows.length - 1].bulan || ("Edisi " + (publishedEditions.length + 1));
      const existingIdx = publishedEditions.findIndex(e => e.label === label);
      if (existingIdx >= 0) {
        if (!confirm(`Edisi "${label}" sudah pernah diterbitkan sebelumnya. Timpa dengan data draf saat ini?`)) return;
      }
      const snapshot = { label, trendRows: cloneRows(trendRows), rlmtRows: cloneRows(rlmtRows), publishedAt: new Date().toISOString() };
      showToast("Menerbitkan edisi...");
      const err = await dbUpsertEdition(snapshot);
      if (err) { showToast("Gagal menerbitkan ke database: " + (err.message || err)); return; }
      if (existingIdx >= 0) publishedEditions[existingIdx] = snapshot; else publishedEditions.push(snapshot);
      loadEditionIntoViewer(label, true);
      if (typeof refreshPredictPanel === "function") refreshPredictPanel();
      showToast(`Edisi ${label} berhasil diterbitkan`);
    }

    // Muat edisi yang sedang dipilih di dropdown kembali ke Panel Admin
    // (tabel Input Data) supaya bisa diperbaiki lalu diterbitkan ulang.
    function editSelectedEdition() {
      const sel = document.getElementById("editionPicker");
      const label = sel ? sel.value : null;
      if (!label || label === "__draft__") {
        showToast("Pilih dulu edisi yang mau diedit dari dropdown");
        return;
      }
      const ed = publishedEditions.find(e => e.label === label);
      if (!ed) { showToast("Edisi tidak ditemukan"); return; }
      if (trendRows.length && !confirm(`Muat edisi "${label}" ke Panel Admin? Perubahan yang belum diterbitkan di draf saat ini akan tertimpa.`)) return;
      trendRows = cloneRows(ed.trendRows);
      rlmtRows = cloneRows(ed.rlmtRows);
      renderTrendTable();
      renderStayTable();
      showPanel("input");
      showToast(`Edisi ${label} dimuat ke Panel Admin - perbaiki datanya lalu klik "Terbitkan Edisi Ini" lagi`);
    }

    // Hapus edisi yang sedang dipilih di dropdown secara permanen dari daftar
    // edisi terbit (localStorage).
    async function deleteSelectedEdition() {
      const sel = document.getElementById("editionPicker");
      const label = sel ? sel.value : null;
      if (!label || label === "__draft__") {
        showToast("Pilih dulu edisi yang mau dihapus dari dropdown");
        return;
      }
      if (!confirm(`Yakin mau menghapus edisi "${label}" secara permanen? Tindakan ini tidak bisa dibatalkan.`)) return;
      const err = await dbDeleteEdition(label);
      if (err) { showToast("Gagal menghapus dari database: " + (err.message || err)); return; }
      publishedEditions = publishedEditions.filter(e => e.label !== label);

      if (publishedEditions.length) {
        const newest = [...publishedEditions].sort((a, b) => monthSortKey(b.label) - monthSortKey(a.label))[0];
        loadEditionIntoViewer(newest.label, false);
      } else {
        activeTrendRows = [];
        activeRlmtRows = [];
        isDraftPreview = false;
        currentEditionLabel = null;
        updateDraftBanner();
        refreshEditionPicker();
        renderTable1();
        renderTable2();
        renderNarratives();
      }
      showToast(`Edisi ${label} berhasil dihapus`);
    }

    /* ============================================================
       INIT
       ============================================================ */
    document.addEventListener("DOMContentLoaded", async () => {
      // Pastikan status login (sesi Supabase) sudah pasti diketahui DULU,
      // baru lanjut ambil draft/edisi dari database - kalau tidak, request
      // ambil draft bisa keburu jalan sebelum sesi login terkonfirmasi,
      // sehingga RLS Supabase menganggap kita masih anonim dan menolak
      // membaca draft_data (baliknya ke data contoh Mei 2026 terus).
      if (typeof checkExistingSession === "function") {
        await checkExistingSession();
      }

      if (typeof Chart === "undefined") {
        showToast("Gagal memuat pustaka grafik (Chart.js)");
      }
      if (typeof SUPABASE_CONFIGURED !== "undefined" && !SUPABASE_CONFIGURED) {
        showToast("Supabase belum dikonfigurasi - lihat README.md");
      }

      // Muat draf yang sebelumnya disimpan admin dari database (kalau ada).
      // suppressDraftAutosave aktif sementara di sini supaya kalau load-nya
      // gagal/kosong dan terpaksa fallback ke data contoh, fallback itu
      // TIDAK otomatis menimpa draf asli yang mungkin sudah ada di database.
      suppressDraftAutosave = true;
      const draftLoaded = await loadDraftFromStorage();
      if (!draftLoaded) {
        trendRows = defaultTrend();
        rlmtRows = defaultStay();
      }

      // Ambil daftar edisi yang sudah diterbitkan dari database
      publishedEditions = await dbFetchEditions();

      // Kalau database masih kosong sama sekali (baru pertama kali setup),
      // tambahkan (backfill) riwayat penerbitan bulanan dari data contoh
      // supaya dropdown "Penampil BRS" tidak kosong melompong. Tidak akan
      // menimpa edisi yang sudah ada.
      if (!publishedEditions.length) {
        showToast("Menyiapkan data contoh awal ke database...");
        const fullTrend = defaultTrendFull();
        const fullStay = defaultStayFull();
        for (let i = 1; i < fullTrend.length; i++) {
          const start = Math.max(0, i - 12);
          const trendWindow = fullTrend.slice(start, i + 1);
          const rlmtWindow = fullStay.slice(start, i + 1);
          const label = trendWindow[trendWindow.length - 1].bulan;
          const snapshot = {
            label,
            trendRows: cloneRows(trendWindow),
            rlmtRows: cloneRows(rlmtWindow),
            publishedAt: new Date().toISOString()
          };
          const err = await dbUpsertEdition(snapshot);
          if (!err) publishedEditions.push(snapshot);
        }
      }

      const newestEdition = publishedEditions.length
        ? [...publishedEditions].sort((a, b) => monthSortKey(b.label) - monthSortKey(a.label))[0]
        : null;

      // Samakan draf Panel Admin dengan database: kalau edisi yang sudah
      // terbit ternyata bulannya lebih baru daripada draf yang tersimpan
      // (mis. admin menerbitkan lewat sesi lain lalu lupa "Edit Edisi Ini"),
      // pakai data edisi terbaru itu sebagai draf - supaya tabel "Tambah
      // Data" selalu konsisten dengan apa yang sungguhan ada di database.
      const draftLastMonth = trendRows.length ? trendRows[trendRows.length - 1].bulan : null;
      const draftLastKey = draftLastMonth !== null ? monthSortKey(draftLastMonth) : -Infinity;
      const editionLastKey = newestEdition ? monthSortKey(newestEdition.label) : -Infinity;
      const draftWasSynced = !!(newestEdition && editionLastKey > draftLastKey);
      if (draftWasSynced) {
        trendRows = cloneRows(newestEdition.trendRows);
        rlmtRows = cloneRows(newestEdition.rlmtRows);
      }

      renderTrendTable();
      renderStayTable();
      suppressDraftAutosave = false;
      // Kalau tadi disamakan dengan edisi terbaru, simpan juga hasilnya ke
      // draft_data supaya load berikutnya sudah langsung konsisten.
      if (draftWasSynced) saveDraftToStorage();

      // Tampilkan edisi terbaru yang sudah diterbitkan di Penampil BRS
      if (newestEdition) {
        activeTrendRows = cloneRows(newestEdition.trendRows);
        activeRlmtRows = cloneRows(newestEdition.rlmtRows);
        currentEditionLabel = newestEdition.label;
      }
      refreshEditionPicker();
      renderTable1();
      renderTable2();
      renderNarratives();
      initPredictPanel();
      initPanelTransitions();
      showPanel("beranda");
      // Penampil BRS & Peramalan sekarang selalu tampil (satu halaman yang
      // bisa di-scroll), jadi grafiknya perlu langsung digambar saat load,
      // bukan menunggu tab dibuka.
      requestAnimationFrame(() => { requestAnimationFrame(renderCharts); });
    });

    // re-draw charts if the window is resized (keeps them crisp instead of
    // stretched/blank after resizing). Output & Predict charts are always
    // visible now (continuous scroll page) except while viewing Panel Admin.
    window.addEventListener("resize", () => {
      if (!document.body.classList.contains("viewing-admin")) {
        if (chart1) chart1.resize();
        if (chart2) chart2.resize();
        if (predictChart) predictChart.resize();
      }
    });
