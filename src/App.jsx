import { useState, useEffect } from "react";


const days = ["月", "火", "水", "木", "金", "土", "日"];
const rows = [1, 2];

const initialData = {};
days.forEach((day) => {
  initialData[day] = {};
  rows.forEach((r) => {
    initialData[day][r] = { sleep: "", wake: "", adjust: "" };
  });
});


export default function App() {


  const [data, setData] = useState(() => {
    const saved = localStorage.getItem("currentWeekData");
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log("初期化時に読み込んだデータ:", parsed);
      return parsed;
    }
    console.log("初期化時: 保存データなし → initialData を使用");
    return initialData;
  });

  // ★ 基準時刻（デフォルト 13:00）
  const [baseTime, setBaseTime] = useState(() => {
    return localStorage.getItem("baseTime") || "13:00";
  });;
  const [showSetting, setShowSetting] = useState(false);

  useEffect(() => {
    localStorage.setItem("baseTime", baseTime);
  }, [baseTime]);


  useEffect(() => {
    const saved = localStorage.getItem("baseTime");
    if (saved) {
      setBaseTime(saved);
    }
  }, []);




  // 時刻 → 分
  const toMinutes = (time) => {
    if (!time) return null;
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  // 分 → hh:mm（長さ）
  const durationToHHMM = (hours) => {
    const totalMin = Math.round(hours * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // 分 → hh:mm（時刻）
  const toHHMM = (min) => {
    min = ((min % 1440) + 1440) % 1440;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // 睡眠時間（h）
  const calcDuration = (sleep, wake, adjust) => {
    if (adjust) {
      const min = toMinutes(adjust);
      if (min !== null) return min / 60;
    }

    const s = toMinutes(sleep);
    const w = toMinutes(wake);
    if (s === null || w === null) return 0;

    const diff = w >= s ? w - s : w + 1440 - s;
    return diff / 60;
  };

  // MST（中央時刻）
  const calcMidpoint = (sleep, duration) => {
    const s = toMinutes(sleep);
    if (s === null) return "";

    let mid = s + (duration * 60) / 2;

    // 時刻として正規化/整数化（UI用）
    mid = mid % 1440;
    mid = Math.round(mid);
    return toHHMM(mid);
  };

  // ★ MST を「基準時刻」からの差分（±720）に変換
  const shiftMST = (mst) => {
    const base = toMinutes(baseTime);
    let diff = mst - base;

    // 基準より後ろなら翌日扱い
    if (mst >= base) diff -= 1440;

    return diff;
  };

  const handleChange = (day, row, key, value) => {
    setData((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [row]: {
          ...prev[day][row],
          [key]: value,
        },
      },
    }));
  };

  const normalizeTime = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);

    // 24時以上なら24を引く
    const nh = h >= 24 ? h - 24 : h;

    return `${String(nh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // -------------------------
  // 睡眠計画（①〜③）
  // -------------------------
  const [shortSleep, setShortSleep] = useState("");
  const [idealDuration, setIdealDuration] = useState(0);
  const [idealMST, setIdealMST] = useState(0);
  const [longSleepBed, setLongSleepBed] = useState("");
  const [longSleepWake, setLongSleepWake] = useState("");

  // -------------------------
  // 翌日のデータ入力（2回分）
  // -------------------------
  const [newSleep1, setNewSleep1] = useState("");
  const [newWake1, setNewWake1] = useState("");
  const [newAdjust1, setNewAdjust1] = useState("");

  const [newSleep2, setNewSleep2] = useState("");
  const [newWake2, setNewWake2] = useState("");
  const [newAdjust2, setNewAdjust2] = useState("");

  const [newDur1, setNewDur1] = useState(0);
  const [newDur2, setNewDur2] = useState(0);
  const [newTotal, setNewTotal] = useState(0);
  const [newMST, setNewMST] = useState("");

  const [applyToSunday, setApplyToSunday] = useState(false);


  // -------------------------
  // 週まとめデータの計算
  // -------------------------

  const stdevp = (values) => {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      values.length;
    return Math.sqrt(variance);
  };

  const starRating = (value, thresholds) => {
    if (value <= thresholds[0]) return 3;
    if (value <= thresholds[1]) return 2;
    if (value <= thresholds[2]) return 1;
    return 0;
  };

  const rankFromStars = (totalStars) => {
    const ranks = ["F", "E", "D", "C", "B", "A", "S"];
    return ranks[totalStars];
  };

  const weeklyDurations = [];
  const weeklyMST = [];

  days.forEach((day) => {
    // ★ 日曜日だけ、✓ が ON の場合は翌日のデータを使う
    let d1, d2;

    if (day === "日" && applyToSunday) {
      d1 = { sleep: newSleep1, wake: newWake1, adjust: newAdjust1 };
      d2 = { sleep: newSleep2, wake: newWake2, adjust: newAdjust2 };
    } else {
      d1 = data[day][1];
      d2 = data[day][2];
    }

    const dur1 = calcDuration(d1.sleep, d1.wake, d1.adjust);
    const dur2 = calcDuration(d2.sleep, d2.wake, d2.adjust);

    const hasData1 = d1.sleep && d1.wake;
    const hasData2 = d2.sleep && d2.wake;
    const hasAdjust1 = d1.adjust;
    const hasAdjust2 = d2.adjust;

    if (!(hasData1 || hasAdjust1) && !(hasData2 || hasAdjust2)) return;

    weeklyDurations.push((dur1 + dur2) * 60);

    const longer = dur1 >= dur2 ? d1 : d2;
    const longerDur = Math.max(dur1, dur2);

    if (longer.sleep) {
      let mid = toMinutes(longer.sleep) + (longerDur * 60) / 2;
      // 時刻として正規化
      mid = mid % 1440;
      weeklyMST.push(Math.round(mid));
    }
  });

  const stdevDuration = stdevp(weeklyDurations);
  // ★ 基準時刻からの差分に変換
  const shiftedMST = weeklyMST.map(shiftMST);
  // ★ 差分なので普通の標準偏差でOK
  const stdevMST = Number(stdevp(shiftedMST).toFixed(2));

  const starsDuration = starRating(stdevDuration, [60, 90, 120]);
  const starsMST = starRating(stdevMST, [30, 60, 90]);

  const totalStars = starsDuration + starsMST;
  const weeklyRank = rankFromStars(totalStars);

  const starStr = (n) => {
    const yellow = '<span style="color:#FFD700;">★</span>';
    const gray = '<span style="color:#CCCCCC;">☆</span>';
    return yellow.repeat(n) + gray.repeat(3 - n);
  };

  // -------------------------
  // 理想値（週平均）を計算
  // -------------------------
  useEffect(() => {
    if (weeklyDurations.length > 0) {
      setIdealDuration(
        Math.round(
          weeklyDurations.reduce((a, b) => a + b, 0) / weeklyDurations.length
        )
      );
    }
  }, [weeklyDurations]);



  // ★ 理想の MST を計算
  useEffect(() => {
    if (weeklyMST.length === 0) return;

    const base = toMinutes(baseTime); // 基準 MST（ユーザー設定）

    // MST を基準 MST からの差分（±720）に変換
    const diffs = weeklyMST.map((mst) => {
      let diff = mst - base;
      if (diff > 720) diff -= 1440;
      if (diff < -720) diff += 1440;
      return diff;
    });

    // 差分の平均
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;

    // 基準 MST に平均差分を足して理想 MST を作る
    let ideal = base + avgDiff;

    // 0〜1439 に正規化
    ideal = ((ideal % 1440) + 1440) % 1440;

    setIdealMST(Math.round(ideal));
  }, [weeklyMST, baseTime]);

  // -------------------------
  // 長い睡眠の自動計算（①〜③）
  // -------------------------
  useEffect(() => {
    if (idealDuration === 0) return;

    const diff = (idealDuration - shortSleep) / 2;

    // ★ 小数点を四捨五入して整数にする
    const bed = Math.round(idealMST - diff);
    const wake = Math.round(idealMST + diff);

    setLongSleepBed(toHHMM((bed + 1440) % 1440));
    setLongSleepWake(toHHMM((wake + 1440) % 1440));
  }, [shortSleep, idealDuration, idealMST]);

  function toTimeString(mins) {
    mins = (mins + 1440) % 1440; // 正規化
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }






  // -------------------------
  // 翌日の2回分の計算
  // -------------------------
  useEffect(() => {
    const d1 = calcDuration(newSleep1, newWake1, newAdjust1);
    const d2 = calcDuration(newSleep2, newWake2, newAdjust2);

    setNewDur1(d1);
    setNewDur2(d2);

    const total = d1 + d2;
    setNewTotal(total);

    const longerDur = Math.max(d1, d2);
    const longer = d1 >= d2
      ? { sleep: newSleep1 }
      : { sleep: newSleep2 };

    if (longer.sleep) {
      setNewMST(calcMidpoint(longer.sleep, longerDur));
    }
  }, [newSleep1, newWake1, newAdjust1, newSleep2, newWake2, newAdjust2]);





  // -------------------------
  // 反映（⑤）
  // -------------------------
  //モーダルの ON/OFF を管理
  const [showApplyModal, setShowApplyModal] = useState(false);
  //曜日選択用の state
  const [selectedDays, setSelectedDays] = useState([]);
  //チェックボックスを押すたびに追加・削除する関数：
  const toggleDay = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };
  //評価更新ボタン⇒モーダル
  <button onClick={() => setShowApplyModal(true)}>
    評価を更新
  </button>
  //選択した曜日にデータを反映する関
  const applyToSelectedDays = () => {
    const updated = { ...data };

    selectedDays.forEach((day) => {
      updated[day][1] = {
        sleep: newSleep1,
        wake: newWake1,
        adjust: newAdjust1,
      };
      updated[day][2] = {
        sleep: newSleep2,
        wake: newWake2,
        adjust: newAdjust2,
      };
    });

    setData(updated);
    setShowApplyModal(false);
    setSelectedDays([]);
  };
  //削除
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const clearAllSleepData = () => {
    const empty = { sleep: "", wake: "", adjust: "" };

    const cleared = {};
    days.forEach((day) => {
      cleared[day] = {
        1: { ...empty },
        2: { ...empty },

      };
    });

    setData(cleared);
  };

  useEffect(() => {
    console.log("保存直前の data:", data);
    localStorage.setItem("currentWeekData", JSON.stringify(data));
  }, [data]);

  console.log("レンダリング時の data:", data);

  //日付 1 つから週の月曜〜日曜を求める関数
  const getWeekRangeFromSingleDate = (dateStr) => {
    const date = new Date(dateStr); // 例: "2026-05-14"

    const day = date.getDay(); // 日曜=0
    const diffToMonday = (day + 6) % 7; // 月曜まで戻る日数

    const monday = new Date(date);
    monday.setDate(date.getDate() - diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const toStr = (d) => d.toISOString().slice(0, 10);

    return {
      monday: toStr(monday),
      sunday: toStr(sunday),
      label: `${toStr(monday)}〜${toStr(sunday)}`,
    };
  };

  //モーダル用 state（1 日だけ選ぶ）
  const [saveDate, setSaveDate] = useState("");
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  //保存データ一覧を取得する
  const [savedList, setSavedList] = useState([]);
  const [showLoadPage, setShowLoadPage] = useState(false);

  function loadSavedList() {
    const keys = Object.keys(localStorage)
      .filter(k => k.startsWith("sleepWeek_")); // ★ 保存形式に合わせる

    const list = keys.map(k => {
      const obj = JSON.parse(localStorage.getItem(k));

      return {
        key: k,
        range: obj.range,
        rank: obj.rank,
        stars: obj.stars
      };
    });

    setSavedList(list);
  }

  function loadWeek(key) {
    const json = localStorage.getItem(key);
    if (!json) return;

    const obj = JSON.parse(json);
    setData(obj.data);

    setBaseTime(obj.settings.baseTime);

    setShowLoadPage(false);
  }

  function deleteWeek(key) {
    localStorage.removeItem(key);
    localStorage.removeItem(key + "-label");
    loadSavedList(); // 再読み込み
  }

  function renderStars(n) {
    const filled = "★".repeat(n);
    const empty = "☆".repeat(3 - n);
    return filled + empty;
  }


  //日付が選ばれたら自動で週名を生成
  useEffect(() => {
    if (saveDate) {
      const { label } = getWeekRangeFromSingleDate(saveDate);
      setSaveLabel(label);
    }
  }, [saveDate]);

  const saveWeekData = () => {
    if (!saveDate) {
      alert("日付を選んでください");
      return;
    }

    const key = `sleepWeek_${saveLabel}`;

    const payload = {
      range: saveLabel,
      data,
      rank: weeklyRank,
      stars: {
        duration: starsDuration,
        mst: starsMST,
      },
      settings: {
        baseTime,
      }
    };

    localStorage.setItem(key, JSON.stringify(payload));
    alert(`${saveLabel} として保存しました`);
    setShowSaveModal(false);
  };

  const durationWidth = findWidthStdevp(weeklyDurations, 60);
  const mstWidth = findWidthStdevp(weeklyMST, 30);

  function findWidthStdevp(values, threshold) {
    if (values.length === 0) return null;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    let low = 0;
    let high = 600; // ±600分まで見れば十分

    // ★ 15〜20回で十分（40回は過剰）
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      const testValues = [...values, mean + mid];
      const sd = stdevp(testValues);

      if (sd <= threshold) {
        low = mid; // まだ許容 → 幅を広げる
      } else {
        high = mid; // 超えた → 幅を狭める
      }
    }

    return low; // 平均から ±low 分までなら★3維持
  }

  const [helpOpen, setHelpOpen] = useState(false);


  // -------------------------
  // UI
  // -------------------------
  return (
    <>





      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          padding: 10,
          paddingBottom: 1,
          background: "white",
          //fontSize: 18,
          fontFamily: "'M PLUS 1p', sans-serif",
        }}
      >
        {/* タイトル・設定 */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>今週の睡眠データ</h2>

          <button
            onClick={() => setShowSetting(true)}
            style={{
              padding: "4px 4px",
              fontSize: 14,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            ⚙ 設定
          </button>
        </div>


        {/* 評価カード */}
        <div
          style={{
            marginTop: 10,
            marginBottom: 0,
            height: 80,
            padding: 20,
            background: "#2196F3",
            color: "white",
            borderRadius: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            textAlign: "left",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div className="eval-text">
            <div>
              睡眠時間の長さ　　　　<span
                dangerouslySetInnerHTML={{
                  __html: starStr(starsDuration),
                }}
              />
              （{stdevDuration.toFixed(1)}）
            </div>
            <div>
              ミッドスリープタイム　<span
                dangerouslySetInnerHTML={{
                  __html: starStr(starsMST),
                }}
              />
              （{stdevMST.toFixed(1)}）
            </div>
          </div>

          <div
            style={{
              width: 60,
              height: 60,
              background: "white",
              color: "#2196F3",
              borderRadius: 12,
              border: "4px solid #FFD700",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 46,
              fontWeight: "bold",
              flexShrink: 0,
            }}
          >
            {weeklyRank}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 10,
          paddingTop: 0,
          background: "white",
          //fontSize: 18,
          fontFamily: "'M PLUS 1p', sans-serif",
        }}
      >

        {/* 設定モーダル */}
        {showSetting && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 999,
            }}
          >

            <div
              style={{
                fontSize: 12,
                background: "white",
                padding: 15,
                borderRadius: 10,
                width: 300,
              }}
            >
              <h3>基準 MST 設定</h3>

              <input
                type="time"
                value={baseTime}
                onChange={(e) => setBaseTime(e.target.value)}
                style={{
                  width: "50%",
                  fontSize: 20,
                  padding: 6,
                  marginTop: 10,
                  marginBottom: 20,
                }}
              />

              <button
                onClick={() => setShowSetting(false)}
                style={{
                  padding: "5px 10px",
                  fontSize: 16,
                  borderRadius: 6,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                閉じる
              </button>
            </div>
          </div>
        )}



        <div className="plan1-text">
          <div className="plan1-container">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",   // ★ これが重要
                gap: "5px",
                marginTop: "10px",
                width: "100%",
                overflowX: "auto", // ★ 横スクロールで崩れ防止
                textAlign: "left",
              }}
            >
              {/* 左側：翌日の睡眠計画 */}
              <div className="plan1-left">
                <div
                  style={{
                    flex: 1,
                    padding: "5px",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    background: "#fafafa",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>翌日の睡眠計画</h3>

                  <div style={{ marginBottom: "0px" }}>
                    <label>短い方の睡眠　</label>
                    <input
                      type="text"
                      value={shortSleep}
                      onChange={(e) => {
                        const v = e.target.value;

                        // 数字 or 空欄 だけ許可
                        if (/^-?\d*$/.test(v)) {
                          setShortSleep(v);
                        }
                      }}
                      style={{
                        textAlign: "right",
                        width: "20%",
                        padding: "0px",
                        fontSize: "16px",
                        marginBottom: "0px",
                      }}
                    />
                    <label> 分</label>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", marginBottom: "0px", display: "flex" }}>
                    <label>長い方の睡眠　</label>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        textAlign: "left",
                        padding: "0px 0",
                        borderRadius: "6px",
                        marginTop: "0px"


                      }}
                    >
                      <div className="plan-value">
                        {longSleepBed && longSleepWake
                          ? `${longSleepBed} ～ ${longSleepWake}`
                          : "就寝～起床"}
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              {/* 右側：理想の睡眠指標 */}
              <div className="plan1-right">
                <div
                  style={{
                    flex: 1,
                    padding: "5px",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    background: "#fafafa",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>理想の睡眠指標</h3>

                  <div style={{ display: "flex", alignItems: "center", marginBottom: "0px", display: "flex" }}>
                    <label>睡眠時間&nbsp;</label>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: "bold",
                        textAlign: "left",
                        padding: "1px 1",
                        borderRadius: "6px",
                        marginTop: "0px"

                      }}
                    >
                      <div className="plan-value">
                        {toHHMM(idealDuration)}
                        {durationWidth != null && (
                          <div>±{Math.round(durationWidth)}分</div>
                        )}
                      </div>
                    </div>


                  </div>

                  <div style={{ display: "flex", alignItems: "center", marginBottom: "0px", display: "flex" }}>
                    <label>　MST　&nbsp;</label>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: "bold",
                        textAlign: "left",
                        padding: "1px 1",
                        borderRadius: "6px",
                        marginTop: "0px"

                      }}
                    >
                      <div className="plan-value">
                        {toHHMM(idealMST)}
                        {mstWidth != null && (
                          <div>±{Math.round(mstWidth)}分</div>
                        )}
                      </div>
                    </div>
                  </div>




                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ★ ④〜⑤ 翌日のデータ入力（2回分） */}
        <div
          style={{
            marginTop: 10,
            textAlign: "left",
            padding: 5,
            background: "#FFF3E0",
            borderRadius: 8,
          }}
        >
          <h3 style={{ marginTop: 0 }}>データの追加・評価</h3>

          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              textAlign: "center",
              marginTop: 0,
            }}
          >
            <thead>
              <tr style={{ background: "#FFB74D", color: "white" }}>
                <th>回</th>
                <th>就寝</th>
                <th>起床</th>
                <th>補正</th>
                <th>睡眠長さ</th>
                <th>合計</th>
                <th>MST</th>
              </tr>
            </thead>

            <tbody>
              {/* 回1 */}
              <tr style={{ background: "#FFF8E1" }}>
                <td>1</td>

                <td>
                  <input
                    type="time"
                    value={newSleep1}
                    onChange={(e) => setNewSleep1(e.target.value)}
                  />
                </td>

                <td>
                  <input
                    type="time"
                    value={newWake1}
                    onChange={(e) => setNewWake1(e.target.value)}
                  />
                </td>

                <td>
                  <input
                    type="time"
                    value={newAdjust1}
                    onChange={(e) => setNewAdjust1(e.target.value)}
                  />
                </td>

                <td style={{ fontStyle: "italic" }}>
                  {durationToHHMM(newDur1)}
                </td>

                {/* 合計（rowSpan=2） */}
                <td
                  rowSpan={2}
                  style={{
                    fontWeight: "bold",
                    fontStyle: "italic",
                    background: "#FFE0B2",
                  }}
                >
                  {durationToHHMM(newTotal)}
                </td>

                {/* MST（rowSpan=2） */}
                <td
                  rowSpan={2}
                  style={{
                    fontWeight: "bold",
                    background: "#E8FFE8",
                  }}
                >
                  {newMST}
                </td>
              </tr>

              {/* 回2 */}
              <tr style={{ background: "white" }}>
                <td>2</td>

                <td>
                  <input
                    type="time"
                    value={newSleep2}
                    onChange={(e) => setNewSleep2(e.target.value)}
                  />
                </td>

                <td>
                  <input
                    type="time"
                    value={newWake2}
                    onChange={(e) => setNewWake2(e.target.value)}
                  />
                </td>

                <td>
                  <input
                    type="time"
                    value={newAdjust2}
                    onChange={(e) => setNewAdjust2(e.target.value)}
                  />
                </td>

                <td style={{ fontStyle: "italic" }}>
                  {durationToHHMM(newDur2)}
                </td>
              </tr>
            </tbody>
          </table>

          <label style={{
            fontSize: "15Px", display: "flex", alignItems: "center", marginTop: 5
          }}>
            <input
              type="checkbox"
              checked={applyToSunday}
              onChange={(e) => setApplyToSunday(e.target.checked)}
            />
            日曜日として評価をチェック
          </label>

          <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
            <button onClick={() => setShowApplyModal(true)}
              style={{
                background: "#FFB74D",
                color: "white",
                padding: "4px 4px",
                fontSize: 14,
                borderRadius: 8,
                cursor: "pointer",
              }}>
              ▼表に追加
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                background: "#FFB74D",
                color: "white",
                padding: "5px 10px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              ▼表の値削除
            </button>

            <button
              onClick={() => setShowSaveModal(true)}
              style={{
                padding: "4px 4px",
                fontSize: 14,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              保存
            </button>

            <button
              onClick={() => {
                loadSavedList();
                setShowLoadPage(true);
              }}
              style={{
                padding: "4px 4px",
                fontSize: 14,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              データ一覧
            </button>

          </div>

        </div>

        {/* 回2 */}
        {showApplyModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "10px",
                width: "300px",
              }}
            >
              <h3>どの曜日に反映しますか？</h3>
              <div className="day-select-row">
                {["月", "火", "水", "木", "金", "土", "日"].map((day) => (
                  <label key={day} className="day-item">
                    <input
                      type="checkbox"
                      checked={selectedDays.includes(day)}
                      onChange={() => toggleDay(day)}
                    />
                    {day}
                  </label>
                ))}
              </div>

              <button
                onClick={applyToSelectedDays}
                style={{
                  padding: "5px 10px",
                  fontSize: 16,
                  borderRadius: 6,
                  cursor: "pointer",
                  width: "30%",
                }}
              >
                反映する
              </button>
              {" "}
              <button onClick={() => setShowApplyModal(false)}
                style={{
                  padding: "5px 10px",
                  fontSize: 16,
                  borderRadius: 6,
                  cursor: "pointer",
                  width: "30%",
                }}>戻る</button>
            </div>


          </div>
        )}
        {showDeleteConfirm && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "10px",
                width: "300px",
                textAlign: "center",
              }}
            >
              <h3>まとめ表のデータをすべて消しますか？</h3>

              <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                <button
                  onClick={() => {
                    clearAllSleepData([]);   // ← ★ ここで全部削除
                    setShowDeleteConfirm(false);
                  }}
                  style={{
                    flex: 1,
                    background: "#FFB74D",
                    color: "white",
                    padding: "8px 0",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  はい
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    flex: 1,
                    background: "#ccc",
                    padding: "8px 0",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  いいえ
                </button>
              </div>
            </div>
          </div>
        )}



        {
          showLoadPage && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.4)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 9999,
              }}
            >
              <div
                style={{
                  background: "white",
                  padding: 10,
                  borderRadius: 8,
                  width: 370,
                  maxHeight: "120vh",
                  overflowY: "auto",
                }}
              >
                <h3>保存データ一覧</h3>

                {savedList.length === 0 && <p>保存データがありません</p>}

                {savedList.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      border: "1px solid #ccc",
                      padding: 10,
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: "bold", fontSize: 16, textAlign: "left" }}>
                      {item.range}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <div>
                        ランク：{item.rank + "　"}
                        睡眠時間：{renderStars(item.stars?.duration ?? 0) + "　"}
                        MST：{renderStars(item.stars?.mst ?? 0)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                      <button
                        style={{ flex: 1 }}
                        onClick={() => loadWeek(item.key)}
                      >
                        ロード
                      </button>

                      <button
                        style={{
                          flex: 1,
                          background: "#f44336",
                          color: "white",
                        }}
                        onClick={() => deleteWeek(item.key)}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  style={{
                    padding: "5px 10px",
                    fontSize: 16,
                    borderRadius: 6,
                    cursor: "pointer",
                    width: "100%",
                  }}
                  onClick={() => setShowLoadPage(false)}

                >
                  閉じる
                </button>
              </div>
            </div>
          )
        }





        {/* ここから下は既存の UI（省略せずそのまま） */}
        <table
          style={{
            marginTop: 10,
            borderCollapse: "collapse",
            width: "100%",
            textAlign: "center",
          }}
        >
          <thead>
            <tr style={{ background: "#2196F3", color: "white" }}>
              <th>曜日</th>
              <th>回</th>
              <th>就寝</th>
              <th>起床</th>
              <th>補正</th>
              <th>睡眠長さ</th>
              <th>合計</th>
              <th>MST</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const d1 = data[day][1];
              const d2 = data[day][2];

              const dur1 = calcDuration(d1.sleep, d1.wake, d1.adjust);
              const dur2 = calcDuration(d2.sleep, d2.wake, d2.adjust);

              const total = dur1 + dur2;

              const longer = dur1 >= dur2 ? d1 : d2;
              const longerDur = Math.max(dur1, dur2);
              const midpoint = calcMidpoint(longer.sleep, longerDur);

              return (
                <>
                  {[1, 2].map((r, idx) => {
                    const d = data[day][r];
                    const duration = calcDuration(d.sleep, d.wake, d.adjust);

                    return (
                      <tr
                        key={`${day}-${r}`}
                        style={{
                          background: idx === 0 ? "#F7FBFF" : "white",
                          borderBottom:
                            idx === 1
                              ? "1px solid #33b0c1"
                              : "1px solid #c0d1ff",
                        }}
                      >
                        {idx === 0 ? (
                          <td rowSpan={2} style={{ fontWeight: "bold" }}>
                            {day}
                          </td>
                        ) : null}

                        <td>{r}</td>

                        <td>
                          <input
                            type="time"
                            value={d.sleep}
                            onChange={(e) =>
                              handleChange(day, r, "sleep", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            type="time"
                            value={d.wake}
                            onChange={(e) =>
                              handleChange(day, r, "wake", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            type="time"
                            value={d.adjust}
                            onChange={(e) =>
                              handleChange(day, r, "adjust", e.target.value)
                            }
                          />
                        </td>

                        <td style={{ fontStyle: "italic" }}>
                          {durationToHHMM(duration)}
                        </td>

                        {idx === 0 ? (
                          <td
                            rowSpan={2}
                            style={{
                              fontWeight: "bold",
                              fontStyle: "italic",
                              background: "#EAF3FF",
                            }}
                          >
                            {durationToHHMM(total)}
                          </td>
                        ) : null}

                        {idx === 0 ? (
                          <td
                            rowSpan={2}
                            style={{
                              fontWeight: "bold",
                              background: "#E8FFE8",
                            }}
                          >
                            {midpoint}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
        {/* 設定モーダル */}
        {showSaveModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 999,
            }}
          >

            <div
              style={{
                fontSize: 12,
                background: "white",
                padding: 15,
                borderRadius: 10,
                width: 300,
              }}
            >
              <h3>保存する週(日付)を選択</h3>


              <input
                type="date"
                value={saveDate}
                onChange={(e) => setSaveDate(e.target.value)}
              />
              <p>保存名：{saveLabel}</p>
              <button onClick={saveWeekData}
                style={{
                  padding: "5px 10px",
                  fontSize: 16,
                  borderRadius: 6,
                  cursor: "pointer",
                  width: "30%",
                }}
              >
                保存
              </button>
              {" "}
              <button onClick={() => setShowSaveModal(false)}
                style={{
                  padding: "5px 10px",
                  fontSize: 16,
                  borderRadius: 6,
                  cursor: "pointer",
                  width: "30%",
                }}
              >戻る</button>
            </div>
          </div>
        )}
      </div>



      {helpOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999
          }}
          onClick={() => setHelpOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 10,
              width: "80%",
              maxWidth: 400,
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>ヘルプ</h2>
            <h4>このアプリでは、睡眠時間と MST のデータから週の評価を計算します。</h4>
            <h4>翌日の睡眠計画：長い方の就寝～起床の時間を短い方の睡眠時間で補正して教えてくれます</h4>
            <h4>理想の睡眠指標：★3 を維持できる許容幅が表示されます。数分程度の誤差があるため数分以下の場合は達成が不可の場合があります</h4>
            <h4></h4>

            <button
              onClick={() => setHelpOpen(false)}
              style={{
                marginTop: 20,
                width: "100%",
                padding: 10,
                background: "#007bff",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer"
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setHelpOpen(true)}
        style={{
          position: "absolute",
          top: 15,
          right: 80,
          background: "#eee",
          border: "1px solid #ccc",
          borderRadius: "50%",
          width: 24,
          height: 24,
          fontSize: 16,
          cursor: "pointer",
          zIndex:999
        }}
      >
        ?
      </button>




    </>


  );







}




